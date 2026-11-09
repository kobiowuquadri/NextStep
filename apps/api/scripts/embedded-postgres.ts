/**
 * Local PostgreSQL without Docker, for development and tests on machines where
 * Docker isn't available. Uses real PostgreSQL binaries from the
 * `embedded-postgres` package. Docker Compose remains the recommended path.
 *
 *   pnpm --filter @nextstep/api db:embedded          # start and keep running
 */
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface LocalPg {
  url: (db: string) => string;
  stop: () => Promise<void>;
}

export async function startLocalPostgres(opts: { dir?: string; port?: number; databases?: string[]; persistent?: boolean } = {}): Promise<LocalPg> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const databaseDir = opts.dir ?? path.join(here, '..', '.pgdata');
  const port = opts.port ?? 54329;
  const pg = new EmbeddedPostgres({ databaseDir, port, user: 'nextstep', password: 'nextstep', persistent: opts.persistent ?? true, initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {} });
  if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  for (const db of opts.databases ?? ['nextstep']) {
    try {
      await pg.createDatabase(db);
    } catch {
      /* already exists */
    }
  }
  return { url: (db) => `postgresql://nextstep:nextstep@localhost:${port}/${db}`, stop: () => pg.stop() };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const pg = await startLocalPostgres();
  console.log(`PostgreSQL running at ${pg.url('nextstep')} — press Ctrl+C to stop.`);
  const shutdown = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
