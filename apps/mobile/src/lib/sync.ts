import type { OpResult, PullResponse, PushResponse, SyncConflict, SyncOp } from '@nextstep/contracts';
import type { Db } from './db';
import { getMeta, setMeta } from './db';
import { authedRequest, NetworkError } from './api';

interface OutboxRow {
  seq: number;
  op_id: string;
  entity: SyncOp['entity'];
  entity_id: string;
  kind: SyncOp['kind'];
  base_rev: number | null;
  changed_fields: string | null;
  data: string | null;
  batch_id: string | null;
  base_plan_revision: number | null;
  created_at: string;
  attempts: number;
}

export interface SyncOutcome {
  pushed: number;
  pulled: number;
  failed: number;
  conflicts: SyncConflict[];
  needsRepair: boolean;
}

const MAX_OPS = 200;
const TRANSIENT = new Set(['INTERNAL']);

function toOp(r: OutboxRow): SyncOp {
  return {
    opId: r.op_id,
    entity: r.entity,
    entityId: r.entity_id,
    kind: r.kind,
    baseRev: r.base_rev,
    ...(r.changed_fields ? { changedFields: JSON.parse(r.changed_fields) as string[] } : {}),
    ...(r.data ? { data: JSON.parse(r.data) as Record<string, unknown> } : {}),
    ...(r.batch_id ? { batchId: r.batch_id } : {}),
    ...(r.base_plan_revision !== null ? { basePlanRevision: r.base_plan_revision } : {}),
    clientTime: r.created_at,
  };
}

/**
 * Next request: pending ops in order, never two ops for the same record in one
 * request (so a device can't conflict with itself), and whole batches only.
 */
function nextChunk(rows: OutboxRow[]): OutboxRow[] {
  const chunk: OutboxRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rows.length && chunk.length < MAX_OPS; i++) {
    const r = rows[i]!;
    if (r.batch_id) {
      const batch = rows.filter((x) => x.batch_id === r.batch_id);
      if (chunk.length > 0 && (chunk.length + batch.length > MAX_OPS || batch.some((b) => seen.has(`${b.entity}:${b.entity_id}`)))) break;
      chunk.push(...batch);
      batch.forEach((b) => seen.add(`${b.entity}:${b.entity_id}`));
      i += batch.length - 1;
      continue;
    }
    const key = `${r.entity}:${r.entity_id}`;
    if (seen.has(key)) break;
    seen.add(key);
    chunk.push(r);
  }
  return chunk;
}

async function applyResult(db: Db, row: OutboxRow, result: OpResult): Promise<'done' | 'failed' | 'retry' | 'repair'> {
  const later = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM outbox WHERE entity = ? AND entity_id = ? AND status = 'pending' AND seq > ?`,
    row.entity,
    row.entity_id,
    row.seq,
  );
  const hasLater = (later?.n ?? 0) > 0;
  const setRev = async (rev: number | undefined) => {
    if (rev === undefined) return;
    await db.runAsync('UPDATE records SET rev = ? WHERE entity = ? AND id = ?', rev, row.entity, row.entity_id);
    // Rebase later edits of this record on the revision we just created.
    await db.runAsync(`UPDATE outbox SET base_rev = ? WHERE entity = ? AND entity_id = ? AND status = 'pending' AND seq > ? AND base_rev IS NOT NULL`, rev, row.entity, row.entity_id, row.seq);
  };
  const overwrite = async (record: Record<string, unknown>) => {
    if (hasLater) return;
    await db.runAsync('UPDATE records SET data = ?, deleted = ? WHERE entity = ? AND id = ?', JSON.stringify(record), record.deletedAt ? 1 : 0, row.entity, row.entity_id);
  };

  switch (result.status) {
    case 'applied':
    case 'merged':
    case 'duplicate': {
      await setRev(result.rev);
      if (result.record && 'id' in result.record) {
        const record = row.entity === 'gamificationEvent' ? { ...result.record, status: 'confirmed' } : result.record;
        await overwrite(record);
      } else if (row.entity === 'gamificationEvent' && row.kind === 'upsert') {
        const current = await db.getFirstAsync<{ data: string }>('SELECT data FROM records WHERE entity = ? AND id = ?', row.entity, row.entity_id);
        if (current) await overwrite({ ...JSON.parse(current.data), status: 'confirmed' });
      }
      return 'done';
    }
    case 'conflict':
      if (result.reason === 'STALE_PLAN') return 'repair';
      await setRev(result.rev);
      if (result.record) await overwrite(result.record);
      return 'done';
    case 'rejected': {
      const reason = result.reason ?? '';
      if (TRANSIENT.has(reason)) return 'retry';
      if (reason === 'RECORD_DELETED') {
        // Deleted elsewhere: tombstone locally (the JSON's deletedAt is what the app reads).
        const deletedAt = (result.record?.deletedAt as string | undefined) ?? new Date().toISOString();
        await db.runAsync(`UPDATE records SET deleted = 1, data = json_set(data, '$.deletedAt', ?) WHERE entity = ? AND id = ?`, deletedAt, row.entity, row.entity_id);
        await db.runAsync(`DELETE FROM outbox WHERE entity = ? AND entity_id = ? AND status = 'pending' AND seq > ?`, row.entity, row.entity_id, row.seq);
        return 'done';
      }
      if (reason.startsWith('XP_NOT_VERIFIED') || reason === 'ACHIEVEMENT_NOT_EARNED') {
        const current = await db.getFirstAsync<{ data: string }>('SELECT data FROM records WHERE entity = ? AND id = ?', row.entity, row.entity_id);
        if (current && row.entity === 'gamificationEvent') await overwrite({ ...JSON.parse(current.data), status: 'rejected' });
        else await db.runAsync('DELETE FROM records WHERE entity = ? AND id = ?', row.entity, row.entity_id);
        return 'done';
      }
      if (reason === 'DUPLICATE_RESOURCE_PROGRESS' && result.record && 'id' in result.record) {
        await db.runAsync('DELETE FROM records WHERE entity = ? AND id = ?', row.entity, row.entity_id);
        await db.runAsync('INSERT OR REPLACE INTO records (entity, id, data, rev, deleted) VALUES (?, ?, ?, ?, 0)', row.entity, result.record.id as string, JSON.stringify(result.record), (result.record.rev as number) ?? null);
        return 'done';
      }
      return 'failed';
    }
  }
}

export async function push(db: Db, userId: string, deviceId: string): Promise<{ pushed: number; failed: number; needsRepair: boolean }> {
  let pushed = 0;
  let failed = 0;
  let needsRepair = false;
  for (let round = 0; round < 50; round++) {
    const rows = await db.getAllAsync<OutboxRow>(`SELECT * FROM outbox WHERE status = 'pending' ORDER BY seq LIMIT ${MAX_OPS * 2}`);
    if (rows.length === 0) break;
    const chunk = nextChunk(rows);
    const res = await authedRequest<PushResponse>(userId, 'POST', '/v1/sync/push', { deviceId, ops: chunk.map(toOp) }, 30_000);
    const byId = new Map(res.results.map((r) => [r.opId, r]));
    let progressed = false;
    for (const row of chunk) {
      const result = byId.get(row.op_id);
      if (!result) continue;
      const outcome = await applyResult(db, row, result);
      if (outcome === 'retry') {
        await db.runAsync('UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE seq = ?', result.reason ?? 'retry', row.seq);
        continue;
      }
      progressed = true;
      if (outcome === 'failed') {
        failed++;
        await db.runAsync(`UPDATE outbox SET status = 'failed', last_error = ? WHERE seq = ?`, result.reason ?? 'rejected', row.seq);
      } else {
        if (outcome === 'repair') needsRepair = true;
        pushed++;
        await db.runAsync('DELETE FROM outbox WHERE seq = ?', row.seq);
      }
    }
    if (!progressed) break;
  }
  return { pushed, failed, needsRepair };
}

export async function pull(db: Db, userId: string, fromScratch = false): Promise<{ pulled: number; conflicts: SyncConflict[] }> {
  let cursor = fromScratch ? 0 : ((await getMeta<number>(db, 'cursor')) ?? 0);
  let pulled = 0;
  const conflicts: SyncConflict[] = [];
  const seenOnServer = new Set<string>();
  for (let page = 0; page < 100; page++) {
    const res = await authedRequest<PullResponse>(userId, 'GET', `/v1/sync/pull?cursor=${cursor}&limit=500`, undefined, 30_000);
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const c of res.changes) {
        seenOnServer.add(`${c.entity}:${c.id}`);
        // Local edits waiting to upload win locally; the server merges them on push.
        const pending = await txn.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM outbox WHERE entity = ? AND entity_id = ? AND status IN ('pending','failed')`, c.entity, c.id);
        if ((pending?.n ?? 0) > 0) continue;
        if (c.record) {
          const record = c.entity === 'gamificationEvent' ? { ...c.record, status: 'confirmed' } : c.record;
          await txn.runAsync(
            `INSERT INTO records (entity, id, data, rev, deleted) VALUES (?, ?, ?, ?, ?) ON CONFLICT(entity, id) DO UPDATE SET data = excluded.data, rev = excluded.rev, deleted = excluded.deleted`,
            c.entity,
            c.id,
            JSON.stringify(record),
            c.rev,
            c.deleted ? 1 : 0,
          );
        } else {
          await txn.runAsync(`UPDATE records SET deleted = 1, rev = ?, data = json_set(data, '$.deletedAt', COALESCE(json_extract(data, '$.deletedAt'), ?)) WHERE entity = ? AND id = ?`, c.rev, new Date().toISOString(), c.entity, c.id);
        }
        pulled++;
      }
      for (const k of res.conflicts) {
        await txn.runAsync('INSERT INTO conflicts (id, data, status) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, status = excluded.status', k.id, JSON.stringify(k), k.status);
        if (k.status === 'open') conflicts.push(k);
      }
      cursor = res.cursor;
      await txn.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'cursor', JSON.stringify(cursor));
    });
    if (!res.hasMore) break;
  }
  if (fromScratch) {
    // Repair: drop local records the server never accepted and that aren't waiting to upload.
    const local = await db.getAllAsync<{ entity: string; id: string }>('SELECT entity, id FROM records WHERE rev IS NULL');
    for (const r of local) {
      if (seenOnServer.has(`${r.entity}:${r.id}`)) continue;
      const pending = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM outbox WHERE entity = ? AND entity_id = ?`, r.entity, r.id);
      if ((pending?.n ?? 0) === 0) await db.runAsync('DELETE FROM records WHERE entity = ? AND id = ?', r.entity, r.id);
    }
  }
  await setMeta(db, 'lastSyncedAt', new Date().toISOString());
  return { pulled, conflicts };
}

/** One full sync: push, then pull; a stale plan triggers a repair re-pull. */
export async function syncOnce(db: Db, userId: string, deviceId: string): Promise<SyncOutcome> {
  const p = await push(db, userId, deviceId);
  const r = await pull(db, userId, p.needsRepair);
  return { pushed: p.pushed, failed: p.failed, pulled: r.pulled, conflicts: r.conflicts, needsRepair: p.needsRepair };
}

/** Exponential backoff with jitter for transient failures: 2s, 4s, 8s … capped at 60s. */
export function backoffMs(attempt: number): number {
  const base = Math.min(60_000, 2_000 * 2 ** Math.min(attempt, 5));
  return Math.round(base / 2 + Math.random() * (base / 2));
}

export function isTransient(e: unknown): boolean {
  return e instanceof NetworkError || (typeof e === 'object' && e !== null && 'status' in e && ((e as { status: number }).status >= 500 || (e as { status: number }).status === 429));
}

export async function discardFailed(db: Db, seq?: number) {
  if (seq === undefined) await db.runAsync(`DELETE FROM outbox WHERE status = 'failed'`);
  else await db.runAsync('DELETE FROM outbox WHERE seq = ?', seq);
}
