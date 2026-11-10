# NextStep walkthrough video

The narrated walkthrough on the website's `/demo` page. It combines real footage of the NextStep Android app with motion graphics, rendered with [Remotion](https://www.remotion.dev).

This folder is a separate npm project, not part of the pnpm workspace, so its dependencies never affect the website or API builds.

## What's real and what's generated

| Part | Source |
|---|---|
| App screens | Screen recordings of the NextStep **release build** on an Android emulator, with the fictional sample semester. Segments are only trimmed (and the last frame held for a moment); the app content is not edited. Touch indicators come from Android's "Show taps" setting. |
| Narration | A **synthetic voice**: [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0), voice `af_heart`, run offline. The website says so next to the video. `narration.json` holds the script; `say` is only a pronunciation hint ("Toby" for "Tobi"). |
| Motion graphics | `src/` (React components rendered by Remotion), using the brand colours, the Bricolage Grotesque and Plus Jakarta Sans fonts (SIL OFL, in `public/fonts`) and the mascot/logo art from `packages/illustrations`. |
| Captions | Generated from the same script and timeline (`out/captions.vtt`). |

Every claim in the narration matches the app and the docs. Re-check them if you change the script.

## Rebuild it

Requirements: Node 22+, ffmpeg on PATH, and for new footage an Android emulator with the release APK. For new narration, Python with `kokoro-onnx` (see `scripts/tts.py`).

```bash
npm install
npm run art                                        # mascot/logo SVGs from packages/illustrations (run `pnpm build:packages` first)
node scripts/record-android.mjs c1_today <recDir>  # …and the other clips listed at the top of the script
node scripts/prepare-footage.mjs <recDir>          # trimmed 30 fps segments → public/clips
<python> scripts/tts.py <kokoro model folder>      # narration → public/voice + src/narration.generated.json
node scripts/build-timeline.mjs                    # frame timeline + captions; fails if a line overruns its scene
npm run render -- --port=3456                      # → out/nextstep-walkthrough.mp4 (pick a free port)
node scripts/export-web.mjs                        # web MP4, poster, captions and metadata → apps/web
```

`npm run studio` opens Remotion Studio for previewing and tweaking scenes.

The raw recordings, cut clips and voice files are not committed (they're large and can be regenerated). The finished video, poster and captions are committed under `apps/web/public/video/`.

## Licences

- Remotion is free for individuals and small teams; larger companies need a company licence. Check [remotion.dev/license](https://www.remotion.dev/license) before reusing this project commercially.
- Kokoro model and voices: Apache-2.0. kokoro-onnx: MIT.
- Fonts: SIL Open Font License 1.1 (texts in `public/fonts`).
