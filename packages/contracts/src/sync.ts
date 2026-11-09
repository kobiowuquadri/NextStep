import { z } from 'zod';
import { Id } from './ids.js';
import {
  AvailabilityRule,
  Commitment,
  Course,
  DayOverride,
  FocusLog,
  GamificationEvent,
  GoalCheckin,
  IsoDateTime,
  PersonalGoal,
  PlanRevision,
  Preferences,
  RecoveryProposalRecord,
  ResourceProgress,
  ScheduledSession,
  Semester,
  Subtask,
  Task,
  UserAchievement,
  WeeklyReflection,
} from './entities.js';

export const SYNC_ENTITIES = [
  'preferences',
  'semester',
  'course',
  'task',
  'subtask',
  'availability',
  'commitment',
  'dayOverride',
  'session',
  'planRevision',
  'focusLog',
  'recoveryProposal',
  'reflection',
  'goal',
  'goalCheckin',
  'resourceProgress',
  'gamificationEvent',
  'userAchievement',
] as const;
export const SyncEntity = z.enum(SYNC_ENTITIES);
export type SyncEntity = z.infer<typeof SyncEntity>;

export interface EntitySpec {
  schema: z.ZodObject;
  /**
   * Fields where a concurrent edit on two devices must be resolved by the
   * student rather than by last-writer-wins.
   */
  important: readonly string[];
  /** Append-only records: created once, never edited; replays merge safely. */
  appendOnly: boolean;
  /** Parent references that must belong to the same user. */
  parents: Readonly<Record<string, SyncEntity>>;
}

export const ENTITY_SPECS: Record<SyncEntity, EntitySpec> = {
  preferences: { schema: Preferences, important: [], appendOnly: false, parents: {} },
  semester: { schema: Semester, important: [], appendOnly: false, parents: {} },
  course: { schema: Course, important: [], appendOnly: false, parents: { semesterId: 'semester' } },
  task: {
    schema: Task,
    important: ['dueAt', 'estimatedMinutes', 'remainingMinutes'],
    appendOnly: false,
    parents: { courseId: 'course', goalId: 'goal' },
  },
  subtask: { schema: Subtask, important: [], appendOnly: false, parents: { taskId: 'task' } },
  availability: { schema: AvailabilityRule, important: ['start', 'end', 'weekday'], appendOnly: false, parents: {} },
  commitment: { schema: Commitment, important: ['start', 'end', 'weekdays', 'date'], appendOnly: false, parents: {} },
  dayOverride: { schema: DayOverride, important: ['maxMinutes', 'windows'], appendOnly: false, parents: {} },
  session: {
    schema: ScheduledSession,
    important: ['startAt', 'endAt', 'status'],
    appendOnly: false,
    parents: { taskId: 'task', planRevisionId: 'planRevision' },
  },
  planRevision: { schema: PlanRevision, important: [], appendOnly: false, parents: {} },
  focusLog: { schema: FocusLog, important: [], appendOnly: true, parents: { taskId: 'task', sessionId: 'session' } },
  recoveryProposal: { schema: RecoveryProposalRecord, important: [], appendOnly: false, parents: {} },
  reflection: { schema: WeeklyReflection, important: [], appendOnly: false, parents: {} },
  goal: { schema: PersonalGoal, important: ['weeklyTargetMinutes'], appendOnly: false, parents: {} },
  goalCheckin: { schema: GoalCheckin, important: [], appendOnly: true, parents: { goalId: 'goal' } },
  resourceProgress: { schema: ResourceProgress, important: [], appendOnly: false, parents: {} },
  gamificationEvent: { schema: GamificationEvent, important: [], appendOnly: true, parents: {} },
  userAchievement: { schema: UserAchievement, important: [], appendOnly: true, parents: {} },
};

/** Fields owned by the sync layer; clients may not set them directly. */
export const META_FIELDS = ['id', 'rev', 'createdAt', 'updatedAt', 'deletedAt'] as const;

export const SyncOp = z.object({
  /** Unique per operation; the server stores results so retries are idempotent. */
  opId: Id,
  entity: SyncEntity,
  entityId: Id,
  kind: z.enum(['upsert', 'delete']),
  /** Server revision the client last saw for this record; null when creating. */
  baseRev: z.number().int().nonnegative().nullable(),
  /** Field names the client changed since baseRev. Required for updates. */
  changedFields: z.array(z.string().max(60)).max(60).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  /** Ops sharing a batchId (e.g. accepting a recovery plan) are applied in one transaction. */
  batchId: Id.optional(),
  /** For plan batches: the plan revision number the change was built on. */
  basePlanRevision: z.number().int().nonnegative().optional(),
  clientTime: IsoDateTime,
});
export type SyncOp = z.infer<typeof SyncOp>;

export const PushRequest = z.object({
  deviceId: z.string().min(8).max(64),
  ops: z.array(SyncOp).min(1).max(200),
});
export type PushRequest = z.infer<typeof PushRequest>;

export const OpStatus = z.enum(['applied', 'duplicate', 'merged', 'conflict', 'rejected']);
export type OpStatus = z.infer<typeof OpStatus>;

export const OpResult = z.object({
  opId: Id,
  status: OpStatus,
  rev: z.number().int().optional(),
  conflictId: Id.optional(),
  /** Machine-readable reason, e.g. RECORD_DELETED, STALE_PLAN, VALIDATION_FAILED. */
  reason: z.string().optional(),
  /** Canonical server copy when it differs from what the client sent. */
  record: z.record(z.string(), z.unknown()).optional(),
});
export type OpResult = z.infer<typeof OpResult>;

export const PushResponse = z.object({
  results: z.array(OpResult),
  cursor: z.number().int(),
  serverTime: IsoDateTime,
});
export type PushResponse = z.infer<typeof PushResponse>;

export const SyncConflict = z.object({
  id: Id,
  entity: SyncEntity,
  entityId: Id,
  fields: z.array(z.string()),
  serverValues: z.record(z.string(), z.unknown()),
  clientValues: z.record(z.string(), z.unknown()),
  status: z.enum(['open', 'resolved']),
  createdAt: IsoDateTime,
  rev: z.number().int(),
});
export type SyncConflict = z.infer<typeof SyncConflict>;

export const ResolveConflictRequest = z.object({
  choice: z.enum(['server', 'client']),
});

export const PullChange = z.object({
  entity: SyncEntity,
  id: Id,
  rev: z.number().int(),
  deleted: z.boolean(),
  record: z.record(z.string(), z.unknown()).nullable(),
});
export type PullChange = z.infer<typeof PullChange>;

export const PullResponse = z.object({
  changes: z.array(PullChange),
  conflicts: z.array(SyncConflict),
  /** Opaque server-issued cursor. Clients never derive it from their own clock. */
  cursor: z.number().int(),
  hasMore: z.boolean(),
  serverTime: IsoDateTime,
});
export type PullResponse = z.infer<typeof PullResponse>;

/**
 * Field-level three-way check used by the server: given which fields changed
 * on the server after the client's base revision, decide what can be merged
 * automatically and what must go to the student.
 */
export function classifyConcurrentChange(
  entity: SyncEntity,
  clientChanged: readonly string[],
  serverChangedSinceBase: readonly string[],
  clientData: Record<string, unknown>,
  serverData: Record<string, unknown>,
): { autoMerge: string[]; conflicting: string[] } {
  const spec = ENTITY_SPECS[entity];
  const serverSet = new Set(serverChangedSinceBase);
  const autoMerge: string[] = [];
  const conflicting: string[] = [];
  for (const field of clientChanged) {
    if ((META_FIELDS as readonly string[]).includes(field)) continue;
    const sameValue = JSON.stringify(clientData[field]) === JSON.stringify(serverData[field]);
    if (serverSet.has(field) && spec.important.includes(field) && !sameValue) conflicting.push(field);
    else autoMerge.push(field);
  }
  return { autoMerge, conflicting };
}
