import * as SQLite from 'expo-sqlite';

export type Db = SQLite.SQLiteDatabase;

/**
 * One SQLite file per account ("guest" or a user id) so accounts on a
 * shared phone never see each other's data. Logging out deletes the file.
 */
export const dbNameFor = (accountKey: string) => `nextstep-${accountKey.replace(/[^a-zA-Z0-9-]/g, '')}.db`;

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS records (
  entity TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  rev INTEGER,
  deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entity, id)
);
CREATE TABLE IF NOT EXISTS outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  op_id TEXT NOT NULL UNIQUE,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  base_rev INTEGER,
  changed_fields TEXT,
  data TEXT,
  batch_id TEXT,
  base_plan_revision INTEGER,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS outbox_record ON outbox (entity, entity_id, status);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS conflicts (id TEXT PRIMARY KEY, data TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS downloads (resource_id TEXT PRIMARY KEY, version INTEGER NOT NULL, size_bytes INTEGER NOT NULL, data TEXT NOT NULL, downloaded_at TEXT NOT NULL);
`;

export async function openAccountDb(accountKey: string): Promise<Db> {
  const db = await SQLite.openDatabaseAsync(dbNameFor(accountKey));
  await db.execAsync(SCHEMA);
  return db;
}

export async function deleteAccountDb(db: Db | null, accountKey: string): Promise<void> {
  try {
    await db?.closeAsync();
  } catch {
    /* already closed */
  }
  try {
    await SQLite.deleteDatabaseAsync(dbNameFor(accountKey));
  } catch {
    /* file may not exist */
  }
}

export async function getMeta<T>(db: Db, key: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row ? (JSON.parse(row.value) as T) : null;
}

export async function setMeta(db: Db, key: string, value: unknown): Promise<void> {
  await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
}
