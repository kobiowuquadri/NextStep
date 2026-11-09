import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  acceptRecovery,
  createTask,
  deleteTask,
  generatePlanAction,
  logFocus,
  newPreferences,
  previewRecovery,
  saveAvailability,
  undoRevision,
  type ActionError,
  type ActionResult,
} from './actions.js';
import { emptyState, lastRecoveryAt, live, type AppState, type Ctx } from './state.js';

const TZ = 'Africa/Lagos';
const MONDAY_9AM = Date.parse('2026-11-09T08:00:00Z'); // 09:00 in Lagos
const FRIDAY_6PM = '2026-11-13T17:00:00.000Z';
const ctx = (now = MONDAY_9AM): Ctx => ({ now, newId: () => randomUUID() });

function ok(r: ActionResult | ActionError): ActionResult {
  if ('error' in r) throw new Error(`${r.error}: ${'reason' in r ? r.reason : ''}`);
  return r;
}

/** A student free 18:00–21:00 every day with one assignment due Friday. */
function base(): { state: AppState; taskId: string } {
  const userId = randomUUID();
  let state = emptyState(userId, newPreferences(userId, 'Ada', TZ, MONDAY_9AM));
  for (let wd = 0; wd < 7; wd++) state = saveAvailability(state, { weekday: wd, start: '18:00', end: '21:00' }, ctx()).state;
  const taskId = randomUUID();
  state = createTask(state, { id: taskId, title: 'Essay', kind: 'assignment', estimatedMinutes: 180, dueAt: FRIDAY_6PM, importance: 3 }, ctx(), ['Outline', 'Draft', 'Edit']).state;
  return { state, taskId };
}

describe('engine actions', { timeout: 30_000 }, () => {
  it('creates a task with ordered subtasks as separate mutations', () => {
    const { state, taskId } = base();
    const subs = live(state.subtasks).filter((s) => s.taskId === taskId).sort((a, b) => a.position - b.position);
    expect(subs.map((s) => s.title)).toEqual(['Outline', 'Draft', 'Edit']);
    expect(state.tasks.find((t) => t.id === taskId)?.remainingMinutes).toBe(180);
  });

  it('puts the plan revision first so synced sessions never reference a missing revision, and awards the first plan once', () => {
    const { state } = base();
    const first = generatePlanAction(state, ctx());
    expect(first.result.mutations[0]?.entity).toBe('planRevision');
    const sessions = first.result.mutations.filter((m) => m.entity === 'session');
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((m) => m.record.planRevisionId === first.result.mutations[0]!.id)).toBe(true);
    expect(first.result.awards.map((a) => a.entry.type)).toContain('plan_created');

    const again = generatePlanAction(first.result.state, ctx(MONDAY_9AM + 60_000));
    expect(again.result.awards.filter((a) => a.entry.type === 'plan_created')).toHaveLength(0);
  });

  it('deleting a task tombstones its steps and planned sessions and unlinks dependants', () => {
    const { state: s0, taskId } = base();
    const dependant = randomUUID();
    let s = createTask(s0, { id: dependant, title: 'Upload essay', kind: 'assignment', estimatedMinutes: 15, dueAt: FRIDAY_6PM, dependsOn: [taskId] }, ctx()).state;
    s = generatePlanAction(s, ctx()).result.state;
    const del = deleteTask(s, taskId, ctx());
    const deleted = del.mutations.filter((m) => m.kind === 'delete');
    expect(deleted.filter((m) => m.entity === 'task').map((m) => m.id)).toEqual([taskId]);
    expect(deleted.filter((m) => m.entity === 'subtask')).toHaveLength(3);
    expect(live(del.state.sessions).some((x) => x.taskId === taskId)).toBe(false);
    expect(del.state.tasks.find((t) => t.id === dependant)?.dependsOn).toEqual([]);
    // Tombstones carry deletedAt so other devices learn about the deletion.
    expect(deleted.every((m) => typeof m.record.deletedAt === 'string')).toBe(true);
  });

  it('finishing the remaining work completes the task, clears its future sessions and awards XP once', () => {
    const { state: s0, taskId } = base();
    const s = generatePlanAction(s0, ctx()).result.state;
    const done = logFocus(
      s,
      { taskId, mode: 'manual', startedAt: '2026-11-09T07:00:00.000Z', endedAt: '2026-11-09T07:50:00.000Z', focusMinutes: 50, breakCount: 1, remainingMinutes: 0, finishedNote: 'Finished early' },
      ctx(),
    );
    expect(done.state.tasks.find((t) => t.id === taskId)?.status).toBe('done');
    expect(live(done.state.sessions).filter((x) => x.taskId === taskId && x.status === 'planned')).toHaveLength(0);
    const types = done.awards.map((a) => a.entry.type);
    expect(types).toEqual(expect.arrayContaining(['focus_completed', 'checkin_completed', 'task_completed']));
    // focus: 50 min → 10 XP + 2 for the break.
    expect(done.awards.find((a) => a.entry.type === 'focus_completed')?.entry.xp).toBe(12);
  });

  it('applies daily caps by local date and reports them as capped', () => {
    let { state: s } = base();
    let focusXp = 0;
    let sawCapped = false;
    for (let i = 0; i < 7; i++) {
      const start = MONDAY_9AM + i * 3_600_000;
      const r = logFocus(s, { taskId: null, mode: 'manual', startedAt: new Date(start).toISOString(), endedAt: new Date(start + 50 * 60_000).toISOString(), focusMinutes: 50, breakCount: 1 }, ctx(start + 50 * 60_000));
      s = r.state;
      for (const a of r.awards) {
        if (a.entry.type !== 'focus_completed') continue;
        focusXp += a.entry.xp;
        if (a.result === 'capped') sawCapped = true;
      }
    }
    expect(focusXp).toBe(60);
    expect(sawCapped).toBe(true);
  });

  it('undoing a recovery restores replaced sessions under new IDs and keeps earned XP', () => {
    const { state: s0 } = base();
    const s = generatePlanAction(s0, ctx()).result.state;
    const proposal = previewRecovery(s, { kind: 'less_time', date: '2026-11-09', availableMinutes: 0 }, ctx());
    const accepted = ok(acceptRecovery(s, proposal, ctx()));
    const xpBefore = live(accepted.state.events).reduce((a, e) => a + e.xp, 0);
    const revision = live(accepted.state.planRevisions).sort((a, b) => b.number - a.number)[0]!;
    const snapshot = revision.replacedSessions as Array<{ _kind: string; id: string }>;
    const replacedIds = snapshot.filter((r) => r._kind === 'session').map((r) => r.id);
    expect(replacedIds.length).toBeGreaterThan(0);
    expect(snapshot.some((r) => r._kind === 'createdOverride')).toBe(true);

    const undone = ok(undoRevision(accepted.state, revision.id, ctx(MONDAY_9AM + 60_000)));
    const restored = undone.mutations.filter((m) => m.entity === 'session' && m.isNew);
    expect(restored.length).toBe(replacedIds.length);
    expect(restored.every((m) => !replacedIds.includes(m.id))).toBe(true);
    expect(live(undone.state.events).reduce((a, e) => a + e.xp, 0)).toBe(xpBefore);
    // The override created by the recovery is removed again.
    expect(live(undone.state.overrides).filter((o) => o.date === '2026-11-09')).toHaveLength(0);
  });

  it('only an accepted, not-undone recovery clears earlier missed-session prompts', () => {
    const { state: s0 } = base();
    let s = generatePlanAction(s0, ctx()).result.state;
    // An automatic replan (e.g. after adding a task) doesn't count as reviewing missed sessions.
    s = createTask(s, { title: 'Lab report', kind: 'assignment', estimatedMinutes: 60, dueAt: FRIDAY_6PM }, ctx()).state;
    s = generatePlanAction(s, ctx(MONDAY_9AM + 60_000)).result.state;
    expect(lastRecoveryAt(s)).toBeUndefined();

    const later = MONDAY_9AM + 120_000;
    const accepted = ok(acceptRecovery(s, previewRecovery(s, { kind: 'lighter_day', date: '2026-11-09', maxMinutes: 30 }, ctx(later)), ctx(later)));
    expect(lastRecoveryAt(accepted.state)).toBe(later);

    const revision = live(accepted.state.planRevisions).find((r) => r.reason === 'recovery')!;
    const undone = ok(undoRevision(accepted.state, revision.id, ctx(later + 60_000)));
    expect(lastRecoveryAt(undone.state)).toBeUndefined();
  });
});
