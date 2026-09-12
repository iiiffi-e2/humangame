import { expect, test } from '@playwright/test';
import { asNewGuest, playWholeRun } from './helpers';

test.describe('social loops', () => {
  test('a challenge link shows the score to beat, then the head-to-head', async ({ page }) => {
    // Two complete official runs, back to back.
    test.setTimeout(300_000);
    // The challenger plays and mints a link.
    await asNewGuest(page);
    await playWholeRun(page);
    // Wait for the reveal to settle before reading anything off it — the
    // score counts up, so an early read sees a number that is still climbing.
    await expect(page.getByRole('heading', { name: /you beat .* of humans today/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('link', { name: /challenge a friend/i }).click();
    await page.getByRole('button', { name: /copy link/i }).click();
    await expect(page.getByText(/challenge link copied|could not copy/i)).toBeVisible();

    // Read the token straight out of the page's own link preview.
    const preview = await page.locator('text=/\\/c\\//').first().textContent();
    const token = preview?.split('/c/')[1]?.trim();
    expect(token).toBeTruthy();

    // The recipient is a different guest.
    await asNewGuest(page);
    await page.goto(`/c/${token}`);
    await expect(page.getByText(/put up/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /^beat /i })).toBeVisible();
    // The day's answers are never on this page.
    await expect(page.getByText(/hold for exactly/i)).toHaveCount(0);

    await page.getByRole('link', { name: /^beat /i }).click();
    await page.getByRole('button', { name: 'Start run' }).click();
    const { playOneEvent } = await import('./helpers');
    for (let index = 0; index < 5; index += 1) {
      await playOneEvent(page);
      const interstitial = page.getByTestId('interstitial');
      await expect(interstitial).toBeVisible({ timeout: 15_000 });
      await interstitial.click();
    }
    await page.waitForURL(/\/result\//, { timeout: 30_000 });

    await page.goto(`/c/${token}`);
    await expect(page.getByText(/you win by|wins by|dead level/i)).toBeVisible();
  });

  test('a guest can claim a username after playing', async ({ page }) => {
    await asNewGuest(page);
    await playWholeRun(page);

    await page.goto('/profile');
    const handle = `tester${Date.now().toString().slice(-6)}`;
    await page.getByLabel('Username').fill(handle);
    await page.getByRole('button', { name: /claim|update/i }).click();
    await expect(page.getByText(/handle claimed/i)).toBeVisible();

    await page.reload();
    await expect(page.getByText(`@${handle}`)).toBeVisible();
  });

  test('a crew can be created and joined with its code', async ({ page }) => {
    await asNewGuest(page);
    await page.goto('/crews');
    const name = `Crew${Date.now().toString().slice(-6)}`;
    await page.getByLabel('Or start one').fill(name);
    await page.getByRole('button', { name: 'Create' }).click();

    await page.waitForURL(/\/crew\//, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: new RegExp(name, 'i') })).toBeVisible();
    const code = /code ([A-Z0-9]{6})/.exec((await page.textContent('body')) ?? '')?.[1];
    expect(code).toBeTruthy();

    // A second guest joins with the code.
    await asNewGuest(page);
    await page.goto('/crews');
    await page.getByLabel('Join with a code').fill(code as string);
    await page.getByRole('button', { name: 'Join' }).click();
    await page.waitForURL(/\/crew\//, { timeout: 15_000 });
    await expect(page.getByText(/played today/i)).toBeVisible();
    // Scores stay sealed until this player has run.
    await expect(page.getByText(/scores sealed until you play/i)).toBeVisible();
  });

  test('leaderboards hide exact scores until the viewer has played', async ({ page }) => {
    await asNewGuest(page);
    await page.goto('/leaderboards?tab=global');
    await expect(page.getByText(/scores stay sealed until you finish/i)).toBeVisible();

    await playWholeRun(page);
    await page.goto('/leaderboards?tab=global');
    await expect(page.getByText(/scores stay sealed until you finish/i)).toHaveCount(0);
  });
});
