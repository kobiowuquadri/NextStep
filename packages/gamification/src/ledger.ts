import type { XpEventType } from '@nextstep/contracts';
import { baseXp, dedupeKeyFor, RULES, type AwardRequest } from './rules.js';

export interface LedgerEntry {
  id: string;
  dedupeKey: string;
  type: XpEventType;
  xp: number;
  occurredAt: string;
  localDate: string;
  meta: Record<string, unknown>;
  status?: 'pending' | 'confirmed' | 'rejected';
  deletedAt?: string | null;
}

export interface AwardOutcome {
  /** 'awarded' — new entry; 'duplicate' — already in the ledger; 'capped' — recorded with reduced XP. */
  result: 'awarded' | 'duplicate' | 'capped';
  entry: LedgerEntry;
  xp: number;
}

const counted = (e: LedgerEntry) => !e.deletedAt && e.status !== 'rejected';

/**
 * Evaluate an award against the ledger. Pure: returns the entry to append (or
 * the existing one for duplicates). Caps apply per local date of the action.
 */
export function evaluateAward(ledger: readonly LedgerEntry[], req: AwardRequest, id: string): AwardOutcome {
  const dedupeKey = dedupeKeyFor(req);
  const existing = ledger.find((e) => e.dedupeKey === dedupeKey && !e.deletedAt);
  if (existing) return { result: 'duplicate', entry: existing, xp: 0 };

  const rule = RULES[req.type];
  let xp = baseXp(req);
  let capped = false;
  const sameDay = ledger.filter((e) => counted(e) && e.type === req.type && e.localDate === req.localDate);
  if (rule.dailyCountCap !== undefined && sameDay.length >= rule.dailyCountCap) {
    xp = 0;
    capped = true;
  }
  if (rule.dailyXpCap !== undefined) {
    const used = sameDay.reduce((a, e) => a + e.xp, 0);
    const room = Math.max(0, rule.dailyXpCap - used);
    if (xp > room) {
      xp = room;
      capped = true;
    }
  }
  const entry: LedgerEntry = {
    id,
    dedupeKey,
    type: req.type,
    xp,
    occurredAt: req.occurredAt,
    localDate: req.localDate,
    meta: { ...req.data },
    status: 'pending',
  };
  return { result: capped ? 'capped' : 'awarded', entry, xp };
}

export function totalXp(ledger: readonly LedgerEntry[]): number {
  return ledger.filter(counted).reduce((a, e) => a + e.xp, 0);
}

/**
 * Reconcile local pending entries with the server's confirmed ledger. The
 * server copy wins for any shared dedupe key; local entries the server has
 * not seen yet stay pending (never dropped for being late).
 */
export function reconcileLedger(local: readonly LedgerEntry[], server: readonly LedgerEntry[]): LedgerEntry[] {
  const byKey = new Map<string, LedgerEntry>();
  for (const e of server) byKey.set(e.dedupeKey, { ...e, status: e.status === 'rejected' ? 'rejected' : 'confirmed' });
  for (const e of local) if (!byKey.has(e.dedupeKey)) byKey.set(e.dedupeKey, e);
  return [...byKey.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.dedupeKey.localeCompare(b.dedupeKey));
}
