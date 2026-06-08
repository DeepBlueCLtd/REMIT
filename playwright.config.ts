// playwright.config.ts — REFERENCE config.
//
// When running inside a Claude Code cloud session (CLAUDE_CODE=1), it points
// Playwright at the bundled Chromium extracted by run-playwright.mjs
// (CHROMIUM_PATH). Locally, Playwright uses its own managed browser as usual.
//
// Requires dev deps:  npm i -D @playwright/test @sparticuz/chromium
import { defineConfig, devices } from '@playwright/test';

const isCloud = process.env.CLAUDE_CODE === '1';
const chromiumPath = process.env.CHROMIUM_PATH;
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    screenshot: 'on',
    trace: 'on-first-retry',
    // In cloud sessions, use the bundled @sparticuz/chromium binary.
    ...(isCloud && chromiumPath
      ? { launchOptions: { executablePath: chromiumPath, args: ['--no-sandbox'] } }
      : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
