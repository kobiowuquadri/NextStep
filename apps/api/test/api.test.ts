import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApp, iso, op, pull, push, registerUser, taskData, type TestUser } from './helpers.js';

let app: INestApplication;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  app = await bootApp();
});
afterAll(async () => {
  await app?.close();
});

describe('system', () => {
  it('health reports the database and AI status', async () => {
    const res = await http().get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok', aiConfigured: false });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('serves an OpenAPI document generated from the shared contracts', async () => {
    const res = await http().get('/docs/openapi.json').expect(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining(['/v1/sync/push', '/v1/recovery/accept', '/v1/tasks/{id}']));
  });

  it('returns structured errors for unknown routes', async () => {
    const res = await http().get('/v1/nope').set('Authorization', 'Bearer x').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('authentication', () => {
  it('registers, rejects duplicates and weak passwords', async () => {
    const u = await registerUser(app);
    await http().post('/v1/auth/register').send({ email: u.email.toUpperCase(), password: 'another long password', displayName: 'X', timezone: 'Africa/Lagos' }).expect(409);
    const weak = await http().post('/v1/auth/register').send({ email: `w-${randomUUID()}@example.test`, password: 'short', displayName: 'W', timezone: 'Africa/Lagos' }).expect(400);
    expect(weak.body.error.details[0].path).toBe('password');
    await http().post('/v1/auth/register').send({ email: `t-${randomUUID()}@example.test`, password: 'long enough password', displayName: 'T', timezone: 'Mars/Olympus' }).expect(400);
  });

  it('creates preferences whose id equals the user id', async () => {
    const u = await registerUser(app);
    const me = await http().get('/v1/me').set(u.auth()).expect(200);
    expect(me.body.preferences).toMatchObject({ id: u.id, timezone: 'Africa/Lagos', dailyLimitMinutes: 180 });
  });

  it('handles invalid credentials without revealing whether the email exists', async () => {
    const u = await registerUser(app);
    const wrong = await http().post('/v1/auth/login').send({ email: u.email, password: 'wrong password!!' }).expect(401);
    const missing = await http().post('/v1/auth/login').send({ email: `nobody-${randomUUID()}@example.test`, password: 'wrong password!!' }).expect(401);
    expect(wrong.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(missing.body.error.message).toBe(wrong.body.error.message);
    await http().post('/v1/auth/login').send({ email: u.email, password: u.password }).expect(200);
  });

  it('rejects missing, malformed and forged tokens', async () => {
    await http().get('/v1/me').expect(401);
    await http().get('/v1/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
    const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4Iiwic2lkIjoieSJ9.c2lnbmF0dXJl';
    await http().get('/v1/me').set('Authorization', `Bearer ${forged}`).expect(401);
  });

  it('rotates refresh tokens and revokes the family when an old one is reused', async () => {
    const u = await registerUser(app);
    const r1 = await http().post('/v1/auth/refresh').send({ refreshToken: u.refresh }).expect(200);
    expect(r1.body.refreshToken).not.toBe(u.refresh);
    // Reusing the rotated token looks like theft: everything in the family is revoked.
    await http().post('/v1/auth/refresh').send({ refreshToken: u.refresh }).expect(401);
    await http().post('/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(401);
    await http().get('/v1/me').set('Authorization', `Bearer ${r1.body.accessToken}`).expect(401);
  });

  it('logout ends the session immediately', async () => {
    const u = await registerUser(app);
    await http().post('/v1/auth/logout').set(u.auth()).send({ refreshToken: u.refresh }).expect(204);
    await http().get('/v1/me').set(u.auth()).expect(401);
  });

  it('password reset requests never reveal whether an account exists', async () => {
    const res = await http().post('/v1/auth/password-reset/request').send({ email: `x-${randomUUID()}@example.test` }).expect(202);
    expect(res.body.message).toMatch(/If an account exists/);
    await http().post('/v1/auth/password-reset/confirm').send({ token: 'x'.repeat(43), newPassword: 'a brand new password' }).expect(400);
  });
});

describe('ownership and isolation', () => {
  let a: TestUser;
  let b: TestUser;
  const taskId = randomUUID();
  beforeAll(async () => {
    a = await registerUser(app, 'Amaka');
    b = await registerUser(app, 'Bola');
    await http().post('/v1/tasks').set(a.auth()).send(taskData(taskId)).expect(201);
  });

  it("a user cannot read, edit or delete another user's task", async () => {
    await http().get(`/v1/tasks/${taskId}`).set(b.auth()).expect(404);
    await http().patch(`/v1/tasks/${taskId}`).set(b.auth()).send({ title: 'hijacked' }).expect(404);
    await http().delete(`/v1/tasks/${taskId}`).set(b.auth()).expect(404);
    const list = await http().get('/v1/tasks').set(b.auth()).expect(200);
    expect(list.body.items).toEqual([]);
  });

  it("sync cannot overwrite or reference another user's records", async () => {
    const res = await push(app, b, [op('task', taskId, taskData(taskId, { title: 'hijacked' }), { baseRev: 1 })]).expect(200);
    expect(res.body.results[0]).toMatchObject({ status: 'rejected', reason: 'NOT_FOUND' });
    const subId = randomUUID();
    const sub = await push(app, b, [op('subtask', subId, { id: subId, taskId, title: 'x', done: false, position: 0, estimatedMinutes: null, completedAt: null, createdAt: iso(), updatedAt: iso() })]).expect(200);
    expect(sub.body.results[0].reason).toBe('PARENT_NOT_FOUND:taskId');
    const pulled = await pull(app, b).expect(200);
    expect(pulled.body.changes.find((c: { id: string }) => c.id === taskId)).toBeUndefined();
    const still = await http().get(`/v1/tasks/${taskId}`).set(a.auth()).expect(200);
    expect(still.body.title).toBe('Linked list assignment');
  });

  it('validates input and returns field-level errors', async () => {
    const res = await http().post('/v1/tasks').set(a.auth()).send(taskData(randomUUID(), { importance: 9 })).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('paginates collections by revision', async () => {
    for (let i = 0; i < 3; i++) await http().post('/v1/courses').set(a.auth()).send({ title: `Course ${i}`, code: null, color: '#8670FF', semesterId: null }).expect(201);
    const p1 = await http().get('/v1/courses?limit=2').set(a.auth()).expect(200);
    expect(p1.body.items).toHaveLength(2);
    const p2 = await http().get(`/v1/courses?limit=2&cursor=${p1.body.nextCursor}`).set(a.auth()).expect(200);
    expect(p2.body.items).toHaveLength(1);
    expect(p2.body.nextCursor).toBeNull();
  });
});

describe('offline sync', () => {
  it('is idempotent: a retried push (e.g. after a dropped response) never duplicates', async () => {
    const u = await registerUser(app);
    const id = randomUUID();
    const ops = [op('task', id, taskData(id))];
    const first = await push(app, u, ops).expect(200);
    expect(first.body.results[0], JSON.stringify(first.body.results[0])).toMatchObject({ status: 'applied' });
    const retry = await push(app, u, ops).expect(200);
    expect(retry.body.results[0].status).toBe('duplicate');
    const list = await http().get('/v1/tasks').set(u.auth()).expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(retry.body.cursor).toBe(first.body.cursor);
  });

  it('pulls incrementally with a server-issued cursor', async () => {
    const u = await registerUser(app);
    const base = (await pull(app, u).expect(200)).body.cursor;
    const id = randomUUID();
    await push(app, u, [op('task', id, taskData(id))]).expect(200);
    const delta = await pull(app, u, base).expect(200);
    expect(delta.body.changes.map((c: { id: string }) => c.id)).toEqual([id]);
    const none = await pull(app, u, delta.body.cursor).expect(200);
    expect(none.body.changes).toEqual([]);
  });

  it('offline create then delete before sync leaves a tombstone, and a stale device cannot resurrect it', async () => {
    const u = await registerUser(app);
    const id = randomUUID();
    await push(app, u, [op('task', id, taskData(id)), op('task', id, undefined, { kind: 'delete' })]).expect(200);
    const stale = await push(app, u, [op('task', id, taskData(id, { title: 'edited on old phone' }), { baseRev: 1, changedFields: ['title'] })], 'device-bbbb-2').expect(200);
    expect(stale.body.results[0]).toMatchObject({ status: 'rejected', reason: 'RECORD_DELETED' });
    const pulled = await pull(app, u).expect(200);
    expect(pulled.body.changes.find((c: { id: string }) => c.id === id)).toMatchObject({ deleted: true });
    await http().get(`/v1/tasks/${id}`).set(u.auth()).expect(404);
  });

  it('a delete for a record the server never saw still blocks later recreation', async () => {
    const u = await registerUser(app);
    const id = randomUUID();
    await push(app, u, [op('task', id, undefined, { kind: 'delete' })]).expect(200);
    const res = await push(app, u, [op('task', id, taskData(id))]).expect(200);
    expect(res.body.results[0].reason).toBe('RECORD_DELETED');
  });

  it('preserves both versions of concurrent deadline edits and auto-merges other fields', async () => {
    const u = await registerUser(app);
    const id = randomUUID();
    const created = await push(app, u, [op('task', id, taskData(id))]).expect(200);
    const baseRev = created.body.results[0].rev;
    const dueA = iso(Date.now() + 5 * 86_400_000);
    const dueB = iso(Date.now() + 6 * 86_400_000);
    await push(app, u, [op('task', id, { dueAt: dueA }, { baseRev, changedFields: ['dueAt'] })], 'device-aaaa-1').expect(200);
    const second = await push(app, u, [op('task', id, { dueAt: dueB, title: 'Linked lists (final)' }, { baseRev, changedFields: ['dueAt', 'title'] })], 'device-bbbb-2').expect(200);
    const r = second.body.results[0];
    expect(r.status).toBe('conflict');
    expect(r.record.title).toBe('Linked lists (final)');
    expect(r.record.dueAt).toBe(dueA);
    const pulled = await pull(app, u).expect(200);
    const conflict = pulled.body.conflicts.find((c: { id: string }) => c.id === r.conflictId);
    expect(conflict).toMatchObject({ fields: ['dueAt'], serverValues: { dueAt: dueA }, clientValues: { dueAt: dueB }, status: 'open' });
    await http().post(`/v1/sync/conflicts/${r.conflictId}/resolve`).set(u.auth()).send({ choice: 'client' }).expect(200);
    const task = await http().get(`/v1/tasks/${id}`).set(u.auth()).expect(200);
    expect(task.body.dueAt).toBe(dueB);
  });

  it('rejects a duplicate plan generated on another device from the same base revision', async () => {
    const u = await registerUser(app);
    const taskId = randomUUID();
    await push(app, u, [op('task', taskId, taskData(taskId))]).expect(200);
    const planBatch = (device: string) => {
      const batchId = randomUUID();
      const revId = randomUUID();
      const sessionId = randomUUID();
      const start = Date.now() + 86_400_000;
      return {
        sessionId,
        ops: [
          op('session', sessionId, { id: sessionId, taskId, startAt: iso(start), endAt: iso(start + 45 * 60000), minutes: 45, status: 'planned', pinned: false, source: 'auto', planRevisionId: revId, label: null, createdAt: iso(), updatedAt: iso() }, { batchId }),
          op('planRevision', revId, { id: revId, number: 1, parentNumber: 0, reason: 'initial', summary: `from ${device}`, replacedSessions: [], createdSessionIds: [sessionId], proposalId: null, undoneAt: null, createdAt: iso(), updatedAt: iso() }, { batchId, basePlanRevision: 0 }),
        ],
      };
    };
    const a = planBatch('A');
    const b = planBatch('B');
    expect((await push(app, u, a.ops, 'device-aaaa-1').expect(200)).body.results.every((x: { status: string }) => x.status === 'applied')).toBe(true);
    const second = await push(app, u, b.ops, 'device-bbbb-2').expect(200);
    expect(second.body.results.every((x: { status: string; reason: string }) => x.status === 'conflict' && x.reason === 'STALE_PLAN')).toBe(true);
    const sessions = await http().get('/v1/sessions').set(u.auth()).expect(200);
    expect(sessions.body.items.map((s: { id: string }) => s.id)).toEqual([a.sessionId]);
  });

  it('applies a batch atomically: one invalid op rolls back the whole batch', async () => {
    const u = await registerUser(app);
    const batchId = randomUUID();
    const good = randomUUID();
    const res = await push(app, u, [op('task', good, taskData(good), { batchId }), op('task', randomUUID(), taskData(randomUUID(), { estimatedMinutes: -5 }), { batchId })]).expect(200);
    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual(['rejected', 'rejected']);
    await http().get(`/v1/tasks/${good}`).set(u.auth()).expect(404);
  });
});

describe('server-authoritative XP', () => {
  it('verifies awards, ignores claimed XP, and never double-awards', async () => {
    const u = await registerUser(app);
    const id = randomUUID();
    await push(app, u, [op('task', id, taskData(id, { estimatedMinutes: 90, remainingMinutes: 90, createdAt: iso(Date.now() - 86_400_000) }))]).expect(200);
    const event = (claimed: number) => {
      const eid = randomUUID();
      return op('gamificationEvent', eid, { id: eid, dedupeKey: `task:${id}`, type: 'task_completed', xp: claimed, occurredAt: iso(), localDate: new Date().toISOString().slice(0, 10), meta: { taskId: id }, createdAt: iso(), updatedAt: iso() });
    };
    // Not done yet: rejected.
    expect((await push(app, u, [event(999)]).expect(200)).body.results[0].reason).toMatch(/XP_NOT_VERIFIED:TASK_NOT_DONE/);
    const rev = (await http().get(`/v1/tasks/${id}`).set(u.auth())).body.rev;
    await push(app, u, [op('task', id, { status: 'done', remainingMinutes: 0, completedAt: iso() }, { baseRev: rev, changedFields: ['status', 'remainingMinutes', 'completedAt'] })]).expect(200);
    const ok = await push(app, u, [event(999)]).expect(200);
    expect(ok.body.results[0]).toMatchObject({ status: 'applied' });
    expect(ok.body.results[0].record.xp).toBe(25); // server rule: 10 + 5 × 3, not the claimed 999
    // Same award from another device (different op and event id): duplicate, no extra XP.
    const again = await push(app, u, [event(25)], 'device-bbbb-2').expect(200);
    expect(again.body.results[0].status).toBe('duplicate');
    const progress = await http().get('/v1/progress').set(u.auth()).expect(200);
    expect(progress.body.totalXp).toBe(25);
  });

  it('rejects achievements that were not earned', async () => {
    const u = await registerUser(app);
    const id = randomUUID();
    const res = await push(app, u, [op('userAchievement', id, { id, achievementId: 'back_on_track', unlockedAt: iso(), createdAt: iso(), updatedAt: iso() })]).expect(200);
    expect(res.body.results[0].reason).toBe('ACHIEVEMENT_NOT_EARNED');
  });
});

describe('planning and Recovery Mode (no AI required)', () => {
  let u: TestUser;
  beforeAll(async () => {
    u = await registerUser(app, 'Tobi');
    const avail = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
      const id = randomUUID();
      return op('availability', id, { id, weekday, start: '19:00', end: '21:30', online: true, label: null, createdAt: iso(), updatedAt: iso() });
    });
    const t1 = randomUUID();
    const t2 = randomUUID();
    await push(app, u, [...avail, op('task', t1, taskData(t1, { estimatedMinutes: 180, remainingMinutes: 180 })), op('task', t2, taskData(t2, { title: 'Test revision', kind: 'exam', dueAt: iso(Date.now() + 7 * 86_400_000) }))]).expect(200);
  });

  it('generates a plan and exposes today', async () => {
    const res = await http().post('/v1/planning/generate').set(u.auth()).expect(200);
    expect(res.body.revision).toBe(1);
    expect(res.body.plan.newSessions.length).toBeGreaterThan(0);
    expect(res.body.awards.map((a: { type: string }) => a.type)).toContain('plan_created');
    await http().get('/v1/today').set(u.auth()).expect(200);
  });

  it('refuses a stale recovery preview and accepts a fresh one', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const input = { kind: 'lighter_day', date: tomorrow, maxMinutes: 30 };
    const preview = await http().post('/v1/recovery/preview').set(u.auth()).send(input).expect(200);
    // Something changes before the student accepts (e.g. an edit on another device).
    const tasks = (await http().get('/v1/tasks').set(u.auth())).body.items;
    await http().patch(`/v1/tasks/${tasks[0].id}`).set(u.auth()).send({ remainingMinutes: 150 }).expect(200);
    const stale = await http().post('/v1/recovery/accept').set(u.auth()).send({ input, baseRevision: preview.body.baseRevision, fingerprint: preview.body.fingerprint }).expect(409);
    expect(stale.body.error.code).toBe('STALE_PREVIEW');
    const fresh = stale.body.error.details.proposal;
    const ok = await http().post('/v1/recovery/accept').set(u.auth()).send({ input, baseRevision: fresh.baseRevision, fingerprint: fresh.fingerprint }).expect(200);
    expect(ok.body.revision).toBe(fresh.baseRevision + 1);
    expect(ok.body.awards.map((a: { type: string }) => a.type)).toContain('recovery_accepted');
    // Replaying the same acceptance is now stale, never applied twice.
    await http().post('/v1/recovery/accept').set(u.auth()).send({ input, baseRevision: fresh.baseRevision, fingerprint: fresh.fingerprint }).expect(409);
  });

  it('AI routes degrade gracefully without credentials', async () => {
    const res = await http().post('/v1/ai/breakdown').set(u.auth()).send({ title: 'Write report' }).expect(503);
    expect(res.body.error.code).toBe('AI_NOT_CONFIGURED');
  });
});

describe('resources', () => {
  it('lists original resources with sizes and honest review status (public)', async () => {
    const res = await http().get('/v1/resources').expect(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(4);
    for (const r of res.body.items) {
      expect(r.sizeBytes).toBeGreaterThan(0);
      expect(r.reviewStatus).toBe('unreviewed');
      expect(r.content).toBeUndefined();
    }
    const one = await http().get(`/v1/resources/${res.body.items[0].id}`).expect(200);
    expect(one.body.sections.length).toBeGreaterThan(0);
  });
});

describe('account export and deletion', () => {
  it('exports data and deletes the account, invalidating its tokens', async () => {
    const u = await registerUser(app);
    const id = randomUUID();
    await push(app, u, [op('task', id, taskData(id))]).expect(200);
    const exp = await http().get('/v1/me/export').set(u.auth()).expect(200);
    expect(exp.body.data.task).toHaveLength(1);
    expect(JSON.stringify(exp.body)).not.toMatch(/passwordHash|tokenHash/);
    await http().delete('/v1/me').set(u.auth()).send({ password: 'wrong password!', confirm: 'DELETE' }).expect(403);
    await http().delete('/v1/me').set(u.auth()).send({ password: u.password, confirm: 'DELETE' }).expect(204);
    await http().get('/v1/me').set(u.auth()).expect(401);
    await http().post('/v1/auth/login').send({ email: u.email, password: u.password }).expect(401);
  });
});
