import { addDaysToKey, weekStartOfKey } from '@nextstep/contracts';
import type { LedgerEntry } from './ledger.js';

export interface QuestDef {
  id: string;
  cadence: 'daily' | 'weekly';
  title: string;
  description: string;
  xp: number;
  target: number;
  /** Counts matching ledger entries inside the quest period. */
  measure: (entries: readonly LedgerEntry[]) => number;
}

const of = (type: string, pred: (e: LedgerEntry) => boolean = () => true) => (entries: readonly LedgerEntry[]) =>
  entries.filter((e) => e.type === type && pred(e)).length;

export const DAILY_QUESTS: QuestDef[] = [
  { id: 'one_session', cadence: 'daily', title: 'Show up once', description: 'Log one focus session of 10+ minutes.', xp: 10, target: 1, measure: of('focus_completed', (e) => Number(e.meta.focusMinutes ?? 0) >= 10) },
  { id: 'checkin', cadence: 'daily', title: 'Close the loop', description: 'Do one after-session check-in.', xp: 10, target: 1, measure: of('checkin_completed') },
  { id: 'small_step', cadence: 'daily', title: 'One small step', description: 'Tick off one step of a task.', xp: 10, target: 1, measure: (e) => of('subtask_completed')(e) + of('task_completed')(e) },
  { id: 'proper_break', cadence: 'daily', title: 'Rest counts', description: 'Take a break after focusing.', xp: 10, target: 1, measure: of('focus_completed', (e) => e.meta.breakTaken === true) },
  { id: 'goal_moment', cadence: 'daily', title: 'Something for you', description: 'Check in on a personal goal.', xp: 10, target: 1, measure: of('goal_checkin') },
];

export const WEEKLY_QUESTS: QuestDef[] = [
  { id: 'three_sessions', cadence: 'weekly', title: 'Three good sessions', description: 'Log three focus sessions this week.', xp: 25, target: 3, measure: of('focus_completed', (e) => Number(e.meta.focusMinutes ?? 0) >= 10) },
  { id: 'weekly_review', cadence: 'weekly', title: 'Look back, plan forward', description: 'Complete your weekly reflection.', xp: 25, target: 1, measure: of('reflection_completed') },
  { id: 'goal_twice', cadence: 'weekly', title: 'Keep a promise to yourself', description: 'Check in on a personal goal on two days.', xp: 25, target: 2, measure: (e) => new Set(e.filter((x) => x.type === 'goal_checkin').map((x) => x.localDate)).size },
];

export interface QuestStatus {
  instanceId: string;
  def: QuestDef;
  progress: number;
  complete: boolean;
  claimed: boolean;
}

function seededPick<T>(items: T[], seed: string, n: number): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr.slice(0, n);
}

/**
 * Today's quests: deterministic per date, never more than three, and only
 * one gentle quest on a lighter or rest day. Goal quests only appear when the
 * student has an active goal.
 */
export function questsFor(
  ledger: readonly LedgerEntry[],
  today: string,
  opts: { hasActiveGoal: boolean; lightDay: boolean },
): { daily: QuestStatus[]; weekly: QuestStatus[] } {
  const live = ledger.filter((e) => !e.deletedAt && e.status !== 'rejected');
  const pool = DAILY_QUESTS.filter((q) => opts.hasActiveGoal || q.id !== 'goal_moment');
  const daily = opts.lightDay ? pool.filter((q) => q.id === 'proper_break' || q.id === 'goal_moment').slice(0, 1) : seededPick(pool, today, 3);
  const weekStart = weekStartOfKey(today);
  const weekDays = new Set(Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i)));
  const todays = live.filter((e) => e.localDate === today);
  const weeks = live.filter((e) => weekDays.has(e.localDate));
  const claimed = new Set(live.filter((e) => e.type === 'quest_completed').map((e) => String(e.meta.questInstanceId)));
  const status = (def: QuestDef, instanceId: string, entries: readonly LedgerEntry[]): QuestStatus => {
    const progress = Math.min(def.target, def.measure(entries));
    return { instanceId, def, progress, complete: progress >= def.target, claimed: claimed.has(instanceId) };
  };
  return {
    daily: daily.map((q) => status(q, `daily:${today}:${q.id}`, todays)),
    weekly: WEEKLY_QUESTS.filter((q) => opts.hasActiveGoal || q.id !== 'goal_twice').map((q) => status(q, `weekly:${weekStart}:${q.id}`, weeks)),
  };
}
