/**
 * Creates (or deletes) a temporary account holding Quadri's fictional sample semester, so the
 * real app can be shown with realistic data for screenshots and the demo video. The data goes
 * through the normal sync API, exactly as a phone would upload it.
 *
 *   API_URL=https://… npx tsx scripts/sample-account.ts create <credentials.json>
 *   API_URL=https://… npx tsx scripts/sample-account.ts delete <credentials.json>
 *
 * The credentials file holds a random password; keep it outside the repository and delete the
 * account when the captures are done. Real users' accounts are never touched.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { SyncOp } from '@nextstep/contracts';
import { buildQuadriScenario, DEMO_TIMEZONE } from '@nextstep/demo-data';
import { COLLECTION_OF, type AppState, type Mutation } from '@nextstep/engine';

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const [command, file] = process.argv.slice(2);
if (!file || (command !== 'create' && command !== 'delete')) throw new Error('usage: sample-account.ts create|delete <credentials.json>');

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

if (command === 'create') {
  const email = `sample-quadri-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomBytes(18).toString('base64url');
  const reg = await call('POST', '/v1/auth/register', { email, password, displayName: 'Quadri', timezone: DEMO_TIMEZONE });
  if (reg.status !== 201) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.json)}`);
  const userId = reg.json.user.id as string;
  writeFileSync(file, JSON.stringify({ api: API, email, password, userId }, null, 2));

  const scenario = buildQuadriScenario(Date.now());
  const state: AppState = { ...scenario, userId, preferences: { ...scenario.preferences, id: userId } };
  const all: Mutation[] = [];
  for (const [entity, key] of Object.entries(COLLECTION_OF)) {
    for (const r of (state as unknown as Record<string, Array<Record<string, unknown>>>)[key] ?? []) all.push({ entity: entity as Mutation['entity'], kind: 'upsert', id: r.id as string, record: r, isNew: true });
  }
  // Parents before children, as the phone's outbox would send them.
  const order = ['course', 'goal', 'task', 'subtask', 'availability', 'commitment', 'planRevision', 'session', 'focusLog', 'gamificationEvent', 'userAchievement'];
  const ops: SyncOp[] = all
    .filter((m) => order.includes(m.entity))
    .sort((a, b) => order.indexOf(a.entity) - order.indexOf(b.entity))
    .map((m) => ({ opId: randomUUID(), entity: m.entity, entityId: m.id, kind: m.kind, baseRev: null, changedFields: m.changedFields, data: m.record, clientTime: new Date().toISOString() }));
  // Registration already created the preferences record: update it on top of its current revision.
  const pull = await call('GET', '/v1/sync/pull?cursor=0&limit=1000', undefined, reg.json.accessToken);
  const serverPrefs = (pull.json.changes as Array<{ entity: string; record: Record<string, unknown> & { rev: number } }>).find((c) => c.entity === 'preferences')?.record;
  if (!serverPrefs) throw new Error('no preferences record after registration');
  const META = ['id', 'userId', 'rev', 'fieldRevs', 'createdAt', 'updatedAt', 'deletedAt'];
  const changed = Object.keys(state.preferences).filter((k) => !META.includes(k) && JSON.stringify((state.preferences as unknown as Record<string, unknown>)[k]) !== JSON.stringify(serverPrefs[k]));
  ops.unshift({ opId: randomUUID(), entity: 'preferences', entityId: userId, kind: 'upsert', baseRev: serverPrefs.rev, changedFields: changed, data: { ...serverPrefs, ...state.preferences, id: userId }, clientTime: new Date().toISOString() });
  const push = await call('POST', '/v1/sync/push', { deviceId: `sample-${randomUUID().slice(0, 8)}`, ops }, reg.json.accessToken);
  const rejected = (push.json?.results ?? []).filter((r: { status: string }) => r.status !== 'applied' && r.status !== 'duplicate');
  if (rejected.length) console.log('not applied:', JSON.stringify(rejected.slice(0, 5)));
  const statuses = (push.json?.results ?? []).reduce((acc: Record<string, number>, r: { status: string }) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  console.log(`account created (${email}); push ${push.status}: ${ops.length} ops`, statuses);
  if (push.status !== 200) process.exitCode = 1;
} else {
  const creds = JSON.parse(readFileSync(file, 'utf8')) as { email: string; password: string };
  const login = await call('POST', '/v1/auth/login', { email: creds.email, password: creds.password });
  if (login.status !== 200) throw new Error(`login failed: ${login.status} (already deleted?)`);
  const del = await call('DELETE', '/v1/me', { password: creds.password, confirm: 'DELETE' }, login.json.accessToken);
  const after = await call('POST', '/v1/auth/login', { email: creds.email, password: creds.password });
  console.log(`delete ${del.status}; login afterwards ${after.status}`);
}
