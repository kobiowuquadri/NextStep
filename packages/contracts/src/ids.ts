import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Client-generated or server-generated UUID-formatted identifier. */
export const Id = z.string().regex(UUID_RE, 'Expected a UUID');
export type Id = z.infer<typeof Id>;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Deterministic, non-cryptographic 128-bit hash formatted as a UUID (version
 * nibble 5, RFC variant). Used so the same plan generated twice, or on two
 * devices from identical inputs, produces identical session IDs and therefore
 * cannot create duplicates on sync. Never use for secrets.
 */
export function stableUuid(...parts: Array<string | number | null | undefined>): string {
  const input = parts.map((p) => (p === null || p === undefined ? '∅' : String(p))).join('|');
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  const hex = [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('');
  const chars = hex.split('');
  chars[12] = '5';
  chars[16] = ((parseInt(chars[16]!, 16) & 0x3) | 0x8).toString(16);
  const s = chars.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/** Short stable hash string (hex) for fingerprints. */
export function stableHash(value: unknown): string {
  return stableUuid(canonicalJson(value)).replace(/-/g, '');
}

/** JSON with sorted object keys so equal values always serialise identically. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}
