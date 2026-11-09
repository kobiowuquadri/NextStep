import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import type { TestProject } from 'vitest/node';
import { startLocalPostgres, type LocalPg } from '../scripts/embedded-postgres.js';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** A free TCP port, so a stale cluster from an interrupted run can never block the suite. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

let pg: LocalPg | null = null;
let dir: string | null = null;

/**
 * Integration tests run against real PostgreSQL. If TEST_DATABASE_URL is set
 * (e.g. Docker or CI service), it is used; otherwise a throwaway embedded
 * PostgreSQL cluster is started on a free port.
 */
export async function setup(project: TestProject) {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    dir = mkdtempSync(path.join(tmpdir(), 'nextstep-pg-'));
    pg = await startLocalPostgres({ dir, port: Number(process.env.TEST_PG_PORT ?? (await freePort())), databases: ['nextstep_test'], persistent: false });
    url = pg.url('nextstep_test');
  }
  const cwd = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd, env, stdio: 'pipe' });
  process.env.DATABASE_URL = url;
  project.provide('databaseUrl', url);
  process.env.JWT_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';
  return async () => {
    try {
      if (pg) await pg.stop();
    } catch {
      // Already stopped.
    }
    // Windows can hold the data directory for a moment after shutdown; a leftover temp folder is harmless.
    try {
      if (dir) rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      // Best effort.
    }
  };
}
