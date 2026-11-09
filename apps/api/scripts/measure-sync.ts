/**
 * Measures bytes on the wire for representative sync workflows against a
 * running API (default http://localhost:4000). Reports gzip vs uncompressed.
 *
 *   API_URL=http://localhost:4000 npx tsx scripts/measure-sync.ts
 */
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { localDateKey, type SyncOp } from '@nextstep/contracts';
import { buildTobiScenario } from '@nextstep/demo-data';
import { acceptRecovery, COLLECTION_OF, previewRecovery, updateTask, type ActionResult, type AppState, type Mutation } from '@nextstep/engine';

const API = new URL(process.env.API_URL ?? 'http://localhost:4000');

function raw(method: string, path: string, body: unknown, headers: Record<string, string>): Promise<{ status: number; wireBytes: number; json: any }> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const req = http.request({ host: API.hostname, port: API.port, path, method, headers: { 'content-type': 'application/json', ...(payload ? { 'content-length': String(payload.length) } : {}), ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', async () => {
        const buf = Buffer.concat(chunks);
        let text = buf.toString('utf8');
        if (res.headers['content-encoding'] === 'gzip') text = (await import('node:zlib')).gunzipSync(buf).toString('utf8');
        resolve({ status: res.statusCode ?? 0, wireBytes: buf.length, json: text ? JSON.parse(text) : null });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const toOps = (mutations: Mutation[], batch?: { base: number }): SyncOp[] => {
  const batchId = batch ? randomUUID() : undefined;
  return mutations.map((m) => ({
    opId: randomUUID(), entity: m.entity, entityId: m.id, kind: m.kind, baseRev: m.isNew ? null : ((m.record.rev as number) ?? null),
    changedFields: m.changedFields, data: m.kind === 'delete' ? undefined : m.record, clientTime: new Date().toISOString(),
    ...(batchId ? { batchId } : {}), ...(batch && m.entity === 'planRevision' && m.isNew ? { basePlanRevision: batch.base } : {}),
  }));
};

const reg = await raw('POST', '/v1/auth/register', { email: `measure-${randomUUID().slice(0, 8)}@example.test`, password: 'measurement password', displayName: 'Tobi', timezone: 'Africa/Lagos' }, {});
const auth = { Authorization: `Bearer ${reg.json.accessToken}` };
const userId = reg.json.user.id as string;

// 1. Upload a full fictional semester (what a phone pushes after onboarding offline).
const tobi = buildTobiScenario(Date.now());
const state: AppState = { ...tobi, userId, preferences: { ...tobi.preferences, id: userId } };
const all: Mutation[] = [];
for (const [entity, key] of Object.entries(COLLECTION_OF)) {
  for (const r of (state as unknown as Record<string, Array<Record<string, unknown>>>)[key] ?? []) all.push({ entity: entity as Mutation['entity'], kind: 'upsert', id: r.id as string, record: r, isNew: true });
}
const order = ['course', 'goal', 'task', 'subtask', 'availability', 'commitment', 'planRevision', 'session', 'focusLog', 'gamificationEvent', 'userAchievement'];
all.sort((a, b) => order.indexOf(a.entity) - order.indexOf(b.entity));
const pushOps = toOps(all.filter((m) => order.includes(m.entity)));
const pushBody = { deviceId: 'measure-device-1', ops: pushOps };
const push = await raw('POST', '/v1/sync/push', pushBody, { ...auth, 'accept-encoding': 'gzip' });
const pushReq = Buffer.byteLength(JSON.stringify(pushBody));

// 2. Fresh device: full pull, compressed vs not.
const pullGz = await raw('GET', '/v1/sync/pull?cursor=0', undefined, { ...auth, 'accept-encoding': 'gzip' });
const pullId = await raw('GET', '/v1/sync/pull?cursor=0', undefined, { ...auth, 'accept-encoding': 'identity' });
const cursor = pullGz.json.cursor as number;

// 3. Edit one task and push.
const serverState = { ...state };
const task = state.tasks.find((t) => t.kind === 'exam')!;
const edit = updateTask(serverState, task.id, { remainingMinutes: 150 }, { now: Date.now(), newId: () => randomUUID() }) as ActionResult;
const editBody = { deviceId: 'measure-device-1', ops: toOps(edit.mutations.map((m) => ({ ...m, record: { ...m.record, rev: 1 } }))) };
const editRes = await raw('POST', '/v1/sync/push', editBody, { ...auth, 'accept-encoding': 'gzip' });

// 4. Incremental pull on another device after that edit.
const delta = await raw('GET', `/v1/sync/pull?cursor=${cursor}`, undefined, { ...auth, 'accept-encoding': 'gzip' });

// 5. Accept a recovery plan on the phone and push the batch.
const loaded = await raw('GET', '/v1/sync/pull?cursor=0&limit=1000', undefined, { ...auth, 'accept-encoding': 'gzip' });
const fromServer: AppState = { ...state, sessions: [], planRevisions: [], tasks: [] } as AppState;
for (const c of loaded.json.changes) if (c.record && (c.entity === 'session' || c.entity === 'planRevision' || c.entity === 'task')) (fromServer as any)[COLLECTION_OF[c.entity as 'session']].push(c.record);
const proposal = previewRecovery(fromServer, { kind: 'less_time', date: localDateKey(Date.now(), 'Africa/Lagos'), availableMinutes: 45 }, { now: Date.now(), newId: () => randomUUID() });
const accepted = acceptRecovery(fromServer, proposal, { now: Date.now(), newId: () => randomUUID() }) as ActionResult;
const recoveryBody = { deviceId: 'measure-device-1', ops: toOps(accepted.mutations, { base: proposal.baseRevision }) };
const recRes = await raw('POST', '/v1/sync/push', recoveryBody, { ...auth, 'accept-encoding': 'gzip' });
const recReq = Buffer.byteLength(JSON.stringify(recoveryBody));

const rows = [
  ['Upload a full sample semester (first sync after offline onboarding)', `${pushOps.length} ops`, `${kb(pushReq)} up (${kb(gzipSync(JSON.stringify(pushBody)).length)} if the client gzipped)`, `${kb(push.wireBytes)} down`],
  ['Full download on a new phone (gzip)', `${pullGz.json.changes.length} records`, '—', `${kb(pullGz.wireBytes)} down (${kb(pullId.wireBytes)} without gzip)`],
  ['Edit one task and sync', `${editBody.ops.length} op`, `${kb(Buffer.byteLength(JSON.stringify(editBody)))} up`, `${kb(editRes.wireBytes)} down`],
  ['Incremental pull after that edit', `${delta.json.changes.length} change(s)`, '—', `${kb(delta.wireBytes)} down`],
  ['Accept a recovery plan and sync', `${recoveryBody.ops.length} ops`, `${kb(recReq)} up`, `${kb(recRes.wireBytes)} down`],
];
console.log('| Workflow | Size | Upload | Download |\n|---|---|---|---|');
for (const r of rows) console.log(`| ${r.join(' | ')} |`);
console.log(`\nStatuses: push ${push.status}, pull ${pullGz.status}, edit ${editRes.status} (${editRes.json.results?.[0]?.status}), recovery ${recRes.status} (${recRes.json.results?.map((x: { status: string }) => x.status).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join('/')})`);
