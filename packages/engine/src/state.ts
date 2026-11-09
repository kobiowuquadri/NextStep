import type {
  AvailabilityRule,
  Commitment,
  Course,
  DayOverride,
  FocusLog,
  GamificationEvent,
  GoalCheckin,
  PersonalGoal,
  PlanRevision,
  Preferences,
  RecoveryProposalRecord,
  ResourceProgress,
  ScheduledSession,
  Semester,
  Subtask,
  SyncEntity,
  Task,
  UserAchievement,
  WeeklyReflection,
} from '@nextstep/contracts';
import type { PlannerInput } from '@nextstep/scheduler';

/** Everything one student has, held in memory. Small by design (hundreds of records). */
export interface AppState {
  userId: string;
  preferences: Preferences;
  semesters: Semester[];
  courses: Course[];
  tasks: Task[];
  subtasks: Subtask[];
  availability: AvailabilityRule[];
  commitments: Commitment[];
  overrides: DayOverride[];
  sessions: ScheduledSession[];
  planRevisions: PlanRevision[];
  focusLogs: FocusLog[];
  proposals: RecoveryProposalRecord[];
  reflections: WeeklyReflection[];
  goals: PersonalGoal[];
  goalCheckins: GoalCheckin[];
  resourceProgress: ResourceProgress[];
  events: GamificationEvent[];
  achievements: UserAchievement[];
}

type CollectionKey = Exclude<keyof AppState, 'userId' | 'preferences'>;

export const COLLECTION_OF: Record<Exclude<SyncEntity, 'preferences'>, CollectionKey> = {
  semester: 'semesters',
  course: 'courses',
  task: 'tasks',
  subtask: 'subtasks',
  availability: 'availability',
  commitment: 'commitments',
  dayOverride: 'overrides',
  session: 'sessions',
  planRevision: 'planRevisions',
  focusLog: 'focusLogs',
  recoveryProposal: 'proposals',
  reflection: 'reflections',
  goal: 'goals',
  goalCheckin: 'goalCheckins',
  resourceProgress: 'resourceProgress',
  gamificationEvent: 'events',
  userAchievement: 'achievements',
};

export interface Mutation {
  entity: SyncEntity;
  kind: 'upsert' | 'delete';
  id: string;
  /** Full record after the change (for deletes: the tombstoned record). */
  record: Record<string, unknown>;
  /** Fields that changed (undefined for creates). Drives field-level sync merges. */
  changedFields?: string[];
  isNew: boolean;
}

export interface Ctx {
  now: number;
  newId: () => string;
}

export function emptyState(userId: string, preferences: Preferences): AppState {
  return {
    userId,
    preferences,
    semesters: [],
    courses: [],
    tasks: [],
    subtasks: [],
    availability: [],
    commitments: [],
    overrides: [],
    sessions: [],
    planRevisions: [],
    focusLogs: [],
    proposals: [],
    reflections: [],
    goals: [],
    goalCheckins: [],
    resourceProgress: [],
    events: [],
    achievements: [],
  };
}

export const live = <T extends { deletedAt?: string | null }>(xs: readonly T[]): T[] => xs.filter((x) => !x.deletedAt);

export function findRecord(state: AppState, entity: SyncEntity, id: string): Record<string, unknown> | undefined {
  if (entity === 'preferences') return state.preferences.id === id ? (state.preferences as unknown as Record<string, unknown>) : undefined;
  return (state[COLLECTION_OF[entity]] as unknown as Array<Record<string, unknown>>).find((r) => r.id === id);
}

/** Apply mutations immutably. */
export function applyMutations(state: AppState, mutations: readonly Mutation[]): AppState {
  if (mutations.length === 0) return state;
  const next: AppState = { ...state };
  const touched = new Set<CollectionKey>();
  for (const m of mutations) {
    if (m.entity === 'preferences') {
      next.preferences = m.record as unknown as Preferences;
      continue;
    }
    const key = COLLECTION_OF[m.entity];
    if (!touched.has(key)) {
      (next as unknown as Record<string, unknown[]>)[key] = [...(state[key] as unknown[])];
      touched.add(key);
    }
    const arr = (next as unknown as Record<string, Array<Record<string, unknown>>>)[key]!;
    const idx = arr.findIndex((r) => r.id === m.id);
    if (idx >= 0) arr[idx] = m.record;
    else arr.push(m.record);
  }
  return next;
}

/** Build a create/update mutation, stamping timestamps and computing changed fields. */
export function upsert(state: AppState, entity: SyncEntity, record: Record<string, unknown>, ctx: Ctx): Mutation {
  const iso = new Date(ctx.now).toISOString();
  const existing = findRecord(state, entity, record.id as string);
  if (!existing) {
    const created = { ...record, createdAt: (record.createdAt as string) ?? iso, updatedAt: iso, deletedAt: null };
    return { entity, kind: 'upsert', id: record.id as string, record: created, isNew: true };
  }
  const merged = { ...existing, ...record, updatedAt: iso };
  const changedFields = Object.keys(record).filter(
    (k) => !['id', 'createdAt', 'updatedAt', 'rev'].includes(k) && JSON.stringify(existing[k]) !== JSON.stringify(record[k]),
  );
  return { entity, kind: 'upsert', id: record.id as string, record: merged, changedFields, isNew: false };
}

export function tombstone(state: AppState, entity: SyncEntity, id: string, ctx: Ctx): Mutation | null {
  const existing = findRecord(state, entity, id);
  if (!existing || existing.deletedAt) return null;
  const iso = new Date(ctx.now).toISOString();
  return { entity, kind: 'delete', id, record: { ...existing, deletedAt: iso, updatedAt: iso }, isNew: false };
}

/**
 * When the student last accepted a Recovery Mode plan (and didn't undo it).
 * Sessions that ended before then were reviewed in that proposal, so Today
 * stops asking about them. Automatic replans (e.g. after adding a task) don't
 * count: nobody looked at the missed session then.
 */
export function lastRecoveryAt(state: AppState): number | undefined {
  const times = live(state.planRevisions)
    .filter((r) => r.reason === 'recovery' && !r.undoneAt)
    .map((r) => Date.parse(r.createdAt));
  return times.length ? Math.max(...times) : undefined;
}

export function currentRevision(state: AppState): number {
  return live(state.planRevisions).reduce((m, r) => Math.max(m, r.number), 0);
}

/** Map app state to scheduler input. */
export function toPlannerInput(state: AppState, now: number, extra: Partial<PlannerInput> = {}): PlannerInput {
  const p = state.preferences;
  return {
    now,
    // Seeded by revision: two devices planning from the same base produce identical
    // session IDs (no duplicates on sync), while a later revision never reuses the ID
    // of a tombstoned session (which the server would refuse to resurrect).
    seed: `${state.userId}:r${currentRevision(state)}`,
    horizonDays: 14,
    tasks: live(state.tasks),
    subtasks: live(state.subtasks),
    sessions: live(state.sessions),
    availability: live(state.availability),
    commitments: live(state.commitments),
    overrides: live(state.overrides),
    preferences: {
      timezone: p.timezone,
      defaultSessionMinutes: p.defaultSessionMinutes,
      minSessionMinutes: p.minSessionMinutes,
      maxSessionMinutes: p.maxSessionMinutes,
      dailyLimitMinutes: p.dailyLimitMinutes,
      bufferMinutes: p.bufferMinutes,
      deadlineBufferHours: p.deadlineBufferHours,
      maxSessionsPerTaskPerDay: p.maxSessionsPerTaskPerDay,
    },
    ...extra,
  };
}
