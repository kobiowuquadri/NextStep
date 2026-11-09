import type { LearningResource } from '@nextstep/contracts';
import { LEARNING_RESOURCES, resourceSize } from '@nextstep/demo-data';
import { publicRequest } from './api';
import { getMeta, setMeta, type Db } from './db';

export interface CatalogItem {
  id: string;
  title: string;
  subject: string;
  kind: 'guide' | 'practice';
  summary: string;
  estMinutes: number;
  version: number;
  sizeBytes: number;
  reviewStatus: string;
  provenance: string;
  /** 'server' items need a connection to download; 'bundled' sample items ship inside the app. */
  source: 'server' | 'bundled';
}

const bundled = (): CatalogItem[] =>
  LEARNING_RESOURCES.map((r) => ({ id: r.id, title: r.title, subject: r.subject, kind: r.kind, summary: r.summary, estMinutes: r.estMinutes, version: r.version, sizeBytes: resourceSize(r), reviewStatus: r.reviewStatus, provenance: r.provenance, source: 'bundled' }));

/** Catalogue: from the server when signed in and online (cached), otherwise the sample items bundled with the app. */
export async function loadCatalog(db: Db, useServer: boolean): Promise<{ items: CatalogItem[]; fromCache: boolean; error: string | null }> {
  if (!useServer) return { items: bundled(), fromCache: false, error: null };
  try {
    const res = await publicRequest<{ items: Array<Omit<CatalogItem, 'source'>> }>('GET', '/v1/resources');
    const items = res.items.map((i) => ({ ...i, source: 'server' as const }));
    await setMeta(db, 'resourceCatalog', items);
    return { items, fromCache: false, error: null };
  } catch {
    const cached = await getMeta<CatalogItem[]>(db, 'resourceCatalog');
    return { items: cached ?? [], fromCache: true, error: cached ? null : 'Connect to the internet to see the resource library. Downloaded items work offline.' };
  }
}

export async function downloadResource(db: Db, item: CatalogItem): Promise<LearningResource> {
  const full: LearningResource =
    item.source === 'bundled' ? LEARNING_RESOURCES.find((r) => r.id === item.id)! : await publicRequest<LearningResource>('GET', `/v1/resources/${item.id}`);
  await db.runAsync(
    'INSERT OR REPLACE INTO downloads (resource_id, version, size_bytes, data, downloaded_at) VALUES (?, ?, ?, ?, ?)',
    item.id,
    full.version,
    item.sizeBytes,
    JSON.stringify(full),
    new Date().toISOString(),
  );
  return full;
}

export async function getDownloaded(db: Db, id: string): Promise<LearningResource | null> {
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM downloads WHERE resource_id = ?', id);
  return row ? (JSON.parse(row.data) as LearningResource) : null;
}

export async function listDownloads(db: Db): Promise<Array<{ resource_id: string; size_bytes: number; version: number }>> {
  return db.getAllAsync('SELECT resource_id, size_bytes, version FROM downloads');
}

export async function removeDownload(db: Db, id: string) {
  await db.runAsync('DELETE FROM downloads WHERE resource_id = ?', id);
}

export const kb = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);
