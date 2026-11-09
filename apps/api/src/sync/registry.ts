import type { SyncEntity } from '@nextstep/contracts';

/**
 * Maps each synchronised contract entity to its Prisma model. Column names are
 * identical to contract field names; only DateTime columns need conversion
 * between ISO strings (wire) and Date (database).
 */
export interface ModelSpec {
  delegate: string;
  dateFields: readonly string[];
  /** REST path segment for the CRUD routes. */
  path: string;
  /** Whether REST clients may create/update/delete directly (others are read-only over REST). */
  writable: boolean;
}

export const MODELS: Record<SyncEntity, ModelSpec> = {
  preferences: { delegate: 'userPreferences', dateFields: ['onboardingCompletedAt'], path: 'preferences', writable: true },
  semester: { delegate: 'semester', dateFields: [], path: 'semesters', writable: true },
  course: { delegate: 'course', dateFields: [], path: 'courses', writable: true },
  task: { delegate: 'task', dateFields: ['dueAt', 'completedAt'], path: 'tasks', writable: true },
  subtask: { delegate: 'subtask', dateFields: ['completedAt'], path: 'subtasks', writable: true },
  availability: { delegate: 'availabilityRule', dateFields: [], path: 'availability', writable: true },
  commitment: { delegate: 'commitment', dateFields: [], path: 'commitments', writable: true },
  dayOverride: { delegate: 'dayOverride', dateFields: [], path: 'day-overrides', writable: true },
  session: { delegate: 'scheduledSession', dateFields: ['startAt', 'endAt'], path: 'sessions', writable: true },
  planRevision: { delegate: 'planRevision', dateFields: ['undoneAt'], path: 'plan-revisions', writable: false },
  focusLog: { delegate: 'focusLog', dateFields: ['startedAt', 'endedAt'], path: 'focus-logs', writable: true },
  recoveryProposal: { delegate: 'recoveryProposal', dateFields: ['nextActionCompletedAt', 'acceptedAt'], path: 'recovery-proposals', writable: false },
  reflection: { delegate: 'weeklyReflection', dateFields: [], path: 'reflections', writable: true },
  goal: { delegate: 'personalGoal', dateFields: [], path: 'goals', writable: true },
  goalCheckin: { delegate: 'goalCheckin', dateFields: [], path: 'goal-checkins', writable: true },
  resourceProgress: { delegate: 'resourceProgress', dateFields: ['downloadedAt', 'completedAt'], path: 'resource-progress', writable: true },
  gamificationEvent: { delegate: 'gamificationEvent', dateFields: ['occurredAt'], path: 'events', writable: false },
  userAchievement: { delegate: 'userAchievement', dateFields: ['unlockedAt'], path: 'achievements', writable: false },
};

const META_DATES = ['createdAt', 'updatedAt', 'deletedAt'];

/** Database row → wire record (ISO dates, no internal columns). */
export function toWire(entity: SyncEntity, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const dates = new Set([...MODELS[entity].dateFields, ...META_DATES]);
  for (const [k, v] of Object.entries(row)) {
    if (k === 'userId' || k === 'fieldRevs') continue;
    out[k] = dates.has(k) && v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

/** Wire record → database data (Dates), dropping fields the client may not set. */
export function toDb(entity: SyncEntity, data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const dates = new Set([...MODELS[entity].dateFields, ...META_DATES]);
  for (const [k, v] of Object.entries(data)) {
    if (k === 'userId' || k === 'rev' || k === 'fieldRevs' || k === 'id') continue;
    if (entity === 'gamificationEvent' && k === 'status') continue;
    out[k] = dates.has(k) && typeof v === 'string' ? new Date(v) : v;
  }
  return out;
}
