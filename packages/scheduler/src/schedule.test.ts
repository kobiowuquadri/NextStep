import { describe, expect, it } from 'vitest';
import { instantAt, localDateKey, zonedParts } from '@nextstep/contracts';
import { analyzePlan, buildToday, commitmentIntervals, currentSessionLabels, generatePlan, overlaps } from './index';
import { at, baseInput, NOW, session, task, TZ } from './test-utils';
import type { PlannedSession, PlannerInput } from './types';

const iv = (s: { startAt: string; endAt: string }) => ({ start: Date.parse(s.startAt), end: Date.parse(s.endAt) });

function assertNoOverlaps(sessions: PlannedSession[]) {
  const sorted = [...sessions].sort((a, b) => a.startAt.localeCompare(b.startAt));
  for (let i = 1; i < sorted.length; i++) {
    expect(Date.parse(sorted[i]!.startAt), `${sorted[i - 1]!.startAt}–${sorted[i - 1]!.endAt} overlaps ${sorted[i]!.startAt}`).toBeGreaterThanOrEqual(Date.parse(sorted[i - 1]!.endAt));
  }
}

function assertOutsideCommitments(input: PlannerInput, sessions: PlannedSession[]) {
  for (const s of sessions) {
    const date = localDateKey(Date.parse(s.startAt), input.preferences.timezone);
    for (const block of commitmentIntervals(input.commitments, date, input.preferences.timezone)) {
      expect(overlaps(iv(s), block), `session ${s.startAt} overlaps a commitment`).toBe(false);
    }
  }
}

function assertInsideWindows(input: PlannerInput, sessions: PlannedSession[]) {
  const tz = input.preferences.timezone;
  for (const s of sessions) {
    const date = localDateKey(Date.parse(s.startAt), tz);
    const wd = zonedParts(Date.parse(s.startAt), tz).weekday;
    const inside = input.availability
      .filter((a) => a.weekday === wd)
      .some((a) => Date.parse(s.startAt) >= instantAt(date, a.start, tz) && Date.parse(s.endAt) <= instantAt(date, a.end, tz));
    expect(inside, `session ${s.startAt} outside availability`).toBe(true);
  }
}

const tobiTasks = () => [
  task('A', { title: 'Data structures assignment', dueAt: at('2026-11-13', '18:00'), importance: 3, remainingMinutes: 180, estimatedMinutes: 180 }),
  task('B', { title: 'Linear algebra test revision', dueAt: at('2026-11-17', '09:00'), importance: 3, remainingMinutes: 150, estimatedMinutes: 150 }),
  task('C', { title: 'Novel reading', importance: 2, remainingMinutes: 60, optional: true }),
  task('D', { title: 'Submit and check the assignment', dueAt: at('2026-11-13', '18:00'), importance: 2, remainingMinutes: 20, dependsOn: ['A'] }),
];

describe('generatePlan', () => {
  it('places all work without overlaps, inside availability, outside commitments', () => {
    const input = baseInput({ tasks: tobiTasks() });
    const plan = generatePlan(input);
    expect(plan.shortfall).toBeNull();
    assertNoOverlaps(plan.sessions);
    assertOutsideCommitments(input, plan.sessions);
    assertInsideWindows(input, plan.sessions);
    for (const t of tobiTasks()) {
      const minutes = plan.sessions.filter((s) => s.taskId === t.id).reduce((a, s) => a + s.minutes, 0);
      expect(minutes).toBe(t.remainingMinutes);
    }
  });

  it('keeps buffers between sessions and after commitments', () => {
    const input = baseInput({ tasks: tobiTasks() });
    const plan = generatePlan(input);
    const sorted = [...plan.sessions].sort((a, b) => a.startAt.localeCompare(b.startAt));
    for (let i = 1; i < sorted.length; i++) {
      const gap = (Date.parse(sorted[i]!.startAt) - Date.parse(sorted[i - 1]!.endAt)) / 60000;
      expect(gap).toBeGreaterThanOrEqual(10);
    }
    // Monday: commute ends at 18:00, so the first session starts at 18:10 at the earliest.
    const monday = sorted.filter((s) => localDateKey(Date.parse(s.startAt), TZ) === '2026-11-09');
    expect(Date.parse(monday[0]!.startAt)).toBeGreaterThanOrEqual(Date.parse(at('2026-11-09', '18:10')));
  });

  it('respects the daily limit and session length bounds', () => {
    const input = baseInput({ tasks: tobiTasks() });
    const plan = generatePlan(input);
    const perDay = new Map<string, number>();
    for (const s of plan.sessions) {
      const d = localDateKey(Date.parse(s.startAt), TZ);
      perDay.set(d, (perDay.get(d) ?? 0) + s.minutes);
      expect(s.minutes).toBeLessThanOrEqual(90);
    }
    for (const m of perDay.values()) expect(m).toBeLessThanOrEqual(120);
  });

  it('respects dependencies: a dependent starts after its prerequisite finishes', () => {
    const plan = generatePlan(baseInput({ tasks: tobiTasks() }));
    const lastA = Math.max(...plan.sessions.filter((s) => s.taskId === 'A').map((s) => Date.parse(s.endAt)));
    const firstD = Math.min(...plan.sessions.filter((s) => s.taskId === 'D').map((s) => Date.parse(s.startAt)));
    expect(firstD).toBeGreaterThan(lastA);
  });

  it('protects rest: never schedules over protected commitments (Saturday family lunch)', () => {
    const tasks = [task('X', { dueAt: at('2026-11-15', '20:00'), remainingMinutes: 600, importance: 4 })];
    const input = baseInput({ tasks, preferences: { ...baseInput().preferences, dailyLimitMinutes: 300 } });
    const plan = generatePlan(input);
    const lunch = { start: Date.parse(at('2026-11-14', '12:00')), end: Date.parse(at('2026-11-14', '13:00')) };
    for (const s of plan.sessions) expect(overlaps(iv(s), lunch)).toBe(false);
    assertOutsideCommitments(input, plan.sessions);
  });

  it('detects work that cannot fit before the deadline and explains the shortfall', () => {
    const tasks = [
      task('BIG', { title: 'Project report', dueAt: at('2026-11-10', '23:00'), importance: 4, remainingMinutes: 400 }),
      task('OPT', { title: 'Extra reading', dueAt: at('2026-11-10', '23:00'), importance: 1, optional: true, remainingMinutes: 60 }),
    ];
    const plan = generatePlan(baseInput({ tasks }));
    const big = plan.tasks.find((t) => t.taskId === 'BIG')!;
    expect(big.status).toBe('at_risk');
    expect(big.shortfallMinutes).toBeGreaterThan(0);
    expect(plan.shortfall).not.toBeNull();
    expect(plan.shortfall!.message).toMatch(/doesn't fit/);
    const kinds = plan.shortfall!.options.map((o) => o.kind);
    expect(kinds).toContain('reduce_scope');
    expect(kinds).toContain('seek_help');
    expect(kinds).toContain('add_time');
    // Never pretends: scheduled minutes + shortfall equals remaining work.
    expect(big.scheduledMinutes + big.shortfallMinutes).toBe(400);
    // Never moves the deadline.
    expect(big.dueAt).toBe(at('2026-11-10', '23:00'));
  });

  it('offers deferring a lower-priority task when that frees time before the deadline', () => {
    const tasks = [
      task('OPT', { title: 'Optional reading', dueAt: at('2026-11-10', '20:00'), importance: 1, optional: true, remainingMinutes: 90 }),
      task('KEY', { title: 'Lab report', dueAt: at('2026-11-11', '08:00'), importance: 4, remainingMinutes: 200 }),
    ];
    const plan = generatePlan(baseInput({ tasks, preferences: { ...baseInput().preferences, deadlineBufferHours: 0 } }));
    const key = plan.tasks.find((t) => t.taskId === 'KEY')!;
    expect(key.status).toBe('at_risk');
    const defer = plan.shortfall!.options.find((o) => o.kind === 'defer_task');
    expect(defer?.deferTaskId).toBe('OPT');
    expect(defer!.minutes).toBeGreaterThan(0);
  });

  it('schedules only remaining effort for partially completed tasks and keeps done sessions', () => {
    const done = session('done-1', 'A', at('2026-11-09', '06:00'), at('2026-11-09', '07:00'), { status: 'done' });
    const tasks = [task('A', { dueAt: at('2026-11-13', '18:00'), remainingMinutes: 60, estimatedMinutes: 120, status: 'in_progress' })];
    const plan = generatePlan(baseInput({ tasks, sessions: [done] }));
    const minutes = plan.newSessions.filter((s) => s.taskId === 'A').reduce((a, s) => a + s.minutes, 0);
    expect(minutes).toBe(60);
    // Done session counted toward today's load.
    expect(plan.days.find((d) => d.date === '2026-11-09')!.doneMinutes).toBe(60);
    expect(plan.tasks[0]!.reasons.join(' ')).toMatch(/50% done/);
  });

  it('keeps pinned sessions exactly and counts them toward remaining work', () => {
    const pinned = session('pin-1', 'A', at('2026-11-10', '19:00'), at('2026-11-10', '20:00'), { pinned: true });
    const tasks = [task('A', { dueAt: at('2026-11-13', '18:00'), remainingMinutes: 120 })];
    const plan = generatePlan(baseInput({ tasks, sessions: [pinned] }));
    expect(plan.sessions.find((s) => s.id === 'pin-1')).toMatchObject({ startAt: pinned.startAt, endAt: pinned.endAt, isNew: false });
    expect(plan.newSessions.reduce((a, s) => a + s.minutes, 0)).toBe(60);
    assertNoOverlaps(plan.sessions);
  });

  it('replaces unpinned planned sessions instead of duplicating them', () => {
    const input = baseInput({ tasks: tobiTasks() });
    const first = generatePlan(input);
    const again = generatePlan({ ...input, sessions: first.sessions.map((s) => ({ ...s, label: s.label })) });
    expect(again.sessions.length).toBe(first.sessions.length);
    expect(again.sessions.map((s) => s.id)).toEqual(first.sessions.map((s) => s.id));
  });

  it('is deterministic: same input, same plan and IDs', () => {
    const a = generatePlan(baseInput({ tasks: tobiTasks() }));
    const b = generatePlan(baseInput({ tasks: tobiTasks() }));
    expect(a).toEqual(b);
  });

  it('places online-only tasks only in connected windows', () => {
    const tasks = [task('WEB', { title: 'Submit on the portal', connectivity: 'online', dueAt: at('2026-11-16', '09:00'), remainingMinutes: 40 })];
    const input = baseInput({
      tasks,
      availability: [
        { weekday: 1, start: '18:00', end: '21:00', online: false },
        { weekday: 2, start: '18:00', end: '21:00', online: true },
      ],
    });
    const plan = generatePlan(input);
    expect(plan.sessions).toHaveLength(1);
    expect(localDateKey(Date.parse(plan.sessions[0]!.startAt), TZ)).toBe('2026-11-10');
  });

  it('places a non-splittable task as one block', () => {
    const tasks = [task('MOCK', { title: 'Timed mock exam', splittable: false, remainingMinutes: 120, dueAt: at('2026-11-16', '09:00') })];
    const plan = generatePlan(baseInput({ tasks }));
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0]!.minutes).toBe(120);
  });

  it('labels sessions with the next unfinished subtasks', () => {
    const tasks = [task('A', { dueAt: at('2026-11-13', '18:00'), remainingMinutes: 90 })];
    const subtasks = [
      { id: 's1', taskId: 'A', title: 'Outline the answer', done: true, position: 0 },
      { id: 's2', taskId: 'A', title: 'Draft section 1', done: false, position: 1 },
      { id: 's3', taskId: 'A', title: 'Draft section 2', done: false, position: 2 },
    ];
    const plan = generatePlan(baseInput({ tasks, subtasks }));
    expect(plan.sessions.map((s) => s.label)).toEqual(['Draft section 1', 'Draft section 2']);
  });

  it('flags overdue tasks without moving their deadline', () => {
    const tasks = [task('LATE', { dueAt: at('2026-11-08', '18:00'), remainingMinutes: 30 })];
    const plan = generatePlan(baseInput({ tasks }));
    expect(plan.tasks[0]!.status).toBe('overdue');
    expect(plan.tasks[0]!.dueAt).toBe(at('2026-11-08', '18:00'));
  });

  it('warns about circular dependencies instead of hanging', () => {
    const tasks = [task('P', { dependsOn: ['Q'] }), task('Q', { dependsOn: ['P'] })];
    const plan = generatePlan(baseInput({ tasks }));
    expect(plan.warnings.join(' ')).toMatch(/loop/);
    expect(plan.sessions.length).toBeGreaterThan(0);
  });

  it('honours a day override that reduces capacity', () => {
    const input = baseInput({ tasks: tobiTasks(), overrides: [{ date: '2026-11-09', maxMinutes: 45 }] });
    const plan = generatePlan(input);
    const monday = plan.sessions.filter((s) => localDateKey(Date.parse(s.startAt), TZ) === '2026-11-09');
    expect(monday.reduce((a, s) => a + s.minutes, 0)).toBeLessThanOrEqual(45);
  });
});

describe('timezones', () => {
  it('plans in the user timezone across a DST change (America/New_York, 1 Nov 2026)', () => {
    const tz = 'America/New_York';
    const now = Date.parse('2026-10-30T12:00:00Z'); // Fri 30 Oct, 08:00 EDT
    const input = baseInput({
      now,
      commitments: [],
      tasks: [task('E', { dueAt: new Date(instantAt('2026-11-04', '23:00', tz)).toISOString(), remainingMinutes: 300 })],
      preferences: { ...baseInput().preferences, timezone: tz, dailyLimitMinutes: 60 },
      availability: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: '19:00', end: '20:00', online: true })),
    });
    const plan = generatePlan(input);
    for (const s of plan.sessions) {
      const p = zonedParts(Date.parse(s.startAt), tz);
      expect(p.hour).toBe(19);
      expect(p.minute).toBe(0);
    }
    // Sessions on both sides of the change keep their local wall-clock time.
    const utcHours = new Set(plan.sessions.map((s) => new Date(s.startAt).getUTCHours()));
    expect(utcHours).toEqual(new Set([23, 0]));
  });

  it('a timezone change moves windows to the new local time', () => {
    const tasks = [task('A', { dueAt: at('2026-11-13', '18:00'), remainingMinutes: 45 })];
    const lagos = generatePlan(baseInput({ tasks }));
    const london = generatePlan(baseInput({ tasks, commitments: [], preferences: { ...baseInput().preferences, timezone: 'Europe/London' } }));
    expect(zonedParts(Date.parse(lagos.sessions[0]!.startAt), 'Africa/Lagos').hour).toBe(18);
    expect(zonedParts(Date.parse(london.sessions[0]!.startAt), 'Europe/London').hour).toBe(18);
    expect(lagos.sessions[0]!.startAt).not.toBe(london.sessions[0]!.startAt);
  });

  it('handles the local midnight boundary: late-night now plans from the next day', () => {
    const now = Date.parse('2026-11-09T22:50:00Z'); // 23:50 Monday in Lagos
    const plan = generatePlan(baseInput({ now, tasks: tobiTasks() }));
    expect(localDateKey(Date.parse(plan.sessions[0]!.startAt), TZ)).toBe('2026-11-10');
  });
});

describe('analyzePlan (manual planning)', () => {
  it('flags overlapping sessions, commitment clashes and under-planned tasks', () => {
    const tasks = [task('A', { dueAt: at('2026-11-13', '18:00'), remainingMinutes: 120 })];
    const sessions = [
      session('m1', 'A', at('2026-11-09', '16:30'), at('2026-11-09', '17:30')), // during work/commute
      session('m2', 'A', at('2026-11-10', '19:00'), at('2026-11-10', '20:00')),
      session('m3', 'A', at('2026-11-10', '19:30'), at('2026-11-10', '20:00')),
    ];
    const issues = analyzePlan(baseInput({ tasks, sessions }));
    const kinds = issues.map((i) => i.kind);
    expect(kinds).toContain('session_overlap');
    expect(kinds).toContain('commitment_overlap');
    expect(issues.find((i) => i.kind === 'commitment_overlap')!.message).toMatch(/Shift at the bookshop|Bus home/);
  });
});

describe('buildToday', () => {
  it('shows only realistic actions and a completed state', () => {
    const sessions = [
      session('t1', 'A', at('2026-11-09', '06:00'), at('2026-11-09', '06:45'), { status: 'done' }),
    ];
    const view = buildToday(baseInput({ tasks: tobiTasks(), sessions }));
    expect(view.actions).toHaveLength(0);
    expect(view.completedForToday).toBe(true);
  });

  it('does not pad to three actions when only one is planned', () => {
    const sessions = [session('t1', 'A', at('2026-11-09', '18:10'), at('2026-11-09', '18:55'))];
    const view = buildToday(baseInput({ tasks: tobiTasks(), sessions, now: NOW }));
    expect(view.actions).toHaveLength(1);
    expect(view.actions[0]!.reasons[0]).toMatch(/Due Fri 13 Nov/);
  });
});

describe('session labels', () => {
  const steps = (titles: string[], done: number[] = []) =>
    titles.map((title, position) => ({ id: `st${position}`, taskId: 'A', title, position, done: done.includes(position) }));

  it('re-labels the remaining sessions with the open steps when earlier sessions were missed', () => {
    const sessions = [
      session('s1', 'A', at('2026-11-08', '16:00'), at('2026-11-08', '16:45'), { label: 'Read notes' }),
      session('s2', 'A', at('2026-11-08', '16:55'), at('2026-11-08', '17:40'), { label: 'Implement' }),
      session('s3', 'A', at('2026-11-09', '19:00'), at('2026-11-09', '19:45'), { label: 'Write tests' }),
      session('s4', 'A', at('2026-11-10', '19:00'), at('2026-11-10', '19:45'), { label: 'Write report' }),
    ];
    const subtasks = steps(['Read notes', 'Implement', 'Write tests', 'Write report']);
    const labels = currentSessionLabels(sessions, subtasks, NOW);
    expect(labels.has('s1')).toBe(false); // past sessions keep their history
    expect(labels.get('s3')).toBe('Read notes');
    expect(labels.get('s4')).toBe('Implement');
    const view = buildToday(baseInput({ tasks: tobiTasks(), sessions, subtasks, now: NOW }));
    expect(view.actions[0]!.label).toBe('Read notes');
  });

  it('skips steps already ticked off and leaves tasks without steps alone', () => {
    const sessions = [
      session('a1', 'A', at('2026-11-09', '19:00'), at('2026-11-09', '19:45'), { label: 'Read notes' }),
      session('b1', 'B', at('2026-11-10', '19:00'), at('2026-11-10', '19:45'), { label: 'Old label' }),
    ];
    const labels = currentSessionLabels(sessions, steps(['Read notes', 'Implement'], [0]), NOW);
    expect(labels.get('a1')).toBe('Implement');
    expect(labels.has('b1')).toBe(false);
    const allDone = currentSessionLabels(sessions, steps(['Read notes', 'Implement'], [0, 1]), NOW);
    expect(allDone.get('a1')).toBeNull();
  });
});
