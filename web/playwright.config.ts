/**
 * Playwright configuration for SoulGraph Web UI E2E tests.
 *
 * Runs against mock-ws server (:8080) + vite dev server (:5173).
 * Vite dev server proxies API + WS calls to mock-ws on :8080.
 * Uses data-testid selectors exclusively (survives style refactors).
 *
 * Prerequisites (auto-started by webServer config):
 *   1. npm run mock-ws  (starts mock backend on :8080)
 *   2. npm run dev       (starts vite dev with proxy on :5173)
 *
 * Owner: Stark (P5) | Sprint Day 4
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * Base URL — when SOULGRAPH_URL is set, tests run against that server
 * (e.g., Docker stack on :9080). Otherwise, auto-start mock + vite dev.
 */
const BASE_URL = process.env.SOULGRAPH_URL ?? 'http://localhost:5173';

/** True when running against an external server (Docker stack). */
const isExternalServer = Boolean(process.env.SOULGRAPH_URL);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Sequential — some tests depend on session state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    testIdAttribute: 'data-testid',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /responsive\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
      testMatch: /responsive\.spec\.ts/,
    },
  ],

  /*
   * Auto-start mock backend + vite dev server.
   * Skipped when SOULGRAPH_URL is set (running against Docker stack or deployed server).
   */
  ...(!isExternalServer && {
    webServer: [
      {
        command: 'MOCK_WS_PORT=8081 npx tsx scripts/mock-ws.ts',
        url: 'http://localhost:8081/health',
        reuseExistingServer: true,
        timeout: 15_000,
      },
      {
        command: 'SOULGRAPH_BACKEND_PORT=8081 npx vite --port 5173',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 15_000,
      },
    ],
  }),
});
