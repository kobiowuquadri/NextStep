import { useMemo } from 'react';
import { addDaysToKey, localDateKey, weekStartOfKey } from '@nextstep/contracts';
import { lastRecoveryAt, live, toPlannerInput, type AppState } from '@nextstep/engine';
import { ACHIEVEMENTS, levelFromXp, questsFor, steadyWeeks, totalXp, unlockedCosmetics, type LedgerEntry } from '@nextstep/gamification';
import { buildToday, currentSessionLabels, generatePlan, type TaskPlan } from '@nextstep/scheduler';
import { useApp } from './store';

export function derive(state: AppState, now: number) {
  const tz = state.preferences.timezone;
  const day = localDateKey(now, tz);
  const input = toPlannerInput(state, now);
  const today = buildToday(input, 3, lastRecoveryAt(state));
  const labels = currentSessionLabels(input.sessions, input.subtasks, now);
  /** The step a session is for right now (stored labels go stale after missed sessions). */
  const labelOf = (s: { id: string; label?: string | null }): string | null => (labels.has(s.id) ? labels.get(s.id)! : (s.label ?? null));
  const analysis = generatePlan(input);
  const ledger = (live(state.events) as LedgerEntry[]).filter((e) => e.status !== 'rejected');
  const xp = totalXp(ledger);
  const pendingXp = ledger.filter((e) => e.status === 'pending').reduce((a, e) => a + e.xp, 0);
  const level = levelFromXp(xp);
  const steady = steadyWeeks(ledger, day, state.preferences.weeklyActiveDaysGoal);
  const lightDay = live(state.overrides).some((o) => o.date === day && o.maxMinutes !== null && o.maxMinutes < state.preferences.dailyLimitMinutes / 2);
  const quests = questsFor(ledger, day, { hasActiveGoal: live(state.goals).some((g) => g.active), lightDay });
  const unlockedIds = new Set(live(state.achievements).map((a) => a.achievementId));
  return {
    tz,
    day,
    weekStart: weekStartOfKey(day),
    week: Array.from({ length: 7 }, (_, i) => addDaysToKey(day, i)),
    today,
    labelOf,
    analysis,
    ledger,
    xp,
    pendingXp,
    level,
    steady,
    quests,
    unlockedIds,
    achievements: ACHIEVEMENTS,
    cosmetics: unlockedCosmetics(level.level, unlockedIds),
    courses: new Map(live(state.courses).map((c) => [c.id, c])),
    tasks: new Map(live(state.tasks).map((t) => [t.id, t])),
    taskPlans: new Map<string, TaskPlan>(analysis.tasks.map((t) => [t.taskId, t])),
  };
}

export type Derived = ReturnType<typeof derive>;

/** Derived view data; recomputed when state changes (and each minute via `tick`). */
export function useDerived(tick = 0): Derived | null {
  const state = useApp((s) => s.state);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (state ? derive(state, Date.now()) : null), [state, tick]);
}
