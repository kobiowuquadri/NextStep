import { addDaysToKey, formatMinutes, localDateKey, weekdayName, weekdayOfKey } from '@nextstep/contracts';
import { generatePlan } from '@nextstep/scheduler';
import { live, toPlannerInput, type AppState } from './state.js';

export interface WeeklySummary {
  weekStart: string;
  plannedMinutes: number;
  completedMinutes: number;
  /** Logged focus time (self-reported or timer) — activity, not a measure of learning. */
  actualMinutes: number;
  estimatedMinutes: number;
  sessionsPlanned: number;
  sessionsDone: number;
  sessionsMissed: number;
  tasksCompleted: Array<{ id: string; title: string; estimated: number; actual: number }>;
  needsAttention: Array<{ id: string; title: string; reason: string }>;
  obstacles: Array<{ label: string; count: number }>;
  restarts: number;
  suggestions: string[];
}

export function weeklySummary(state: AppState, weekStart: string, now: number): WeeklySummary {
  const tz = state.preferences.timezone;
  const days = new Set(Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i)));
  const inWeek = (isoTime: string) => days.has(localDateKey(Date.parse(isoTime), tz));
  const sessions = live(state.sessions).filter((s) => inWeek(s.startAt));
  const logs = live(state.focusLogs).filter((l) => inWeek(l.startedAt));
  const completed = live(state.tasks).filter((t) => t.completedAt && inWeek(t.completedAt) && !t.goalId);
  const tasksCompleted = completed.map((t) => ({
    id: t.id,
    title: t.title,
    estimated: t.estimatedMinutes,
    actual: live(state.focusLogs).filter((l) => l.taskId === t.id).reduce((a, l) => a + l.focusMinutes, 0),
  }));
  const obstacleCounts = new Map<string, number>();
  for (const l of logs) for (const o of l.obstacles) obstacleCounts.set(o, (obstacleCounts.get(o) ?? 0) + 1);

  const plan = generatePlan(toPlannerInput(state, now, { skipOptions: true }));
  const needsAttention = plan.tasks
    .filter((t) => t.status === 'at_risk' || t.status === 'overdue' || t.status === 'blocked')
    .map((t) => ({ id: t.taskId, title: t.title, reason: t.explanation }));

  const plannedMinutes = sessions.filter((s) => s.status !== 'skipped').reduce((a, s) => a + s.minutes, 0);
  const completedMinutes = sessions.filter((s) => s.status === 'done').reduce((a, s) => a + s.minutes, 0);
  const actualMinutes = logs.reduce((a, l) => a + l.focusMinutes, 0);
  const missed = sessions.filter((s) => s.status === 'missed' || (s.status === 'planned' && Date.parse(s.endAt) < now));
  const restarts = live(state.proposals).filter((p) => p.status === 'accepted' && p.acceptedAt && inWeek(p.acceptedAt) && p.nextActionCompletedAt).length;

  const suggestions: string[] = [];
  const est = tasksCompleted.reduce((a, t) => a + t.estimated, 0);
  const act = tasksCompleted.reduce((a, t) => a + t.actual, 0);
  if (plannedMinutes > 0 && completedMinutes / plannedMinutes < 0.6) {
    const target = Math.max(30, Math.round((completedMinutes / 7 + plannedMinutes / 7) / 2 / 15) * 15);
    suggestions.push(`You completed ${Math.round((completedMinutes / plannedMinutes) * 100)}% of planned time. A daily limit around ${formatMinutes(target)} may be more realistic next week.`);
  }
  if (est > 0 && act > est * 1.25) suggestions.push(`Finished tasks took about ${Math.round((act / est - 1) * 100)}% longer than estimated. Try adding that margin to similar tasks.`);
  const missedByDay = new Map<number, number>();
  for (const s of missed) {
    const wd = weekdayOfKey(localDateKey(Date.parse(s.startAt), tz));
    missedByDay.set(wd, (missedByDay.get(wd) ?? 0) + 1);
  }
  const worst = [...missedByDay.entries()].sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] >= 2) suggestions.push(`${weekdayName(worst[0])} sessions were missed ${worst[1]} times. Consider a shorter or different window that day.`);
  const topObstacle = [...obstacleCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topObstacle && topObstacle[1] >= 2) suggestions.push(`"${topObstacle[0]}" came up ${topObstacle[1]} times. Plan around it — for example download materials while you have data.`);
  if (needsAttention.length > 0) suggestions.push(`${needsAttention.length} task${needsAttention.length > 1 ? 's need' : ' needs'} a decision. Open Plan to see the options.`);
  if (suggestions.length === 0) suggestions.push('Your plan matched what you did this week. Keep a similar rhythm.');

  return {
    weekStart,
    plannedMinutes,
    completedMinutes,
    actualMinutes,
    estimatedMinutes: est,
    sessionsPlanned: sessions.length,
    sessionsDone: sessions.filter((s) => s.status === 'done').length,
    sessionsMissed: missed.length,
    tasksCompleted,
    needsAttention,
    obstacles: [...obstacleCounts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    restarts,
    suggestions,
  };
}
