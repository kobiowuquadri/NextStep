import { addDaysToKey, instantAt, localDateKey, stableUuid, weekdayOfKey } from '@nextstep/contracts';
import { courseColors } from '@nextstep/design-tokens';
import {
  createTask,
  emptyState,
  generatePlanAction,
  logFocus,
  newPreferences,
  saveAvailability,
  saveCommitment,
  saveCourse,
  saveGoal,
  toggleSubtask,
  type ActionResult,
  type AppState,
  type Ctx,
} from '@nextstep/engine';

export const DEMO_TIMEZONE = 'Africa/Lagos';
export const DEMO_USER_ID = stableUuid('demo', 'tobi');
export const DEMO_LABEL = 'Fictional demo data — Tobi is not a real student.';

const id = (name: string) => stableUuid('tobi', name);

function ctxAt(now: number, seq: { n: number }): Ctx {
  return { now, newId: () => stableUuid('tobi-gen', ++seq.n) };
}

function run(state: AppState, r: ActionResult | { error: string }): AppState {
  if ('error' in r) throw new Error(`Demo seed failed: ${r.error}`);
  return r.state;
}

/** Next Friday that is at least two days away (so the week has room to plan). */
function demoFriday(today: string): string {
  const wd = weekdayOfKey(today);
  let delta = (5 - wd + 7) % 7;
  if (delta < 2) delta += 7;
  return addDaysToKey(today, delta);
}

export interface ScenarioOptions {
  /** Add a large extra deadline so the week cannot fit (shortfall demo). */
  overloaded?: boolean;
}

/**
 * Tobi: a fictional second-year student in Lagos who works part-time shifts
 * and commutes by bus. Built relative to `now` so the demo week is always
 * current. Includes a missed session from yesterday evening.
 */
export function buildTobiScenario(now: number, opts: ScenarioOptions = {}): AppState {
  const tz = DEMO_TIMEZONE;
  const seq = { n: 0 };
  const today = localDateKey(now, tz);
  const yesterday = addDaysToKey(today, -1);
  const twoDaysAgo = addDaysToKey(today, -2);
  const setupTime = instantAt(addDaysToKey(today, -3), '09:00', tz);
  const c = (t: number) => ctxAt(t, seq);

  let s = emptyState(DEMO_USER_ID, { ...newPreferences(id('prefs'), 'Tobi', tz, setupTime), dailyLimitMinutes: 120, institution: null, programme: 'Computer Science (fictional)', onboardingCompletedAt: new Date(setupTime).toISOString() });

  const csc = id('course-csc');
  const mth = id('course-mth');
  const gst = id('course-gst');
  s = run(s, saveCourse(s, { id: csc, title: 'Data Structures', code: 'CSC 205', color: courseColors[0] }, c(setupTime)));
  s = run(s, saveCourse(s, { id: mth, title: 'Linear Algebra', code: 'MTH 211', color: courseColors[2] }, c(setupTime)));
  s = run(s, saveCourse(s, { id: gst, title: 'Communication in English', code: 'GST 222', color: courseColors[1] }, c(setupTime)));

  // Availability: weekday evenings, Saturday morning, Sunday late afternoon.
  for (const wd of [1, 2, 3, 4, 5]) s = run(s, saveAvailability(s, { id: id(`avail-${wd}`), weekday: wd, start: '19:00', end: '21:30', online: wd !== 3, label: wd === 3 ? 'Evening (data usually low)' : 'Evening at home' }, c(setupTime)));
  s = run(s, saveAvailability(s, { id: id('avail-6'), weekday: 6, start: '10:00', end: '13:00', online: false, label: 'Saturday morning' }, c(setupTime)));
  s = run(s, saveAvailability(s, { id: id('avail-0'), weekday: 0, start: '16:00', end: '18:00', online: true, label: 'Sunday afternoon' }, c(setupTime)));

  // Commitments: part-time work, commute, lectures, protected rest and family time.
  s = run(s, saveCommitment(s, { id: id('work'), title: 'Shift at the print shop', kind: 'work', weekdays: [1, 3, 5], start: '10:00', end: '16:00' }, c(setupTime)));
  s = run(s, saveCommitment(s, { id: id('commute'), title: 'Bus home', kind: 'commute', weekdays: [1, 3, 5], start: '16:00', end: '17:30' }, c(setupTime)));
  s = run(s, saveCommitment(s, { id: id('lectures'), title: 'Lectures', kind: 'class', weekdays: [2, 4], start: '09:00', end: '13:00' }, c(setupTime)));
  s = run(s, saveCommitment(s, { id: id('family'), title: 'Family time', kind: 'family', weekdays: [0], start: '09:00', end: '14:00', protected: true }, c(setupTime)));
  s = run(s, saveCommitment(s, { id: id('rest'), title: 'Rest evening', kind: 'rest', weekdays: [6], start: '17:00', end: '22:00', protected: true }, c(setupTime)));

  const friday = demoFriday(today);
  const testDay = addDaysToKey(friday, 4); // the following Tuesday
  const assignment = id('task-assignment');
  s = run(
    s,
    createTask(s, {
      id: assignment, title: 'Linked list assignment', kind: 'assignment', courseId: csc, importance: 3, estimatedMinutes: 240,
      dueAt: new Date(instantAt(friday, '18:00', tz)).toISOString(), description: 'Implement insert/delete for a singly linked list, with tests and a one-page report.',
    }, c(setupTime), ['Re-read the lecture notes on pointers', 'Implement insert and delete', 'Write test cases', 'Write the one-page report']),
  );
  s = run(s, createTask(s, { id: id('task-upload'), title: 'Upload assignment to the course portal', kind: 'assignment', courseId: csc, importance: 3, estimatedMinutes: 15, dueAt: new Date(instantAt(friday, '18:00', tz)).toISOString(), dependsOn: [assignment], connectivity: 'online', splittable: false }, c(setupTime)));
  s = run(
    s,
    createTask(s, {
      id: id('task-test'), title: 'Class test revision', kind: 'exam', courseId: mth, importance: 3, estimatedMinutes: 180,
      dueAt: new Date(instantAt(testDay, '10:00', tz)).toISOString(), description: 'Test covers matrices, determinants and 2×2 systems.',
      resourceIds: [stableUuid('resource', 'solving-2x2-linear-systems')],
    }, c(setupTime), ['Matrix operations practice', 'Determinants', 'Past questions under time']),
  );
  s = run(s, createTask(s, { id: id('task-essay'), title: 'Essay outline', kind: 'project', courseId: gst, importance: 2, estimatedMinutes: 90, dueAt: new Date(instantAt(addDaysToKey(today, 10), '12:00', tz)).toISOString() }, c(setupTime)));
  s = run(s, createTask(s, { id: id('task-reading'), title: 'Read chapter 6: Trees', kind: 'reading', courseId: csc, importance: 1, estimatedMinutes: 60, optional: true, resourceIds: [stableUuid('resource', 'big-o-in-ten-minutes')] }, c(setupTime)));
  s = run(s, saveGoal(s, { id: id('goal-reading'), title: 'Read for fun', category: 'reading', weeklyTargetMinutes: 60, sessionMinutes: 20 }, c(setupTime)));

  if (opts.overloaded) {
    s = run(s, createTask(s, { id: id('task-group'), title: 'Group project report', kind: 'project', courseId: gst, importance: 4, estimatedMinutes: 600, dueAt: new Date(instantAt(addDaysToKey(today, 2), '17:00', tz)).toISOString() }, c(setupTime)));
  }

  // Two days ago: Tobi finished the first step and logged a focus session.
  const step1 = s.subtasks.find((x) => x.taskId === assignment && x.position === 0)!;
  const histStart = instantAt(twoDaysAgo, '19:00', tz);
  s = run(s, toggleSubtask(s, step1.id, true, c(histStart + 40 * 60000)));
  s = run(
    s,
    logFocus(s, { taskId: assignment, mode: 'timer', startedAt: new Date(histStart).toISOString(), endedAt: new Date(histStart + 50 * 60000).toISOString(), focusMinutes: 45, breakCount: 1, finishedNote: 'Went through pointers again', remainingMinutes: 180, readiness: 'ready', obstacles: [] }, c(histStart + 50 * 60000)),
  );

  // Yesterday morning the plan was generated; yesterday evening's session didn't happen.
  const planTime = instantAt(yesterday, '08:00', tz);
  s = run(s, generatePlanAction(s, c(planTime)).result);

  return s;
}
