// Records real NextStep app footage on an Android emulator while driving the app with adb taps.
// Uses the emulator's own recorder (adb emu screenrecord), which captures far more frames than
// the in-device `screenrecord` on an emulator.
//
// Before recording: install the release APK, then
//   adb shell pm clear com.teamapex.nextstep
//   adb shell pm grant com.teamapex.nextstep android.permission.POST_NOTIFICATIONS
//   adb shell settings put system show_touches 1           # shows taps in the footage
//   node ../apps/web/scripts/capture-android.mjs --demo-mode on   # clean status bar
// and open the app on its welcome screen. Record the clips in order (each continues from the last):
//   node scripts/record-android.mjs c1_today [outDir]   … then c2_recovery, c3_focus, c3b_checkin, c4_journey, c5_plan
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
const ADB = process.env.ADB || path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const adb = (...a) => execFileSync(ADB, a, { maxBuffer: 64 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let T0 = Date.now();
const stamp = (label) => console.log(((Date.now() - T0) / 1000).toFixed(2).padStart(6), label);

function nodes() {
  for (let i = 0; i < 5; i++) {
    try {
      adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
      break;
    } catch (e) {
      if (i === 4) throw e;
    }
  }
  const xml = adb('shell', 'cat', '/sdcard/ui.xml').toString('utf8');
  return [...xml.matchAll(/<node [^>]*?text="([^"]*)"[^>]*?content-desc="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)].map((m) => ({
    text: m[1].replace(/&amp;/g, '&'),
    desc: m[2].replace(/&amp;/g, '&'),
    x: Math.round((+m[3] + +m[5]) / 2),
    y: Math.round((+m[4] + +m[6]) / 2),
  }));
}
function find(want) {
  const w = want.toLowerCase();
  const ns = nodes();
  return (
    ns.find((n) => n.desc.toLowerCase() === w || n.text.toLowerCase() === w) ??
    ns.find((n) => n.desc.toLowerCase().startsWith(w) || n.text.toLowerCase().startsWith(w))
  );
}
const tap = (want) => async () => {
  const n = find(want);
  if (!n) throw new Error('NOT FOUND: ' + want);
  adb('shell', 'input', 'tap', String(n.x), String(n.y));
  stamp('tap ' + want);
};
const tapXY = (x, y) => async () => {
  adb('shell', 'input', 'tap', String(x), String(y));
  stamp(`tapXY ${x},${y}`);
};
const wait = (ms) => async () => sleep(ms);
const swipe =
  (y1, y2, ms = 900) =>
  async () => {
    stamp(`swipe ${y1}->${y2}`);
    adb('shell', 'input', 'swipe', '540', String(y1), '540', String(y2), String(ms));
  };
const key = (k) => async () => adb('shell', 'input', 'keyevent', String(k));

const CLIPS = {
  c1_today: [wait(1800), tap('Explore a fictional sample semester'), wait(3200), swipe(1700, 1100, 1400), wait(1800), swipe(1700, 1150, 1400), wait(2200)],
  c2_recovery: [
    tap('My plans changed'),
    wait(2200),
    tap('I have less time'),
    wait(1600),
    tap('45 min'),
    wait(1200),
    tap('Show me the new plan'),
    wait(3500),
    swipe(1800, 1000, 1600),
    wait(2000),
    swipe(1800, 900, 1600),
    wait(1500),
    swipe(1900, 500, 800),
    wait(500),
    swipe(1900, 500, 800),
    wait(1800),
    tap('Accept changes'),
    wait(3000),
  ],
  c3_focus: [tap('Start: Implement insert and delete'), wait(2200), swipe(1700, 900, 1000), wait(1200), tap('Start'), wait(7000)],
  c3b_checkin: [tapXY(536, 1254), wait(2600), tap('Ready'), wait(1200), swipe(1900, 700, 1200), wait(1200), tap('Save check-in'), wait(4200)],
  c4_journey: [tap('Keep going'), wait(1500), tap('Journey'), wait(2600), swipe(1800, 1000, 1500), wait(1600), swipe(1800, 900, 1500), wait(2200)],
  c5_plan: [tap('Plan'), wait(2600), tap('Wed'), wait(2000), tap('Tasks'), wait(2600)],
};

const name = process.argv[2];
const steps = CLIPS[name];
if (!steps) throw new Error('unknown clip ' + name);
const dir = path.resolve(process.argv[3] ?? 'recordings');
mkdirSync(dir, { recursive: true });
const out = path.join(dir, `${name}.webm`);
T0 = Date.now();
adb('emu', 'screenrecord', 'start', '--size', '720x1600', '--fps', '30', '--bit-rate', '8000000', '--time-limit', '170', out);
await sleep(900);
try {
  for (const s of steps) await s();
} finally {
  adb('emu', 'screenrecord', 'stop');
  await sleep(1500);
  console.log('saved', out);
}
