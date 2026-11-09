import type { XpEventType } from '@nextstep/contracts';

/**
 * XP earning rules. Documented in docs/GAMIFICATION.md — keep both in sync.
 *
 * Principles:
 * - Rewards follow meaningful progress, not volume or time-on-app.
 * - Every award has a dedupe key; replays, re-syncs and toggling never re-award.
 * - Repeatable actions have daily caps measured on the student's local date of
 *   the action, so a delayed sync never costs XP.
 * - Long sessions are not rewarded beyond 60 minutes; breaks are rewarded.
 */

export interface AwardRequest {
  type: XpEventType;
  /** ISO time the action happened (device time; only used for local-date caps). */
  occurredAt: string;
  /** Student's local calendar date of the action. */
  localDate: string;
  /** Rule inputs. Unknown keys are ignored. */
  data: {
    taskId?: string;
    subtaskId?: string;
    focusLogId?: string;
    proposalId?: string;
    weekStart?: string;
    goalId?: string;
    resourceId?: string;
    questInstanceId?: string;
    questXp?: number;
    estimatedMinutes?: number;
    /** Minutes between task creation and completion. */
    taskAgeMinutes?: number;
    focusMinutes?: number;
    breakTaken?: boolean;
    daysAway?: number;
    scorePercent?: number;
  };
}

export interface Rule {
  label: string;
  description: string;
  /** Daily XP cap for this event type (local date). */
  dailyXpCap?: number;
  /** Daily count cap for this event type (local date). */
  dailyCountCap?: number;
}

export const RULES: Record<XpEventType, Rule> = {
  task_completed: {
    label: 'Task completed',
    description: '10 XP + 5 XP per 30 min of estimated effort (max 40). Tasks under 10 min, or completed within 5 min of creation, earn 5 XP. Once per task. Daily cap 200 XP.',
    dailyXpCap: 200,
  },
  subtask_completed: {
    label: 'Step completed',
    description: '3 XP per step, once per step. Daily cap 30 XP.',
    dailyXpCap: 30,
  },
  focus_completed: {
    label: 'Focus logged',
    description: '1 XP per 5 focused minutes, counted up to 60 minutes (max 12), plus 2 XP for taking a break. Sessions under 10 minutes earn nothing but still count as activity. Daily cap 60 XP.',
    dailyXpCap: 60,
  },
  checkin_completed: {
    label: 'Check-in',
    description: '5 XP for the after-session check-in. Once per session. Daily cap 25 XP.',
    dailyXpCap: 25,
  },
  recovery_accepted: {
    label: 'Plan recovered',
    description: '15 XP for accepting a recovery plan. Once per proposal, at most 2 per day — disruption is never something to farm.',
    dailyCountCap: 2,
  },
  recovery_next_action: {
    label: 'Back on track',
    description: '20 XP for completing the next action of an accepted recovery plan. Once per proposal.',
  },
  reflection_completed: {
    label: 'Weekly reflection',
    description: '30 XP once per week.',
  },
  goal_checkin: {
    label: 'Personal goal',
    description: '5 XP once per goal per day. Daily cap 10 XP.',
    dailyXpCap: 10,
  },
  practice_completed: {
    label: 'Practice check',
    description: '8 XP the first time you finish a practice check. Retakes are for learning and earn nothing extra.',
  },
  quest_completed: {
    label: 'Quest',
    description: 'Quest reward (10 XP daily, 25 XP weekly). Once per quest instance.',
  },
  welcome_back: {
    label: 'Welcome back',
    description: '10 XP when you return after 3 or more days away. Once per day.',
  },
  plan_created: {
    label: 'First plan',
    description: '10 XP once, for building your first plan.',
  },
};

/** The dedupe key decides what counts as "the same award". */
export function dedupeKeyFor(req: AwardRequest): string {
  const d = req.data;
  switch (req.type) {
    case 'task_completed':
      return `task:${d.taskId}`;
    case 'subtask_completed':
      return `subtask:${d.subtaskId}`;
    case 'focus_completed':
      return `focus:${d.focusLogId}`;
    case 'checkin_completed':
      return `checkin:${d.focusLogId}`;
    case 'recovery_accepted':
      return `recovery:${d.proposalId}`;
    case 'recovery_next_action':
      return `recovery-next:${d.proposalId}`;
    case 'reflection_completed':
      return `reflection:${d.weekStart}`;
    case 'goal_checkin':
      return `goal:${d.goalId}:${req.localDate}`;
    case 'practice_completed':
      return `practice:${d.resourceId}`;
    case 'quest_completed':
      return `quest:${d.questInstanceId}`;
    case 'welcome_back':
      return `welcome:${req.localDate}`;
    case 'plan_created':
      return 'plan:first';
  }
}

/** Base XP before caps. Pure function of the request. */
export function baseXp(req: AwardRequest): number {
  const d = req.data;
  switch (req.type) {
    case 'task_completed': {
      const est = d.estimatedMinutes ?? 0;
      const quick = est < 10 || (d.taskAgeMinutes !== undefined && d.taskAgeMinutes < 5);
      if (quick) return 5;
      return Math.min(40, 10 + 5 * Math.floor(Math.min(est, 180) / 30));
    }
    case 'subtask_completed':
      return 3;
    case 'focus_completed': {
      const m = d.focusMinutes ?? 0;
      if (m < 10) return 0;
      return Math.floor(Math.min(m, 60) / 5) + (d.breakTaken ? 2 : 0);
    }
    case 'checkin_completed':
      return 5;
    case 'recovery_accepted':
      return 15;
    case 'recovery_next_action':
      return 20;
    case 'reflection_completed':
      return 30;
    case 'goal_checkin':
      return 5;
    case 'practice_completed':
      return 8;
    case 'quest_completed':
      return Math.max(0, Math.min(50, d.questXp ?? 10));
    case 'welcome_back':
      return (d.daysAway ?? 0) >= 3 ? 10 : 0;
    case 'plan_created':
      return 10;
  }
}
