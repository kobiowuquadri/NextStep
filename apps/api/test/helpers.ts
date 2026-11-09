import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { inject } from 'vitest';
import type { SyncOp } from '@nextstep/contracts';

export async function bootApp(): Promise<INestApplication> {
  process.env.DATABASE_URL = inject('databaseUrl');
  process.env.JWT_SECRET ??= 'test-secret-0123456789abcdef0123456789abcdef';
  const { createApp } = await import('../src/bootstrap.js');
  const app = await createApp({ logger: false });
  await app.init();
  return app;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  access: string;
  refresh: string;
  auth: () => { Authorization: string };
}

export async function registerUser(app: INestApplication, name = 'Ada'): Promise<TestUser> {
  const email = `${name.toLowerCase()}-${randomUUID().slice(0, 8)}@example.test`;
  const password = 'correct horse battery staple';
  const res = await request(app.getHttpServer()).post('/v1/auth/register').send({ email, password, displayName: name, timezone: 'Africa/Lagos' }).expect(201);
  const u: TestUser = {
    id: res.body.user.id,
    email,
    password,
    access: res.body.accessToken,
    refresh: res.body.refreshToken,
    auth: () => ({ Authorization: `Bearer ${u.access}` }),
  };
  return u;
}

export const iso = (ms = Date.now()) => new Date(ms).toISOString();

export function taskData(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    title: 'Linked list assignment',
    description: null,
    courseId: null,
    goalId: null,
    kind: 'assignment',
    dueAt: iso(Date.now() + 4 * 86_400_000),
    importance: 3,
    estimatedMinutes: 120,
    remainingMinutes: 120,
    status: 'todo',
    dependsOn: [],
    preferredSessionMinutes: null,
    splittable: true,
    optional: false,
    connectivity: 'any',
    links: [],
    resourceIds: [],
    completedAt: null,
    createdAt: iso(Date.now() - 3_600_000),
    updatedAt: iso(),
    ...patch,
  };
}

export function op(entity: SyncOp['entity'], entityId: string, data: Record<string, unknown> | undefined, extra: Partial<SyncOp> = {}): SyncOp {
  return { opId: randomUUID(), entity, entityId, kind: 'upsert', baseRev: null, data, clientTime: iso(), ...extra };
}

export const push = (app: INestApplication, user: TestUser, ops: SyncOp[], deviceId = 'device-aaaa-1') =>
  request(app.getHttpServer()).post('/v1/sync/push').set(user.auth()).send({ deviceId, ops });

export const pull = (app: INestApplication, user: TestUser, cursor = 0) => request(app.getHttpServer()).get(`/v1/sync/pull?cursor=${cursor}`).set(user.auth());
