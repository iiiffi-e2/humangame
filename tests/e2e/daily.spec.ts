import { expect, test } from '@playwright/test';
import { asNewGuest, playWholeRun } from './helpers';

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
  });

  test('the run recovers after an accidental navigation', async ({ page }) => {
    await asNewGuest(page);
    await page.goto('/play');
    await page.getByRole('button', { name: 'Start run' }).click();

    const { playOneEvent } = await import('./helpers');
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
