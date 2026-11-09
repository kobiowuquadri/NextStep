import { describe, expect, it } from 'vitest';
import {
  evaluateAchievements,
  evaluateAward,
  levelFromXp,
  questsFor,
  reconcileLedger,
  steadyWeeks,
  summariseProgress,
  totalXp,
  unlockedCosmetics,
  xpForLevel,
  type AwardRequest,
  type LedgerEntry,
} from './index';

let n = 0;
const id = () => `id-${++n}`;
const req = (type: AwardRequest['type'], data: AwardRequest['data'], localDate = '2026-11-09'): AwardRequest => ({
  type,
  data,
  localDate,
  occurredAt: `${localDate}T12:00:00Z`,
});

function award(ledger: LedgerEntry[], r: AwardRequest) {
  const out = evaluateAward(ledger, r, id());
  if (out.result !== 'duplicate') ledger.push(out.entry);
  return out;
}

describe('XP rules', () => {
  it('awards task completion once, no matter how often it is toggled or synced', () => {
    const ledger: LedgerEntry[] = [];
    const r = req('task_completed', { taskId: 't1', estimatedMinutes: 90, taskAgeMinutes: 600 });
    expect(award(ledger, r)).toMatchObject({ result: 'awarded', xp: 25 });
    expect(award(ledger, r)).toMatchObject({ result: 'duplicate', xp: 0 });
    expect(award(ledger, r)).toMatchObject({ result: 'duplicate', xp: 0 });
    expect(totalXp(ledger)).toBe(25);
  });

  it('gives quick or trivial tasks only 5 XP', () => {
    const ledger: LedgerEntry[] = [];
    expect(award(ledger, req('task_completed', { taskId: 'q1', estimatedMinutes: 5, taskAgeMinutes: 100 })).xp).toBe(5);
    expect(award(ledger, req('task_completed', { taskId: 'q2', estimatedMinutes: 60, taskAgeMinutes: 1 })).xp).toBe(5);
  });

  it('caps daily task XP so hundreds of tasks cannot be farmed', () => {
    const ledger: LedgerEntry[] = [];
    for (let i = 0; i < 300; i++) award(ledger, req('task_completed', { taskId: `t${i}`, estimatedMinutes: 180, taskAgeMinutes: 999 }));
    expect(totalXp(ledger)).toBe(200);
    // The next day is a fresh allowance.
    award(ledger, req('task_completed', { taskId: 'next', estimatedMinutes: 30, taskAgeMinutes: 999 }, '2026-11-10'));
    expect(totalXp(ledger)).toBe(215);
  });

  it('does not reward excessively long focus sessions, and rewards breaks', () => {
    const ledger: LedgerEntry[] = [];
    expect(award(ledger, req('focus_completed', { focusLogId: 'f1', focusMinutes: 240 })).xp).toBe(12);
    expect(award(ledger, req('focus_completed', { focusLogId: 'f2', focusMinutes: 45, breakTaken: true })).xp).toBe(11);
    expect(award(ledger, req('focus_completed', { focusLogId: 'f3', focusMinutes: 5 })).xp).toBe(0);
  });

  it('limits recovery awards so disruption cannot be farmed', () => {
    const ledger: LedgerEntry[] = [];
    expect(award(ledger, req('recovery_accepted', { proposalId: 'p1' })).xp).toBe(15);
    expect(award(ledger, req('recovery_accepted', { proposalId: 'p2' })).xp).toBe(15);
    expect(award(ledger, req('recovery_accepted', { proposalId: 'p3' }))).toMatchObject({ result: 'capped', xp: 0 });
  });

  it('applies caps by the local date of the action, so late syncing is not punished', () => {
    const ledger: LedgerEntry[] = [];
    // Two subtasks done offline on Monday, synced on Wednesday: still Monday's allowance.
    award(ledger, req('subtask_completed', { subtaskId: 's1' }, '2026-11-09'));
    for (let i = 0; i < 12; i++) award(ledger, req('subtask_completed', { subtaskId: `w${i}` }, '2026-11-11'));
    expect(ledger.filter((e) => e.localDate === '2026-11-09').reduce((a, e) => a + e.xp, 0)).toBe(3);
    expect(ledger.filter((e) => e.localDate === '2026-11-11').reduce((a, e) => a + e.xp, 0)).toBe(30);
  });

  it('reconciles pending local awards with the server without duplicating', () => {
    const local: LedgerEntry[] = [];
    award(local, req('task_completed', { taskId: 't1', estimatedMinutes: 60, taskAgeMinutes: 99 }));
    award(local, req('subtask_completed', { subtaskId: 's1' }));
    const server: LedgerEntry[] = [{ ...local[0]!, id: 'server-1', status: 'confirmed' }];
    const merged = reconcileLedger(local, server);
    expect(merged).toHaveLength(2);
    expect(merged.find((e) => e.dedupeKey === 'task:t1')!.status).toBe('confirmed');
    expect(merged.find((e) => e.dedupeKey === 'subtask:s1')!.status).toBe('pending');
    expect(totalXp(merged)).toBe(totalXp(local));
  });
});

describe('levels', () => {
  it('uses the documented curve', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 250, 450, 700]);
    expect(levelFromXp(0)).toMatchObject({ level: 1, name: 'Trailhead' });
    expect(levelFromXp(260)).toMatchObject({ level: 3, name: 'Path Finder' });
    expect(levelFromXp(175).progress).toBeCloseTo(0.5);
  });
});

describe('steady weeks', () => {
  const active = (dates: string[]): LedgerEntry[] =>
    dates.map((d, i) => ({ id: `a${i}`, dedupeKey: `subtask:${i}`, type: 'subtask_completed', xp: 3, occurredAt: `${d}T10:00:00Z`, localDate: d, meta: {} }));

  it('counts active days per week and does not reset on a missed day', () => {
    const s = steadyWeeks(active(['2026-11-09', '2026-11-11', '2026-11-12', '2026-11-14']), '2026-11-14', 4);
    expect(s.activeDaysThisWeek).toBe(4);
    expect(s.streak).toBe(1);
  });

  it('an unmet week pauses the streak but keeps XP and history', () => {
    const ledger = active(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-10']);
    const s = steadyWeeks(ledger, '2026-11-17', 4);
    expect(s.weeksMet).toBe(1);
    expect(s.streak).toBe(0);
    expect(totalXp(ledger)).toBe(15);
  });
});

describe('achievements', () => {
  it('unlocks Back on Track only after completing the recovery next action, once', () => {
    const ledger: LedgerEntry[] = [];
    award(ledger, req('recovery_accepted', { proposalId: 'p1' }));
    const ctx = () => ({ ledger, level: 1, steady: steadyWeeks(ledger, '2026-11-09', 4) });
    expect(evaluateAchievements(ctx(), new Set()).map((a) => a.id)).not.toContain('back_on_track');
    award(ledger, req('recovery_next_action', { proposalId: 'p1' }));
    const unlocked = evaluateAchievements(ctx(), new Set()).map((a) => a.id);
    expect(unlocked).toContain('back_on_track');
    expect(evaluateAchievements(ctx(), new Set(unlocked)).map((a) => a.id)).not.toContain('back_on_track');
  });

  it('cosmetic rewards never include functional features', () => {
    const c = unlockedCosmetics(6, new Set(['back_on_track', 'first_step']));
    expect(c.skins).toContain('coral');
    expect(c.accessories).toEqual(expect.arrayContaining(['none', 'cap', 'gradcap', 'headphones']));
  });
});

describe('quests', () => {
  it('offers at most three daily quests and only one on a light day', () => {
    expect(questsFor([], '2026-11-09', { hasActiveGoal: true, lightDay: false }).daily.length).toBe(3);
    expect(questsFor([], '2026-11-09', { hasActiveGoal: true, lightDay: true }).daily.length).toBe(1);
  });

  it('is deterministic per day and tracks progress', () => {
    const a = questsFor([], '2026-11-09', { hasActiveGoal: false, lightDay: false });
    const b = questsFor([], '2026-11-09', { hasActiveGoal: false, lightDay: false });
    expect(a.daily.map((q) => q.def.id)).toEqual(b.daily.map((q) => q.def.id));
    expect(a.daily.some((q) => q.def.id === 'goal_moment')).toBe(false);
    const ledger: LedgerEntry[] = [];
    award(ledger, req('focus_completed', { focusLogId: 'f', focusMinutes: 30, breakTaken: true }));
    award(ledger, req('subtask_completed', { subtaskId: 's' }));
    const weekly = questsFor(ledger, '2026-11-09', { hasActiveGoal: false, lightDay: false }).weekly.find((q) => q.def.id === 'three_sessions')!;
    expect(weekly.progress).toBe(1);
  });

  it('summarises progress including pending XP', () => {
    const ledger: LedgerEntry[] = [];
    award(ledger, req('plan_created', {}));
    expect(summariseProgress(ledger, '2026-11-09', 4)).toMatchObject({ totalXp: 10, pendingXp: 10 });
  });
});
