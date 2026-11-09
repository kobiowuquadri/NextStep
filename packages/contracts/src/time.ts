/**
 * Timezone helpers built only on `Intl.DateTimeFormat`, so they behave the
 * same in Node, browsers and Hermes. All scheduling maths happens on UTC
 * instants (epoch milliseconds); wall-clock values ("Tuesday 19:00 in
 * Africa/Lagos") are converted at the edges with these functions.
 */

export const DEFAULT_TIMEZONE = 'Africa/Lagos';
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimezone(timeZone: string): boolean {
  try {
    formatterFor(timeZone).format(0);
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of an instant in a timezone. */
export function zonedParts(ms: number, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0; // some engines emit 24 for midnight
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour,
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: WEEKDAYS[get('weekday')] ?? 0,
  };
}

/** Offset of the timezone from UTC at the given instant, in minutes (Lagos = +60). */
export function tzOffsetMinutes(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MINUTE);
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC instant.
 * Non-existent local times (spring-forward gaps) resolve forward; ambiguous
 * times (fall-back overlaps) resolve to the earlier instant.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const o1 = tzOffsetMinutes(naive, timeZone);
  let guess = naive - o1 * MINUTE;
  const o2 = tzOffsetMinutes(guess, timeZone);
  if (o2 !== o1) {
    const alt = naive - o2 * MINUTE;
    const p = zonedParts(alt, timeZone);
    if (p.hour === hour && p.minute === minute) guess = alt;
    else guess = Math.max(guess, alt); // gap: move forward
  } else {
    // ambiguous: prefer the earlier instant if it also maps to the same wall time
    const earlier = guess - HOUR;
    const pe = zonedParts(earlier, timeZone);
    if (pe.hour === hour && pe.minute === minute && pe.day === day) guess = earlier;
  }
  return guess;
}

/** 'YYYY-MM-DD' calendar date of an instant in a timezone. */
export function localDateKey(ms: number, timeZone: string): string {
  const p = zonedParts(ms, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { year: y!, month: m!, day: d! };
}

export function addDaysToKey(key: string, days: number): string {
  const { year, month, day } = parseDateKey(key);
  const t = new Date(Date.UTC(year, month - 1, day + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Sunday … 6 = Saturday, for a calendar date key (timezone independent). */
export function weekdayOfKey(key: string): number {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function diffDaysKeys(a: string, b: string): number {
  const pa = parseDateKey(a);
  const pb = parseDateKey(b);
  return Math.round((Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / DAY);
}

/** Parse 'HH:MM' (00:00–24:00) into minutes after midnight. */
export function parseHHMM(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid time "${value}"`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min !== 0)) throw new Error(`Invalid time "${value}"`);
  return h * 60 + min;
}

export function formatHHMM(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** UTC instant of a wall-clock 'HH:MM' on a local date key. '24:00' means the next midnight. */
export function instantAt(dateKey: string, hhmm: string, timeZone: string): number {
  const mins = parseHHMM(hhmm);
  if (mins === 24 * 60) return startOfLocalDay(addDaysToKey(dateKey, 1), timeZone);
  const { year, month, day } = parseDateKey(dateKey);
  return zonedTimeToUtc(year, month, day, Math.floor(mins / 60), mins % 60, timeZone);
}

export function startOfLocalDay(dateKey: string, timeZone: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  return zonedTimeToUtc(year, month, day, 0, 0, timeZone);
}

/** Monday-start week key ('YYYY-MM-DD' of that Monday) for an instant. */
export function weekStartKey(ms: number, timeZone: string): string {
  const key = localDateKey(ms, timeZone);
  return weekStartOfKey(key);
}

export function weekStartOfKey(key: string): string {
  const wd = weekdayOfKey(key);
  const delta = wd === 0 ? -6 : 1 - wd;
  return addDaysToKey(key, delta);
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekdayName(weekday: number, short = false): string {
  const n = WEEKDAY_NAMES[weekday] ?? '';
  return short ? n.slice(0, 3) : n;
}

/** "Fri 14 Nov, 18:00" in the user's timezone. Deterministic (no locale dependence). */
export function formatInstant(ms: number, timeZone: string, opts: { time?: boolean; weekday?: boolean } = {}): string {
  const p = zonedParts(ms, timeZone);
  const date = `${opts.weekday === false ? '' : weekdayName(p.weekday, true) + ' '}${p.day} ${MONTH_NAMES[p.month - 1]}`;
  return opts.time === false ? date : `${date}, ${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatTimeOfDay(ms: number, timeZone: string): string {
  const p = zonedParts(ms, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatDateKey(key: string, withWeekday = true): string {
  const { month, day } = parseDateKey(key);
  return `${withWeekday ? weekdayName(weekdayOfKey(key), true) + ' ' : ''}${day} ${MONTH_NAMES[month - 1]}`;
}

/** Human duration: 45 → "45 min", 90 → "1 h 30 min". */
export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

/** "in 2 days", "tomorrow", "today", "3 days ago" relative to now in the user's timezone. */
export function relativeDay(ms: number, now: number, timeZone: string): string {
  const d = diffDaysKeys(localDateKey(now, timeZone), localDateKey(ms, timeZone));
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  if (d > 1) return `in ${d} days`;
  return `${-d} days ago`;
}
