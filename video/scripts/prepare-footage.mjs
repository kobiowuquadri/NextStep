// Cuts the raw emulator recordings into the segments the video uses, as constant-30fps H.264.
// usage: node scripts/prepare-footage.mjs <folder with c1_today.webm … c5_plan.webm>
// The recordings come from scripts/record-android.mjs (real app, Android emulator). Content is only trimmed.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) throw new Error('Pass the folder that holds the recordings.');
const out = path.join(import.meta.dirname, '..', 'public', 'clips');
mkdirSync(out, { recursive: true });

// [name, recording, start s, end s, hold last frame s]
const SEGMENTS = [
  ['today', 'c1_today', 9.9, 18.2, 1.8],
  ['rec-sheet', 'c2_recovery', 8.6, 12.2, 0],
  ['rec-time', 'c2_recovery', 16.8, 19.6, 0],
  ['rec-preview', 'c2_recovery', 30.4, 36.3, 0],
  ['rec-scroll', 'c2_recovery', 37.2, 40.4, 0],
  ['rec-accept', 'c2_recovery', 50.8, 54.8, 0.4],
  ['focus-pick', 'c3_focus', 6.8, 11.5, 0],
  ['focus-timer', 'c3_focus', 36.0, 43.5, 0],
  ['checkin-open', 'c3b_checkin', 1.0, 5.0, 0],
  ['checkin-ready', 'c3b_checkin', 11.2, 15.0, 0],
  ['badge', 'c3b_checkin', 22.4, 25.7, 1.8],
  ['journey', 'c4_journey', 19.6, 26.2, 0.8],
  ['plan-today', 'c5_plan', 9.6, 13.6, 0],
  ['plan-wed', 'c5_plan', 20.2, 24.0, 0],
  ['plan-tasks', 'c5_plan', 32.4, 35.3, 0.6],
];

for (const [name, rec, start, end, hold] of SEGMENTS) {
  // Trim inside the filter graph (frame-accurate on the emulator's variable-frame-rate WebM), then hold the last frame if asked.
  const vf = [
    `trim=start=${start}:end=${end}`,
    'setpts=PTS-STARTPTS',
    'fps=30',
    'scale=720:1600:flags=lanczos',
    hold ? `tpad=stop_mode=clone:stop_duration=${hold}` : null,
  ]
    .filter(Boolean)
    .join(',');
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    path.join(src, `${rec}.webm`),
    '-an',
    '-vf',
    vf,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '16',
    '-pix_fmt',
    'yuv420p',
    path.join(out, `${name}.mp4`),
  ]);
  console.log(name.padEnd(14), `${(end - start + hold).toFixed(1)} s`);
}
