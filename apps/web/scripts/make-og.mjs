/** Renders public/og.png (1200×630) from brand HTML + SVG art. Text is real type, not generated imagery. */
import { chromium } from '@playwright/test';
import { heroSceneSvg, logoMarkSvg } from '@nextstep/illustrations';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og.png');
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&family=Plus+Jakarta+Sans:wght@600;800&display=swap" rel="stylesheet">
<style>
  body{margin:0;width:1200px;height:630px;background:#FFFBF5;font-family:'Plus Jakarta Sans',sans-serif;color:#17142E;display:grid;grid-template-columns:560px 1fr;align-items:center;overflow:hidden}
  .copy{padding:0 0 0 72px;display:grid;gap:22px}
  .brand{display:flex;align-items:center;gap:14px;font-family:'Bricolage Grotesque';font-size:40px;font-weight:800}
  h1{font-family:'Bricolage Grotesque';font-size:92px;line-height:.95;letter-spacing:-.04em;margin:0}
  h1 span{color:#5534F0}
  p{font-size:26px;font-weight:600;color:#4F4A5E;margin:0}
  .art{width:640px;margin-left:-20px}
  .pill{justify-self:start;background:#FFF0EC;color:#9E321C;font-weight:800;font-size:18px;letter-spacing:.08em;text-transform:uppercase;padding:8px 18px;border-radius:999px}
</style></head><body>
<div class="copy"><div class="brand">${logoMarkSvg({ size: 56 })} NextStep</div><span class="pill">Recovery Mode for real weeks</span><h1>Plans change.<br><span>Keep moving.</span></h1><p>Study planning that adapts when life happens.</p></div>
<div class="art">${heroSceneSvg()}</div></body></html>`;

let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = await chromium.launch({ channel: 'chrome' });
}
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.screenshot({ path: OUT });
await browser.close();
console.log('wrote', OUT);
