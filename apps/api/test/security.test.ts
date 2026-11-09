import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';

/** Separate file: runs in its own worker with real rate limits and captured logs. */
let app: INestApplication;
const lines: string[] = [];

beforeAll(async () => {
  process.env.TEST_RATE_LIMITS = '1';
  process.env.AUTH_RATE_LIMIT_PER_MINUTE = '3';
  process.env.DATABASE_URL = inject('databaseUrl');
  process.env.JWT_SECRET ??= 'test-secret-0123456789abcdef0123456789abcdef';
  const capture = (...args: unknown[]) => lines.push(args.map(String).join(' '));
  vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string) => (capture(chunk), true)) as never);
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string) => (capture(chunk), true)) as never);
  const { createApp } = await import('../src/bootstrap.js');
  app = await createApp({ logger: true });
  await app.init();
});
afterAll(async () => {
  vi.restoreAllMocks();
  await app?.close();
});

describe('security', () => {
  it('rate-limits authentication attempts', async () => {
    const email = `rl-${randomUUID()}@example.test`;
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password: 'wrong password!!' })).status);
    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses).toContain(429);
  });

  it('never logs passwords, tokens or email addresses', async () => {
    const email = `log-${randomUUID()}@example.test`;
    const password = 'super secret passphrase 123';
    const res = await request(app.getHttpServer()).post('/v1/auth/register').set('X-Forwarded-For', '10.9.9.9').send({ email, password, displayName: 'Log', timezone: 'Africa/Lagos' });
    expect([201, 429]).toContain(res.status);
    const all = lines.join('\n');
    expect(all).toContain('POST /v1/auth/register');
    expect(all).not.toContain(password);
    expect(all).not.toContain(email);
    if (res.status === 201) {
      expect(all).not.toContain(res.body.accessToken);
      expect(all).not.toContain(res.body.refreshToken);
    }
  });

  it('sets security headers', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
