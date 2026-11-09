// Captures a real screen from the NextStep Android app for the website.
//
// Usage (the app open on an emulator or a device connected with adb):
//   node scripts/capture-android.mjs --demo-mode on    # clean status bar (Android's SystemUI demo mode)
//   node scripts/capture-android.mjs today             # -> public/screens/app/today.webp (720×1600)
//   node scripts/capture-android.mjs --demo-mode off
//
// The screenshot is only resized and converted to WebP — the app content is never edited.
// Register new files in src/lib/screens.ts (with alt text) and list them in docs/ASSET_MANIFEST.md.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
const ADB = process.env.ADB || (sdk ? path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb') : 'adb');
const adb = (...args) => execFileSync(ADB, args, { maxBuffer: 64 * 1024 * 1024 });
const demo = (...extra) => adb('shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', ...extra);

const [arg, value] = process.argv.slice(2);
if (!arg) {
  console.error('Usage: node scripts/capture-android.mjs <name> | --demo-mode on|off');
  process.exit(1);
}

if (arg === '--demo-mode') {
  if (value === 'off') {
    demo('exit');
  } else {
    adb('shell', 'settings', 'put', 'global', 'sysui_demo_allowed', '1');
    demo('enter');
    demo('battery', '-e', 'level', '100', '-e', 'plugged', 'false');
    demo('network', '-e', 'wifi', 'show', '-e', 'level', '4', '-e', 'fully', 'true');
    demo('network', '-e', 'mobile', 'hide');
    demo('notifications', '-e', 'visible', 'false');
  }
  console.log(`Status-bar demo mode ${value === 'off' ? 'off' : 'on'}.`);
  process.exit(0);
}

if (!/^[a-z0-9-]+$/.test(arg)) {
  console.error('Use a simple file name: lowercase letters, digits and dashes.');
  process.exit(1);
}

// Keep the status-bar clock equal to the device clock, so it matches the time shown in the app.
try {
  demo('clock', '-e', 'hhmm', adb('shell', 'date', '+%H%M').toString().trim());
  await new Promise((r) => setTimeout(r, 400));
} catch {
  /* demo mode not enabled — the real status bar is captured */
}

const png = adb('exec-out', 'screencap', '-p');
const outDir = path.join(import.meta.dirname, '..', 'public', 'screens', 'app');
mkdirSync(outDir, { recursive: true });

let sharp;
try {
  sharp = createRequire(import.meta.url)('sharp');
} catch {
  sharp = null;
}
if (sharp) {
  const out = path.join(outDir, `${arg}.webp`);
  await sharp(png).resize(720, 1600, { fit: 'fill' }).webp({ quality: 86, effort: 6 }).toFile(out);
  console.log('Saved', path.relative(process.cwd(), out));
} else {
  const out = path.join(outDir, `${arg}.png`);
  writeFileSync(out, png);
  console.log('Saved', path.relative(process.cwd(), out), '(install sharp to resize and convert to WebP)');
}
