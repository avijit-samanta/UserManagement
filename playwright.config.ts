import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Parallel execution: each worker is a separate process running its own
  // browser instance, so independent test files execute concurrently
  // instead of one after another. Defaults to 4 workers (set PW_WORKERS to
  // override, e.g. `PW_WORKERS=1 npm run test:e2e` on a constrained
  // machine/VM where running two browser engines' workers concurrently
  // against the same local dev server causes resource contention and
  // misleading timeouts — or pass --workers=N directly).
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 4,
  reporter: 'html',
  // Per-test and per-assertion timeouts, raised above Playwright's defaults
  // (30s / 5s) so a manual/headed run through VS Code — where you're
  // actually watching the browser, possibly with the Inspector paused, or
  // running with PWSLOWMO below — doesn't time out just from being observed.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Per-action (click/fill/etc.) timeout, also raised from the 0 default
    // (which just falls back to the whole-test timeout above).
    actionTimeout: 15_000,
    // Set PWSLOWMO=<ms> to add a delay between every Playwright action —
    // e.g. `PWSLOWMO=400 npm run test:e2e:headed` — so you can actually
    // follow along in the browser instead of it flashing through in ~1s.
    // 0 by default so normal headless/CI runs stay fast.
    launchOptions: {
      slowMo: process.env.PWSLOWMO ? Number(process.env.PWSLOWMO) : 0,
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
      dependencies: ['setup'],
    },
  ],
});
