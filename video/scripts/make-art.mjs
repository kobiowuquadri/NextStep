// Writes the brand artwork the video uses (mascot poses, logo mark, a badge) as SVG files
// from the shared @nextstep/illustrations package. Build the packages first: `pnpm build:packages`.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.join(import.meta.dirname, '..');
const lib = await import(pathToFileURL(path.join(root, '..', 'packages', 'illustrations', 'dist', 'index.js')).href);
const out = path.join(root, 'public', 'art');
mkdirSync(out, { recursive: true });

const files = {
  'logo.svg': lib.logoMarkSvg({ size: 256 }),
  'mascot-welcome.svg': lib.mascotSvg({ pose: 'welcome' }),
  'mascot-encourage.svg': lib.mascotSvg({ pose: 'encourage', accessory: 'backpack' }),
  'mascot-recovery.svg': lib.mascotSvg({ pose: 'recovery' }),
  'mascot-focus.svg': lib.mascotSvg({ pose: 'focus', accessory: 'headphones' }),
  'mascot-celebrate.svg': lib.mascotSvg({ pose: 'celebrate' }),
  'badge-reroute.svg': lib.badgeSvg('reroute'),
};
for (const [name, svg] of Object.entries(files)) {
  // Standalone SVG files need the namespace; inline markup from the package may omit it.
  const doc = svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  writeFileSync(path.join(out, name), doc);
}
console.log('wrote', Object.keys(files).length, 'files to public/art');
