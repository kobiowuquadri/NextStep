import { addDaysToKey, instantAt, localDateKey, MINUTE, parseHHMM, weekdayOfKey } from '@nextstep/contracts';
import type { PlannerCommitment, PlannerInput, PlannerOverride } from './types.js';

export interface Interval {
  start: number;
  end: number;
}

export interface FreeSlot extends Interval {
  date: string;
  online: boolean;
}

export interface DayCapacity {
  date: string;
  limitMinutes: number;
  windowMinutes: number;
  /** Minutes already used by kept sessions (done today, pinned, locked). */
  usedMinutes: number;
  doneMinutes: number;
}

const live = <T extends { deletedAt?: string | null }>(xs: readonly T[] | undefined): T[] =>
  (xs ?? []).filter((x) => !x.deletedAt);

export function roundUpTo(ms: number, minutes: number): number {
  const step = minutes * MINUTE;
  return Math.ceil(ms / step) * step;
}

/** Subtract `blocks` from `base`, returning the remaining pieces. Both inputs may be unsorted. */
export function subtract(base: Interval[], blocks: Interval[]): Interval[] {
  let pieces = base.map((b) => ({ ...b }));
  for (const block of blocks) {
    const next: Interval[] = [];
    for (const p of pieces) {
      if (block.end <= p.start || block.start >= p.end) {
        next.push(p);
        continue;
      }
      if (block.start > p.start) next.push({ start: p.start, end: block.start });
      if (block.end < p.end) next.push({ start: block.end, end: p.end });
    }
    pieces = next;
  }
  return pieces.filter((p) => p.end > p.start);
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function commitmentOccursOn(c: PlannerCommitment, dateKey: string): boolean {
  if (c.date) return c.date === dateKey;
  return c.weekdays.includes(weekdayOfKey(dateKey));
}

/** Commitment intervals on a date. Overnight commitments (end <= start) continue to the next morning. */
export function commitmentIntervals(commitments: PlannerCommitment[], dateKey: string, tz: string): Interval[] {
  const out: Interval[] = [];
  for (const c of live(commitments)) {
    // occurrences that start today
    if (commitmentOccursOn(c, dateKey)) {
      const start = instantAt(dateKey, c.start, tz);
      const overnight = parseHHMM(c.end) <= parseHHMM(c.start);
      const end = overnight ? instantAt(addDaysToKey(dateKey, 1), c.end, tz) : instantAt(dateKey, c.end, tz);
      out.push({ start, end });
    }
  }
  return out;
}

export function dateKeysInHorizon(now: number, tz: string, days: number): string[] {
  const first = localDateKey(now, tz);
  return Array.from({ length: days }, (_, i) => addDaysToKey(first, i));
}

export function overrideFor(overrides: PlannerOverride[] | undefined, date: string): PlannerOverride | undefined {
  // Latest-defined override wins if several exist for the same date.
  const matches = live(overrides).filter((o) => o.date === date);
  return matches[matches.length - 1];
}

export interface FreeTimeResult {
  slots: FreeSlot[];
  days: Map<string, DayCapacity>;
  horizonStart: number;
  horizonEnd: number;
}

/**
 * Build the free study slots for the planning horizon:
 * availability windows (or a day override's windows), minus commitments and
 * protected rest, minus kept sessions, each padded by the buffer, clipped to
 * the future.
 */
export function buildFreeTime(input: PlannerInput, keptSessions: Interval[]): FreeTimeResult {
  const prefs = input.preferences;
  const tz = prefs.timezone;
  const horizonDays = input.horizonDays ?? 14;
  const horizonStart = roundUpTo(input.now, 5);
  const dates = dateKeysInHorizon(input.now, tz, horizonDays);
  const horizonEnd = instantAt(addDaysToKey(dates[dates.length - 1]!, 1), '00:00', tz);
  const buffer = prefs.bufferMinutes * MINUTE;

  const slots: FreeSlot[] = [];
  const days = new Map<string, DayCapacity>();
  const availability = live(input.availability);

  // Commitments from the previous day may spill over midnight into the first day.
  const prevDay = addDaysToKey(dates[0]!, -1);
  const spill = commitmentIntervals(input.commitments, prevDay, tz);

  for (const date of dates) {
    const override = overrideFor(input.overrides, date);
    const weekday = weekdayOfKey(date);
    const windowDefs =
      override?.windows ??
      availability.filter((a) => a.weekday === weekday).map((a) => ({ start: a.start, end: a.end, online: a.online ?? true }));

    // Normalise windows: sort and clip overlaps so time is never double counted.
    const windows = windowDefs
      .map((w) => ({ start: instantAt(date, w.start, tz), end: instantAt(date, w.end, tz), online: w.online }))
      .filter((w) => w.end > w.start)
      .sort((a, b) => a.start - b.start);
    const normalised: Array<Interval & { online: boolean }> = [];
    for (const w of windows) {
      const prev = normalised[normalised.length - 1];
      if (prev && w.start < prev.end) {
        if (w.end > prev.end) normalised.push({ start: prev.end, end: w.end, online: w.online });
      } else normalised.push(w);
    }

    const blocks: Interval[] = [
      ...commitmentIntervals(input.commitments, date, tz),
      ...(date === dates[0] ? spill : []),
      ...keptSessions,
    ].map((b) => ({ start: b.start - buffer, end: b.end + buffer }));

    let windowMinutes = 0;
    for (const w of normalised) {
      const pieces = subtract([w], blocks)
        .map((p) => ({ start: Math.max(p.start, horizonStart), end: p.end }))
        .filter((p) => p.end - p.start >= MINUTE);
      for (const p of pieces) {
        slots.push({ ...p, date, online: w.online });
        windowMinutes += Math.round((p.end - p.start) / MINUTE);
      }
    }

    const limit = override && override.maxMinutes !== null && override.maxMinutes !== undefined ? override.maxMinutes : prefs.dailyLimitMinutes;
    days.set(date, { date, limitMinutes: limit, windowMinutes, usedMinutes: 0, doneMinutes: 0 });
  }

  slots.sort((a, b) => a.start - b.start);
  return { slots, days, horizonStart, horizonEnd };
}

/**
 * Reserve [start, end) inside a slot list (mutates). The remaining left part
 * keeps a buffer before `start`; the right part starts after `end + buffer`.
 */
export function reserve(slots: FreeSlot[], index: number, start: number, end: number, bufferMs: number, minPieceMs: number): void {
  const slot = slots[index]!;
  const pieces: FreeSlot[] = [];
  if (start - bufferMs - slot.start >= minPieceMs) pieces.push({ ...slot, end: start - bufferMs });
  if (slot.end - (end + bufferMs) >= minPieceMs) pieces.push({ ...slot, start: end + bufferMs });
  slots.splice(index, 1, ...pieces);
}
