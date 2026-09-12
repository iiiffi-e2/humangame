import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3210);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // A single test can play two full 5-event runs; the fields have real
  // waits in them (a grid flashes, a sequence plays back), so these are
  // slower than a typical UI test by design.
  timeout: 150_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Some environments ship a pre-installed Chromium that does not match the
    // build this Playwright version downloads. Point at it rather than
    // re-downloading a browser.
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      HUMAN_DEV_DB: '.data/e2e-db.json',
      HUMAN_RUN_SECRET: 'e2e-run-secret-e2e-run-secret-0001',
      HUMAN_MANIFEST_SECRET: 'e2e-manifest-secret-0001',
    },
  },
});
