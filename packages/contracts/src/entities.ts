import { z } from 'zod';
import { Id } from './ids.js';

export const IsoDateTime = z.iso.datetime({ offset: true });
export const DateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export const TimeOfDay = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/, 'Expected HH:MM');

/** Metadata shared by every synchronised record. */
export const RecordMeta = z.object({
  id: Id,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  /** Tombstone. A deleted record is never resurrected by a stale update. */
  deletedAt: IsoDateTime.nullable().optional(),
  /** Server revision (sync cursor position) of the last accepted change. */
  rev: z.number().int().nonnegative().optional(),
});
export type RecordMeta = z.infer<typeof RecordMeta>;

// ─── Preferences ────────────────────────────────────────────────────────────

export const ThemePreference = z.enum(['system', 'light', 'dark']);
export const MotionPreference = z.enum(['system', 'reduce', 'full']);
export const PlanningMode = z.enum(['auto', 'manual']);

export const MASCOT_SKINS = ['violet', 'lagoon', 'coral', 'marigold', 'midnight', 'mint'] as const;
export const MASCOT_ACCESSORIES = ['none', 'headphones', 'cap', 'scarf', 'glasses', 'backpack', 'gradcap', 'starpin'] as const;
export const MascotSkin = z.enum(MASCOT_SKINS);
export const MascotAccessory = z.enum(MASCOT_ACCESSORIES);
export type MascotSkin = z.infer<typeof MascotSkin>;
export type MascotAccessory = z.infer<typeof MascotAccessory>;

export const Preferences = RecordMeta.extend({
  displayName: z.string().trim().min(1).max(60),
  timezone: z.string().min(1).max(64),
  institution: z.string().trim().max(120).nullable().optional(),
  programme: z.string().trim().max(120).nullable().optional(),
  defaultSessionMinutes: z.number().int().min(10).max(180),
  minSessionMinutes: z.number().int().min(10).max(90),
  maxSessionMinutes: z.number().int().min(15).max(240),
  breakMinutes: z.number().int().min(0).max(60),
  dailyLimitMinutes: z.number().int().min(15).max(720),
  bufferMinutes: z.number().int().min(0).max(60),
  deadlineBufferHours: z.number().int().min(0).max(72),
  maxSessionsPerTaskPerDay: z.number().int().min(1).max(6),
  planningMode: PlanningMode,
  weeklyActiveDaysGoal: z.number().int().min(1).max(7),
  quietHoursStart: TimeOfDay,
  quietHoursEnd: TimeOfDay,
  notifySessions: z.boolean(),
  notifyDeadlines: z.boolean(),
  notifyRecovery: z.boolean(),
  reminderLeadMinutes: z.number().int().min(0).max(120),
  theme: ThemePreference,
  motion: MotionPreference,
  haptics: z.boolean(),
  sound: z.boolean(),
  streaksEnabled: z.boolean(),
  celebrationsEnabled: z.boolean(),
  syncOnCellular: z.boolean(),
  mascotSkin: MascotSkin,
  mascotAccessory: MascotAccessory,
  onboardingCompletedAt: IsoDateTime.nullable().optional(),
});
export type Preferences = z.infer<typeof Preferences>;

export const DEFAULT_PREFERENCES: Omit<Preferences, keyof RecordMeta | 'displayName' | 'timezone'> = {
  institution: null,
  programme: null,
  defaultSessionMinutes: 45,
  minSessionMinutes: 20,
  maxSessionMinutes: 90,
  breakMinutes: 10,
  dailyLimitMinutes: 180,
  bufferMinutes: 10,
  deadlineBufferHours: 12,
  maxSessionsPerTaskPerDay: 2,
  planningMode: 'auto',
  weeklyActiveDaysGoal: 4,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  notifySessions: true,
  notifyDeadlines: true,
  notifyRecovery: true,
  reminderLeadMinutes: 10,
  theme: 'system',
  motion: 'system',
  haptics: true,
  sound: false,
  streaksEnabled: true,
  celebrationsEnabled: true,
  syncOnCellular: true,
  mascotSkin: 'violet',
  mascotAccessory: 'none',
  onboardingCompletedAt: null,
};

// ─── Academic organisation ─────────────────────────────────────────────────

export const Semester = RecordMeta.extend({
  name: z.string().trim().min(1).max(80),
  startDate: DateKey.nullable().optional(),
  endDate: DateKey.nullable().optional(),
});
export type Semester = z.infer<typeof Semester>;

export const Course = RecordMeta.extend({
  title: z.string().trim().min(1).max(100),
  code: z.string().trim().max(20).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  semesterId: Id.nullable().optional(),
});
export type Course = z.infer<typeof Course>;

export const TASK_KINDS = ['assignment', 'exam', 'revision', 'reading', 'project', 'practice', 'personal'] as const;
export const TaskKind = z.enum(TASK_KINDS);
export type TaskKind = z.infer<typeof TaskKind>;
export const TaskStatus = z.enum(['todo', 'in_progress', 'done', 'archived']);
export type TaskStatus = z.infer<typeof TaskStatus>;
/** What a task needs: 'online' tasks are only scheduled in windows the student marked as connected. */
export const Connectivity = z.enum(['any', 'online', 'offline']);
export type Connectivity = z.infer<typeof Connectivity>;
/** 1 low · 2 normal · 3 high · 4 critical */
export const Importance = z.number().int().min(1).max(4);

export const TaskLink = z.object({
  title: z.string().trim().min(1).max(80),
  url: z.url({ protocol: /^https?$/ }).max(500),
});

export const Task = RecordMeta.extend({
  title: z.string().trim().min(1).max(140),
  description: z.string().max(2000).nullable().optional(),
  courseId: Id.nullable().optional(),
  goalId: Id.nullable().optional(),
  kind: TaskKind,
  /** The real deadline. NextStep never changes this on its own. */
  dueAt: IsoDateTime.nullable(),
  importance: Importance,
  estimatedMinutes: z.number().int().min(5).max(6000),
  remainingMinutes: z.number().int().min(0).max(6000),
  status: TaskStatus,
  dependsOn: z.array(Id).max(20),
  preferredSessionMinutes: z.number().int().min(10).max(240).nullable().optional(),
  splittable: z.boolean(),
  /** Optional tasks are the first candidates when a week is overloaded. */
  optional: z.boolean(),
  connectivity: Connectivity,
  links: z.array(TaskLink).max(10),
  resourceIds: z.array(Id).max(10),
  completedAt: IsoDateTime.nullable().optional(),
});
export type Task = z.infer<typeof Task>;

export const Subtask = RecordMeta.extend({
  taskId: Id,
  title: z.string().trim().min(1).max(140),
  done: z.boolean(),
  position: z.number().int().min(0).max(1000),
  estimatedMinutes: z.number().int().min(1).max(600).nullable().optional(),
  completedAt: IsoDateTime.nullable().optional(),
});
export type Subtask = z.infer<typeof Subtask>;

// ─── Time ───────────────────────────────────────────────────────────────────

const Weekday = z.number().int().min(0).max(6);

/** A recurring weekly window in which the student is willing to study. */
export const AvailabilityRule = RecordMeta.extend({
  weekday: Weekday,
  start: TimeOfDay,
  end: TimeOfDay,
  /** Whether the student usually has internet access in this window. */
  online: z.boolean(),
  label: z.string().trim().max(60).nullable().optional(),
});
export type AvailabilityRule = z.infer<typeof AvailabilityRule>;

export const COMMITMENT_KINDS = ['work', 'commute', 'class', 'family', 'rest', 'worship', 'other'] as const;
export const CommitmentKind = z.enum(COMMITMENT_KINDS);
export type CommitmentKind = z.infer<typeof CommitmentKind>;

/** A fixed event. Weekly when `date` is null, otherwise a one-off on that date. */
export const Commitment = RecordMeta.extend({
  title: z.string().trim().min(1).max(80),
  kind: CommitmentKind,
  weekdays: z.array(Weekday).max(7),
  date: DateKey.nullable().optional(),
  start: TimeOfDay,
  end: TimeOfDay,
  /** Protected time (rest, worship, family) is never used for study. All commitments block study. */
  protected: z.boolean(),
});
export type Commitment = z.infer<typeof Commitment>;

/** A per-date capacity change, typically created by Recovery Mode. */
export const DayOverride = RecordMeta.extend({
  date: DateKey,
  maxMinutes: z.number().int().min(0).max(720).nullable(),
  windows: z.array(z.object({ start: TimeOfDay, end: TimeOfDay, online: z.boolean() })).max(8).nullable().optional(),
  reason: z.string().trim().max(140),
  source: z.enum(['recovery', 'manual']),
});
export type DayOverride = z.infer<typeof DayOverride>;

// ─── Planning ───────────────────────────────────────────────────────────────

export const SessionStatus = z.enum(['planned', 'done', 'missed', 'skipped']);
export type SessionStatus = z.infer<typeof SessionStatus>;
export const SessionSource = z.enum(['auto', 'manual', 'recovery']);

/** A block of time to work on a task. Distinct from the task's deadline. */
export const ScheduledSession = RecordMeta.extend({
  taskId: Id,
  startAt: IsoDateTime,
  endAt: IsoDateTime,
  minutes: z.number().int().min(1).max(600),
  status: SessionStatus,
  pinned: z.boolean(),
  source: SessionSource,
  planRevisionId: Id.nullable().optional(),
  label: z.string().max(160).nullable().optional(),
});
export type ScheduledSession = z.infer<typeof ScheduledSession>;

export const PlanRevisionReason = z.enum(['initial', 'replan', 'recovery', 'manual', 'undo']);
export const PlanRevision = RecordMeta.extend({
  number: z.number().int().min(1),
  parentNumber: z.number().int().min(0).nullable(),
  reason: PlanRevisionReason,
  summary: z.string().max(400),
  /** Sessions this revision removed or replaced, kept so the revision can be undone safely. */
  replacedSessions: z.array(z.record(z.string(), z.unknown())).max(400),
  createdSessionIds: z.array(Id).max(400),
  proposalId: Id.nullable().optional(),
  undoneAt: IsoDateTime.nullable().optional(),
});
export type PlanRevision = z.infer<typeof PlanRevision>;

export const Readiness = z.enum(['ready', 'more_practice', 'unsure']);
export const FocusLog = RecordMeta.extend({
  taskId: Id.nullable().optional(),
  sessionId: Id.nullable().optional(),
  mode: z.enum(['timer', 'manual']),
  startedAt: IsoDateTime,
  endedAt: IsoDateTime,
  focusMinutes: z.number().int().min(0).max(600),
  breakCount: z.number().int().min(0).max(50),
  finishedNote: z.string().max(500).nullable().optional(),
  remainingMinutes: z.number().int().min(0).max(6000).nullable().optional(),
  readiness: Readiness.nullable().optional(),
  obstacles: z.array(z.string().max(60)).max(10),
});
export type FocusLog = z.infer<typeof FocusLog>;

export const RECOVERY_KINDS = ['missed_session', 'less_time', 'deadline_changed', 'urgent', 'lighter_day'] as const;
export const RecoveryKind = z.enum(RECOVERY_KINDS);
export type RecoveryKind = z.infer<typeof RecoveryKind>;

export const RecoveryInput = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('missed_session'),
    sessionIds: z.array(Id).min(1).max(20),
    /** Optional minutes of progress the student did manage, per session. */
    progressMinutes: z.record(z.string(), z.number().int().min(0).max(600)).optional(),
  }),
  z.object({
    kind: z.literal('less_time'),
    date: DateKey,
    availableMinutes: z.number().int().min(0).max(720),
  }),
  z.object({
    kind: z.literal('deadline_changed'),
    taskId: Id,
    newDueAt: IsoDateTime,
    /** The student confirms this reflects an official change. */
    confirmedByStudent: z.literal(true),
  }),
  z.object({
    kind: z.literal('urgent'),
    startDate: DateKey,
    days: z.number().int().min(1).max(7),
    note: z.string().max(140).optional(),
  }),
  z.object({
    kind: z.literal('lighter_day'),
    date: DateKey,
    maxMinutes: z.number().int().min(0).max(720),
  }),
]);
export type RecoveryInput = z.infer<typeof RecoveryInput>;

export const RecoveryProposalRecord = RecordMeta.extend({
  kind: RecoveryKind,
  input: z.record(z.string(), z.unknown()),
  baseRevision: z.number().int().min(0),
  fingerprint: z.string().max(64),
  status: z.enum(['accepted', 'kept', 'stale', 'undone']),
  summary: z.string().max(400),
  nextActionSessionId: Id.nullable().optional(),
  nextActionCompletedAt: IsoDateTime.nullable().optional(),
  acceptedAt: IsoDateTime.nullable().optional(),
});
export type RecoveryProposalRecord = z.infer<typeof RecoveryProposalRecord>;

// ─── Reflection & goals ─────────────────────────────────────────────────────

export const WeeklyReflection = RecordMeta.extend({
  weekStart: DateKey,
  plannedMinutes: z.number().int().min(0),
  completedMinutes: z.number().int().min(0),
  estimatedMinutes: z.number().int().min(0),
  actualMinutes: z.number().int().min(0),
  wentWell: z.string().max(1000).nullable().optional(),
  obstacles: z.array(z.string().max(60)).max(10),
  adjustments: z.array(z.string().max(120)).max(10),
  note: z.string().max(1000).nullable().optional(),
});
export type WeeklyReflection = z.infer<typeof WeeklyReflection>;

export const GoalCategory = z.enum(['reading', 'exercise', 'skill', 'wellbeing', 'other']);
export const PersonalGoal = RecordMeta.extend({
  title: z.string().trim().min(1).max(80),
  category: GoalCategory,
  weeklyTargetMinutes: z.number().int().min(10).max(1200),
  sessionMinutes: z.number().int().min(10).max(120),
  active: z.boolean(),
  /** When true the planner reserves sessions for it after academic work. */
  scheduleIt: z.boolean(),
});
export type PersonalGoal = z.infer<typeof PersonalGoal>;

export const GoalCheckin = RecordMeta.extend({
  goalId: Id,
  date: DateKey,
  minutes: z.number().int().min(1).max(600),
  note: z.string().max(280).nullable().optional(),
});
export type GoalCheckin = z.infer<typeof GoalCheckin>;

// ─── Learning resources ─────────────────────────────────────────────────────

export const ResourceQuestion = z.object({
  id: z.string().min(1).max(40),
  prompt: z.string().min(1).max(500),
  choices: z.array(z.string().min(1).max(200)).min(2).max(6),
  answerIndex: z.number().int().min(0),
  explanation: z.string().min(1).max(800),
});

export const LearningResource = z.object({
  id: Id,
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(120),
  subject: z.string().min(1).max(60),
  kind: z.enum(['guide', 'practice']),
  summary: z.string().max(400),
  estMinutes: z.number().int().min(1).max(120),
  version: z.number().int().min(1),
  /** Honest provenance: who wrote it and whether anyone reviewed it. */
  provenance: z.string().max(400),
  reviewStatus: z.enum(['unreviewed', 'team_reviewed', 'educator_reviewed']),
  license: z.string().max(120),
  sections: z.array(z.object({ heading: z.string().max(120), body: z.string().max(4000) })).max(20),
  questions: z.array(ResourceQuestion).max(20),
});
export type LearningResource = z.infer<typeof LearningResource>;

export const ResourceProgress = RecordMeta.extend({
  resourceId: Id,
  downloadedVersion: z.number().int().nullable().optional(),
  downloadedAt: IsoDateTime.nullable().optional(),
  completedAt: IsoDateTime.nullable().optional(),
  lastScore: z.number().int().min(0).max(100).nullable().optional(),
  attempts: z.number().int().min(0).max(1000),
});
export type ResourceProgress = z.infer<typeof ResourceProgress>;

// ─── Gamification ───────────────────────────────────────────────────────────

export const XP_EVENT_TYPES = [
  'task_completed',
  'subtask_completed',
  'focus_completed',
  'checkin_completed',
  'recovery_accepted',
  'recovery_next_action',
  'reflection_completed',
  'goal_checkin',
  'practice_completed',
  'quest_completed',
  'welcome_back',
  'plan_created',
] as const;
export const XpEventType = z.enum(XP_EVENT_TYPES);
export type XpEventType = z.infer<typeof XpEventType>;

/** Append-only ledger entry. `dedupeKey` is unique per user, so replays never double-award. */
export const GamificationEvent = RecordMeta.extend({
  dedupeKey: z.string().min(1).max(160),
  type: XpEventType,
  xp: z.number().int().min(0).max(500),
  occurredAt: IsoDateTime,
  localDate: DateKey,
  meta: z.record(z.string(), z.unknown()),
  /** Client-side state: pending until the server confirms. */
  status: z.enum(['pending', 'confirmed', 'rejected']).optional(),
});
export type GamificationEvent = z.infer<typeof GamificationEvent>;

export const UserAchievement = RecordMeta.extend({
  achievementId: z.string().min(1).max(60),
  unlockedAt: IsoDateTime,
});
export type UserAchievement = z.infer<typeof UserAchievement>;
