#!/usr/bin/env node
// run-playwright.mjs — REFERENCE wrapper for running Playwright inside Claude Code
// cloud (web) sessions, where `playwright install chromium` is blocked by a CDN 403.
//
// This ships as a TEMPLATE. To activate it in a Node project:
//   1. Add dev deps:  npm i -D @playwright/test @sparticuz/chromium
//   2. Adjust SERVER_CMD / SERVER_URL below to start *your* app.
//   3. Run:           node run-playwright.mjs   (any extra args pass to `playwright test`)
//
// Locally you do not need this — `npx playwright install chromium` once, then
// `npx playwright test` directly.

import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const isCloud = process.env.CLAUDE_CODE === '1' || process.env.CLAUDE_CODE === 'true';

// --- Configure these for your app ------------------------------------------------
const SERVER_CMD = process.env.SERVER_CMD || 'npx --yes http-server app -p 4173 -s';
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:4173';
// --------------------------------------------------------------------------------

async function resolveChromiumPath() {
  if (!isCloud) return undefined; // local: Playwright uses its own managed browser
  const chromium = (await import('@sparticuz/chromium')).default;
  // Extract the bundled binary to a stable location and return its path.
  return chromium.executablePath('/tmp/chromium');
}

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await sleep(300);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

let server;
try {
  const chromiumPath = await resolveChromiumPath();

  const env = { ...process.env, CLAUDE_CODE: isCloud ? '1' : '', BASE_URL: SERVER_URL };
  if (chromiumPath) env.CHROMIUM_PATH = chromiumPath;

  console.log(`[run-playwright] cloud=${isCloud} server="${SERVER_CMD}"`);
  server = spawn(SERVER_CMD, { shell: true, stdio: 'inherit', env });
  await waitForServer(SERVER_URL);

  const result = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env,
  });
  process.exitCode = result.status ?? 1;
} finally {
  if (server) server.kill();
}
