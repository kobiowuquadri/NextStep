// Prepares the rendered video for the website: a web-friendly MP4 (fast start, AAC voice),
// a poster image, the captions, and a small JSON with chapters, transcript, duration and size.
// Run after `npm run render`:  node scripts/export-web.mjs
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const web = path.join(root, '..', 'apps', 'web');
const outDir = path.join(web, 'public', 'video');
mkdirSync(outDir, { recursive: true });

const timeline = JSON.parse(readFileSync(path.join(root, 'src', 'timeline.generated.json'), 'utf8'));
const LABELS = {
  intro: 'Welcome',
  tobi: 'Meet Tobi',
  today: 'Today',
  recover: 'Recovery Mode',
  focus: 'Focus',
  checkin: 'Check-in',
  badge: 'Back on Track',
  journey: 'Journey',
  plan: 'Plan',
  outro: 'Keep moving',
};

const src = path.join(root, 'out', 'nextstep-walkthrough.mp4');
const mp4 = path.join(outDir, 'nextstep-walkthrough.mp4');
execFileSync('ffmpeg', [
  '-v',
  'error',
  '-y',
  '-i',
  src,
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '24',
  '-profile:v',
  'high',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  '-af',
  'loudnorm=I=-16:TP=-2:LRA=11,alimiter=limit=0.7:level=false',
  '-c:a',
  'aac',
  '-b:a',
  '96k',
  '-ac',
  '1',
  '-ar',
  '48000',
  mp4,
]);

const posterScene = timeline.scenes.find((s) => s.id === 'recover');
const posterAt = (posterScene.start + 9.4 * timeline.fps) / timeline.fps;
const poster = path.join(outDir, 'nextstep-walkthrough-poster.jpg');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(posterAt), '-i', src, '-frames:v', '1', '-vf', 'scale=1600:-1', '-q:v', '4', poster]);

copyFileSync(path.join(root, 'out', 'captions.vtt'), path.join(outDir, 'nextstep-walkthrough.en.vtt'));

const transcript = readFileSync(path.join(root, 'out', 'transcript.txt'), 'utf8')
  .trim()
  .split('\n');
const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString());
const info = {
  duration: Math.round(seconds * 10) / 10,
  bytes: statSync(mp4).size,
  width: 1920,
  height: 1080,
  voice: 'Kokoro (af_heart), synthetic',
  chapters: timeline.scenes.map((s) => ({ label: LABELS[s.id] ?? s.id, start: Math.round((s.start / timeline.fps) * 10) / 10 })),
  transcript,
};
writeFileSync(path.join(web, 'src', 'lib', 'walkthrough.generated.json'), JSON.stringify(info, null, 2) + '\n');
console.log(
  `video ${(info.bytes / 1e6).toFixed(1)} MB, ${info.duration}s; poster ${(statSync(poster).size / 1024).toFixed(0)} KB; ${info.chapters.length} chapters`,
);
