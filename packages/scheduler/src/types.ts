import type { CommitmentKind, Connectivity, SessionStatus, TaskKind, TaskStatus } from '@nextstep/contracts';

/** The subset of a Task the planner needs. Extra fields are ignored. */
export interface PlannerTask {
  id: string;
  title: string;
  kind?: TaskKind;
  courseId?: string | null;
  goalId?: string | null;
  dueAt: string | null;
  importance: number;
  estimatedMinutes?: number;
  remainingMinutes: number;
  status: TaskStatus;
  dependsOn?: string[];
  preferredSessionMinutes?: number | null;
  splittable?: boolean;
  optional?: boolean;
  connectivity?: Connectivity;
  createdAt?: string;
  deletedAt?: string | null;
}

export interface PlannerSubtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  position: number;
  deletedAt?: string | null;
}

export interface PlannerSession {
  id: string;
  taskId: string;
  startAt: string;
  endAt: string;
  minutes: number;
  status: SessionStatus;
  pinned: boolean;
  source: 'auto' | 'manual' | 'recovery';
  label?: string | null;
  planRevisionId?: string | null;
  deletedAt?: string | null;
}

export interface PlannerAvailability {
  id?: string;
  weekday: number;
  start: string;
  end: string;
  online?: boolean;
  deletedAt?: string | null;
}

export interface PlannerCommitment {
  id?: string;
  title: string;
  kind: CommitmentKind;
  weekdays: number[];
  date?: string | null;
  start: string;
  end: string;
  protected?: boolean;
  deletedAt?: string | null;
}

export interface PlannerOverride {
  id?: string;
  date: string;
  /** Replaces the daily study limit for this date (can be lower or higher). */
  maxMinutes: number | null;
  /** Replaces the availability windows for this date when present. */
  windows?: Array<{ start: string; end: string; online: boolean }> | null;
  reason?: string;
  source?: 'recovery' | 'manual';
  deletedAt?: string | null;
}

export interface PlannerPreferences {
  timezone: string;
  defaultSessionMinutes: number;
  minSessionMinutes: number;
  maxSessionMinutes: number;
  dailyLimitMinutes: number;
  bufferMinutes: number;
  deadlineBufferHours: number;
  maxSessionsPerTaskPerDay: number;
}

export interface PlannerInput {
  /** Current instant (epoch ms). Injected so planning is deterministic and testable. */
  now: number;
  /** Seed for stable session IDs, normally the user ID. */
  seed: string;
  horizonDays?: number;
  tasks: PlannerTask[];
  subtasks?: PlannerSubtask[];
  sessions: PlannerSession[];
  availability: PlannerAvailability[];
  commitments: PlannerCommitment[];
  overrides?: PlannerOverride[];
  preferences: PlannerPreferences;
  /** Tasks to leave out of this run (used for "what if I defer this?" simulations). */
  excludeTaskIds?: string[];
  /** Future planned sessions to keep exactly where they are (Recovery Mode minimises churn this way). */
  lockedSessionIds?: string[];
  /** Source tag for sessions created in this run. */
  source?: 'auto' | 'recovery';
  /** Skip computing shortfall options (used internally by simulations). */
  skipOptions?: boolean;
}

export interface PlannedSession {
  id: string;
  taskId: string;
  startAt: string;
  endAt: string;
  minutes: number;
  status: 'planned' | 'done' | 'missed' | 'skipped';
  pinned: boolean;
  source: 'auto' | 'manual' | 'recovery';
  label: string | null;
  /** True for sessions created by this run; false for kept (pinned, locked, done) sessions. */
  isNew: boolean;
}

export type TaskPlanStatus =
  | 'on_track'
  | 'tight'
  | 'at_risk'
  | 'blocked'
  | 'overdue'
  | 'flexible'
  | 'done';

export interface TaskPlan {
  taskId: string;
  title: string;
  status: TaskPlanStatus;
  dueAt: string | null;
  remainingMinutes: number;
  /** Minutes covered by future sessions (kept + new). */
  scheduledMinutes: number;
  shortfallMinutes: number;
  firstSessionAt: string | null;
  lastSessionEndAt: string | null;
  score: number;
  rank: number;
  /** Plain-language reasons this task is prioritised the way it is. */
  reasons: string[];
  /** One-sentence summary of the outcome for this task. */
  explanation: string;
}

export interface DayLoad {
  date: string;
  limitMinutes: number;
  windowMinutes: number;
  plannedMinutes: number;
  doneMinutes: number;
}

export type ShortfallOptionKind = 'reduce_scope' | 'defer_task' | 'raise_daily_limit' | 'add_time' | 'seek_help';

export interface ShortfallOption {
  kind: ShortfallOptionKind;
  title: string;
  detail: string;
  /** The at-risk task this option helps. */
  taskId?: string;
  /** For defer_task: the task that would be deferred. */
  deferTaskId?: string;
  minutes?: number;
  /** For raise_daily_limit: proposed per-day limit and the dates it applies to. */
  dailyLimit?: number;
  dates?: string[];
  /** Whether the simulation shows this option alone covers the shortfall. */
  resolves: boolean;
}

export interface Shortfall {
  totalMinutes: number;
  taskIds: string[];
  message: string;
  options: ShortfallOption[];
}

export interface PlanResult {
  generatedAt: string;
  fingerprint: string;
  /** Complete picture of future sessions: kept ones plus newly placed ones, sorted by start. */
  sessions: PlannedSession[];
  newSessions: PlannedSession[];
  tasks: TaskPlan[];
  days: DayLoad[];
  shortfall: Shortfall | null;
  warnings: string[];
}
