import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/how-it-works', '/features', '/community', '/about', '/faq', '/privacy', '/terms', '/demo'];
const release = JSON.parse(readFileSync(new URL('../src/lib/release.json', import.meta.url), 'utf8')) as {
  available: boolean;
  version: string;
  file: string;
  bytes: number;
};

test.describe('website', () => {
  for (const path of PAGES) {
    test(`${path} renders with a single h1 and no console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      // Uncaught errors (e.g. a syntax error in an inline <head> script) don't always reach the console listener.
      page.on('pageerror', (e) => errors.push(e.message));
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
    });
  }

  test('calls to action go to the demo video and the download section', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('main').getByRole('link', { name: /Watch the demo/ }).first().click();
    // Client-side navigation can take a few seconds while the suite runs in parallel.
    await expect(page).toHaveURL(/\/demo$/, { timeout: 15_000 });
    await expect(page.locator('video')).toBeVisible();
    await page.goto('/');
    const getApp = page.getByRole('banner').getByRole('link', { name: /Get the app/ });
    await expect(getApp).toBeVisible();
    await getApp.click();
    await expect(page).toHaveURL(/\/demo#download$/, { timeout: 15_000 });
    await expect(page.locator('#download')).toBeInViewport();
  });

  test('the interactive demo is gone and nothing links to it', async ({ page, request }) => {
    expect((await request.get('/demo/interactive')).status()).toBe(404);
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator('a[href*="/demo/interactive"]')).toHaveCount(0);
      expect(await page.locator('body').innerText(), path).not.toMatch(/interactive demo/i);
    }
  });

  test('every internal link resolves', async ({ page, request }) => {
    for (const path of ['/', '/demo']) {
      await page.goto(path);
      const hrefs = await page.$$eval('a[href^="/"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')!.split('#')[0]!))]);
      for (const href of hrefs) expect((await request.head(href || '/')).status(), href).toBe(200);
    }
  });

  test('download button links to the APK, with its version and install steps next to the video', async ({ page, request }) => {
    test.skip(!release.available, 'No APK published yet');
    for (const path of ['/', '/demo']) {
      await page.goto(path);
      const button = page.getByRole('link', { name: 'Download Android APK' }).first();
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute('href', release.file);
      await expect(button).toHaveAttribute('download', '');
      await expect(page.getByText(`Version ${release.version}`).first()).toBeVisible();
    }
    await expect(page.getByText(/Install anyway/)).toBeVisible();
    // The video stays on the same page as the download.
    await expect(page.locator('video')).toHaveCount(1);
    const res = await request.head(release.file);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/vnd.android.package-archive');
    expect(Number(res.headers()['content-length'])).toBe(release.bytes);
    await expect(page.getByText(/Google Play badge|App Store badge/)).toHaveCount(0);
  });

  test('reset-password shows the code from the link fragment and is not indexed', async ({ page }) => {
    const token = 'abcDEF123_-abcDEF123_-abcDEF123_-xyz';
    await page.goto(`/reset-password#token=${token}`);
    await expect(page.getByLabel('Reset code')).toHaveText(token);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.goto('/reset-password');
    await expect(page.getByText('No reset code found')).toBeVisible();
  });

  test('features page shows real app screenshots that load', async ({ page }) => {
    await page.goto('/features');
    const shots = page.locator('img[src*="screens%2Fapp%2F"], img[src*="/screens/app/"]');
    expect(await shots.count()).toBeGreaterThanOrEqual(20);
    for (const img of await shots.all()) {
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      expect(await img.getAttribute('alt')).toBeTruthy();
    }
  });

  test('hero slideshow can be paused and switched by hand', async ({ page }) => {
    await page.goto('/');
    const show = page.getByRole('group', {
      name: 'Screens from the NextStep Android app',
    });
    const pause = show.getByRole('button', { name: 'Pause slideshow' });
    await expect(pause).toBeVisible();
    await pause.click();
    await expect(show.getByRole('button', { name: 'Play slideshow' })).toBeVisible();
    await show.getByRole('button', { name: 'Recovery preview' }).click();
    await expect(show.getByRole('button', { name: 'Recovery preview' })).toHaveAttribute('aria-pressed', 'true');
    await expect(show.getByRole('img', { name: /Recovery preview/ })).toBeVisible();
  });

  test('scroll reveals show content as it scrolls into view', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
    const heading = page.locator('#features-title');
    await heading.scrollIntoViewIfNeeded();
    await expect(page.locator('header[data-reveal]').filter({ has: heading })).toHaveAttribute('data-in', '');
  });

  test('with reduced motion, nothing is hidden and the slideshow starts paused', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-motion', 'on');
    await expect(page.getByRole('button', { name: 'Play slideshow' })).toBeVisible();
    const opacity = await page.locator('#features-title').evaluate((el) => getComputedStyle(el.closest('header')!).opacity);
    expect(opacity).toBe('1');
    await context.close();
  });

  test('demo page plays the walkthrough video with captions and a transcript', async ({ page, request }) => {
    await page.goto('/demo');
    const video = page.locator('video');
    await expect(video).toHaveAttribute('preload', 'metadata');
    await expect(video).toHaveAttribute('poster', /\.jpg$/);
    const src = await page.locator('video source').getAttribute('src');
    const track = page.locator('video track[kind="captions"]');
    await expect(track).toHaveAttribute('default', '');
    const res = await request.get(src!);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('video/mp4');
    const vtt = await request.get((await track.getAttribute('src'))!);
    const captions = await vtt.text();
    expect(captions).toMatch(/^WEBVTT/);
    await expect(page.getByText(/synthetic voice/).first()).toBeVisible();
    await page.getByText('Read the transcript').click();
    await expect(page.getByText(/Recovery Mode, and focus all work offline after setup/)).toBeVisible();
    // Playwright's bundled Chromium has no H.264 decoder; real Chrome (E2E_CHANNEL=chrome) does.
    const h264 = await video.evaluate((v: HTMLVideoElement) => v.canPlayType('video/mp4; codecs="avc1.640028"') !== '');
    if (h264) {
      await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
      expect(await video.evaluate((v: HTMLVideoElement) => Math.round(v.duration))).toBeGreaterThan(60);
      await page.getByRole('button', { name: /Recovery Mode/ }).click();
      await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 }).toBeGreaterThan(20);
    } else {
      test.info().annotations.push({ type: 'note', description: 'Browser cannot decode H.264; playback checks skipped.' });
    }
  });

  test('sitemap and robots exist', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/demo');
    expect(sitemap).not.toContain('/demo/interactive');
    expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap');
  });
});
