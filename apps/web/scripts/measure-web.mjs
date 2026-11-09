/**
 * Measures the production website under an emulated mid-range phone on a slow
 * mobile network (Chrome DevTools Protocol): bytes transferred, requests, DOM
 * ready and Largest Contentful Paint for a cold load of each page (median of
 * RUNS cold loads, default 3).
 *
 *   pnpm build:web && pnpm --filter @nextstep/web start   # in one terminal
 *   node apps/web/scripts/measure-web.mjs [baseUrl]      # in another
 *
 * These are lab numbers from one machine, not field data from real devices.
 */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const PAGES = ['/', '/how-it-works', '/features', '/community', '/about', '/faq', '/privacy', '/demo'];
// Roughly "Fast 3G" plus a 4× slower CPU, similar to common mobile lab profiles.
const NETWORK = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
const CPU_SLOWDOWN = 4;
const RUNS = Number(process.env.RUNS ?? 3);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? 'chrome' });
const rows = [];
async function measure(path) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', NETWORK);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  let bytes = 0;
  let requests = 0;
  const byType = {};
  const types = new Map();
  cdp.on('Network.responseReceived', (e) => types.set(e.requestId, e.type));
  cdp.on('Network.loadingFinished', (e) => {
    bytes += e.encodedDataLength;
    requests++;
    const t = types.get(e.requestId) ?? 'Other';
    byType[t] = (byType[t] ?? 0) + e.encodedDataLength;
  });
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await page.goto(BASE + path, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForTimeout(1500);
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return { dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), lcp: Math.round(window.__lcp) };
  });
  await context.close();
  return { kb: bytes / 1024, requests, js: (byType.Script ?? 0) / 1024, ...timing };
}
for (const path of PAGES) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await measure(path));
  rows.push({ path, ...Object.fromEntries(['kb', 'js', 'requests', 'dcl', 'lcp'].map((k) => [k, median(runs.map((r) => r[k]))])) });
}
await browser.close();

console.log(`Emulated: 390×844 phone, ${CPU_SLOWDOWN}× CPU slowdown, 1.6 Mbps down / 750 kbps up / 150 ms RTT, cold cache. Median of ${RUNS} runs.\n`);
console.log('| Page | Transferred | of which JS | Requests | DOM ready | LCP |\n|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.path} | ${r.kb.toFixed(0)} KB | ${r.js.toFixed(0)} KB | ${r.requests} | ${(r.dcl / 1000).toFixed(1)} s | ${(r.lcp / 1000).toFixed(1)} s |`);
