import { expect, test, type Page } from '@playwright/test';

const PAGES = ['/', '/how-it-works', '/features', '/community', '/about', '/faq', '/privacy', '/terms', '/demo'];

test.describe('website', () => {
  for (const path of PAGES) {
    test(`${path} renders with a single h1 and no console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      // Uncaught errors (e.g. a syntax error in an inline <head> script) don't always reach the console listener.
      page.on('pageerror', (e) => errors.push(e.message));
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      if (path === '/demo') await page.getByText('Good evening').waitFor();
      await expect(page.locator('h1')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
    });
  }

  test('primary and secondary CTAs go to the demo and the app tour', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Try the demo/ }).first().click();
    // Client-side navigation can take a few seconds while the suite runs in parallel.
    await expect(page).toHaveURL(/\/demo$/, { timeout: 15_000 });
    await page.goto('/');
    await page.getByRole('link', { name: 'Explore the app' }).first().click();
    await expect(page).toHaveURL(/\/features$/, { timeout: 15_000 });
  });

  test('every internal link resolves', async ({ page, request }) => {
    await page.goto('/');
    const hrefs = await page.$$eval('a[href^="/"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')!))]);
    for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
  });

  test('shows an honest availability message instead of store badges', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('The mobile apps aren’t published yet.')).toBeVisible();
    await expect(page.getByText(/Google Play|App Store/)).toHaveCount(0);
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

  test('sitemap and robots exist', async ({ request }) => {
    expect((await request.get('/sitemap.xml')).status()).toBe(200);
    expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap');
  });
});

async function freshDemo(page: Page) {
  await page.goto('/demo');
  await page.evaluate(() => localStorage.removeItem('nextstep-demo-v1'));
  await page.reload();
  await page.getByText('Good evening').waitFor();
}

test.describe('browser demo', () => {
  test('core flow: less time → accept → next step → Back on Track once', async ({ page }) => {
    await freshDemo(page);
    await expect(page.getByText(/Fictional demo data/)).toBeVisible();
    await page
      .getByRole('button', { name: /My plans changed/ })
      .first()
      .click();
    await page.getByRole('button', { name: /I have less time/ }).click();
    await page.getByRole('radio', { name: '45 min' }).check();
    await page.getByRole('button', { name: /Show me the new plan/ }).click();
    await expect(
      page.getByRole('heading', {
        name: 'You have less time than planned. Here are your options.',
      }),
    ).toBeVisible();
    await expect(page.getByText(/What changes/)).toBeVisible();
    await page.getByRole('button', { name: 'Accept changes' }).click();
    await expect(page.getByRole('heading', { name: 'You still have a next step.' })).toBeVisible();
    await page.getByRole('button', { name: /^Start:/ }).click();
    await page.getByRole('button', { name: /I did this session/ }).click();
    await expect(page.getByRole('heading', { name: 'Back on Track' })).toBeVisible();
    await page.getByRole('button', { name: 'Keep going' }).click();
    // A level-up may follow the badge.
    if (await page.getByRole('button', { name: 'Keep going' }).isVisible()) await page.getByRole('button', { name: 'Keep going' }).click();
    await page.getByRole('button', { name: 'Journey', exact: true }).click();
    await expect(page.locator('li', { hasText: 'Back on Track' }).getByText('Plans changed and you kept moving.')).toHaveCount(1);
  });

  test('keep my current plan changes nothing', async ({ page }) => {
    await freshDemo(page);
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    const before = await page.locator('ul li button').allInnerTexts();
    await page
      .getByRole('button', { name: /My plans changed/ })
      .first()
      .click();
    await page.getByRole('button', { name: /I need a lighter day/ }).click();
    await page.getByRole('button', { name: /Show me the new plan/ }).click();
    await page.getByRole('button', { name: 'Keep my current plan' }).click();
    expect(await page.locator('ul li button').allInnerTexts()).toEqual(before);
  });

  test('add a task, mark a missed session, and reset restores the original state', async ({ page }) => {
    await freshDemo(page);
    const original = await page.evaluate(() => JSON.parse(localStorage.getItem('nextstep-demo-v1')!).app.tasks.length);
    await page
      .getByRole('button', { name: /Add task/ })
      .first()
      .click();
    await page.getByLabel('Title').fill('Physics lab write-up');
    await page.getByRole('button', { name: 'Add task' }).last().click();
    await expect(page.getByText('Physics lab write-up').first()).toBeVisible();
    await page.getByRole('button', { name: 'Just mark missed' }).click();
    await expect(page.getByText(/Marked as missed/)).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /Reset demo/ }).click();
    await page.getByText('Good evening').waitFor();
    await expect(page.getByText('Physics lab write-up')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nextstep-demo-v1')!).app.tasks.length)).toBe(original);
  });

  test('overloaded week explains the shortfall instead of an impossible plan', async ({ page }) => {
    await freshDemo(page);
    await page.getByRole('button', { name: 'Load overloaded week' }).click();
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Not everything fits' })).toBeVisible();
    await expect(page.getByText(/doesn't fit before/).first()).toBeVisible();
    await expect(page.getByText(/Reduce the scope/).first()).toBeVisible();
  });

  test('recovery sheet is keyboard accessible and closes with Escape', async ({ page }) => {
    await freshDemo(page);
    await page
      .getByRole('button', { name: /My plans changed/ })
      .first()
      .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'My plans changed' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'My plans changed' })).toHaveCount(0);
  });
});
