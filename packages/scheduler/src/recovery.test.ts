import { describe, expect, it } from 'vitest';
import { localDateKey } from '@nextstep/contracts';
import { buildRecoveryProposal, checkProposalFresh, generatePlan } from './index';
import { at, baseInput, NOW, task, TZ } from './test-utils';
import type { PlannerInput, PlannerSession } from './types';

const tasks = () => [
  task('A', { title: 'Data structures assignment', dueAt: at('2026-11-13', '18:00'), importance: 3, remainingMinutes: 180 }),
  task('B', { title: 'Linear algebra test revision', dueAt: at('2026-11-17', '09:00'), importance: 3, remainingMinutes: 150 }),
  task('C', { title: 'Novel reading', importance: 2, remainingMinutes: 60, optional: true }),
];

/** A state with a generated plan already in place (revision 1). */
function planned(patch: Partial<PlannerInput> = {}): PlannerInput {
  const input = baseInput({ tasks: tasks(), ...patch });
  const plan = generatePlan(input);
  const sessions: PlannerSession[] = plan.sessions.map((s) => ({ ...s, status: 'planned' as const }));
  return { ...input, sessions };
}

const minutesOn = (sessions: Array<{ startAt: string; minutes: number }>, date: string) =>
  sessions.filter((s) => localDateKey(Date.parse(s.startAt), TZ) === date).reduce((a, s) => a + s.minutes, 0);

describe('Recovery Mode', () => {
  it('less time today: proposes a smaller immediate step and moves the rest', () => {
    const state = planned();
    const today = '2026-11-09';
    expect(minutesOn(state.sessions, today)).toBeGreaterThan(45);
    const proposal = buildRecoveryProposal(state, { kind: 'less_time', date: today, availableMinutes: 45 }, 1);

    expect(minutesOn(proposal.after, today)).toBeLessThanOrEqual(45);
    expect(proposal.nextAction).not.toBeNull();
    expect(proposal.nextAction!.minutes).toBeLessThanOrEqual(45);
    expect(localDateKey(Date.parse(proposal.nextAction!.startAt), TZ)).toBe(today);
    expect(proposal.headline).toBe('You have less time than planned. Here are your options.');
    // Sessions on other days that did not need to move stay unchanged.
    expect(proposal.unchanged.length).toBeGreaterThan(0);
    expect(proposal.changes.length).toBeGreaterThan(0);
    for (const c of proposal.changes) expect(c.why.length).toBeGreaterThan(10);
    expect(proposal.stateChanges.overrides).toEqual([expect.objectContaining({ date: today, maxMinutes: 45 })]);
    // All work is still accounted for.
    for (const t of state.tasks) {
      const tp = proposal.plan.tasks.find((x) => x.taskId === t.id)!;
      expect(tp.scheduledMinutes + tp.shortfallMinutes).toBeLessThanOrEqual(t.remainingMinutes);
    }
  });

  it('missed session: marks it missed and re-places the work', () => {
    // Monday evening was planned; it is now Tuesday morning and it did not happen.
    const state = planned();
    const monday = state.sessions.filter((s) => localDateKey(Date.parse(s.startAt), TZ) === '2026-11-09');
    expect(monday.length).toBeGreaterThan(0);
    const tuesdayMorning = Date.parse('2026-11-10T07:00:00Z');
    const later: PlannerInput = { ...state, now: tuesdayMorning };
    const proposal = buildRecoveryProposal(later, { kind: 'missed_session', sessionIds: monday.map((s) => s.id) }, 1);

    expect(proposal.stateChanges.sessionStatus).toEqual(monday.map((s) => ({ sessionId: s.id, status: 'missed' })));
    expect(proposal.headline).toBe('You still have a next step.');
    const missedTask = monday[0]!.taskId;
    const scheduled = proposal.after.filter((s) => s.taskId === missedTask).reduce((a, s) => a + s.minutes, 0);
    const tp = proposal.plan.tasks.find((t) => t.taskId === missedTask)!;
    expect(scheduled + tp.shortfallMinutes).toBe(state.tasks.find((t) => t.id === missedTask)!.remainingMinutes);
    expect(proposal.after.every((s) => Date.parse(s.startAt) >= tuesdayMorning)).toBe(true);
  });

  it('records partial progress reported for a missed session', () => {
    const state = planned();
    const first = state.sessions[0]!;
    const proposal = buildRecoveryProposal({ ...state, now: Date.parse(first.endAt) + 60_000 }, { kind: 'missed_session', sessionIds: [first.id], progressMinutes: { [first.id]: 20 } }, 1);
    const remaining = state.tasks.find((t) => t.id === first.taskId)!.remainingMinutes - 20;
    expect(proposal.stateChanges.taskUpdates).toEqual([{ taskId: first.taskId, patch: { remainingMinutes: remaining } }]);
  });

  it('urgent: clears the blocked days and keeps deadlines', () => {
    const state = planned();
    const proposal = buildRecoveryProposal(state, { kind: 'urgent', startDate: '2026-11-09', days: 2 }, 1);
    expect(minutesOn(proposal.after, '2026-11-09')).toBe(0);
    expect(minutesOn(proposal.after, '2026-11-10')).toBe(0);
    for (const t of proposal.plan.tasks) expect(t.dueAt).toBe(state.tasks.find((x) => x.id === t.taskId)!.dueAt);
  });

  it('deadline changed (student-confirmed): moves sessions that now fall after it', () => {
    const state = planned();
    const newDue = at('2026-11-11', '18:00');
    const proposal = buildRecoveryProposal(state, { kind: 'deadline_changed', taskId: 'A', newDueAt: newDue, confirmedByStudent: true }, 1);
    expect(proposal.stateChanges.taskUpdates).toEqual([{ taskId: 'A', patch: { dueAt: newDue } }]);
    for (const s of proposal.after.filter((x) => x.taskId === 'A')) expect(Date.parse(s.endAt)).toBeLessThanOrEqual(Date.parse(newDue));
    const a = proposal.plan.tasks.find((t) => t.taskId === 'A')!;
    expect(['at_risk', 'tight', 'on_track']).toContain(a.status);
    if (a.status === 'at_risk') expect(proposal.plan.shortfall?.options.length).toBeGreaterThan(0);
  });

  it('lighter day reduces the load on that day only', () => {
    const state = planned();
    const proposal = buildRecoveryProposal(state, { kind: 'lighter_day', date: '2026-11-10', maxMinutes: 30 }, 1);
    expect(minutesOn(proposal.after, '2026-11-10')).toBeLessThanOrEqual(30);
    expect(proposal.headline).toMatch(/lighter day/i);
  });

  it('keeps pinned sessions even on an affected day', () => {
    const state = planned();
    const target = state.sessions.find((s) => localDateKey(Date.parse(s.startAt), TZ) === '2026-11-10')!;
    target.pinned = true;
    const proposal = buildRecoveryProposal(state, { kind: 'urgent', startDate: '2026-11-10', days: 1 }, 1);
    expect(proposal.after.find((s) => s.id === target.id)).toMatchObject({ startAt: target.startAt, endAt: target.endAt });
    expect(proposal.replacedSessionIds).not.toContain(target.id);
  });

  it('detects stale previews: revision change, input change, or time passing', () => {
    const state = planned();
    const proposal = buildRecoveryProposal(state, { kind: 'less_time', date: '2026-11-09', availableMinutes: 45 }, 3);
    expect(checkProposalFresh(proposal, state, 3)).toEqual({ fresh: true });
    expect(checkProposalFresh(proposal, state, 4)).toEqual({ fresh: false, reason: 'revision_changed' });
    const edited = { ...state, tasks: state.tasks.map((t) => (t.id === 'B' ? { ...t, remainingMinutes: 200 } : t)) };
    expect(checkProposalFresh(proposal, edited, 3)).toEqual({ fresh: false, reason: 'inputs_changed' });
    const muchLater = { ...state, now: NOW + 2 * 86_400_000 };
    expect(checkProposalFresh(proposal, muchLater, 3)).toEqual({ fresh: false, reason: 'sessions_in_past' });
  });

  it('shows the shortfall honestly when work cannot fit after a disruption', () => {
    const state = planned({ tasks: [task('A', { title: 'Big essay', dueAt: at('2026-11-11', '21:00'), importance: 4, remainingMinutes: 200 })] });
    const proposal = buildRecoveryProposal(state, { kind: 'urgent', startDate: '2026-11-09', days: 2 }, 1);
    expect(proposal.atRisk.map((t) => t.taskId)).toContain('A');
    expect(proposal.subline).toMatch(/Not everything fits/);
    expect(proposal.plan.shortfall!.options.some((o) => o.kind === 'reduce_scope')).toBe(true);
  });

  it('is deterministic', () => {
    const state = planned();
    const a = buildRecoveryProposal(state, { kind: 'less_time', date: '2026-11-09', availableMinutes: 45 }, 1);
    const b = buildRecoveryProposal(state, { kind: 'less_time', date: '2026-11-09', availableMinutes: 45 }, 1);
    expect(a).toEqual(b);
  });
});
