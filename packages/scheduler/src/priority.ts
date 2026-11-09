import { formatInstant, HOUR, relativeDay } from '@nextstep/contracts';
import type { PlannerTask } from './types.js';

/**
 * Priority score, 0–100. Documented in docs/SCHEDULER.md.
 *
 *   urgency     0–50  linear: due now → 50, due in ≥ 7 days → 0, overdue → 50
 *   importance  0–30  (importance − 1) / 3 × 30
 *   unlocks     0–10  5 per open task that depends on this one (max 10)
 *   started     0–5   5 if work has begun (status in_progress or remaining < estimate)
 *   optional    −10   optional tasks yield to required ones
 *
 * The score orders tasks for "what should I do next?" suggestions and breaks
 * ties during allocation. Allocation itself is earliest-effective-deadline
 * first, which is what keeps the most work feasible.
 */
export function scoreTask(task: PlannerTask, now: number, dependents: PlannerTask[]): number {
  let urgency = 0;
  if (task.dueAt) {
    const hours = (Date.parse(task.dueAt) - now) / HOUR;
    urgency = hours <= 0 ? 50 : 50 * Math.max(0, Math.min(1, 1 - hours / (7 * 24)));
  }
  const importance = ((Math.min(4, Math.max(1, task.importance)) - 1) / 3) * 30;
  const unlocks = Math.min(10, dependents.filter((d) => d.status !== 'done' && d.status !== 'archived').length * 5);
  const started = isStarted(task) ? 5 : 0;
  const optional = task.optional ? -10 : 0;
  return Math.round((urgency + importance + unlocks + started + optional) * 10) / 10;
}

export function isStarted(task: PlannerTask): boolean {
  return task.status === 'in_progress' || (task.estimatedMinutes !== undefined && task.remainingMinutes < task.estimatedMinutes);
}

const IMPORTANCE_LABEL: Record<number, string> = { 1: 'low', 2: 'normal', 3: 'high', 4: 'critical' };

export function importanceLabel(importance: number): string {
  return IMPORTANCE_LABEL[importance] ?? 'normal';
}

/** Plain-language reasons, most significant first. */
export function reasonsFor(
  task: PlannerTask,
  now: number,
  tz: string,
  dependents: PlannerTask[],
  dependencies: PlannerTask[],
): string[] {
  const reasons: string[] = [];
  if (task.dueAt) {
    const due = Date.parse(task.dueAt);
    if (due <= now) {
      reasons.push(`Deadline passed (${formatInstant(due, tz)}). NextStep won't move it — update it only if it officially changed.`);
    } else {
      reasons.push(`Due ${formatInstant(due, tz)} (${relativeDay(due, now, tz)})`);
    }
  } else if (task.goalId) {
    reasons.push('Personal goal — fitted around academic work');
  } else {
    reasons.push('No deadline — fitted around deadline work');
  }
  if (task.importance >= 3) reasons.push(`You marked it ${importanceLabel(task.importance)} importance`);
  const openDependents = dependents.filter((d) => d.status !== 'done' && d.status !== 'archived');
  if (openDependents.length > 0) {
    reasons.push(
      `Unlocks ${openDependents.length === 1 ? `"${openDependents[0]!.title}"` : `${openDependents.length} other tasks`}`,
    );
  }
  const openDeps = dependencies.filter((d) => d.status !== 'done' && d.status !== 'archived');
  if (openDeps.length > 0) reasons.push(`Starts after "${openDeps[0]!.title}"${openDeps.length > 1 ? ` and ${openDeps.length - 1} more` : ''}`);
  if (isStarted(task) && task.estimatedMinutes) {
    const pct = Math.round((1 - task.remainingMinutes / task.estimatedMinutes) * 100);
    if (pct > 0) reasons.push(`Already ${pct}% done`);
  }
  if (task.connectivity === 'online') reasons.push('Needs internet, so it goes in windows you marked as connected');
  if (task.optional) reasons.push('Marked optional');
  return reasons;
}
