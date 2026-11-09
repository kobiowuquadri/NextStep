import { useMemo } from 'react';
import { addDaysToKey, commitmentOccursOnDate, localDateKey, type Course, type Task } from './shared';
import { lastRecoveryAt, live, toPlannerInput, type AppState } from '@nextstep/engine';
import { buildToday, currentSessionLabels, generatePlan, type PlanResult, type TaskPlan } from '@nextstep/scheduler';
import { ACHIEVEMENTS, levelFromXp, questsFor, steadyWeeks, totalXp, unlockedCosmetics, type LedgerEntry } from '@nextstep/gamification';
import { useDemo } from './store';

export function useDerived() {
  const { app, clock } = useDemo();
  return useMemo(() => derive(app, clock), [app, clock]);
}

export function derive(app: AppState, clock: number) {
  const tz = app.preferences.timezone;
  const input = toPlannerInput(app, clock);
  const today = buildToday(input, 3, lastRecoveryAt(app));
  const labels = currentSessionLabels(input.sessions, input.subtasks, clock);
  /** The step a session is for right now (stored labels go stale after missed sessions). */
  const labelOf = (s: { id: string; label?: string | null }): string | null => (labels.has(s.id) ? labels.get(s.id)! : (s.label ?? null));
  const analysis: PlanResult = generatePlan(input);
  const ledger = live(app.events) as LedgerEntry[];
  const xp = totalXp(ledger);
  const level = levelFromXp(xp);
  const day = localDateKey(clock, tz);
  const steady = steadyWeeks(ledger, day, app.preferences.weeklyActiveDaysGoal);
  const lightDay = live(app.overrides).some((o) => o.date === day && o.maxMinutes !== null && o.maxMinutes < app.preferences.dailyLimitMinutes / 2);
  const quests = questsFor(ledger, day, { hasActiveGoal: live(app.goals).some((g) => g.active), lightDay });
  const unlockedIds = new Set(live(app.achievements).map((a) => a.achievementId));
  const cosmetics = unlockedCosmetics(level.level, unlockedIds);
  const courses = new Map(live(app.courses).map((c) => [c.id, c]));
  const tasks = new Map(live(app.tasks).map((t) => [t.id, t]));
  const taskPlans = new Map<string, TaskPlan>(analysis.tasks.map((t) => [t.taskId, t]));
  const week = Array.from({ length: 7 }, (_, i) => addDaysToKey(day, i));
  return { tz, day, week, today, labelOf, analysis, ledger, xp, level, steady, quests, unlockedIds, cosmetics, courses, tasks, taskPlans, achievements: ACHIEVEMENTS };
}

export type Derived = ReturnType<typeof derive>;

export function courseOf(d: Derived, task: Task | undefined): Course | undefined {
  return task?.courseId ? d.courses.get(task.courseId) : undefined;
}

export function commitmentsOn(app: AppState, date: string) {
  return live(app.commitments)
    .filter((c) => commitmentOccursOnDate(c, date))
    .sort((a, b) => a.start.localeCompare(b.start));
}
