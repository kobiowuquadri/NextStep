import {
  DEFAULT_PREFERENCES,
  localDateKey,
  weekStartKey,
  type AvailabilityRule,
  type Commitment,
  type Course,
  type GamificationEvent,
  type PersonalGoal,
  type PlanRevision,
  type Preferences,
  type RecoveryInput,
  type ScheduledSession,
  type Subtask,
  type Task,
} from '@nextstep/contracts';
import {
  ACHIEVEMENTS,
  daysAway,
  evaluateAchievements,
  evaluateAward,
  levelFromXp,
  questsFor,
  steadyWeeks,
  totalXp,
  type AchievementDef,
  type AwardRequest,
  type LedgerEntry,
} from '@nextstep/gamification';
import {
  buildRecoveryProposal,
  checkProposalFresh,
  generatePlan,
  type PlanResult,
  type RecoveryProposal,
  type StaleReason,
} from '@nextstep/scheduler';
import {
  applyMutations,
  currentRevision,
  live,
  tombstone,
  toPlannerInput,
  upsert,
  type AppState,
  type Ctx,
  type Mutation,
} from './state.js';

export interface ActionResult {
  state: AppState;
  /** Persist these in one local transaction, then enqueue them for sync. */
  mutations: Mutation[];
  awards: Array<{ entry: GamificationEvent; result: 'awarded' | 'capped' }>;
  unlocked: AchievementDef[];
  levelUp: { from: number; to: number } | null;
}

export type ActionError = { error: 'NOT_FOUND' | 'STALE_PREVIEW' | 'INVALID'; reason?: StaleReason | string };

const iso = (ctx: Ctx) => new Date(ctx.now).toISOString();
const today = (state: AppState, ctx: Ctx) => localDateKey(ctx.now, state.preferences.timezone);
const nn = <T>(x: T | null): x is T => x !== null;

/**
 * Apply mutations, then evaluate awards, quests and achievements. Awards are
 * appended to the ledger as pending events with unique dedupe keys.
 */
function finalize(state: AppState, mutations: Mutation[], awardReqs: Array<Omit<AwardRequest, 'occurredAt' | 'localDate'>>, ctx: Ctx): ActionResult {
  let s = applyMutations(state, mutations);
  const all = [...mutations];
  const awards: ActionResult['awards'] = [];
  const beforeLevel = levelFromXp(totalXp(live(state.events) as LedgerEntry[])).level;
  const day = today(state, ctx);

  const award = (req: Omit<AwardRequest, 'occurredAt' | 'localDate'>) => {
    const out = evaluateAward(live(s.events) as LedgerEntry[], { ...req, occurredAt: iso(ctx), localDate: day }, ctx.newId());
    if (out.result === 'duplicate') return;
    const m = upsert(s, 'gamificationEvent', out.entry as unknown as Record<string, unknown>, ctx);
    s = applyMutations(s, [m]);
    all.push(m);
    awards.push({ entry: m.record as unknown as GamificationEvent, result: out.result });
  };
  for (const r of awardReqs) award(r);

  // Quests: claim any newly completed quest exactly once.
  if (awardReqs.length > 0) {
    const lightDay = live(s.overrides).some((o) => o.date === day && o.maxMinutes !== null && o.maxMinutes < s.preferences.dailyLimitMinutes / 2);
    const quests = questsFor(live(s.events) as LedgerEntry[], day, { hasActiveGoal: live(s.goals).some((g) => g.active), lightDay });
    for (const q of [...quests.daily, ...quests.weekly]) {
      if (q.complete && !q.claimed) award({ type: 'quest_completed', data: { questInstanceId: q.instanceId, questXp: q.def.xp } });
    }
  }

  // Achievements.
  const ledger = live(s.events) as LedgerEntry[];
  const level = levelFromXp(totalXp(ledger)).level;
  const have = new Set(live(s.achievements).map((a) => a.achievementId));
  const unlocked = evaluateAchievements({ ledger, level, steady: steadyWeeks(ledger, day, s.preferences.weeklyActiveDaysGoal) }, have);
  for (const a of unlocked) {
    const m = upsert(s, 'userAchievement', { id: ctx.newId(), achievementId: a.id, unlockedAt: iso(ctx) }, ctx);
    s = applyMutations(s, [m]);
    all.push(m);
  }
  return { state: s, mutations: all, awards, unlocked, levelUp: level > beforeLevel ? { from: beforeLevel, to: level } : null };
}

const noAwards = (state: AppState, mutations: Mutation[], ctx: Ctx) => finalize(state, mutations, [], ctx);

// ─── Preferences, courses, availability ────────────────────────────────────

export function updatePreferences(state: AppState, patch: Partial<Preferences>, ctx: Ctx): ActionResult {
  return noAwards(state, [upsert(state, 'preferences', { ...patch, id: state.preferences.id }, ctx)], ctx);
}

export function newPreferences(id: string, displayName: string, timezone: string, now: number): Preferences {
  const t = new Date(now).toISOString();
  return { ...DEFAULT_PREFERENCES, id, displayName, timezone, createdAt: t, updatedAt: t, deletedAt: null };
}

export function saveCourse(state: AppState, input: Partial<Course> & { title: string; color: string }, ctx: Ctx): ActionResult {
  const id = input.id ?? ctx.newId();
  return noAwards(state, [upsert(state, 'course', { code: null, semesterId: null, ...input, id }, ctx)], ctx);
}

export function deleteCourse(state: AppState, id: string, ctx: Ctx): ActionResult {
  const m = [tombstone(state, 'course', id, ctx)].filter(nn);
  // Tasks keep existing; they simply lose their course link.
  for (const t of live(state.tasks).filter((t) => t.courseId === id)) m.push(upsert(state, 'task', { id: t.id, courseId: null }, ctx));
  return noAwards(state, m, ctx);
}

export function saveAvailability(state: AppState, input: Partial<AvailabilityRule> & Pick<AvailabilityRule, 'weekday' | 'start' | 'end'>, ctx: Ctx): ActionResult {
  return noAwards(state, [upsert(state, 'availability', { online: true, label: null, ...input, id: input.id ?? ctx.newId() }, ctx)], ctx);
}

export function saveCommitment(state: AppState, input: Partial<Commitment> & Pick<Commitment, 'title' | 'kind' | 'start' | 'end'>, ctx: Ctx): ActionResult {
  return noAwards(state, [upsert(state, 'commitment', { weekdays: [], date: null, protected: input.kind === 'rest' || input.kind === 'worship', ...input, id: input.id ?? ctx.newId() }, ctx)], ctx);
}

export function deleteRecord(state: AppState, entity: 'availability' | 'commitment' | 'dayOverride' | 'semester', id: string, ctx: Ctx): ActionResult {
  return noAwards(state, [tombstone(state, entity, id, ctx)].filter(nn), ctx);
}

// ─── Tasks & subtasks ──────────────────────────────────────────────────────

export type TaskInput = Partial<Task> & Pick<Task, 'title' | 'kind' | 'estimatedMinutes'>;

export function createTask(state: AppState, input: TaskInput, ctx: Ctx, subtaskTitles: string[] = []): ActionResult {
  const id = input.id ?? ctx.newId();
  const task: Record<string, unknown> = {
    description: null,
    courseId: null,
    goalId: null,
    dueAt: null,
    importance: 2,
    status: 'todo',
    dependsOn: [],
    preferredSessionMinutes: null,
    splittable: true,
    optional: false,
    connectivity: 'any',
    links: [],
    resourceIds: [],
    completedAt: null,
    remainingMinutes: input.estimatedMinutes,
    ...input,
    id,
  };
  const m = [upsert(state, 'task', task, ctx)];
  subtaskTitles
    .map((t) => t.trim())
    .filter(Boolean)
    .forEach((title, position) => m.push(upsert(state, 'subtask', { id: ctx.newId(), taskId: id, title, done: false, position, estimatedMinutes: null, completedAt: null }, ctx)));
  return noAwards(state, m, ctx);
}

/** Edit a task. Deadlines only ever change here, by the student. */
export function updateTask(state: AppState, id: string, patch: Partial<Task>, ctx: Ctx): ActionResult | ActionError {
  const t = state.tasks.find((x) => x.id === id && !x.deletedAt);
  if (!t) return { error: 'NOT_FOUND' };
  const next = { ...patch, id };
  if (patch.estimatedMinutes !== undefined && patch.remainingMinutes === undefined && t.remainingMinutes === t.estimatedMinutes) next.remainingMinutes = patch.estimatedMinutes;
  return noAwards(state, [upsert(state, 'task', next, ctx)], ctx);
}

export function deleteTask(state: AppState, id: string, ctx: Ctx): ActionResult {
  const m: Mutation[] = [tombstone(state, 'task', id, ctx)].filter(nn);
  for (const st of live(state.subtasks).filter((x) => x.taskId === id)) m.push(tombstone(state, 'subtask', st.id, ctx)!);
  for (const s of live(state.sessions).filter((x) => x.taskId === id && x.status === 'planned')) m.push(tombstone(state, 'session', s.id, ctx)!);
  for (const other of live(state.tasks).filter((x) => x.dependsOn.includes(id))) m.push(upsert(state, 'task', { id: other.id, dependsOn: other.dependsOn.filter((d) => d !== id) }, ctx));
  return noAwards(state, m, ctx);
}

export function addSubtask(state: AppState, taskId: string, title: string, ctx: Ctx): ActionResult {
  const position = live(state.subtasks).filter((s) => s.taskId === taskId).reduce((m, s) => Math.max(m, s.position + 1), 0);
  return noAwards(state, [upsert(state, 'subtask', { id: ctx.newId(), taskId, title: title.trim(), done: false, position, estimatedMinutes: null, completedAt: null }, ctx)], ctx);
}

/** Accepted recovery proposals whose next action this activity completes. */
function recoveryNextActionHits(state: AppState, hit: { sessionId?: string; taskId?: string; subtaskTitle?: string }): string[] {
  return live(state.proposals)
    .filter((p) => p.status === 'accepted' && !p.nextActionCompletedAt && p.nextActionSessionId)
    .filter((p) => {
      const session = state.sessions.find((s) => s.id === p.nextActionSessionId);
      if (!session) return false;
      if (hit.sessionId && hit.sessionId === session.id) return true;
      if (hit.taskId && hit.taskId === session.taskId && !hit.subtaskTitle) return true;
      return !!hit.subtaskTitle && !!session.label && hit.subtaskTitle === session.label && hit.taskId === session.taskId;
    })
    .map((p) => p.id);
}

function nextActionMutations(state: AppState, proposalIds: string[], ctx: Ctx) {
  const mutations = proposalIds.map((id) => upsert(state, 'recoveryProposal', { id, nextActionCompletedAt: iso(ctx) }, ctx));
  const awards = proposalIds.map((proposalId) => ({ type: 'recovery_next_action' as const, data: { proposalId } }));
  return { mutations, awards };
}

export function toggleSubtask(state: AppState, subtaskId: string, done: boolean, ctx: Ctx): ActionResult | ActionError {
  const st = state.subtasks.find((s) => s.id === subtaskId && !s.deletedAt);
  if (!st) return { error: 'NOT_FOUND' };
  const m = [upsert(state, 'subtask', { id: subtaskId, done, completedAt: done ? iso(ctx) : null }, ctx)];
  const task = state.tasks.find((t) => t.id === st.taskId);
  if (done && task && task.status === 'todo') m.push(upsert(state, 'task', { id: task.id, status: 'in_progress' }, ctx));
  const awards: Array<Omit<AwardRequest, 'occurredAt' | 'localDate'>> = [];
  if (done) {
    awards.push({ type: 'subtask_completed', data: { subtaskId, taskId: st.taskId } });
    const hits = recoveryNextActionHits(state, { taskId: st.taskId, subtaskTitle: st.title });
    const n = nextActionMutations(state, hits, ctx);
    m.push(...n.mutations);
    awards.push(...n.awards);
  }
  return finalize(state, m, awards, ctx);
}

export function completeTask(state: AppState, taskId: string, ctx: Ctx): ActionResult | ActionError {
  const t = state.tasks.find((x) => x.id === taskId && !x.deletedAt);
  if (!t) return { error: 'NOT_FOUND' };
  const m: Mutation[] = [upsert(state, 'task', { id: taskId, status: 'done', remainingMinutes: 0, completedAt: iso(ctx) }, ctx)];
  // Future planned sessions for a finished task are no longer needed.
  for (const s of live(state.sessions).filter((s) => s.taskId === taskId && s.status === 'planned' && Date.parse(s.startAt) > ctx.now)) m.push(tombstone(state, 'session', s.id, ctx)!);
  const ageMinutes = Math.round((ctx.now - Date.parse(t.createdAt)) / 60000);
  const awards: Array<Omit<AwardRequest, 'occurredAt' | 'localDate'>> = [
    { type: 'task_completed', data: { taskId, estimatedMinutes: t.estimatedMinutes, taskAgeMinutes: ageMinutes } },
  ];
  if (t.goalId) awards.length = 0; // goal tasks earn through goal check-ins instead
  const n = nextActionMutations(state, recoveryNextActionHits(state, { taskId }), ctx);
  m.push(...n.mutations);
  awards.push(...n.awards);
  return finalize(state, m, awards, ctx);
}

/** Reopen a task. XP already earned stays; completing again earns nothing extra. */
export function reopenTask(state: AppState, taskId: string, remainingMinutes: number, ctx: Ctx): ActionResult {
  return noAwards(state, [upsert(state, 'task', { id: taskId, status: 'in_progress', remainingMinutes, completedAt: null }, ctx)], ctx);
}

// ─── Planning ──────────────────────────────────────────────────────────────

function sessionRecord(s: { id: string; taskId: string; startAt: string; endAt: string; minutes: number; label: string | null; source: string }, revisionId: string) {
  return { id: s.id, taskId: s.taskId, startAt: s.startAt, endAt: s.endAt, minutes: s.minutes, status: 'planned', pinned: false, source: s.source, planRevisionId: revisionId, label: s.label };
}

/** Generate (or regenerate) the automatic plan and record it as a new plan revision. */
export function generatePlanAction(state: AppState, ctx: Ctx): { result: ActionResult; plan: PlanResult } {
  const plan = generatePlan(toPlannerInput(state, ctx.now));
  const newIds = new Set(plan.newSessions.map((s) => s.id));
  const replaceable = live(state.sessions).filter((s) => s.status === 'planned' && !s.pinned && Date.parse(s.startAt) > ctx.now);
  const revisionId = ctx.newId();
  const m: Mutation[] = [];
  const replaced: Record<string, unknown>[] = [];
  for (const s of replaceable) {
    if (newIds.has(s.id)) continue;
    replaced.push({ _kind: 'session', ...s });
    m.push(tombstone(state, 'session', s.id, ctx)!);
  }
  for (const s of plan.newSessions) {
    const existing = state.sessions.find((x) => x.id === s.id && !x.deletedAt && x.status === 'planned');
    if (existing && existing.startAt === s.startAt && existing.endAt === s.endAt && existing.label === s.label) continue;
    m.push(upsert(state, 'session', sessionRecord(s, revisionId), ctx));
  }
  const number = currentRevision(state) + 1;
  const revision: Omit<PlanRevision, 'createdAt' | 'updatedAt'> = {
    id: revisionId,
    number,
    parentNumber: number - 1,
    reason: number === 1 ? 'initial' : 'replan',
    summary: `${plan.newSessions.length} sessions planned${plan.shortfall ? `; ${plan.shortfall.totalMinutes} min does not fit` : ''}.`,
    replacedSessions: replaced,
    createdSessionIds: plan.newSessions.map((s) => s.id),
    proposalId: null,
    undoneAt: null,
  };
  // The revision goes first so sessions never reference a revision that doesn't exist yet.
  m.unshift(upsert(state, 'planRevision', revision as unknown as Record<string, unknown>, ctx));
  return { result: finalize(state, m, [{ type: 'plan_created', data: {} }], ctx), plan };
}

/** Manual planning: the student places a session themselves. Manual sessions are pinned. */
export function addManualSession(state: AppState, input: { taskId: string; startAt: string; endAt: string; label?: string | null }, ctx: Ctx): ActionResult {
  const minutes = Math.round((Date.parse(input.endAt) - Date.parse(input.startAt)) / 60000);
  return noAwards(
    state,
    [upsert(state, 'session', { id: ctx.newId(), taskId: input.taskId, startAt: input.startAt, endAt: input.endAt, minutes, status: 'planned', pinned: true, source: 'manual', planRevisionId: null, label: input.label ?? null }, ctx)],
    ctx,
  );
}

export function setSessionPinned(state: AppState, sessionId: string, pinned: boolean, ctx: Ctx): ActionResult {
  return noAwards(state, [upsert(state, 'session', { id: sessionId, pinned }, ctx)], ctx);
}

export function moveSession(state: AppState, sessionId: string, startAt: string, endAt: string, ctx: Ctx): ActionResult {
  const minutes = Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60000);
  return noAwards(state, [upsert(state, 'session', { id: sessionId, startAt, endAt, minutes, pinned: true, source: 'manual' }, ctx)], ctx);
}

export function deleteSession(state: AppState, sessionId: string, ctx: Ctx): ActionResult {
  return noAwards(state, [tombstone(state, 'session', sessionId, ctx)].filter(nn), ctx);
}

export function markSessionMissed(state: AppState, sessionId: string, ctx: Ctx): ActionResult {
  return noAwards(state, [upsert(state, 'session', { id: sessionId, status: 'missed' }, ctx)], ctx);
}

// ─── Recovery Mode ─────────────────────────────────────────────────────────

export function previewRecovery(state: AppState, input: RecoveryInput, ctx: Ctx): RecoveryProposal {
  return buildRecoveryProposal(toPlannerInput(state, ctx.now), input, currentRevision(state));
}

/**
 * Accept a proposal atomically. Refuses (STALE_PREVIEW) if anything relevant
 * changed since the preview was built — the caller regenerates and asks again.
 */
export function acceptRecovery(state: AppState, proposal: RecoveryProposal, ctx: Ctx): ActionResult | ActionError {
  const fresh = checkProposalFresh(proposal, toPlannerInput(state, ctx.now), currentRevision(state));
  if (!fresh.fresh) return { error: 'STALE_PREVIEW', reason: fresh.reason };

  const revisionId = ctx.newId();
  const proposalId = ctx.newId();
  const m: Mutation[] = [];
  const snapshot: Record<string, unknown>[] = [];

  for (const { sessionId, status } of proposal.stateChanges.sessionStatus) {
    const prev = state.sessions.find((s) => s.id === sessionId);
    if (prev) snapshot.push({ _kind: 'session', ...prev });
    m.push(upsert(state, 'session', { id: sessionId, status }, ctx));
  }
  for (const o of proposal.stateChanges.overrides) {
    for (const old of live(state.overrides).filter((x) => x.date === o.date)) {
      snapshot.push({ _kind: 'override', ...old });
      m.push(tombstone(state, 'dayOverride', old.id, ctx)!);
    }
    const id = ctx.newId();
    snapshot.push({ _kind: 'createdOverride', id });
    m.push(upsert(state, 'dayOverride', { id, date: o.date, maxMinutes: o.maxMinutes, windows: o.windows ?? null, reason: o.reason ?? 'Recovery', source: 'recovery' }, ctx));
  }
  for (const { taskId, patch } of proposal.stateChanges.taskUpdates) {
    const prev = state.tasks.find((t) => t.id === taskId);
    if (prev) snapshot.push({ _kind: 'task', ...prev });
    m.push(upsert(state, 'task', { id: taskId, ...patch }, ctx));
  }
  for (const id of proposal.replacedSessionIds) {
    const prev = state.sessions.find((s) => s.id === id);
    if (prev) snapshot.push({ _kind: 'session', ...prev });
    const t = tombstone(state, 'session', id, ctx);
    if (t) m.push(t);
  }
  for (const s of proposal.plan.newSessions) m.push(upsert(state, 'session', sessionRecord({ ...s, source: 'recovery' }, revisionId), ctx));

  const number = currentRevision(state) + 1;
  m.push(
    upsert(state, 'planRevision', {
      id: revisionId,
      number,
      parentNumber: number - 1,
      reason: 'recovery',
      summary: proposal.headline,
      replacedSessions: snapshot,
      createdSessionIds: proposal.plan.newSessions.map((s) => s.id),
      proposalId,
      undoneAt: null,
    }, ctx),
  );
  m.push(
    upsert(state, 'recoveryProposal', {
      id: proposalId,
      kind: proposal.kind,
      input: proposal.input as unknown as Record<string, unknown>,
      baseRevision: proposal.baseRevision,
      fingerprint: proposal.fingerprint,
      status: 'accepted',
      summary: proposal.headline,
      nextActionSessionId: proposal.nextAction?.sessionId ?? null,
      nextActionCompletedAt: null,
      acceptedAt: iso(ctx),
    }, ctx),
  );
  return finalize(state, m, [{ type: 'recovery_accepted', data: { proposalId } }], ctx);
}

/** "Keep my current plan": recorded for reflection, nothing else changes. */
export function keepCurrentPlan(state: AppState, proposal: RecoveryProposal, ctx: Ctx): ActionResult {
  return noAwards(
    state,
    [
      upsert(state, 'recoveryProposal', {
        id: ctx.newId(),
        kind: proposal.kind,
        input: proposal.input as unknown as Record<string, unknown>,
        baseRevision: proposal.baseRevision,
        fingerprint: proposal.fingerprint,
        status: 'kept',
        summary: proposal.headline,
        nextActionSessionId: null,
        nextActionCompletedAt: null,
        acceptedAt: null,
      }, ctx),
    ],
    ctx,
  );
}

export function canUndo(state: AppState, revisionId: string): { ok: true } | { ok: false; reason: string } {
  const rev = state.planRevisions.find((r) => r.id === revisionId && !r.deletedAt);
  if (!rev) return { ok: false, reason: 'Revision not found.' };
  if (rev.undoneAt) return { ok: false, reason: 'Already undone.' };
  if (rev.number !== currentRevision(state)) return { ok: false, reason: 'A newer plan exists. Undo is only available for the latest change.' };
  const touched = rev.createdSessionIds.some((id) => {
    const s = state.sessions.find((x) => x.id === id);
    return s && !s.deletedAt && (s.status !== 'planned' || s.updatedAt !== s.createdAt);
  });
  if (touched) return { ok: false, reason: 'You have already worked on or edited sessions from this plan, so undo could overwrite your later changes.' };
  return { ok: true };
}

/** Undo the latest plan change by restoring its snapshot as a new revision (history is never rewritten). */
export function undoRevision(state: AppState, revisionId: string, ctx: Ctx): ActionResult | ActionError {
  const check = canUndo(state, revisionId);
  if (!check.ok) return { error: 'INVALID', reason: check.reason };
  const rev = state.planRevisions.find((r) => r.id === revisionId)!;
  const m: Mutation[] = [];
  for (const id of rev.createdSessionIds) {
    const t = tombstone(state, 'session', id, ctx);
    if (t) m.push(t);
  }
  let s1 = applyMutations(state, m);
  const restore: Mutation[] = [];
  // Tombstones are final: removed records come back as new copies with new IDs,
  // so no device or the server ever sees a deleted record "reappear".
  const strip = (r: Record<string, unknown>) => {
    const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, rev: _r, ...rest } = r;
    return rest;
  };
  for (const item of rev.replacedSessions) {
    const { _kind, ...record } = item as Record<string, unknown> & { _kind: string; id: string };
    const current = (list: Array<{ id: string; deletedAt?: string | null }>) => list.find((x) => x.id === record.id);
    if (_kind === 'session') {
      const live1 = current(s1.sessions);
      if (live1 && !live1.deletedAt) restore.push(upsert(s1, 'session', { id: record.id, status: record.status, startAt: record.startAt, endAt: record.endAt, minutes: record.minutes }, ctx));
      else restore.push(upsert(s1, 'session', { ...strip(record), id: ctx.newId() }, ctx));
    } else if (_kind === 'task') restore.push(upsert(s1, 'task', { id: record.id, dueAt: record.dueAt, remainingMinutes: record.remainingMinutes }, ctx));
    else if (_kind === 'override') restore.push(upsert(s1, 'dayOverride', { ...strip(record), id: ctx.newId() }, ctx));
    else if (_kind === 'createdOverride') {
      const t = tombstone(s1, 'dayOverride', record.id, ctx);
      if (t) restore.push(t);
    }
  }
  s1 = applyMutations(s1, restore);
  m.push(...restore);
  const number = currentRevision(state) + 1;
  const extra: Mutation[] = [
    upsert(s1, 'planRevision', { id: revisionId, undoneAt: iso(ctx) }, ctx),
    upsert(s1, 'planRevision', { id: ctx.newId(), number, parentNumber: number - 1, reason: 'undo', summary: `Undid: ${rev.summary}`, replacedSessions: [], createdSessionIds: [], proposalId: rev.proposalId ?? null, undoneAt: null }, ctx),
  ];
  if (rev.proposalId) extra.push(upsert(s1, 'recoveryProposal', { id: rev.proposalId, status: 'undone' }, ctx));
  m.push(...extra);
  // XP already earned for accepting is kept: undo is never punished.
  return noAwards(state, m, ctx);
}

// ─── Focus & check-ins ─────────────────────────────────────────────────────

export interface FocusInput {
  taskId: string | null;
  sessionId?: string | null;
  mode: 'timer' | 'manual';
  startedAt: string;
  endedAt: string;
  focusMinutes: number;
  breakCount: number;
  finishedNote?: string | null;
  remainingMinutes?: number | null;
  readiness?: 'ready' | 'more_practice' | 'unsure' | null;
  obstacles?: string[];
  /** Subtasks the student ticked in the check-in. */
  completedSubtaskIds?: string[];
}

export function logFocus(state: AppState, input: FocusInput, ctx: Ctx): ActionResult {
  const focusLogId = ctx.newId();
  const m: Mutation[] = [
    upsert(state, 'focusLog', {
      id: focusLogId,
      taskId: input.taskId,
      sessionId: input.sessionId ?? null,
      mode: input.mode,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      focusMinutes: Math.max(0, Math.round(input.focusMinutes)),
      breakCount: input.breakCount,
      finishedNote: input.finishedNote ?? null,
      remainingMinutes: input.remainingMinutes ?? null,
      readiness: input.readiness ?? null,
      obstacles: input.obstacles ?? [],
    }, ctx),
  ];
  const awards: Array<Omit<AwardRequest, 'occurredAt' | 'localDate'>> = [
    { type: 'focus_completed', data: { focusLogId, focusMinutes: input.focusMinutes, breakTaken: input.breakCount > 0 } },
  ];
  const checkedIn = !!(input.finishedNote?.trim() || input.readiness || input.remainingMinutes !== undefined);
  if (checkedIn) awards.push({ type: 'checkin_completed', data: { focusLogId } });
  if (input.sessionId) m.push(upsert(state, 'session', { id: input.sessionId, status: 'done' }, ctx));

  const task = input.taskId ? state.tasks.find((t) => t.id === input.taskId && !t.deletedAt) : undefined;
  for (const id of input.completedSubtaskIds ?? []) {
    const st = state.subtasks.find((x) => x.id === id && !x.done);
    if (!st) continue;
    m.push(upsert(state, 'subtask', { id, done: true, completedAt: iso(ctx) }, ctx));
    awards.push({ type: 'subtask_completed', data: { subtaskId: id, taskId: st.taskId } });
  }
  const hits = recoveryNextActionHits(state, { sessionId: input.sessionId ?? undefined, taskId: input.sessionId ? undefined : input.taskId ?? undefined });
  const n = nextActionMutations(state, hits, ctx);
  m.push(...n.mutations);
  awards.push(...n.awards);

  if (task) {
    const remaining = input.remainingMinutes ?? Math.max(0, task.remainingMinutes - Math.round(input.focusMinutes));
    if (remaining === 0 && !task.goalId) {
      m.push(upsert(state, 'task', { id: task.id, status: 'done', remainingMinutes: 0, completedAt: iso(ctx) }, ctx));
      for (const fs of live(state.sessions).filter((x) => x.taskId === task.id && x.status === 'planned' && x.id !== input.sessionId && Date.parse(x.startAt) > ctx.now)) {
        m.push(tombstone(state, 'session', fs.id, ctx)!);
      }
      awards.push({ type: 'task_completed', data: { taskId: task.id, estimatedMinutes: task.estimatedMinutes, taskAgeMinutes: Math.round((ctx.now - Date.parse(task.createdAt)) / 60000) } });
    } else {
      m.push(upsert(state, 'task', { id: task.id, remainingMinutes: remaining, status: 'in_progress' }, ctx));
    }
  }
  return finalize(state, m, awards, ctx);
}

// ─── Goals, reflection, resources, app open ────────────────────────────────

export function saveGoal(state: AppState, input: Partial<PersonalGoal> & Pick<PersonalGoal, 'title' | 'category' | 'weeklyTargetMinutes'>, ctx: Ctx): ActionResult {
  const id = input.id ?? ctx.newId();
  const goal = { sessionMinutes: 20, active: true, scheduleIt: true, ...input, id };
  const m = [upsert(state, 'goal', goal, ctx)];
  const linked = live(state.tasks).find((t) => t.goalId === id);
  const weekMinutes = goalMinutesThisWeek(state, id, ctx);
  const remaining = Math.max(0, goal.weeklyTargetMinutes - weekMinutes);
  if (linked) m.push(upsert(state, 'task', { id: linked.id, title: goal.title, remainingMinutes: goal.active && goal.scheduleIt ? remaining : 0, preferredSessionMinutes: goal.sessionMinutes }, ctx));
  else
    m.push(
      upsert(state, 'task', {
        id: ctx.newId(), title: goal.title, kind: 'personal', goalId: id, dueAt: null, importance: 2, estimatedMinutes: Math.max(5, goal.weeklyTargetMinutes), remainingMinutes: goal.active && goal.scheduleIt ? remaining : 0,
        status: 'todo', dependsOn: [], preferredSessionMinutes: goal.sessionMinutes, splittable: true, optional: true, connectivity: 'any', links: [], resourceIds: [], description: null, courseId: null, completedAt: null,
      }, ctx),
    );
  return noAwards(state, m, ctx);
}

export function goalMinutesThisWeek(state: AppState, goalId: string, ctx: Ctx): number {
  const ws = weekStartKey(ctx.now, state.preferences.timezone);
  return live(state.goalCheckins).filter((c) => c.goalId === goalId && c.date >= ws).reduce((a, c) => a + c.minutes, 0);
}

export function goalCheckin(state: AppState, goalId: string, minutes: number, note: string | null, ctx: Ctx): ActionResult {
  const date = today(state, ctx);
  const m = [upsert(state, 'goalCheckin', { id: ctx.newId(), goalId, date, minutes, note }, ctx)];
  const task = live(state.tasks).find((t) => t.goalId === goalId);
  if (task) m.push(upsert(state, 'task', { id: task.id, remainingMinutes: Math.max(0, task.remainingMinutes - minutes), status: 'in_progress' }, ctx));
  return finalize(state, m, [{ type: 'goal_checkin', data: { goalId } }], ctx);
}

export function saveReflection(
  state: AppState,
  input: { weekStart: string; wentWell?: string | null; obstacles: string[]; adjustments: string[]; note?: string | null },
  stats: { plannedMinutes: number; completedMinutes: number; estimatedMinutes: number; actualMinutes: number },
  ctx: Ctx,
): ActionResult {
  const existing = live(state.reflections).find((r) => r.weekStart === input.weekStart);
  const m = [upsert(state, 'reflection', { id: existing?.id ?? ctx.newId(), ...stats, wentWell: input.wentWell ?? null, note: input.note ?? null, weekStart: input.weekStart, obstacles: input.obstacles, adjustments: input.adjustments }, ctx)];
  return finalize(state, m, [{ type: 'reflection_completed', data: { weekStart: input.weekStart } }], ctx);
}

export function setResourceDownloaded(state: AppState, resourceId: string, version: number | null, ctx: Ctx): ActionResult {
  const existing = live(state.resourceProgress).find((r) => r.resourceId === resourceId);
  return noAwards(
    state,
    [upsert(state, 'resourceProgress', { id: existing?.id ?? ctx.newId(), resourceId, downloadedVersion: version, downloadedAt: version === null ? null : iso(ctx), completedAt: existing?.completedAt ?? null, lastScore: existing?.lastScore ?? null, attempts: existing?.attempts ?? 0 }, ctx)],
    ctx,
  );
}

export function completePractice(state: AppState, resourceId: string, scorePercent: number, ctx: Ctx): ActionResult {
  const existing = live(state.resourceProgress).find((r) => r.resourceId === resourceId);
  const m = [
    upsert(state, 'resourceProgress', {
      id: existing?.id ?? ctx.newId(), resourceId, downloadedVersion: existing?.downloadedVersion ?? null, downloadedAt: existing?.downloadedAt ?? null,
      completedAt: existing?.completedAt ?? iso(ctx), lastScore: Math.round(scorePercent), attempts: (existing?.attempts ?? 0) + 1,
    }, ctx),
  ];
  return finalize(state, m, [{ type: 'practice_completed', data: { resourceId, scorePercent } }], ctx);
}

/** Call when the app opens. Awards "welcome back" after 3+ days away, never a penalty. */
export function recordAppOpen(state: AppState, ctx: Ctx): ActionResult {
  const away = daysAway(live(state.events) as LedgerEntry[], today(state, ctx));
  if (away === null || away < 3) return noAwards(state, [], ctx);
  return finalize(state, [], [{ type: 'welcome_back', data: { daysAway: away } }], ctx);
}

/** Weekly goal-task top-up: at the start of a week, goal tasks get their weekly target back. */
export function refreshGoalTasks(state: AppState, ctx: Ctx): ActionResult {
  const m: Mutation[] = [];
  for (const g of live(state.goals)) {
    const task = live(state.tasks).find((t) => t.goalId === g.id);
    if (!task) continue;
    const remaining = g.active && g.scheduleIt ? Math.max(0, g.weeklyTargetMinutes - goalMinutesThisWeek(state, g.id, ctx)) : 0;
    if (remaining !== task.remainingMinutes) m.push(upsert(state, 'task', { id: task.id, remainingMinutes: remaining, status: remaining === 0 ? 'in_progress' : task.status }, ctx));
  }
  return noAwards(state, m, ctx);
}

export function achievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export type { RecoveryProposal, PlanResult };
export type { Subtask, ScheduledSession };
