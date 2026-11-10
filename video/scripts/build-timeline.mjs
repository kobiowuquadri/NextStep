// Builds the frame-exact timeline from scenes.json, the narration durations and the clip lengths,
// and writes the captions (WebVTT) that the website serves next to the video.
// Run after tts.py and prepare-footage.mjs:  node scripts/build-timeline.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const read = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));
const { fps, scenes, chapters } = read('scenes.json');
const narration = Object.fromEntries(read('src/narration.generated.json').lines.map((l) => [l.id, l]));
const clipFrames = (name) =>
  Math.round(
    Number(
      execFileSync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'csv=p=0',
        path.join(root, 'public', 'clips', `${name}.mp4`),
      ]).toString(),
    ) * fps,
  );

let cursor = 0;
const out = [];
const cues = [];
for (const s of scenes) {
  const clips = (s.clips ?? []).map((c) => ({ name: c, frames: clipFrames(c) }));
  const frames = clips.length ? clips.reduce((n, c) => n + c.frames, 0) : Math.round(s.seconds * fps);
  const voice = (s.voice ?? []).map((v) => {
    const line = narration[v.id];
    if (!line) throw new Error(`No narration for ${v.id}`);
    const from = cursor + Math.round(v.at * fps);
    const len = Math.ceil(line.seconds * fps);
    if (from + len > cursor + frames)
      throw new Error(`Narration "${v.id}" (${line.seconds}s at ${v.at}s) overruns scene "${s.id}" (${(frames / fps).toFixed(2)}s)`);
    cues.push({ from, to: from + len, text: line.text });
    return { id: v.id, file: line.file, from: from - cursor, frames: len };
  });
  const callouts = (s.callouts ?? []).map((c) => ({ ...c, from: Math.round(c.at * fps), to: Math.round(c.until * fps) }));
  out.push({ ...s, start: cursor, frames, clips, voice, callouts });
  cursor += frames;
}

writeFileSync(path.join(root, 'src', 'timeline.generated.json'), JSON.stringify({ fps, totalFrames: cursor, chapters, scenes: out }, null, 2));

const ts = (f) => {
  const ms = Math.round((f / fps) * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
  const sec = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
  return `${h}:${m}:${sec}.${String(ms % 1000).padStart(3, '0')}`;
};
mkdirSync(path.join(root, 'out'), { recursive: true });
writeFileSync(path.join(root, 'out', 'captions.vtt'), 'WEBVTT\n\n' + cues.map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}\n`).join('\n'));
writeFileSync(path.join(root, 'out', 'transcript.txt'), cues.map((c) => c.text).join('\n') + '\n');
console.log(`${out.length} scenes, ${cursor} frames (${(cursor / fps).toFixed(1)} s), ${cues.length} captions`);
for (const s of out) console.log(`  ${s.id.padEnd(8)} ${(s.start / fps).toFixed(2).padStart(6)}s  ${(s.frames / fps).toFixed(2)}s`);
