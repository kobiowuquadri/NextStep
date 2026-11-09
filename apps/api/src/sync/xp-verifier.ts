import { Injectable } from '@nestjs/common';
import { addDaysToKey, type XpEventType } from '@nextstep/contracts';
import {
  ACHIEVEMENTS,
  DAILY_QUESTS,
  WEEKLY_QUESTS,
  daysAway,
  dedupeKeyFor,
  evaluateAward,
  levelFromXp,
  steadyWeeks,
  totalXp,
  type AwardRequest,
  type LedgerEntry,
} from '@nextstep/gamification';
import type { Tx } from '../prisma.service.js';
import { toWire } from './registry.js';

export type Verdict =
  | { kind: 'ok'; xp: number; dedupeKey: string }
  | { kind: 'duplicate'; existing: Record<string, unknown> & { rev: number } }
  | { kind: 'invalid'; reason: string };

/**
 * Server-authoritative XP. The client's claimed XP is ignored: the server
 * checks that the underlying activity exists in its own data, recomputes the
 * award with the shared rules, and applies caps by the action's local date
 * (so syncing late never costs a student XP).
 */
@Injectable()
export class XpVerifier {
  async ledger(tx: Tx, userId: string): Promise<LedgerEntry[]> {
    const rows = await tx.gamificationEvent.findMany({ where: { userId, deletedAt: null }, orderBy: { occurredAt: 'asc' } });
    return rows.map((r) => ({ ...(toWire('gamificationEvent', r as never) as unknown as LedgerEntry), status: 'confirmed' }));
  }

  async verifyEvent(tx: Tx, userId: string, data: Record<string, unknown>): Promise<Verdict> {
    const type = data.type as XpEventType;
    const meta = { ...((data.meta ?? {}) as Record<string, unknown>) } as AwardRequest['data'] & Record<string, unknown>;
    const occurredAt = data.occurredAt as string;
    const localDate = data.localDate as string;
    if (Date.parse(occurredAt) > Date.now() + 5 * 60_000) return { kind: 'invalid', reason: 'FUTURE' };
    const own = { userId, deletedAt: null };

    switch (type) {
      case 'task_completed': {
        const t = await tx.task.findFirst({ where: { id: String(meta.taskId), ...own } });
        if (!t || t.status !== 'done') return { kind: 'invalid', reason: 'TASK_NOT_DONE' };
        meta.estimatedMinutes = t.estimatedMinutes;
        meta.taskAgeMinutes = Math.round((Date.parse(occurredAt) - t.createdAt.getTime()) / 60000);
        if (t.goalId) return { kind: 'invalid', reason: 'GOAL_TASK' };
        break;
      }
      case 'subtask_completed': {
        const s = await tx.subtask.findFirst({ where: { id: String(meta.subtaskId), ...own } });
        if (!s || !s.done) return { kind: 'invalid', reason: 'SUBTASK_NOT_DONE' };
        break;
      }
      case 'focus_completed':
      case 'checkin_completed': {
        const f = await tx.focusLog.findFirst({ where: { id: String(meta.focusLogId), ...own } });
        if (!f) return { kind: 'invalid', reason: 'FOCUS_LOG_MISSING' };
        meta.focusMinutes = f.focusMinutes;
        meta.breakTaken = f.breakCount > 0;
        break;
      }
      case 'recovery_accepted': {
        const p = await tx.recoveryProposal.findFirst({ where: { id: String(meta.proposalId), ...own } });
        if (!p || (p.status !== 'accepted' && p.status !== 'undone')) return { kind: 'invalid', reason: 'PROPOSAL_NOT_ACCEPTED' };
        break;
      }
      case 'recovery_next_action': {
        const p = await tx.recoveryProposal.findFirst({ where: { id: String(meta.proposalId), ...own } });
        if (!p || !p.nextActionCompletedAt) return { kind: 'invalid', reason: 'NEXT_ACTION_NOT_DONE' };
        break;
      }
      case 'reflection_completed': {
        const r = await tx.weeklyReflection.findFirst({ where: { weekStart: String(meta.weekStart), ...own } });
        if (!r) return { kind: 'invalid', reason: 'REFLECTION_MISSING' };
        break;
      }
      case 'goal_checkin': {
        const c = await tx.goalCheckin.findFirst({ where: { goalId: String(meta.goalId), date: localDate, ...own } });
        if (!c) return { kind: 'invalid', reason: 'CHECKIN_MISSING' };
        break;
      }
      case 'practice_completed': {
        const p = await tx.resourceProgress.findFirst({ where: { resourceId: String(meta.resourceId), ...own } });
        if (!p || !p.completedAt) return { kind: 'invalid', reason: 'PRACTICE_NOT_DONE' };
        break;
      }
      case 'plan_created': {
        const r = await tx.planRevision.findFirst({ where: own });
        if (!r) return { kind: 'invalid', reason: 'NO_PLAN' };
        break;
      }
      case 'welcome_back':
      case 'quest_completed':
        break;
      default:
        return { kind: 'invalid', reason: 'UNKNOWN_TYPE' };
    }

    const ledger = await this.ledger(tx, userId);
    if (type === 'welcome_back') {
      const away = daysAway(ledger, localDate);
      if (away === null || away < 3) return { kind: 'invalid', reason: 'NOT_AWAY' };
      meta.daysAway = away;
    }
    if (type === 'quest_completed') {
      const check = this.verifyQuest(ledger, String(meta.questInstanceId));
      if (!check.ok) return { kind: 'invalid', reason: 'QUEST_NOT_COMPLETE' };
      meta.questXp = check.xp;
    }

    const req: AwardRequest = { type, occurredAt, localDate, data: meta };
    const key = dedupeKeyFor(req);
    if (data.dedupeKey !== key) return { kind: 'invalid', reason: 'DEDUPE_KEY_MISMATCH' };
    const existing = await tx.gamificationEvent.findUnique({ where: { userId_dedupeKey: { userId, dedupeKey: key } } });
    if (existing) return { kind: 'duplicate', existing: toWire('gamificationEvent', existing as never) as Record<string, unknown> & { rev: number } };
    const outcome = evaluateAward(ledger, req, String(data.id));
    if (outcome.result === 'duplicate') return { kind: 'invalid', reason: 'DUPLICATE' };
    return { kind: 'ok', xp: outcome.xp, dedupeKey: key };
  }

  private verifyQuest(ledger: LedgerEntry[], instanceId: string): { ok: boolean; xp: number } {
    const m = /^(daily|weekly):(\d{4}-\d{2}-\d{2}):([a-z_]+)$/.exec(instanceId);
    if (!m) return { ok: false, xp: 0 };
    const [, cadence, date, id] = m;
    const def = (cadence === 'daily' ? DAILY_QUESTS : WEEKLY_QUESTS).find((q) => q.id === id);
    if (!def) return { ok: false, xp: 0 };
    const days = cadence === 'daily' ? new Set([date]) : new Set(Array.from({ length: 7 }, (_, i) => addDaysToKey(date!, i)));
    const entries = ledger.filter((e) => days.has(e.localDate));
    return { ok: def.measure(entries) >= def.target, xp: def.xp };
  }

  async verifyAchievement(tx: Tx, userId: string, achievementId: string): Promise<boolean> {
    const def = ACHIEVEMENTS.find((a) => a.id === achievementId);
    if (!def) return false;
    const ledger = await this.ledger(tx, userId);
    const prefs = await tx.userPreferences.findUnique({ where: { userId } });
    const today = ledger.length ? ledger[ledger.length - 1]!.localDate : new Date().toISOString().slice(0, 10);
    return def.check({ ledger, level: levelFromXp(totalXp(ledger)).level, steady: steadyWeeks(ledger, today, prefs?.weeklyActiveDaysGoal ?? 4) });
  }
}
