import { formatInstant, formatMinutes, localDateKey } from '@nextstep/contracts';
import { commitmentIntervals, overlaps } from './slots.js';
import type { PlannerInput, PlannerSession } from './types.js';

export interface PlanIssue {
  kind: 'session_overlap' | 'commitment_overlap' | 'after_deadline' | 'under_planned' | 'over_daily_limit';
  message: string;
  sessionIds: string[];
  taskId?: string;
}

/**
 * Checks an existing (often manually built) plan without changing it:
 * overlaps, sessions on top of commitments, work placed after a deadline,
 * under-planned tasks and days over the student's limit.
 */
export function analyzePlan(input: PlannerInput): PlanIssue[] {
  const tz = input.preferences.timezone;
  const issues: PlanIssue[] = [];
  const sessions = input.sessions
    .filter((s) => !s.deletedAt && s.status === 'planned' && Date.parse(s.endAt) > input.now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const iv = (s: PlannerSession) => ({ start: Date.parse(s.startAt), end: Date.parse(s.endAt) });
  const taskTitle = (id: string) => input.tasks.find((t) => t.id === id)?.title ?? 'a task';

  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i]!;
      const b = sessions[j]!;
      if (Date.parse(b.startAt) >= Date.parse(a.endAt)) break;
      if (overlaps(iv(a), iv(b))) {
        issues.push({
          kind: 'session_overlap',
          sessionIds: [a.id, b.id],
          message: `"${taskTitle(a.taskId)}" and "${taskTitle(b.taskId)}" overlap on ${formatInstant(Date.parse(a.startAt), tz)}.`,
        });
      }
    }
  }

  const byDate = new Map<string, number>();
  for (const s of sessions) {
    const date = localDateKey(Date.parse(s.startAt), tz);
    byDate.set(date, (byDate.get(date) ?? 0) + s.minutes);
    const clash = input.commitments
      .filter((c) => !c.deletedAt)
      .find((c) => commitmentIntervals([c], date, tz).some((b) => overlaps(iv(s), b)));
    if (clash) {
      issues.push({
        kind: 'commitment_overlap',
        sessionIds: [s.id],
        message: `"${taskTitle(s.taskId)}" on ${formatInstant(Date.parse(s.startAt), tz)} clashes with "${clash.title}".`,
      });
    }
  }

  for (const [date, minutes] of byDate) {
    const override = (input.overrides ?? []).find((o) => !o.deletedAt && o.date === date);
    const limit = override?.maxMinutes ?? input.preferences.dailyLimitMinutes;
    if (minutes > limit) {
      issues.push({
        kind: 'over_daily_limit',
        sessionIds: sessions.filter((s) => localDateKey(Date.parse(s.startAt), tz) === date).map((s) => s.id),
        message: `${date}: ${formatMinutes(minutes)} planned, above your ${formatMinutes(limit)} limit.`,
      });
    }
  }

  for (const t of input.tasks) {
    if (t.deletedAt || t.status === 'done' || t.status === 'archived' || t.remainingMinutes <= 0) continue;
    const mine = sessions.filter((s) => s.taskId === t.id);
    const due = t.dueAt ? Date.parse(t.dueAt) : null;
    const late = due ? mine.filter((s) => Date.parse(s.endAt) > due) : [];
    if (late.length > 0) {
      issues.push({
        kind: 'after_deadline',
        taskId: t.id,
        sessionIds: late.map((s) => s.id),
        message: `${late.length} session${late.length > 1 ? 's' : ''} for "${t.title}" end after its deadline.`,
      });
    }
    if (due && due > input.now) {
      const covered = mine.filter((s) => Date.parse(s.endAt) <= due).reduce((a, s) => a + s.minutes, 0);
      if (covered < t.remainingMinutes) {
        issues.push({
          kind: 'under_planned',
          taskId: t.id,
          sessionIds: mine.map((s) => s.id),
          message: `"${t.title}" has ${formatMinutes(t.remainingMinutes - covered)} of work without a session before its deadline.`,
        });
      }
    }
  }
  return issues;
}
