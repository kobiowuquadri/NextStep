import { instantAt } from '@nextstep/contracts';
import type { PlannerInput, PlannerSession, PlannerTask } from './types';

export const TZ = 'Africa/Lagos';
/** Monday 9 Nov 2026, 08:00 in Lagos. */
export const NOW = Date.parse('2026-11-09T07:00:00Z');

export const at = (date: string, hhmm: string, tz = TZ) => new Date(instantAt(date, hhmm, tz)).toISOString();

export function task(id: string, patch: Partial<PlannerTask> = {}): PlannerTask {
  return {
    id,
    title: patch.title ?? `Task ${id}`,
    dueAt: null,
    importance: 2,
    remainingMinutes: 60,
    estimatedMinutes: patch.remainingMinutes ?? 60,
    status: 'todo',
    dependsOn: [],
    splittable: true,
    optional: false,
    connectivity: 'any',
    createdAt: '2026-11-01T00:00:00Z',
    ...patch,
  };
}

export function session(id: string, taskId: string, start: string, end: string, patch: Partial<PlannerSession> = {}): PlannerSession {
  return {
    id,
    taskId,
    startAt: start,
    endAt: end,
    minutes: Math.round((Date.parse(end) - Date.parse(start)) / 60000),
    status: 'planned',
    pinned: false,
    source: 'auto',
    ...patch,
  };
}

export function baseInput(patch: Partial<PlannerInput> = {}): PlannerInput {
  return {
    now: NOW,
    seed: 'user-1',
    horizonDays: 14,
    tasks: [],
    sessions: [],
    availability: [
      ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: '18:00', end: '21:00', online: true })),
      { weekday: 6, start: '10:00', end: '14:00', online: false },
    ],
    commitments: [
      { title: 'Shift at the bookshop', kind: 'work', weekdays: [1, 3, 5], start: '09:00', end: '17:00', protected: false },
      { title: 'Bus home', kind: 'commute', weekdays: [1, 3, 5], start: '17:00', end: '18:00', protected: false },
      { title: 'Family lunch', kind: 'family', weekdays: [6], start: '12:00', end: '13:00', protected: true },
    ],
    overrides: [],
    preferences: {
      timezone: TZ,
      defaultSessionMinutes: 45,
      minSessionMinutes: 20,
      maxSessionMinutes: 90,
      dailyLimitMinutes: 120,
      bufferMinutes: 10,
      deadlineBufferHours: 12,
      maxSessionsPerTaskPerDay: 2,
    },
    ...patch,
  };
}
