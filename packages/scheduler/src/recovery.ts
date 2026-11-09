import {
  addDaysToKey,
  formatDateKey,
  formatInstant,
  formatMinutes,
  formatTimeOfDay,
  localDateKey,
  type RecoveryInput,
} from '@nextstep/contracts';
import { generatePlan, planFingerprint } from './schedule.js';
import type { PlannedSession, PlannerInput, PlannerOverride, PlannerSession, PlanResult, TaskPlan } from './types.js';

export type ChangeKind = 'moved' | 'split' | 'shortened' | 'removed' | 'added';

export interface SessionRef {
  sessionId: string;
  startAt: string;
  endAt: string;
  minutes: number;
}

export interface RecoveryChange {
  kind: ChangeKind;
  taskId: string;
  taskTitle: string;
  from: SessionRef[];
  to: SessionRef[];
  why: string;
}

export interface RecoveryStateChanges {
  /** Sessions whose status changes (e.g. marked missed). */
  sessionStatus: Array<{ sessionId: string; status: 'missed' | 'skipped' }>;
  /** Day overrides to create (replacing any existing override for that date). */
  overrides: PlannerOverride[];
  /** Task field changes the student asked for (never invented by NextStep). */
  taskUpdates: Array<{ taskId: string; patch: { dueAt?: string; remainingMinutes?: number } }>;
}

export interface RecoveryProposal {
  kind: RecoveryInput['kind'];
  input: RecoveryInput;
  createdAt: string;
  /** Plan revision number the proposal was built on. */
  baseRevision: number;
  /** Fingerprint of the state the proposal was built on. */
  fingerprint: string;
  headline: string;
  subline: string;
  /** Current upcoming sessions (and the missed ones) before the change. */
  before: PlannedSession[];
  /** Proposed upcoming sessions. */
  after: PlannedSession[];
  unchanged: PlannedSession[];
  changes: RecoveryChange[];
  atRisk: TaskPlan[];
  plan: PlanResult;
  stateChanges: RecoveryStateChanges;
  /** Sessions in `before` that the proposal replaces (deleted on accept). */
  replacedSessionIds: string[];
  /** The smallest useful next step, when there is one. */
  nextAction: { sessionId: string; taskId: string; taskTitle: string; label: string | null; minutes: number; startAt: string } | null;
  strategy: 'local' | 'global';
}

const sameSlot = (a: { taskId: string; startAt: string; endAt: string }, b: { taskId: string; startAt: string; endAt: string }) =>
  a.taskId === b.taskId && a.startAt === b.startAt && a.endAt === b.endAt;

const ref = (s: PlannedSession | PlannerSession): SessionRef => ({ sessionId: s.id, startAt: s.startAt, endAt: s.endAt, minutes: s.minutes });

/** Apply the student's reported change to a copy of the planner input. */
export function applyRecoveryInput(
  state: PlannerInput,
  input: RecoveryInput,
): { modified: PlannerInput; changes: RecoveryStateChanges; affectedSessionIds: Set<string> } {
  const tz = state.preferences.timezone;
  const changes: RecoveryStateChanges = { sessionStatus: [], overrides: [], taskUpdates: [] };
  let tasks = state.tasks.map((t) => ({ ...t }));
  let sessions = state.sessions.map((s) => ({ ...s }));
  let overrides = [...(state.overrides ?? [])];
  const affected = new Set<string>();
  const upcoming = (s: PlannerSession) => !s.deletedAt && s.status === 'planned' && !s.pinned && Date.parse(s.endAt) > state.now;
  const setOverride = (o: PlannerOverride) => {
    overrides = [...overrides.filter((x) => x.date !== o.date || x.deletedAt), o];
    changes.overrides.push(o);
  };

  switch (input.kind) {
    case 'missed_session': {
      for (const id of input.sessionIds) {
        const s = sessions.find((x) => x.id === id);
        if (!s) continue;
        s.status = 'missed';
        changes.sessionStatus.push({ sessionId: id, status: 'missed' });
        affected.add(id);
        const progress = input.progressMinutes?.[id] ?? 0;
        if (progress > 0) {
          const t = tasks.find((x) => x.id === s.taskId);
          if (t) {
            const remaining = Math.max(0, t.remainingMinutes - progress);
            t.remainingMinutes = remaining;
            changes.taskUpdates.push({ taskId: t.id, patch: { remainingMinutes: remaining } });
          }
        }
      }
      break;
    }
    case 'less_time': {
      setOverride({ date: input.date, maxMinutes: input.availableMinutes, reason: `Only ${formatMinutes(input.availableMinutes)} available`, source: 'recovery' });
      for (const s of sessions) if (upcoming(s) && localDateKey(Date.parse(s.startAt), tz) === input.date) affected.add(s.id);
      break;
    }
    case 'lighter_day': {
      setOverride({ date: input.date, maxMinutes: input.maxMinutes, reason: 'Lighter day', source: 'recovery' });
      for (const s of sessions) if (upcoming(s) && localDateKey(Date.parse(s.startAt), tz) === input.date) affected.add(s.id);
      break;
    }
    case 'urgent': {
      const dates = Array.from({ length: input.days }, (_, i) => addDaysToKey(input.startDate, i));
      for (const date of dates) setOverride({ date, maxMinutes: 0, reason: input.note?.trim() || 'Something urgent came up', source: 'recovery' });
      for (const s of sessions) if (upcoming(s) && dates.includes(localDateKey(Date.parse(s.startAt), tz))) affected.add(s.id);
      break;
    }
    case 'deadline_changed': {
      const t = tasks.find((x) => x.id === input.taskId);
      if (t) {
        t.dueAt = input.newDueAt;
        changes.taskUpdates.push({ taskId: t.id, patch: { dueAt: input.newDueAt } });
        for (const s of sessions) if (upcoming(s) && s.taskId === t.id) affected.add(s.id);
      }
      break;
    }
  }
  tasks = tasks.slice();
  sessions = sessions.slice();
  return { modified: { ...state, tasks, sessions, overrides, source: 'recovery' }, changes, affectedSessionIds: affected };
}

function totalShortfall(plan: PlanResult): number {
  return plan.shortfall?.totalMinutes ?? 0;
}

function headlineFor(input: RecoveryInput, plan: PlanResult, next: RecoveryProposal['nextAction'], tz: string, moved: number): { headline: string; subline: string } {
  const risk = totalShortfall(plan) > 0 ? ' Not everything fits before its deadline — see the options below.' : '';
  const nextText = next ? `Your next step: ${formatMinutes(next.minutes)} on "${next.label ?? next.taskTitle}" at ${formatTimeOfDay(Date.parse(next.startAt), tz)}${localDateKey(Date.parse(next.startAt), tz) === localDateKey(plan.generatedAt ? Date.parse(plan.generatedAt) : 0, tz) ? '' : ` on ${formatDateKey(localDateKey(Date.parse(next.startAt), tz))}`}.` : '';
  const movedText = moved > 0 ? ` ${moved} session${moved === 1 ? '' : 's'} move${moved === 1 ? 's' : ''}.` : '';
  switch (input.kind) {
    case 'less_time':
      return { headline: 'You have less time than planned. Here are your options.', subline: `${nextText}${movedText}${risk}`.trim() };
    case 'missed_session':
      return { headline: 'You still have a next step.', subline: `Missing a session happens. Let's make the rest of your week manageable. ${nextText}${movedText}${risk}`.trim() };
    case 'deadline_changed':
      return { headline: 'Deadline updated. Here is the adjusted plan.', subline: `You confirmed the new deadline. ${nextText}${movedText}${risk}`.trim() };
    case 'urgent':
      return { headline: 'Take care of what came up. We will hold the rest.', subline: `No study is planned on the days you blocked. ${nextText}${movedText}${risk}`.trim() };
    case 'lighter_day':
      return { headline: 'A lighter day is part of a realistic plan.', subline: `${nextText}${movedText}${risk}`.trim() };
  }
}

/** Compare two session sets task by task and describe each meaningful change. */
export function diffPlans(
  before: PlannedSession[],
  after: PlannedSession[],
  taskTitle: (id: string) => string,
  why: (kind: ChangeKind, taskId: string, from: SessionRef[], to: SessionRef[]) => string,
): { unchanged: PlannedSession[]; changes: RecoveryChange[] } {
  const unchanged: PlannedSession[] = [];
  const restBefore: PlannedSession[] = [];
  const matchedAfter = new Set<PlannedSession>();
  for (const b of before) {
    const a = after.find((x) => !matchedAfter.has(x) && (x.id === b.id || sameSlot(x, b)) && b.status === 'planned');
    if (a) {
      matchedAfter.add(a);
      unchanged.push(a);
    } else restBefore.push(b);
  }
  const restAfter = after.filter((a) => !matchedAfter.has(a));
  const taskIds = [...new Set([...restBefore, ...restAfter].map((s) => s.taskId))];
  const changes: RecoveryChange[] = [];
  for (const taskId of taskIds) {
    const from = restBefore.filter((s) => s.taskId === taskId).sort((x, y) => x.startAt.localeCompare(y.startAt)).map(ref);
    const to = restAfter.filter((s) => s.taskId === taskId).sort((x, y) => x.startAt.localeCompare(y.startAt)).map(ref);
    let kind: ChangeKind;
    const fromMin = from.reduce((a, s) => a + s.minutes, 0);
    const toMin = to.reduce((a, s) => a + s.minutes, 0);
    if (from.length === 0) kind = 'added';
    else if (to.length === 0) kind = 'removed';
    else if (to.length > from.length && toMin / to.length < (fromMin / from.length) * 0.85) kind = 'split';
    else if (to.length === from.length && toMin < fromMin && to[0]!.startAt === from[0]!.startAt) kind = 'shortened';
    else kind = 'moved';
    changes.push({ kind, taskId, taskTitle: taskTitle(taskId), from, to, why: why(kind, taskId, from, to) });
  }
  const order: Record<ChangeKind, number> = { shortened: 0, split: 1, moved: 2, added: 3, removed: 4 };
  changes.sort((a, b) => order[a.kind] - order[b.kind] || (a.to[0]?.startAt ?? a.from[0]?.startAt ?? '').localeCompare(b.to[0]?.startAt ?? b.from[0]?.startAt ?? ''));
  return { unchanged, changes };
}

/**
 * Build a Recovery Mode proposal. Nothing is changed until the student
 * accepts; acceptance must check `baseRevision` and `fingerprint` first.
 *
 * Strategy: keep every unaffected session exactly where it is ("local"),
 * re-place only the displaced work, and fall back to a full reshuffle
 * ("global") only if that fits strictly more work before deadlines.
 */
export function buildRecoveryProposal(state: PlannerInput, input: RecoveryInput, baseRevision: number): RecoveryProposal {
  const tz = state.preferences.timezone;
  const fingerprint = planFingerprint(state);
  const { modified, changes: stateChanges, affectedSessionIds } = applyRecoveryInput(state, input);

  const upcomingBefore = state.sessions.filter((s) => !s.deletedAt && s.status === 'planned' && Date.parse(s.endAt) > state.now);
  const lockIds = upcomingBefore.filter((s) => !affectedSessionIds.has(s.id)).map((s) => s.id);

  const local = generatePlan({ ...modified, lockedSessionIds: lockIds });
  const global = generatePlan({ ...modified, lockedSessionIds: [] });
  const useGlobal = totalShortfall(global) < totalShortfall(local);
  const plan = useGlobal ? global : local;

  const missed = state.sessions.filter((s) => input.kind === 'missed_session' && input.sessionIds.includes(s.id));
  const before: PlannedSession[] = [
    ...missed.map((s) => ({ ...s, label: s.label ?? null, isNew: false })),
    ...upcomingBefore.map((s) => ({ ...s, label: s.label ?? null, isNew: false })),
  ].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const after = plan.sessions;

  const title = (id: string) => state.tasks.find((t) => t.id === id)?.title ?? 'Task';
  const taskPlan = (id: string) => plan.tasks.find((t) => t.taskId === id);
  const dayText = (iso: string) => formatInstant(Date.parse(iso), tz);
  const why = (kind: ChangeKind, taskId: string, from: SessionRef[], to: SessionRef[]): string => {
    const tp = taskPlan(taskId);
    const risk = tp && (tp.status === 'at_risk' || tp.status === 'blocked') ? ` ${tp.explanation}` : '';
    const wasMissed = from.some((f) => missed.some((m) => m.id === f.sessionId));
    const directlyAffected = from.some((f) => affectedSessionIds.has(f.sessionId));
    const isGoal = !!state.tasks.find((t) => t.id === taskId)?.goalId;
    switch (kind) {
      case 'shortened':
        return `Shortened to ${formatMinutes(to[0]!.minutes)} so it fits the time you have — a smaller step still counts.${risk}`;
      case 'split':
        return `Split into ${to.length} shorter sessions so it fits ${directlyAffected ? 'around your reduced time' : 'around the other changes'}.${risk}`;
      case 'added':
        if (wasMissed) return `Catching up on the missed work.${risk}`;
        if (isGoal) return 'Personal goal time, fitted around your academic work.';
        return `New session for work that no longer fits where it was${to[0] ? ` — ${dayText(to[0].startAt)}` : ''}.${risk}`;
      case 'removed':
        return tp && tp.status !== 'at_risk' && tp.status !== 'blocked'
          ? 'No longer needed here — the remaining work is covered by other sessions.'
          : `Doesn't fit any more.${risk || ' It stays on your list so you can decide what to do.'}`;
      case 'moved':
      default: {
        const fromMin = from.reduce((a, f) => a + f.minutes, 0);
        const toMin = to.reduce((a, f) => a + f.minutes, 0);
        const extra = toMin > fromMin ? ` It also picks up ${formatMinutes(toMin - fromMin)} of work from sessions that didn't happen.` : '';
        const fewer = toMin < fromMin && !risk ? ` ${formatMinutes(fromMin - toMin)} less is needed here now.` : '';
        return movedWhy() + extra + fewer;
      }
    }
    function movedWhy(): string {
      {
        if (wasMissed) return `Catching up on the missed session: moved to ${to[0] ? dayText(to[0].startAt) : 'later'}.${risk}`;
        if (!directlyAffected) return `Moved to ${to[0] ? dayText(to[0].startAt) : 'later'} to make room for work due sooner.${risk}`;
        if (input.kind === 'less_time' || input.kind === 'lighter_day')
          return `${formatDateKey(input.date)} now has ${formatMinutes(input.kind === 'less_time' ? input.availableMinutes : input.maxMinutes)}, so this moves to ${to[0] ? dayText(to[0].startAt) : 'later'}.${risk}`;
        if (input.kind === 'urgent') return `Moved out of the days you blocked, to ${to[0] ? dayText(to[0].startAt) : 'later'}.${risk}`;
        if (input.kind === 'deadline_changed') return `Follows the new deadline: now ${to[0] ? dayText(to[0].startAt) : 'later'}.${risk}`;
        return useGlobal ? `Reshuffled to make room for more urgent work.${risk}` : `Moved to ${to[0] ? dayText(to[0].startAt) : 'later'}.${risk}`;
      }
    }
  };

  const { unchanged, changes } = diffPlans(before, after, title, why);
  const nextSession = after.find((s) => s.status === 'planned' && Date.parse(s.endAt) > state.now) ?? null;
  const nextAction = nextSession
    ? { sessionId: nextSession.id, taskId: nextSession.taskId, taskTitle: title(nextSession.taskId), label: nextSession.label, minutes: nextSession.minutes, startAt: nextSession.startAt }
    : null;
  const keptIds = new Set(after.map((s) => s.id));
  const replacedSessionIds = upcomingBefore.filter((s) => !s.pinned && !keptIds.has(s.id)).map((s) => s.id);
  const moved = changes.filter((c) => c.kind !== 'added').length;
  const { headline, subline } = headlineFor(input, plan, nextAction, tz, moved);

  return {
    kind: input.kind,
    input,
    createdAt: new Date(state.now).toISOString(),
    baseRevision,
    fingerprint,
    headline,
    subline,
    before,
    after,
    unchanged,
    changes,
    atRisk: plan.tasks.filter((t) => t.status === 'at_risk' || t.status === 'blocked'),
    plan,
    stateChanges,
    replacedSessionIds,
    nextAction,
    strategy: useGlobal ? 'global' : 'local',
  };
}

export type StaleReason = 'revision_changed' | 'inputs_changed' | 'sessions_in_past';

/**
 * A preview is stale if the plan revision moved on, any planning input changed
 * since it was built, or its next session now starts in the past.
 */
export function checkProposalFresh(
  proposal: Pick<RecoveryProposal, 'baseRevision' | 'fingerprint' | 'plan'>,
  current: PlannerInput,
  currentRevision: number,
): { fresh: true } | { fresh: false; reason: StaleReason } {
  if (currentRevision !== proposal.baseRevision) return { fresh: false, reason: 'revision_changed' };
  if (planFingerprint(current) !== proposal.fingerprint) return { fresh: false, reason: 'inputs_changed' };
  const graceMs = 5 * 60_000;
  if (proposal.plan.newSessions.some((s) => Date.parse(s.startAt) < current.now - graceMs)) return { fresh: false, reason: 'sessions_in_past' };
  return { fresh: true };
}
