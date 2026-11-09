import {
  addDaysToKey,
  formatDateKey,
  formatInstant,
  formatMinutes,
  HOUR,
  instantAt,
  localDateKey,
  MINUTE,
  stableHash,
  stableUuid,
  weekStartOfKey,
} from '@nextstep/contracts';
import { reasonsFor, scoreTask } from './priority.js';
import { buildFreeTime, reserve, type Interval } from './slots.js';
import type {
  DayLoad,
  PlannedSession,
  PlannerInput,
  PlannerSession,
  PlannerTask,
  PlanResult,
  Shortfall,
  ShortfallOption,
  TaskPlan,
  TaskPlanStatus,
} from './types.js';

const OPEN = (t: PlannerTask) => !t.deletedAt && t.status !== 'done' && t.status !== 'archived';

type Group = 0 | 1 | 2 | 3; // 0 deadline · 1 overdue · 2 no deadline · 3 personal goal

interface Placement {
  task: PlannerTask;
  group: Group;
  effDue: number;
  score: number;
  needed: number;
  placedMinutes: number;
  keptMinutes: number;
  sessions: PlannedSession[];
  keptSessions: PlannedSession[];
  tight: boolean;
  blockedBy: PlannerTask | null;
  finishedAt: number | null;
  nonSplittableTooLarge: boolean;
}

export interface AllocationResult {
  placements: Placement[];
  ordered: Placement[];
  kept: PlannedSession[];
  newSessions: PlannedSession[];
  days: DayLoad[];
  warnings: string[];
  horizonEnd: number;
}

function toPlanned(s: PlannerSession, isNew: boolean): PlannedSession {
  return {
    id: s.id,
    taskId: s.taskId,
    startAt: s.startAt,
    endAt: s.endAt,
    minutes: s.minutes,
    status: s.status,
    pinned: s.pinned,
    source: s.source,
    label: s.label ?? null,
    isNew,
  };
}

/** Fingerprint of every planning-relevant input except the clock. Used to detect stale previews. */
export function planFingerprint(input: PlannerInput): string {
  const p = input.preferences;
  return stableHash({
    tasks: input.tasks
      .map((t) => [t.id, t.dueAt, t.remainingMinutes, t.status, t.importance, t.dependsOn ?? [], t.splittable, t.optional, t.connectivity, t.preferredSessionMinutes, t.deletedAt ?? null])
      .sort(),
    sessions: input.sessions.map((s) => [s.id, s.startAt, s.endAt, s.status, s.pinned, s.deletedAt ?? null]).sort(),
    availability: input.availability.map((a) => [a.weekday, a.start, a.end, a.online ?? true, a.deletedAt ?? null]).sort(),
    commitments: input.commitments.map((c) => [c.weekdays, c.date ?? null, c.start, c.end, c.deletedAt ?? null]).sort(),
    overrides: (input.overrides ?? []).map((o) => [o.date, o.maxMinutes, o.windows ?? null, o.deletedAt ?? null]).sort(),
    prefs: [p.timezone, p.defaultSessionMinutes, p.minSessionMinutes, p.maxSessionMinutes, p.dailyLimitMinutes, p.bufferMinutes, p.deadlineBufferHours, p.maxSessionsPerTaskPerDay],
  });
}

/** Core allocation. Pure and deterministic for a given input. */
export function allocate(input: PlannerInput): AllocationResult {
  const prefs = input.preferences;
  const tz = prefs.timezone;
  const now = input.now;
  const bufferMs = prefs.bufferMinutes * MINUTE;
  const warnings: string[] = [];
  const excluded = new Set(input.excludeTaskIds ?? []);
  const locked = new Set(input.lockedSessionIds ?? []);
  const source = input.source ?? 'auto';

  const allTasks = input.tasks.filter((t) => !t.deletedAt);
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  const planTasks = allTasks.filter((t) => OPEN(t) && !excluded.has(t.id) && t.remainingMinutes > 0);

  // ── Classify existing sessions ──────────────────────────────────────────
  const liveSessions = input.sessions.filter((s) => !s.deletedAt);
  const kept: PlannedSession[] = [];
  for (const s of liveSessions) {
    const start = Date.parse(s.startAt);
    const end = Date.parse(s.endAt);
    if (s.status === 'done') {
      kept.push(toPlanned(s, false));
      continue;
    }
    if (s.status !== 'planned' || end <= now) continue; // missed/skipped/past sessions are history
    const inProgress = start <= now && end > now;
    if (s.pinned || locked.has(s.id) || inProgress) kept.push(toPlanned(s, false));
    // Otherwise it's a replaceable planned session; the new plan supersedes it.
  }

  const keptFuture = kept.filter((s) => s.status === 'planned' && Date.parse(s.endAt) > now);
  const blocks: Interval[] = keptFuture.map((s) => ({ start: Date.parse(s.startAt), end: Date.parse(s.endAt) }));
  const free = buildFreeTime(input, blocks);
  const { slots, days } = free;

  for (const s of kept) {
    const date = localDateKey(Date.parse(s.startAt), tz);
    const day = days.get(date);
    if (!day) continue;
    if (s.status === 'done') {
      day.doneMinutes += s.minutes;
      day.usedMinutes += s.minutes;
    } else if (Date.parse(s.endAt) > now) day.usedMinutes += s.minutes;
  }

  // ── Dependency graph ─────────────────────────────────────────────────────
  const planIds = new Set(planTasks.map((t) => t.id));
  const dependentsOf = new Map<string, PlannerTask[]>();
  for (const t of allTasks) {
    for (const d of t.dependsOn ?? []) {
      if (!dependentsOf.has(d)) dependentsOf.set(d, []);
      dependentsOf.get(d)!.push(t);
    }
  }

  const effDueMemo = new Map<string, number>();
  const visiting = new Set<string>();
  const effDue = (t: PlannerTask): number => {
    if (effDueMemo.has(t.id)) return effDueMemo.get(t.id)!;
    if (visiting.has(t.id)) return t.dueAt ? Date.parse(t.dueAt) : Infinity;
    visiting.add(t.id);
    let due = t.dueAt ? Date.parse(t.dueAt) : Infinity;
    for (const d of dependentsOf.get(t.id) ?? []) if (planIds.has(d.id)) due = Math.min(due, effDue(d));
    visiting.delete(t.id);
    effDueMemo.set(t.id, due);
    return due;
  };

  const placements = new Map<string, Placement>();
  for (const t of planTasks) {
    const ed = effDue(t);
    const group: Group = t.goalId ? 3 : t.dueAt && Date.parse(t.dueAt) <= now ? 1 : Number.isFinite(ed) && ed > now ? 0 : Number.isFinite(ed) ? 1 : 2;
    const keptMinutes = keptFuture.filter((s) => s.taskId === t.id).reduce((a, s) => a + s.minutes, 0);
    placements.set(t.id, {
      task: t,
      group,
      effDue: ed,
      score: scoreTask(t, now, dependentsOf.get(t.id) ?? []),
      needed: Math.max(0, t.remainingMinutes - keptMinutes),
      placedMinutes: 0,
      keptMinutes,
      sessions: [],
      keptSessions: keptFuture.filter((s) => s.taskId === t.id),
      tight: false,
      blockedBy: null,
      finishedAt: null,
      nonSplittableTooLarge: false,
    });
  }

  const compare = (a: Placement, b: Placement): number =>
    a.group - b.group ||
    a.effDue - b.effDue ||
    b.task.importance - a.task.importance ||
    b.score - a.score ||
    (a.task.createdAt ?? '').localeCompare(b.task.createdAt ?? '') ||
    a.task.id.localeCompare(b.task.id);

  // ── Topological order (Kahn) with priority tie-breaking ─────────────────
  const openDeps = (t: PlannerTask) => (t.dependsOn ?? []).filter((d) => planIds.has(d));
  const indegree = new Map(planTasks.map((t) => [t.id, openDeps(t).length]));
  const ready = [...placements.values()].filter((p) => indegree.get(p.task.id) === 0).sort(compare);
  const ordered: Placement[] = [];
  const seen = new Set<string>();
  while (ready.length > 0) {
    const p = ready.shift()!;
    ordered.push(p);
    seen.add(p.task.id);
    for (const d of dependentsOf.get(p.task.id) ?? []) {
      if (!placements.has(d.id)) continue;
      const n = (indegree.get(d.id) ?? 0) - 1;
      indegree.set(d.id, n);
      if (n === 0) {
        ready.push(placements.get(d.id)!);
        ready.sort(compare);
      }
    }
  }
  const cyclic = [...placements.values()].filter((p) => !seen.has(p.task.id)).sort(compare);
  if (cyclic.length > 0) {
    warnings.push(`These tasks depend on each other in a loop, so their order was ignored: ${cyclic.map((p) => `"${p.task.title}"`).join(', ')}.`);
    ordered.push(...cyclic);
  }
  const cyclicIds = new Set(cyclic.map((p) => p.task.id));

  // ── Subtask labels ───────────────────────────────────────────────────────
  const labelsFor = (taskId: string): string[] =>
    (input.subtasks ?? [])
      .filter((s) => s.taskId === taskId && !s.done && !s.deletedAt)
      .sort((a, b) => a.position - b.position)
      .map((s) => s.title);

  // ── Allocation ──────────────────────────────────────────────────────────
  const newSessions: PlannedSession[] = [];
  const weekEnd = instantAt(addDaysToKey(weekStartOfKey(localDateKey(now, tz)), 7), '00:00', tz);

  for (const p of ordered) {
    const t = p.task;
    let earliest = free.horizonStart;
    if (!cyclicIds.has(t.id)) {
      for (const depId of openDeps(t)) {
        const dep = placements.get(depId);
        if (!dep) continue;
        if (dep.needed > 0 || dep.blockedBy) {
          p.blockedBy = dep.task;
          break;
        }
        if (dep.finishedAt) earliest = Math.max(earliest, dep.finishedAt + bufferMs);
      }
    }
    for (const s of p.keptSessions) p.finishedAt = Math.max(p.finishedAt ?? 0, Date.parse(s.endAt));
    if (p.blockedBy || p.needed === 0) continue;

    const sessionLen = Math.min(prefs.maxSessionMinutes, Math.max(prefs.minSessionMinutes, t.preferredSessionMinutes ?? prefs.defaultSessionMinutes));
    const perDayCap = p.group >= 2 ? 1 : prefs.maxSessionsPerTaskPerDay;
    const splittable = t.splittable !== false;
    const dayCount = new Map<string, number>();
    for (const s of p.keptSessions) {
      const d = localDateKey(Date.parse(s.startAt), tz);
      dayCount.set(d, (dayCount.get(d) ?? 0) + 1);
    }
    const labels = labelsFor(t.id);
    const due = t.dueAt ? Date.parse(t.dueAt) : Infinity;
    const softLimit = due - prefs.deadlineBufferHours * HOUR;

    const passes: Array<{ limit: number; tight: boolean }> =
      p.group === 0
        ? [
            ...(softLimit > earliest ? [{ limit: softLimit, tight: false }] : []),
            { limit: due, tight: true },
          ]
        : p.group === 3
          ? [{ limit: Math.min(free.horizonEnd, weekEnd), tight: false }]
          : [{ limit: free.horizonEnd, tight: false }];

    if (!splittable && p.needed > prefs.dailyLimitMinutes) p.nonSplittableTooLarge = true;

    for (const pass of passes) {
      let placedSomething = true;
      while (p.needed > 0 && placedSomething) {
        placedSomething = false;
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i]!;
          if (slot.end <= earliest || slot.start >= pass.limit) continue;
          if (t.connectivity === 'online' && !slot.online) continue;
          if ((dayCount.get(slot.date) ?? 0) >= perDayCap) continue;
          const day = days.get(slot.date)!;
          const budget = day.limitMinutes - day.usedMinutes;
          const start = Math.max(slot.start, earliest);
          const avail = Math.floor((Math.min(slot.end, pass.limit) - start) / MINUTE);
          let chunk: number;
          if (!splittable) {
            if (avail < p.needed || budget < p.needed) continue;
            chunk = p.needed;
          } else {
            chunk = Math.min(sessionLen, p.needed, avail, budget);
            const minChunk = Math.min(prefs.minSessionMinutes, p.needed);
            if (chunk < minChunk) continue;
            // Avoid leaving a sliver smaller than half a minimum session for later.
            const rest = p.needed - chunk;
            if (rest > 0 && rest < prefs.minSessionMinutes / 2 && chunk + rest <= Math.min(avail, budget)) chunk += rest;
            else if (rest > 0 && chunk > 5) chunk = Math.floor(chunk / 5) * 5;
          }
          const end = start + chunk * MINUTE;
          const ordinal = p.sessions.length;
          const session: PlannedSession = {
            id: stableUuid(input.seed, t.id, start, end),
            taskId: t.id,
            startAt: new Date(start).toISOString(),
            endAt: new Date(end).toISOString(),
            minutes: chunk,
            status: 'planned',
            pinned: false,
            source,
            label: labels[ordinal] ?? null,
            isNew: true,
          };
          p.sessions.push(session);
          newSessions.push(session);
          reserve(slots, i, start, end, bufferMs, 5 * MINUTE);
          day.usedMinutes += chunk;
          dayCount.set(slot.date, (dayCount.get(slot.date) ?? 0) + 1);
          p.needed -= chunk;
          p.placedMinutes += chunk;
          p.finishedAt = Math.max(p.finishedAt ?? 0, end);
          if (pass.tight && end > softLimit) p.tight = true;
          placedSomething = true;
          break; // slots changed; rescan from the start
        }
      }
    }
  }

  const dayLoads: DayLoad[] = [...days.values()].map((d) => ({
    date: d.date,
    limitMinutes: d.limitMinutes,
    windowMinutes: d.windowMinutes,
    plannedMinutes: d.usedMinutes - d.doneMinutes,
    doneMinutes: d.doneMinutes,
  }));

  return {
    placements: [...placements.values()],
    ordered,
    kept: kept.filter((s) => Date.parse(s.endAt) > now || s.status === 'done'),
    newSessions,
    days: dayLoads,
    warnings,
    horizonEnd: free.horizonEnd,
  };
}

function statusOf(p: Placement): TaskPlanStatus {
  if (p.blockedBy) return 'blocked';
  if (p.group === 1) return 'overdue';
  if (p.group >= 2) return 'flexible';
  if (p.needed > 0) return 'at_risk';
  if (p.tight) return 'tight';
  return 'on_track';
}

function explain(p: Placement, status: TaskPlanStatus, tz: string, horizonDays: number): string {
  const all = [...p.keptSessions, ...p.sessions];
  const n = all.length;
  const minutes = p.keptMinutes + p.placedMinutes;
  const last = p.finishedAt;
  const due = p.task.dueAt ? Date.parse(p.task.dueAt) : null;
  const sessionsText = `${n} session${n === 1 ? '' : 's'} (${formatMinutes(minutes)})`;
  switch (status) {
    case 'on_track': {
      if (n === 0) return 'On track: no more work remaining.';
      const lead = due && last ? Math.floor((due - last) / HOUR) : null;
      const leadText = lead === null ? '' : lead >= 48 ? ` — ${Math.floor(lead / 24)} days before the deadline` : ` — ${lead} h before the deadline`;
      return `On track: ${sessionsText} planned, finishing ${last ? formatInstant(last, tz) : ''}${leadText}.`;
    }
    case 'tight':
      return `Tight: ${sessionsText} fit, but the last one ends inside your deadline buffer — little room if something slips.`;
    case 'at_risk':
      if (p.nonSplittableTooLarge)
        return `At risk: it needs one uninterrupted ${formatMinutes(p.task.remainingMinutes)} block, which is more than any day allows. Consider allowing it to be split.`;
      return `At risk: ${formatMinutes(p.needed)} of work doesn't fit before ${due ? formatInstant(due, tz) : 'the deadline'}${n > 0 ? ` (${formatMinutes(minutes)} is planned)` : ''}.`;
    case 'blocked':
      return `Waiting: it can't start until "${p.blockedBy?.title}" fits in full.`;
    case 'overdue':
      return `Overdue: the deadline has passed. ${p.placedMinutes > 0 ? `${formatMinutes(p.placedMinutes)} is planned after current deadlines.` : 'Decide whether to finish, update or archive it.'}`;
    case 'flexible':
      return p.needed > 0
        ? `Flexible: ${formatMinutes(minutes)} planned in the next ${horizonDays} days; ${formatMinutes(p.needed)} continues later.`
        : `Flexible: ${sessionsText} planned around your deadline work.`;
    default:
      return '';
  }
}

export function summarise(input: PlannerInput, a: AllocationResult): { tasks: TaskPlan[]; shortfall: Shortfall | null } {
  const tz = input.preferences.timezone;
  const byId = new Map(input.tasks.map((t) => [t.id, t]));
  const dependentsOf = (id: string) => input.tasks.filter((t) => !t.deletedAt && (t.dependsOn ?? []).includes(id));
  const tasks: TaskPlan[] = a.ordered.map((p, idx) => {
    const status = statusOf(p);
    const all = [...p.keptSessions, ...p.sessions].sort((x, y) => x.startAt.localeCompare(y.startAt));
    const deps = (p.task.dependsOn ?? []).map((d) => byId.get(d)).filter((d): d is PlannerTask => !!d && !d.deletedAt);
    return {
      taskId: p.task.id,
      title: p.task.title,
      status,
      dueAt: p.task.dueAt,
      remainingMinutes: p.task.remainingMinutes,
      scheduledMinutes: p.keptMinutes + p.placedMinutes,
      shortfallMinutes: status === 'at_risk' || status === 'blocked' ? (status === 'blocked' ? p.task.remainingMinutes - p.keptMinutes : p.needed) : 0,
      firstSessionAt: all[0]?.startAt ?? null,
      lastSessionEndAt: all[all.length - 1]?.endAt ?? null,
      score: p.score,
      rank: idx + 1,
      reasons: reasonsFor(p.task, input.now, tz, dependentsOf(p.task.id), deps),
      explanation: explain(p, status, tz, input.horizonDays ?? 14),
    };
  });
  const risky = tasks.filter((t) => (t.status === 'at_risk' || t.status === 'blocked') && t.dueAt);
  if (risky.length === 0) return { tasks, shortfall: null };
  const total = risky.reduce((s, t) => s + t.shortfallMinutes, 0);
  return {
    tasks,
    shortfall: {
      totalMinutes: total,
      taskIds: risky.map((t) => t.taskId),
      message: `${formatMinutes(total)} of work doesn't fit before ${risky.length === 1 ? 'its deadline' : `${risky.length} deadlines`}. NextStep won't pretend it does — here are your options.`,
      options: [],
    },
  };
}

function shortfallFor(input: PlannerInput, taskId: string): number {
  const a = allocate({ ...input, skipOptions: true });
  const p = a.placements.find((x) => x.task.id === taskId);
  if (!p) return 0;
  return p.blockedBy ? p.task.remainingMinutes - p.keptMinutes : p.needed;
}

/** Deterministic "what if" simulations that turn a shortfall into concrete choices. */
export function shortfallOptions(input: PlannerInput, a: AllocationResult, tasks: TaskPlan[]): ShortfallOption[] {
  const tz = input.preferences.timezone;
  const options: ShortfallOption[] = [];
  const risky = tasks.filter((t) => (t.status === 'at_risk' || t.status === 'blocked') && t.dueAt).slice(0, 2);
  for (const r of risky) {
    const task = input.tasks.find((t) => t.id === r.taskId)!;
    const due = Date.parse(r.dueAt!);
    const dueText = formatInstant(due, tz);

    options.push({
      kind: 'reduce_scope',
      taskId: r.taskId,
      minutes: r.shortfallMinutes,
      title: `Reduce the scope of "${r.title}"`,
      detail: `Lower its remaining effort by about ${formatMinutes(r.shortfallMinutes)} — for example, aim for a complete draft instead of a polished one, or drop an optional part.`,
      resolves: true,
    });

    // Defer a lower-priority task that currently uses time before this deadline.
    const ancestors = new Set<string>();
    const walk = (id: string) => {
      for (const d of input.tasks.find((t) => t.id === id)?.dependsOn ?? []) if (!ancestors.has(d)) { ancestors.add(d); walk(d); }
    };
    walk(r.taskId);
    const candidates = a.placements
      .filter((p) => p.task.id !== r.taskId && !ancestors.has(p.task.id))
      .filter((p) => p.task.optional || p.task.importance < task.importance || p.group >= 2)
      .map((p) => ({ p, before: p.sessions.filter((s) => Date.parse(s.startAt) < due).reduce((s, x) => s + x.minutes, 0) }))
      .filter((c) => c.before > 0)
      .sort((x, y) => y.before - x.before || x.p.task.id.localeCompare(y.p.task.id))
      .slice(0, 3);
    for (const c of candidates) {
      const after = shortfallFor({ ...input, excludeTaskIds: [...(input.excludeTaskIds ?? []), c.p.task.id] }, r.taskId);
      const gained = r.shortfallMinutes - after;
      if (gained <= 0) continue;
      options.push({
        kind: 'defer_task',
        taskId: r.taskId,
        deferTaskId: c.p.task.id,
        minutes: gained,
        title: `Defer "${c.p.task.title}"`,
        detail: `${c.p.task.optional ? 'It is optional. ' : c.p.group >= 2 ? 'It has no deadline. ' : 'It is lower importance. '}Pausing it frees ${formatMinutes(gained)} before ${dueText}${after === 0 ? ', which covers the gap.' : `; ${formatMinutes(after)} would still be short.`}`,
        resolves: after === 0,
      });
    }

    // Temporarily raise the daily limit on the days before the deadline.
    const prefs = input.preferences;
    const raised = Math.min(600, prefs.dailyLimitMinutes + 60);
    const dueKey = localDateKey(due, tz);
    const dates = a.days.map((d) => d.date).filter((d) => d <= dueKey);
    const reducedByStudent = new Set((input.overrides ?? []).filter((o) => !o.deletedAt && o.maxMinutes !== null && o.maxMinutes < prefs.dailyLimitMinutes).map((o) => o.date));
    const raiseDates = dates.filter((d) => !reducedByStudent.has(d));
    if (raiseDates.length > 0 && raised > prefs.dailyLimitMinutes) {
      const after = shortfallFor(
        { ...input, overrides: [...(input.overrides ?? []), ...raiseDates.map((date) => ({ date, maxMinutes: raised, reason: 'simulation' }))] },
        r.taskId,
      );
      const gained = r.shortfallMinutes - after;
      if (gained > 0) {
        options.push({
          kind: 'raise_daily_limit',
          taskId: r.taskId,
          minutes: gained,
          dailyLimit: raised,
          dates: raiseDates,
          title: `Allow up to ${formatMinutes(raised)} a day until ${formatDateKey(dueKey)}`,
          detail: `Uses more of your existing study windows. Gains ${formatMinutes(gained)}${after === 0 ? ' — enough to fit it.' : `; ${formatMinutes(after)} would still be short.`} Only do this if it's genuinely sustainable.`,
          resolves: after === 0,
        });
      }
    }

    const emptyDay = a.days.find((d) => d.date <= dueKey && d.windowMinutes === 0);
    options.push({
      kind: 'add_time',
      taskId: r.taskId,
      minutes: r.shortfallMinutes,
      title: 'Add study time before the deadline',
      detail: `Add a window of about ${formatMinutes(r.shortfallMinutes)} before ${dueText}${emptyDay ? ` — ${formatDateKey(emptyDay.date)} currently has none` : ''}. Edit availability in Plan → Availability.`,
      resolves: false,
    });
  }
  options.push({
    kind: 'seek_help',
    title: 'Ask for help or clarity',
    detail: 'Talk to your lecturer, tutor or a classmate about the workload or an extension. NextStep never changes a real deadline for you.',
    resolves: false,
  });
  return options;
}

/** Generate a complete plan with explanations and, when needed, shortfall options. */
export function generatePlan(input: PlannerInput): PlanResult {
  const a = allocate(input);
  const { tasks, shortfall } = summarise(input, a);
  if (shortfall && !input.skipOptions) shortfall.options = shortfallOptions(input, a, tasks);
  const sessions = [...a.kept.filter((s) => s.status === 'planned'), ...a.newSessions].sort((x, y) => x.startAt.localeCompare(y.startAt));
  return {
    generatedAt: new Date(input.now).toISOString(),
    fingerprint: planFingerprint(input),
    sessions,
    newSessions: a.newSessions,
    tasks,
    days: a.days,
    shortfall,
    warnings: a.warnings,
  };
}
