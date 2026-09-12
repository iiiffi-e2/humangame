import { expect, type Page } from '@playwright/test';

/**
 * Driving the run from a test.
 *
 * The five families of a given day come out of the manifest, so a test cannot
 * know in advance which fields it will meet. `playOneEvent` reads the family
 * from the shell's `data-game` attribute and performs a plausible interaction
 * for it — not necessarily a *good* one. These tests are about the lifecycle,
 * not about scoring, which the unit tests cover exhaustively.
 */

export async function playOneEvent(page: Page): Promise<void> {
  const shell = page.getByTestId('event-shell');
  await expect(shell).toBeVisible();
  const game = await shell.getAttribute('data-game');

  // Several families gate themselves behind a READY press so the instruction
  // can be read before anything is timed. The field itself is a lazily loaded
  // chunk, so the gate has to be waited for rather than probed.
  const GATED = new Set([
    'nerve.crosshair',
    'memory.flash-grid',
    'memory.what-moved',
    'memory.sequence',
  ]);
  if (game && GATED.has(game)) {
    const ready = page.getByRole('button', { name: 'Ready', exact: true });
    await ready.waitFor({ state: 'visible', timeout: 15_000 });
    await ready.click();
  }

  switch (game) {
    case 'nerve.dead-stop':
    case 'nerve.grow': {
      const hold = shell.getByRole('button').first();
      await hold.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
      await page.waitForTimeout(1200);
      await hold.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
      break;
    }
    case 'nerve.crosshair': {
      await page.waitForTimeout(700);
      await shell.getByRole('button', { name: /bars cross/i }).click();
      break;
    }
    case 'eye.half': {
      // The line has to be touched before it can be locked.
      const field = shell.getByRole('application');
      await field.click({ position: { x: 60, y: 80 } });
      await shell.getByRole('button', { name: /lock/i }).click();
      break;
    }
    case 'eye.percent':
    case 'eye.angle': {
      await page.waitForTimeout(400);
      await shell.getByRole('button', { name: /lock/i }).click();
      break;
    }
    case 'memory.flash-grid': {
      const instruction = (await shell.getByRole('heading').first().textContent()) ?? '';
      const count = Number(/\d+/.exec(instruction)?.[0] ?? 6);
      // Wait out the flash, then tap the first N tiles.
      await page.waitForTimeout(1800);
      const tiles = shell.getByRole('button', { name: /^Tile / });
      for (let index = 0; index < count; index += 1) {
        await tiles.nth(index).click();
      }
      break;
    }
    case 'memory.what-moved': {
      await page.waitForTimeout(2600);
      await shell.getByRole('button', { name: /Item at/ }).first().click();
      break;
    }
    case 'memory.sequence': {
      const instruction = (await shell.getByRole('heading').first().textContent()) ?? '';
      const count = Number(/\d+/.exec(instruction)?.[0] ?? 5);
      // Let the playback finish before the keypad accepts input.
      await page.waitForTimeout(count * 700 + 600);
      const keys = shell.getByRole('button');
      for (let index = 0; index < count; index += 1) {
        await keys.first().click();
      }
      break;
    }
    case 'brain.order': {
      await shell.getByRole('button', { name: /lock order/i }).click();
      break;
    }
    case 'brain.next':
    case 'brain.rotate': {
      await shell.getByRole('button', { name: /^Option 1$/ }).click();
      break;
    }
    case 'crowd.majority':
    case 'crowd.avoid': {
      await shell.locator('button').first().click();
      break;
    }
    case 'crowd.split': {
      await shell.getByRole('button', { name: /call it/i }).click();
      break;
    }
    default:
      throw new Error(`No test interaction for ${game}`);
  }
}

/** Play all five events and land on the reveal. */
export async function playWholeRun(page: Page): Promise<void> {
  await page.goto('/play');
  await page.getByRole('button', { name: 'Start run' }).click();

  for (let index = 0; index < 5; index += 1) {
    await playOneEvent(page);
    // The interstitial auto-advances; tapping it just makes the test faster.
    const interstitial = page.getByTestId('interstitial');
    await expect(interstitial).toBeVisible({ timeout: 15_000 });
    await interstitial.click();
  }

  await page.waitForURL(/\/result\//, { timeout: 30_000 });
}

/** A fresh guest identity, with no cookies from a previous test. */
export async function asNewGuest(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/');
}
