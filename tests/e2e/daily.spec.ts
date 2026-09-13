import { expect, test } from '@playwright/test';
import { asNewGuest, playOneEvent, playWholeRun } from './helpers';

test.describe('the daily', () => {
  test('a guest can play without signing up and gets one official run', async ({ page }) => {
    await asNewGuest(page);

    // No account gate anywhere on the way in.
    await expect(page.getByRole('heading', { name: /how human are you today/i })).toBeVisible();
    await expect(page.getByText(/one ranked attempt/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /play today/i })).toBeVisible();

    await playWholeRun(page);

    await expect(page.getByRole('heading', { name: /you beat .* of humans today/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/day streak/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /challenge a friend/i })).toBeVisible();
  });

  test('a second official run on the same day is refused', async ({ page }) => {
    await asNewGuest(page);
    await playWholeRun(page);

    await page.goto('/play');
    await expect(page.getByRole('heading', { name: /one run a day/i })).toBeVisible({
      timeout: 15_000,
    });

    // The home page offers the result instead of another run.
    await page.goto('/');
    await expect(page.getByRole('link', { name: /see your result/i })).toBeVisible();
  });

  test('practice is locked until the official run is done', async ({ page }) => {
    await asNewGuest(page);
    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: /today first/i })).toBeVisible();

    await playWholeRun(page);
    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: /^practice$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /play today's five again/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /dead stop/i })).toHaveCount(0);
  });

  test('a practice replay shows an unofficial compare and leaves the official score', async ({
    page,
  }) => {
    await asNewGuest(page);
    await playWholeRun(page);

    const official = await page.getByRole('heading', { name: /you beat .* of humans today/i }).textContent();

    await page.goto('/practice');
    await page.getByRole('button', { name: /play today's five again/i }).click();

    for (let index = 0; index < 5; index += 1) {
      await playOneEvent(page);
      const interstitial = page.getByTestId('interstitial');
      await expect(interstitial).toBeVisible({ timeout: 15_000 });
      await interstitial.click();
    }

    const compare = page.getByTestId('practice-compare');
    await expect(compare).toBeVisible({ timeout: 15_000 });
    await expect(compare.getByText(/first score/i)).toBeVisible();
    await expect(compare.getByText(/this run/i)).toBeVisible();

    await page.goto('/');
    await page.getByRole('link', { name: /see your result/i }).click();
    await expect(page.getByRole('heading', { name: /you beat .* of humans today/i })).toHaveText(
      official ?? /you beat/i,
    );
  });

  test('the run recovers after an accidental navigation', async ({ page }) => {
    await asNewGuest(page);
    await page.goto('/play');
    await page.getByRole('button', { name: 'Start run' }).click();

    await playOneEvent(page);
    await expect(page.getByTestId('interstitial')).toBeVisible({ timeout: 15_000 });

    // Walk away mid-run, then come back.
    await page.goto('/');
    await page.goto('/play');

    // Straight back into the second event, with no intro screen.
    const shell = page.getByTestId('event-shell');
    await expect(shell).toBeVisible({ timeout: 15_000 });
    await expect(shell).toHaveAttribute('data-index', '1');
  });
});
