"""Generates the narration with Kokoro (an open, Apache-2.0 text-to-speech model that runs offline).

Setup (once, in any folder outside the repo):
    uv venv .venv && uv pip install --python .venv kokoro-onnx soundfile
    download kokoro-v1.0.onnx and voices-v1.0.bin from
    https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0

Run from the video/ folder:
    <venv>/python scripts/tts.py <folder with the two model files>

Writes public/voice/<id>.wav and src/narration.generated.json (text + duration per line).
The voice is synthetic; the website says so next to the video.
"""
import json
import pathlib
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

root = pathlib.Path(__file__).resolve().parent.parent
models = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
cfg = json.loads((root / 'narration.json').read_text(encoding='utf-8'))
kokoro = Kokoro(str(models / 'kokoro-v1.0.onnx'), str(models / 'voices-v1.0.bin'))
out_dir = root / 'public' / 'voice'
out_dir.mkdir(parents=True, exist_ok=True)

result = []
for line in cfg['lines']:
    samples, sr = kokoro.create(line.get('say', line['text']), voice=cfg['voice'], speed=cfg['speed'], lang='en-us')
    samples = np.asarray(samples, dtype=np.float32)
    # Trim leading/trailing near-silence so timing is driven by speech, then normalise peaks.
    loud = np.where(np.abs(samples) > 0.01)[0]
    if loud.size:
        samples = samples[max(0, loud[0] - int(0.05 * sr)) : loud[-1] + int(0.12 * sr)]
    peak = float(np.max(np.abs(samples))) or 1.0
    samples = samples * (0.89 / peak)
    sf.write(out_dir / f"{line['id']}.wav", samples, sr, subtype='PCM_16')
    seconds = round(len(samples) / sr, 3)
    result.append({'id': line['id'], 'text': line['text'], 'file': f"voice/{line['id']}.wav", 'seconds': seconds})
    print(f"{line['id']:10s} {seconds:6.2f}s")

(root / 'src').mkdir(exist_ok=True)
(root / 'src' / 'narration.generated.json').write_text(json.dumps({'voice': cfg['voice'], 'lines': result}, indent=2), encoding='utf-8')
print('total speech', round(sum(r['seconds'] for r in result), 1), 's')
