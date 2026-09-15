import { expect, test } from '@playwright/test';
import { asNewGuest, playWholeRun } from './helpers';

test.describe('accessibility and viewports', () => {
  test('reduced motion is honoured end to end', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /how human are you today/i })).toBeVisible();

    await playWholeRun(page);
    // The reveal lands on its settled state rather than animating into it.
    await expect(page.getByRole('heading', { name: /you beat .* of humans today/i })).toBeVisible({
      timeout: 15_000,
    });

    const durations = await page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .slice(0, 400)
        .map((element) => getComputedStyle(element).animationDuration),
    );
    for (const duration of durations) {
      // Browsers normalise the 0.001ms override to scientific notation.
      const seconds = duration.endsWith('ms')
        ? Number.parseFloat(duration) / 1000
        : Number.parseFloat(duration);
      expect(seconds).toBeLessThan(0.01);
    }
    await context.close();
  });

  test('the whole run works on a phone viewport without sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await asNewGuest(page);

    const overflow = async () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(1);

    await playWholeRun(page);
    await expect(page.getByRole('heading', { name: /you beat .* of humans today/i })).toBeVisible({
      timeout: 15_000,
    });
    expect(await overflow()).toBeLessThanOrEqual(1);
  });

  test('every screen has one main landmark and a skip link', async ({ page }) => {
    await asNewGuest(page);
    for (const path of ['/', '/leaderboards', '/history', '/crews', '/profile', '/privacy', '/terms']) {
      await page.goto(path);
      await expect(page.locator('main#main')).toHaveCount(1);
      await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveCount(1);
    }
  });

  test('interactive controls are at least 44 pixels tall', async ({ page }) => {
    await asNewGuest(page);
    await page.goto('/');
    const buttons = page.locator('a.btn, button.btn, .tap');
    const count = await buttons.count();
    for (let index = 0; index < count; index += 1) {
      const box = await buttons.nth(index).boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(43.5);
    }
  });
});
