// Puts a built Android APK on the website: copies it to public/downloads/NextStep-<version>.apk
// (removing older copies) and writes src/lib/release.json with facts read from the APK itself.
// usage: node scripts/publish-apk.mjs <path to .apk>
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) throw new Error('Pass the path to the .apk');
const web = path.join(import.meta.dirname, '..');

// aapt2 from the newest Android build-tools reads the version and minimum SDK from the manifest.
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
const tools = path.join(sdk, 'build-tools');
const newest = readdirSync(tools).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
const aapt = path.join(tools, newest, process.platform === 'win32' ? 'aapt2.exe' : 'aapt2');
const badging = execFileSync(aapt, ['dump', 'badging', src]).toString();
const pick = (re) => badging.match(re)?.[1] ?? null;
const pkg = pick(/package: name='([^']+)'/);
const version = pick(/versionName='([^']+)'/);
const versionCode = Number(pick(/versionCode='(\d+)'/));
const minSdk = Number(pick(/minSdkVersion:'(\d+)'/));
if (pkg !== 'com.teamapex.nextstep' || !version) throw new Error(`Unexpected APK: ${pkg} ${version}`);
const ANDROID = { 21: '5.0', 23: '6.0', 24: '7.0', 26: '8.0', 28: '9', 29: '10', 30: '11', 31: '12', 33: '13', 34: '14', 35: '15', 36: '16' };

const outDir = path.join(web, 'public', 'downloads');
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.apk')) rmSync(path.join(outDir, f));
const name = `NextStep-${version}.apk`;
copyFileSync(src, path.join(outDir, name));

const bytes = statSync(src).size;
const sha256 = createHash('sha256').update(readFileSync(src)).digest('hex');
const release = {
  available: true,
  version,
  versionCode,
  file: `/downloads/${name}`,
  bytes,
  sha256,
  minAndroid: ANDROID[minSdk] ?? `API ${minSdk}`,
  published: new Date().toISOString().slice(0, 10),
};
writeFileSync(path.join(web, 'src', 'lib', 'release.json'), JSON.stringify(release, null, 2) + '\n');
console.log(`${name}: ${(bytes / 1e6).toFixed(1)} MB, versionCode ${versionCode}, Android ${release.minAndroid}+, sha256 ${sha256.slice(0, 16)}…`);
