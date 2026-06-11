import { test, expect } from '@playwright/test';

// Smoke: the app boots on the H3 grid and runs the core loop World→Capture→Plan without
// faults (basemap-tile fetch errors are tolerated — Carto is network-blocked in cloud).
test('app boots and runs World -> Capture -> Plan on hexes', async ({ page }) => {
  const errs: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

  await page.goto('/');
  await expect(page.locator('#fault')).toBeHidden();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/app-world.png' });

  await page.click('[data-testid=world-provision]');
  await page.waitForTimeout(1500);
  await expect(page.locator('#fault')).toBeHidden();
  await page.screenshot({ path: 'test-results/app-world-provisioned.png' });

  await page.click('[data-testid=continue-capture]');
  await page.waitForTimeout(600);
  await page.click('[data-testid=cap-commit]');
  await page.waitForTimeout(600);
  await page.click('[data-testid=continue-plan]');
  await page.waitForTimeout(400);
  await page.click('[data-testid=plan-run]');
  await page.waitForTimeout(1500);
  await expect(page.locator('#fault')).toBeHidden();
  await page.screenshot({ path: 'test-results/app-plan.png' });

  const real = errs.filter((e) => !/cartocdn|Failed to fetch|AJAXError|ERR_CERT/.test(e));
  console.log('REAL ERRORS:', JSON.stringify(real.slice(0, 12)));
  expect(real).toEqual([]);
});
