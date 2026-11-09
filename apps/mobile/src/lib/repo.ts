import * as Crypto from 'expo-crypto';
import { SYNC_ENTITIES, type Preferences, type SyncEntity } from '@nextstep/contracts';
import { COLLECTION_OF, emptyState, type AppState, type Mutation } from '@nextstep/engine';
import type { Db } from './db';

/** Read everything for this account into memory (small: hundreds of records). */
export async function loadState(db: Db, userId: string): Promise<AppState | null> {
  const rows = await db.getAllAsync<{ entity: SyncEntity; data: string }>('SELECT entity, data FROM records');
  let prefs: Preferences | null = null;
  const buckets = new Map<SyncEntity, unknown[]>(SYNC_ENTITIES.map((e) => [e, []]));
  for (const r of rows) {
    const record = JSON.parse(r.data);
    if (r.entity === 'preferences') prefs = record;
    else buckets.get(r.entity)?.push(record);
  }
  if (!prefs) return null;
  const state = emptyState(userId, prefs);
  for (const [entity, items] of buckets) {
    if (entity === 'preferences') continue;
    (state as unknown as Record<string, unknown[]>)[COLLECTION_OF[entity]] = items;
  }
  return state;
}

export interface PersistOptions {
  /** Enqueue for sync (signed-in accounts only). */
  sync: boolean;
  /** Ops that must be applied together on the server (e.g. accepting a recovery plan). */
  batch?: boolean;
  basePlanRevision?: number;
}

/**
 * Persist mutations and their outbox entries in ONE local transaction, so a
 * crash or power cut can never leave data saved without its sync operation.
 * Repeated offline edits to the same record coalesce into a single pending op.
 */
export async function persist(db: Db, mutations: Mutation[], opts: PersistOptions): Promise<void> {
  if (mutations.length === 0) return;
  const batchId = opts.batch ? Crypto.randomUUID() : null;
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const m of mutations) {
      const deleted = m.record.deletedAt ? 1 : 0;
      const rev = (m.record.rev as number | undefined) ?? null;
      await txn.runAsync(
        `INSERT INTO records (entity, id, data, rev, deleted) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(entity, id) DO UPDATE SET data = excluded.data, deleted = excluded.deleted`,
        m.entity,
        m.id,
        JSON.stringify(m.record),
        rev,
        deleted,
      );
      if (!opts.sync) continue;
      const pending = batchId
        ? null
        : await txn.getFirstAsync<{ seq: number; kind: string; changed_fields: string | null; base_rev: number | null }>(
            `SELECT seq, kind, changed_fields, base_rev FROM outbox WHERE entity = ? AND entity_id = ? AND status = 'pending' AND batch_id IS NULL ORDER BY seq DESC LIMIT 1`,
            m.entity,
            m.id,
          );
      if (pending && pending.kind === 'upsert') {
        const fields = new Set<string>([...(pending.changed_fields ? (JSON.parse(pending.changed_fields) as string[]) : []), ...(m.changedFields ?? Object.keys(m.record))]);
        await txn.runAsync(
          `UPDATE outbox SET kind = ?, data = ?, changed_fields = ? WHERE seq = ?`,
          m.kind,
          m.kind === 'delete' ? null : JSON.stringify(m.record),
          pending.base_rev === null ? null : JSON.stringify([...fields]),
          pending.seq,
        );
        continue;
      }
      const localRev = await txn.getFirstAsync<{ rev: number | null }>('SELECT rev FROM records WHERE entity = ? AND id = ?', m.entity, m.id);
      await txn.runAsync(
        `INSERT INTO outbox (op_id, entity, entity_id, kind, base_rev, changed_fields, data, batch_id, base_plan_revision, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        Crypto.randomUUID(),
        m.entity,
        m.id,
        m.kind,
        m.isNew ? null : (localRev?.rev ?? null),
        m.isNew || !m.changedFields ? null : JSON.stringify(m.changedFields),
        m.kind === 'delete' ? null : JSON.stringify(m.record),
        batchId,
        batchId && m.entity === 'planRevision' && m.isNew ? (opts.basePlanRevision ?? null) : null,
        now,
      );
    }
  });
}

/** Write a whole state (used to seed the guest/demo account). */
export async function replaceAll(db: Db, state: AppState): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM records');
    await txn.runAsync('INSERT INTO records (entity, id, data, rev, deleted) VALUES (?, ?, ?, NULL, 0)', 'preferences', state.preferences.id, JSON.stringify(state.preferences));
    for (const entity of SYNC_ENTITIES) {
      if (entity === 'preferences') continue;
      for (const r of (state as unknown as Record<string, Array<Record<string, unknown>>>)[COLLECTION_OF[entity]] ?? []) {
        await txn.runAsync('INSERT INTO records (entity, id, data, rev, deleted) VALUES (?, ?, ?, NULL, ?)', entity, r.id as string, JSON.stringify(r), r.deletedAt ? 1 : 0);
      }
    }
  });
}

export async function pendingCount(db: Db): Promise<{ pending: number; failed: number }> {
  const row = await db.getFirstAsync<{ pending: number; failed: number }>(
    `SELECT SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed FROM outbox`,
  );
  return { pending: row?.pending ?? 0, failed: row?.failed ?? 0 };
}
