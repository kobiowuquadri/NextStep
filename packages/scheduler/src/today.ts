import { localDateKey } from '@nextstep/contracts';
import { reasonsFor, scoreTask } from './priority.js';
import type { PlannerInput, PlannerSession, PlannerSubtask, PlannerTask } from './types.js';

/**
 * Labels for the sessions still ahead: a task's open steps, in order, mapped onto
 * its remaining planned sessions. Labels stored at planning time go stale when an
 * earlier session is missed or a step is ticked off early, so views use these.
 * Tasks without any steps are left out (callers fall back to the stored label).
 */
export function currentSessionLabels(
  sessions: readonly PlannerSession[],
  subtasks: readonly PlannerSubtask[] | undefined,
  now: number,
): Map<string, string | null> {
  const withSteps = new Set<string>();
  const open = new Map<string, string[]>();
  for (const st of [...(subtasks ?? [])].filter((x) => !x.deletedAt).sort((a, b) => a.position - b.position)) {
    withSteps.add(st.taskId);
    if (st.done) continue;
    if (!open.has(st.taskId)) open.set(st.taskId, []);
    open.get(st.taskId)!.push(st.title);
  }
  const used = new Map<string, number>();
  const out = new Map<string, string | null>();
  const remaining = sessions
    .filter((s) => !s.deletedAt && s.status === 'planned' && Date.parse(s.endAt) > now && withSteps.has(s.taskId))
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id));
  for (const s of remaining) {
    const i = used.get(s.taskId) ?? 0;
    out.set(s.id, open.get(s.taskId)?.[i] ?? null);
    used.set(s.taskId, i + 1);
  }
  return out;
}

export interface TodayAction {
  kind: 'session' | 'optional_extra';
  sessionId: string | null;
  taskId: string;
  title: string;
  label: string | null;
  minutes: number;
  startAt: string | null;
  endAt: string | null;
  reasons: string[];
  inProgress: boolean;
}

export interface TodayView {
  date: string;
  /** Realistic actions for today: only what is actually planned, never padded to a quota. */
  actions: TodayAction[];
  doneSessions: number;
  doneMinutes: number;
  plannedMinutes: number;
  /** True when everything planned for today is finished. */
  completedForToday: boolean;
  /** True when nothing was planned today (rest day, lighter day, or no availability). */
  restDay: boolean;
  missedEarlier: PlannerSession[];
  upcomingDeadlines: Array<{ taskId: string; title: string; dueAt: string; status: PlannerTask['status'] }>;
}

/**
 * @param replannedAt  When the student last accepted a Recovery Mode plan (engine `lastRecoveryAt`).
 *                     Sessions that ended before that were reviewed there, so they aren't flagged as
 *                     missed again. Automatic replans must not be passed here.
 */
export function buildToday(input: PlannerInput, maxActions = 3, replannedAt?: number): TodayView {
  const tz = input.preferences.timezone;
  const today = localDateKey(input.now, tz);
  const tasks = new Map(input.tasks.filter((t) => !t.deletedAt).map((t) => [t.id, t]));
  const sessionsToday = input.sessions
    .filter((s) => !s.deletedAt && tasks.has(s.taskId) && localDateKey(Date.parse(s.startAt), tz) === today)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const done = sessionsToday.filter((s) => s.status === 'done');
  const remaining = sessionsToday.filter((s) => s.status === 'planned' && Date.parse(s.endAt) > input.now);
  const missedEarlier = input.sessions.filter(
    (s) => !s.deletedAt && s.status === 'planned' && Date.parse(s.endAt) <= input.now && Date.parse(s.endAt) > input.now - 3 * 86_400_000 && (replannedAt === undefined || Date.parse(s.endAt) > replannedAt) && tasks.get(s.taskId)?.status !== 'done',
  );
  const dependents = (id: string) => input.tasks.filter((t) => (t.dependsOn ?? []).includes(id));
  const deps = (t: PlannerTask) => (t.dependsOn ?? []).map((d) => tasks.get(d)).filter((x): x is PlannerTask => !!x);

  const labels = currentSessionLabels(input.sessions, input.subtasks, input.now);
  const actions: TodayAction[] = remaining.slice(0, maxActions).map((s) => {
    const t = tasks.get(s.taskId)!;
    return {
      kind: 'session',
      sessionId: s.id,
      taskId: t.id,
      title: t.title,
      label: labels.has(s.id) ? labels.get(s.id)! : (s.label ?? null),
      minutes: s.minutes,
      startAt: s.startAt,
      endAt: s.endAt,
      reasons: reasonsFor(t, input.now, tz, dependents(t.id), deps(t)),
      inProgress: Date.parse(s.startAt) <= input.now,
    };
  });

  const upcomingDeadlines = [...tasks.values()]
    .filter((t) => t.dueAt && Date.parse(t.dueAt) > input.now && t.status !== 'done' && t.status !== 'archived')
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
    .slice(0, 4)
    .map((t) => ({ taskId: t.id, title: t.title, dueAt: t.dueAt!, status: t.status }));

  return {
    date: today,
    actions,
    doneSessions: done.length,
    doneMinutes: done.reduce((a, s) => a + s.minutes, 0),
    plannedMinutes: sessionsToday.filter((s) => s.status !== 'skipped').reduce((a, s) => a + s.minutes, 0),
    completedForToday: done.length > 0 && remaining.length === 0,
    restDay: sessionsToday.length === 0,
    missedEarlier,
    upcomingDeadlines,
  };
}

/** Highest-priority open task, for an optional "if you have energy" suggestion. Never added automatically. */
export function optionalExtra(input: PlannerInput): PlannerTask | null {
  const open = input.tasks.filter((t) => !t.deletedAt && t.status !== 'done' && t.status !== 'archived' && t.remainingMinutes > 0 && !t.goalId);
  const dependents = (id: string) => input.tasks.filter((t) => (t.dependsOn ?? []).includes(id));
  const ranked = open
    .filter((t) => (t.dependsOn ?? []).every((d) => input.tasks.find((x) => x.id === d)?.status === 'done' || !input.tasks.find((x) => x.id === d)))
    .map((t) => ({ t, s: scoreTask(t, input.now, dependents(t.id)) }))
    .sort((a, b) => b.s - a.s || a.t.id.localeCompare(b.t.id));
  return ranked[0]?.t ?? null;
}
