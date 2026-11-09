#!/usr/bin/env node
/**
 * Fails if anything that looks like a server secret appears in client code or
 * built client bundles (website + demo, mobile source/bundle).
 *
 *   node scripts/check-client-secrets.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  'apps/web/.next/static',
  'apps/web/src',
  'apps/mobile/src',
  'apps/mobile/android/app/build/generated/assets', // release JS bundle, when built locally
  'packages',
];
const patterns = [
  { name: 'Anthropic API key', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'Server env var name in client code', re: /\b(ANTHROPIC_API_KEY|JWT_SECRET|DATABASE_URL|SMTP_PASSWORD)\b/ },
  { name: 'Private key block', re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
  { name: 'Postgres URL with password', re: /postgres(ql)?:\/\/[^:\s'"]+:[^@\s'"]+@(?!localhost|127\.0\.0\.1|db:)/ },
];
const skipDirs = new Set(['node_modules', 'dist', '.turbo', 'test', '__tests__']);
const exts = /\.(m?js|tsx?|json|html|css|bundle|hbc)$/;
let findings = 0;
let scanned = 0;

function walk(p) {
  if (!existsSync(p)) return;
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const f of readdirSync(p)) if (!skipDirs.has(f)) walk(path.join(p, f));
    return;
  }
  if (!exts.test(p) || st.size > 30 * 1024 * 1024) return;
  if (p.includes(`${path.sep}packages${path.sep}`) && !p.includes(`${path.sep}src${path.sep}`)) return;
  scanned++;
  const text = readFileSync(p, 'utf8');
  for (const { name, re } of patterns) {
    if (re.test(text)) {
      findings++;
      console.error(`✗ ${name}: ${path.relative(root, p)}`);
    }
  }
}

for (const t of targets) walk(path.join(root, t));
console.log(`Scanned ${scanned} client files.`);
if (findings) {
  console.error(`${findings} possible secret(s) found in client code.`);
  process.exit(1);
}
console.log('✓ No server secrets found in client code or bundles.');
