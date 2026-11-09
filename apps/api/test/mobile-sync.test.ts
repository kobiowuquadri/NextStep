/**
 * End-to-end offline sync: the mobile app's real storage and sync modules
 * (apps/mobile/src/lib/{db,repo,sync,api}.ts) run against the real API and
 * PostgreSQL. Only the native modules are replaced: expo-sqlite by Node's
 * built-in SQLite (same SQL), expo-secure-store by an in-memory map, and
 * expo-crypto by node:crypto.
 */
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTask, generatePlanAction, completeTask, updateTask, deleteTask, saveAvailability, currentRevision, type ActionResult, type AppState } from '@nextstep/engine';
import { bootApp } from './helpers.js';

const dir = mkdtempSync(path.join(tmpdir(), 'nextstep-device-'));

const handles: NodeSqlite[] = [];
class NodeSqlite {
  db: DatabaseSync;
  closed = false;
  constructor(public file: string) {
    this.db = new DatabaseSync(file);
    handles.push(this);
  }
  private args(params: unknown[]) {
    return (params.length === 1 && Array.isArray(params[0]) ? params[0] : params) as never[];
  }
  async execAsync(sql: string) {
    this.db.exec(sql);
  }
  async runAsync(sql: string, ...params: unknown[]) {
    return this.db.prepare(sql).run(...this.args(params));
  }
  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return this.db.prepare(sql).all(...this.args(params)) as T[];
  }
  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    return (this.db.prepare(sql).get(...this.args(params)) as T) ?? null;
  }
  async withExclusiveTransactionAsync(fn: (txn: NodeSqlite) => Promise<void>) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      await fn(this);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  async closeAsync() {
    if (!this.closed) this.db.close();
    this.closed = true;
  }
}

const secure = new Map<string, string>();
vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: async (name: string) => new NodeSqlite(path.join(dir, name)),
  deleteDatabaseAsync: async (name: string) => rmSync(path.join(dir, name), { force: true }),
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => secure.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void secure.set(k, v),
  deleteItemAsync: async (k: string) => void secure.delete(k),
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => randomUUID() }));

let app: INestApplication;
let mobile: {
  db: typeof import('../../mobile/src/lib/db');
  repo: typeof import('../../mobile/src/lib/repo');
  sync: typeof import('../../mobile/src/lib/sync');
  api: typeof import('../../mobile/src/lib/api');
};
const realFetch = globalThis.fetch;
const offline = () => vi.stubGlobal('fetch', async () => {
  throw new TypeError('Network request failed');
});
const online = () => vi.stubGlobal('fetch', realFetch);

beforeAll(async () => {
  app = await bootApp();
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address() as { port: number };
  process.env.EXPO_PUBLIC_API_URL = `http://127.0.0.1:${address.port}`;
  mobile = {
    db: await import('../../mobile/src/lib/db'),
    repo: await import('../../mobile/src/lib/repo'),
    sync: await import('../../mobile/src/lib/sync'),
    api: await import('../../mobile/src/lib/api'),
  };
});
afterAll(async () => {
  online();
  await app?.close();
  for (const h of handles) await h.closeAsync();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* Windows may hold the WAL file briefly; the OS temp cleaner removes it. */
  }
});

interface Device {
  key: string;
  id: string;
  db: Awaited<ReturnType<typeof import('../../mobile/src/lib/db')['openAccountDb']>>;
}

async function signUp() {
  const email = `device-${randomUUID().slice(0, 8)}@example.test`;
  const r = await request(app.getHttpServer()).post('/v1/auth/register').send({ email, password: 'a long enough password', displayName: 'Tobi', timezone: 'Africa/Lagos' }).expect(201);
  await mobile.api.tokenStore.set(r.body.user.id, { accessToken: r.body.accessToken, refreshToken: r.body.refreshToken, accessTokenExpiresAt: r.body.accessTokenExpiresAt });
  return { userId: r.body.user.id as string, email, refresh: r.body.refreshToken as string };
}

async function openDevice(userId: string, name: string): Promise<Device> {
  const db = await mobile.db.openAccountDb(`${name}-${userId}`);
  return { key: `${name}-${userId}`, id: `device-${name}-0000`, db };
}

async function state(d: Device, userId: string): Promise<AppState> {
  const s = await mobile.repo.loadState(d.db, userId);
  if (!s) throw new Error('no state');
  return s;
}

async function act(d: Device, userId: string, fn: (s: AppState, ctx: { now: number; newId: () => string }) => ActionResult | { error: string }, batch?: { basePlanRevision: number }) {
  const s = await state(d, userId);
  const r = fn(s, { now: Date.now(), newId: () => randomUUID() });
  if ('error' in r) throw new Error(r.error);
  await mobile.repo.persist(d.db, r.mutations, { sync: true, batch: !!batch, basePlanRevision: batch?.basePlanRevision });
  return r;
}

const serverTasks = async (userId: string, access?: string) => {
  const token = access ?? (await mobile.api.tokenStore.get(userId))!.accessToken;
  return (await request(app.getHttpServer()).get('/v1/tasks?limit=200').set('Authorization', `Bearer ${token}`).expect(200)).body.items as Array<{ id: string; title: string; dueAt: string }>;
};

describe('mobile offline sync against the real API', () => {
  it('first sync needs a connection, then works offline: edits persist through a restart and sync once without duplicates', async () => {
    const { userId } = await signUp();
    let a = await openDevice(userId, 'phoneA');
    offline();
    await expect(mobile.sync.syncOnce(a.db, userId, a.id)).rejects.toBeInstanceOf(mobile.api.NetworkError);
    expect(await mobile.repo.loadState(a.db, userId)).toBeNull(); // initial setup requires connectivity
    online();
    await mobile.sync.syncOnce(a.db, userId, a.id);
    expect((await state(a, userId)).preferences.id).toBe(userId);

    // Data runs out: create, edit twice, add a window — all saved locally with outbox entries.
    offline();
    const taskId = randomUUID();
    await act(a, userId, (s, ctx) => createTask(s, { id: taskId, title: 'Draft', kind: 'assignment', estimatedMinutes: 90, dueAt: new Date(Date.now() + 4 * 86_400_000).toISOString() }, ctx, ['Outline', 'Write']));
    await act(a, userId, (s, ctx) => updateTask(s, taskId, { title: 'Linked list assignment' }, ctx) as ActionResult);
    await act(a, userId, (s, ctx) => updateTask(s, taskId, { importance: 4 }, ctx) as ActionResult);
    await act(a, userId, (s, ctx) => saveAvailability(s, { weekday: 1, start: '19:00', end: '21:00' }, ctx));
    const before = await mobile.repo.pendingCount(a.db);
    expect(before.pending).toBe(4); // task create (two edits coalesced into it) + 2 subtasks + 1 availability window
    await expect(mobile.sync.syncOnce(a.db, userId, a.id)).rejects.toBeInstanceOf(mobile.api.NetworkError);

    // App killed and reopened before reconnecting.
    await a.db.closeAsync();
    a = await openDevice(userId, 'phoneA');
    const reopened = await state(a, userId);
    expect(reopened.tasks.find((t) => t.id === taskId)).toMatchObject({ title: 'Linked list assignment', importance: 4 });
    expect((await mobile.repo.pendingCount(a.db)).pending).toBe(before.pending);

    // Reconnect: one sync uploads everything exactly once.
    online();
    const out = await mobile.sync.syncOnce(a.db, userId, a.id);
    expect(out.failed).toBe(0);
    expect((await mobile.repo.pendingCount(a.db)).pending).toBe(0);
    const tasks = await serverTasks(userId);
    expect(tasks.filter((t) => t.id === taskId)).toHaveLength(1);
    expect(tasks[0]!.title).toBe('Linked list assignment');
    // Syncing again changes nothing.
    await mobile.sync.syncOnce(a.db, userId, a.id);
    expect(await serverTasks(userId)).toHaveLength(1);
  });

  it('a push whose response is lost is retried safely (idempotent ops)', async () => {
    const { userId } = await signUp();
    const a = await openDevice(userId, 'phoneA');
    await mobile.sync.syncOnce(a.db, userId, a.id);
    await act(a, userId, (s, ctx) => createTask(s, { title: 'Lab report', kind: 'project', estimatedMinutes: 60 }, ctx));
    // The server receives the push, but the connection drops before the response arrives.
    vi.stubGlobal('fetch', async (...args: Parameters<typeof fetch>) => {
      await realFetch(...args);
      throw new TypeError('Network request failed');
    });
    await expect(mobile.sync.push(a.db, userId, a.id)).rejects.toBeInstanceOf(mobile.api.NetworkError);
    expect((await mobile.repo.pendingCount(a.db)).pending).toBe(1);
    online();
    await mobile.sync.syncOnce(a.db, userId, a.id);
    expect(await serverTasks(userId)).toHaveLength(1);
    expect((await mobile.repo.pendingCount(a.db)).pending).toBe(0);
  });

  it('two phones: concurrent deadline edits are preserved for the student, deletions stay deleted', async () => {
    const { userId } = await signUp();
    const a = await openDevice(userId, 'phoneA');
    const b = await openDevice(userId, 'phoneB');
    await mobile.sync.syncOnce(a.db, userId, a.id);
    const taskId = randomUUID();
    const other = randomUUID();
    await act(a, userId, (s, ctx) => createTask(s, { id: taskId, title: 'Essay', kind: 'project', estimatedMinutes: 120, dueAt: new Date(Date.now() + 5 * 86_400_000).toISOString() }, ctx));
    await act(a, userId, (s, ctx) => createTask(s, { id: other, title: 'Reading', kind: 'reading', estimatedMinutes: 30 }, ctx));
    await mobile.sync.syncOnce(a.db, userId, a.id);
    await mobile.sync.syncOnce(b.db, userId, b.id);
    expect((await state(b, userId)).tasks.map((t) => t.id).sort()).toEqual([taskId, other].sort());

    const dueA = new Date(Date.now() + 6 * 86_400_000).toISOString();
    const dueB = new Date(Date.now() + 7 * 86_400_000).toISOString();
    await act(a, userId, (s, ctx) => updateTask(s, taskId, { dueAt: dueA }, ctx) as ActionResult);
    await act(b, userId, (s, ctx) => updateTask(s, taskId, { dueAt: dueB, title: 'Essay (final)' }, ctx) as ActionResult);
    await act(b, userId, (s, ctx) => deleteTask(s, other, ctx));
    // A edits the deleted task while offline-ish (before seeing the delete).
    await act(a, userId, (s, ctx) => updateTask(s, other, { title: 'Reading ch. 7' }, ctx) as ActionResult);

    await mobile.sync.syncOnce(b.db, userId, b.id);
    const outA = await mobile.sync.syncOnce(a.db, userId, a.id);
    expect(outA.conflicts.map((k) => k.fields)).toContainEqual(['dueAt']);
    const conflict = outA.conflicts.find((k) => k.entityId === taskId)!;
    expect(conflict.serverValues.dueAt).toBe(dueB);
    expect(conflict.clientValues.dueAt).toBe(dueA);
    const sA = await state(a, userId);
    expect(sA.tasks.find((t) => t.id === taskId)?.title).toBe('Essay (final)'); // non-conflicting field merged
    expect(sA.tasks.find((t) => t.id === other)?.deletedAt).toBeTruthy(); // stale edit did not resurrect it
    const live = await serverTasks(userId);
    expect(live.map((t) => t.id)).toEqual([taskId]);
  });

  it('duplicate plan generation on two phones does not duplicate sessions', async () => {
    const { userId } = await signUp();
    const a = await openDevice(userId, 'phoneA');
    const b = await openDevice(userId, 'phoneB');
    await mobile.sync.syncOnce(a.db, userId, a.id);
    for (const weekday of [0, 1, 2, 3, 4, 5, 6]) await act(a, userId, (s, ctx) => saveAvailability(s, { weekday, start: '19:00', end: '21:00' }, ctx));
    await act(a, userId, (s, ctx) => createTask(s, { title: 'Test revision', kind: 'exam', estimatedMinutes: 180, dueAt: new Date(Date.now() + 6 * 86_400_000).toISOString() }, ctx));
    await mobile.sync.syncOnce(a.db, userId, a.id);
    await mobile.sync.syncOnce(b.db, userId, b.id);

    // Both phones generate a plan from revision 0 while offline.
    const base = currentRevision(await state(a, userId));
    await act(a, userId, (s, ctx) => generatePlanAction(s, ctx).result, { basePlanRevision: base });
    await act(b, userId, (s, ctx) => generatePlanAction(s, ctx).result, { basePlanRevision: base });
    await mobile.sync.syncOnce(a.db, userId, a.id);
    const outB = await mobile.sync.syncOnce(b.db, userId, b.id);
    expect(outB.needsRepair).toBe(true);
    const token = (await mobile.api.tokenStore.get(userId))!.accessToken;
    const serverSessions = (await request(app.getHttpServer()).get('/v1/sessions?limit=200').set('Authorization', `Bearer ${token}`)).body.items as Array<{ id: string; startAt: string }>;
    const starts = serverSessions.map((s) => s.startAt);
    expect(new Set(starts).size).toBe(starts.length);
    // Phone B was repaired to the server's plan, with no orphaned local sessions.
    const bSessions = (await state(b, userId)).sessions.filter((s) => !s.deletedAt).map((s) => s.id).sort();
    expect(bSessions).toEqual(serverSessions.map((s) => s.id).sort());
  });

  it('XP earned offline is confirmed by the server once, never duplicated across phones', async () => {
    const { userId } = await signUp();
    const a = await openDevice(userId, 'phoneA');
    const b = await openDevice(userId, 'phoneB');
    await mobile.sync.syncOnce(a.db, userId, a.id);
    const taskId = randomUUID();
    await act(a, userId, (s, ctx) => createTask(s, { id: taskId, title: 'Worksheet', kind: 'practice', estimatedMinutes: 60, createdAt: new Date(Date.now() - 86_400_000).toISOString() }, ctx));
    offline();
    const done = await act(a, userId, (s, ctx) => completeTask(s, taskId, ctx) as ActionResult);
    const localXp = done.awards.find((w) => w.entry.type === 'task_completed')!.entry.xp;
    expect((await state(a, userId)).events.find((e) => e.type === 'task_completed')?.status).toBe('pending');
    online();
    await mobile.sync.syncOnce(a.db, userId, a.id);
    const confirmed = (await state(a, userId)).events.find((e) => e.type === 'task_completed')!;
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.xp).toBe(localXp);
    await mobile.sync.syncOnce(b.db, userId, b.id);
    expect((await state(b, userId)).events.filter((e) => e.type === 'task_completed')).toHaveLength(1);
  });

  it('keeps accounts isolated on a shared phone and deletes local data on sign-out', async () => {
    const u1 = await signUp();
    const u2 = await signUp();
    const d1 = await openDevice(u1.userId, 'shared');
    await mobile.sync.syncOnce(d1.db, u1.userId, d1.id);
    await act(d1, u1.userId, (s, ctx) => createTask(s, { title: 'Private task', kind: 'assignment', estimatedMinutes: 30 }, ctx));
    const d2 = await openDevice(u2.userId, 'shared');
    await mobile.sync.syncOnce(d2.db, u2.userId, d2.id);
    expect((await state(d2, u2.userId)).tasks).toHaveLength(0);
    await mobile.db.deleteAccountDb(d1.db, d1.key);
    const reopened = await openDevice(u1.userId, 'shared');
    expect(await mobile.repo.loadState(reopened.db, u1.userId)).toBeNull();
  });
});
