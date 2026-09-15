import { expect, test } from '@playwright/test';
import { asNewGuest } from './helpers';

test.describe('legal pages', () => {
  test('privacy and terms are reachable and say this is not an assessment', async ({ page }) => {
    await asNewGuest(page);
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
    await expect(page.getByText(/not an IQ/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();

    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Terms' })).toBeVisible();
    await expect(page.getByText(/13 or older/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
  });
});
