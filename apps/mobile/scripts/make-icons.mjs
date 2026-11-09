/** Renders app icon, Android adaptive icon layers and splash image from the brand SVGs. */
import { chromium } from '@playwright/test';
import { mascotSvg } from '@nextstep/illustrations';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');
const VIOLET = '#5534F0';
const INK = '#17142E';
const step = (stroke) => `<path d="M14 44 H26 V34 H38 V24 H48" fill="none" stroke="${stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M46 22 C44 14 48 8 56 6 C55 13 52 19 46 22 Z" fill="#FFC52E" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
const pages = {
  // Full icon (iOS / legacy): violet tile with the step mark.
  'icon.png': { size: 1024, html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="1024" height="1024"><rect width="64" height="64" fill="${VIOLET}"/><g transform="translate(4 4) scale(0.875)">${step('#FFFFFF')}</g></svg>` },
  // Adaptive foreground: mark inside the 66% safe zone, transparent background.
  'android-icon-foreground.png': { size: 432, html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="432" height="432"><g transform="translate(14 14) scale(0.56)">${step('#FFFFFF')}</g></svg>`, transparent: true },
  'android-icon-background.png': { size: 432, html: `<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432"><rect width="432" height="432" fill="${VIOLET}"/></svg>` },
  'android-icon-monochrome.png': { size: 432, html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="432" height="432"><g transform="translate(14 14) scale(0.56)"><path d="M14 44 H26 V34 H38 V24 H48" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M46 22 C44 14 48 8 56 6 C55 13 52 19 46 22 Z" fill="#000"/></g></svg>`, transparent: true },
  // Splash: Nex waving (no text in artwork; the app renders text).
  'splash-icon.png': { size: 600, html: mascotSvg({ pose: 'welcome', size: 600 }), transparent: true },
  'favicon.png': { size: 64, html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="16" fill="${VIOLET}"/>${step('#FFFFFF')}</svg>` },
};

let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = await chromium.launch({ channel: 'chrome' });
}
for (const [name, p] of Object.entries(pages)) {
  const page = await browser.newPage({ viewport: { width: p.size, height: p.size } });
  await page.setContent(`<html><body style="margin:0;background:${p.transparent ? 'transparent' : '#fff'}">${p.html}</body></html>`);
  await page.locator('svg').first().screenshot({ path: path.join(out, name), omitBackground: !!p.transparent });
  await page.close();
  console.log('wrote', name);
}
await browser.close();
