import { describe, expect, it } from 'vitest';
import { localDateKey, stableUuid } from '@nextstep/contracts';
import {
  acceptRecovery,
  canUndo,
  completeTask,
  currentRevision,
  generatePlanAction,
  live,
  logFocus,
  previewRecovery,
  toPlannerInput,
  undoRevision,
  updateTask,
  weeklySummary,
  type ActionResult,
  type AppState,
  type Ctx,
} from '@nextstep/engine';
import { buildToday } from '@nextstep/scheduler';
import { buildTobiScenario, DEMO_TIMEZONE, LEARNING_RESOURCES } from './index';

// Wednesday 11 Nov 2026, 17:45 in Lagos — Tobi is on the bus home.
const NOW = Date.parse('2026-11-11T16:45:00Z');
let n = 0;
const ctx = (now = NOW): Ctx => ({ now, newId: () => stableUuid('test', ++n) });
const ok = (r: ActionResult | { error: string }): ActionResult => {
  if ('error' in r) throw new Error(`unexpected error ${r.error}`);
  return r;
};
const xp = (s: AppState) => live(s.events).reduce((a, e) => a + e.xp, 0);

describe('Tobi demo scenario', () => {
  it('has three courses, a Friday assignment, a test, work and commute, a reading goal and a missed session', () => {
    const s = buildTobiScenario(NOW);
    expect(live(s.courses)).toHaveLength(3);
    const assignment = s.tasks.find((t) => t.title === 'Linked list assignment')!;
    expect(new Date(assignment.dueAt!).getUTCDay()).toBe(5);
    expect(s.tasks.some((t) => t.kind === 'exam')).toBe(true);
    expect(s.commitments.map((c) => c.kind)).toEqual(expect.arrayContaining(['work', 'commute']));
    expect(s.goals[0]!.category).toBe('reading');
    const today = buildToday(toPlannerInput(s, NOW));
    expect(today.missedEarlier.length).toBeGreaterThan(0);
    expect(xp(s)).toBeGreaterThan(0);
  });

  it('runs the full recovery story: 45 minutes, accept, complete next step, Back on Track once', () => {
    let s = buildTobiScenario(NOW);
    const day = localDateKey(NOW, DEMO_TIMEZONE);
    const before = xp(s);

    const proposal = previewRecovery(s, { kind: 'less_time', date: day, availableMinutes: 45 }, ctx());
    expect(proposal.headline).toBe('You have less time than planned. Here are your options.');
    expect(proposal.nextAction).not.toBeNull();
    expect(proposal.nextAction!.minutes).toBeLessThanOrEqual(45);

    const accepted = ok(acceptRecovery(s, proposal, ctx()));
    s = accepted.state;
    expect(xp(s)).toBe(before + accepted.awards.reduce((a, w) => a + w.entry.xp, 0));
    expect(accepted.awards.map((a) => a.entry.type)).toContain('recovery_accepted');
    const record = live(s.proposals).find((p) => p.status === 'accepted')!;
    expect(record.nextActionSessionId).toBe(proposal.nextAction!.sessionId);
    expect(currentRevision(s)).toBe(proposal.baseRevision + 1);

    // Tobi does the 45-minute next step.
    const next = s.sessions.find((x) => x.id === record.nextActionSessionId)!;
    const done = ok(
      logFocus(s, { taskId: next.taskId, sessionId: next.id, mode: 'timer', startedAt: next.startAt, endedAt: next.endAt, focusMinutes: next.minutes, breakCount: 1, finishedNote: 'Insert works', readiness: 'more_practice', obstacles: [] }, ctx(Date.parse(next.endAt))),
    );
    s = done.state;
    expect(done.unlocked.map((a) => a.id)).toContain('back_on_track');
    expect(live(s.achievements).filter((a) => a.achievementId === 'back_on_track')).toHaveLength(1);

    // Logging again (e.g. a duplicate tap or re-sync) does not award it twice.
    const again = ok(
      logFocus(s, { taskId: next.taskId, sessionId: next.id, mode: 'manual', startedAt: next.startAt, endedAt: next.endAt, focusMinutes: 20, breakCount: 0, obstacles: [] }, ctx(Date.parse(next.endAt) + 60_000)),
    );
    expect(again.unlocked.map((a) => a.id)).not.toContain('back_on_track');
    expect(live(again.state.events).filter((e) => e.type === 'recovery_next_action')).toHaveLength(1);
  });

  it('refuses a stale preview after the plan changed and never applies it', () => {
    const s = buildTobiScenario(NOW);
    const proposal = previewRecovery(s, { kind: 'less_time', date: localDateKey(NOW, DEMO_TIMEZONE), availableMinutes: 45 }, ctx());
    const edited = ok(updateTask(s, s.tasks.find((t) => t.kind === 'exam')!.id, { remainingMinutes: 240 }, ctx())).state;
    expect(acceptRecovery(edited, proposal, ctx())).toEqual({ error: 'STALE_PREVIEW', reason: 'inputs_changed' });
    const replanned = generatePlanAction(s, ctx()).result.state;
    expect(acceptRecovery(replanned, proposal, ctx())).toMatchObject({ error: 'STALE_PREVIEW' });
  });

  it('undo restores the previous plan and is refused once later work exists', () => {
    let s = buildTobiScenario(NOW);
    const slot = (x: { taskId: string; startAt: string; endAt: string }) => `${x.taskId}|${x.startAt}|${x.endAt}`;
    const sessionsBefore = live(s.sessions).filter((x) => x.status === 'planned').map(slot).sort();
    const proposal = previewRecovery(s, { kind: 'urgent', startDate: localDateKey(NOW, DEMO_TIMEZONE), days: 1 }, ctx());
    s = ok(acceptRecovery(s, proposal, ctx())).state;
    const rev = live(s.planRevisions).find((r) => r.reason === 'recovery')!;
    expect(canUndo(s, rev.id)).toEqual({ ok: true });
    const undone = ok(undoRevision(s, rev.id, ctx())).state;
    const sessionsAfter = live(undone.sessions).filter((x) => x.status === 'planned').map(slot).sort();
    // No tombstoned record was resurrected.
    for (const t of s.sessions.filter((x) => x.deletedAt)) expect(undone.sessions.find((x) => x.id === t.id)!.deletedAt).toBeTruthy();
    expect(sessionsAfter).toEqual(sessionsBefore);
    expect(live(undone.overrides)).toHaveLength(0);
    // XP earned for accepting is kept — undo is never punished.
    expect(live(undone.events).some((e) => e.type === 'recovery_accepted')).toBe(true);

    // After working on a session from the new plan, undo is refused.
    const p2 = previewRecovery(undone, { kind: 'lighter_day', date: localDateKey(NOW, DEMO_TIMEZONE), maxMinutes: 30 }, ctx());
    let s2 = ok(acceptRecovery(undone, p2, ctx())).state;
    const rev2 = live(s2.planRevisions).find((r) => r.reason === 'recovery' && !r.undoneAt)!;
    const created = s2.sessions.find((x) => rev2.createdSessionIds.includes(x.id))!;
    s2 = ok(logFocus(s2, { taskId: created.taskId, sessionId: created.id, mode: 'manual', startedAt: created.startAt, endedAt: created.endAt, focusMinutes: 20, breakCount: 0, obstacles: [] }, ctx())).state;
    expect(canUndo(s2, rev2.id).ok).toBe(false);
  });

  it('awards task completion once even if completed, reopened and completed again', () => {
    let s = buildTobiScenario(NOW);
    const t = s.tasks.find((x) => x.title === 'Essay outline')!;
    s = ok(completeTask(s, t.id, ctx())).state;
    const first = xp(s);
    s = ok(updateTask(s, t.id, { status: 'in_progress', remainingMinutes: 30 }, ctx())).state;
    s = ok(completeTask(s, t.id, ctx())).state;
    expect(xp(s)).toBe(first);
  });

  it('explains an overloaded week instead of presenting an impossible plan', () => {
    const s = buildTobiScenario(NOW, { overloaded: true });
    const { plan } = generatePlanAction(s, ctx());
    expect(plan.shortfall).not.toBeNull();
    expect(plan.shortfall!.totalMinutes).toBeGreaterThan(0);
    const group = plan.tasks.find((t) => t.title === 'Group project report')!;
    expect(group.status).toBe('at_risk');
    expect(group.scheduledMinutes + group.shortfallMinutes).toBe(600);
    expect(plan.shortfall!.options.map((o) => o.kind)).toEqual(expect.arrayContaining(['reduce_scope', 'seek_help']));
  });

  it('weekly summary separates logged activity from results and suggests adjustments', () => {
    const s = buildTobiScenario(NOW);
    const summary = weeklySummary(s, '2026-11-09', NOW);
    expect(summary.actualMinutes).toBeGreaterThanOrEqual(45);
    expect(summary.suggestions.length).toBeGreaterThan(0);
  });

  it('ships original resources with honest provenance', () => {
    for (const r of LEARNING_RESOURCES) {
      expect(r.reviewStatus).toBe('unreviewed');
      expect(r.provenance).toMatch(/Not reviewed by an educator/);
      for (const q of r.questions) expect(q.answerIndex).toBeLessThan(q.choices.length);
    }
  });
});
