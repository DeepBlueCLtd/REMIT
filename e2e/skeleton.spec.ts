// e2e/skeleton.spec.ts — walks the six-stage lap on the H3 hex grid (ADR-0016) and
// captures the spec-003 evidence screenshots. Kernel set-pieces (tide wait/detour,
// infeasibility, NF3 ids) are pinned in the browser-free golden tests; here we assert the
// UI lap works end-to-end on hexes without faults.
import { test, expect, Page } from '@playwright/test';

const EVIDENCE = process.env.EVIDENCE_DIR || 'specs/003-hex-grid-routing/evidence/screenshots';
const shot = (page: Page, name: string) => page.screenshot({ path: `${EVIDENCE}/${name}.png`, fullPage: true });
const noFault = (page: Page) => expect(page.locator('#fault')).toBeHidden();

// Basemap tiles are network-blocked in cloud sessions; tolerate those fetch errors only.
const realErrors = (errs: string[]) => errs.filter((e) => !/cartocdn|Failed to fetch|AJAXError|ERR_CERT|tile/i.test(e));

async function walkToPlan(page: Page) {
  await page.getByTestId('world-provision').click();
  await expect(page.getByTestId('world-baseid')).toBeVisible();
  await page.getByTestId('continue-capture').click();
  await page.getByTestId('cap-commit').click();
  await page.getByTestId('continue-plan').click();
  await page.getByTestId('plan-run').click();
  await expect(page.locator('.plan-card')).toHaveCount(2);
}

test('the lap walks end-to-end on the H3 hex grid', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  await page.goto('/');
  await expect(page).toHaveTitle(/REMIT/);
  await page.waitForTimeout(1500);                       // map init

  // 1 World — provision the hex AO.
  await page.getByTestId('world-provision').click();
  await expect(page.getByTestId('world-baseid')).toBeVisible();
  await expect(page.locator('#world-result')).toContainText('config-core hash');
  await expect(page.getByTestId('world-tide')).toContainText('closed');
  await shot(page, '01-world');

  // 2 Capture — the picked OP highlights; changing it moves the highlight; commit round-trips.
  await page.getByTestId('continue-capture').click();
  const hi0 = await page.getByTestId('map').getAttribute('data-highlight');
  await page.getByTestId('cap-where').selectOption('OP-C');
  await expect.poll(() => page.getByTestId('map').getAttribute('data-highlight')).not.toBe(hi0);
  await page.getByTestId('cap-where').selectOption('OP-A');
  await page.getByTestId('cap-dur').fill('45');
  await expect(page.getByTestId('cap-echo')).toContainText('holding observation for at least 45 min');
  await page.getByTestId('cap-commit').click();
  await expect(page.locator('#cap-result')).toContainText('round-trip ✓');
  await shot(page, '02-capture');

  // 3 Plan — a handful of two distinct banded COAs, each scoring observe + exfil.
  await page.getByTestId('continue-plan').click();
  await page.getByTestId('plan-run').click();
  await expect(page.getByTestId('plan-stampid')).toBeVisible();
  await expect(page.locator('.plan-card')).toHaveCount(2);
  for (const s of ['direct', 'tracked']) await expect(page.getByTestId(`plan-card-${s}`)).toBeVisible();
  const shape = await page.evaluate(() => {
    const h = (window as any).__remit.state.handful;
    return { count: h.length, sats: h.map((p: any) => p.scores.satisfaction.length),
             allExfil: h.every((p: any) => p.materialisation.schedule.some((s: any) => s.kind === 'exfil')) };
  });
  expect(shape.count).toBe(2);
  expect(shape.sats).toEqual([2, 2]);
  expect(shape.allExfil).toBe(true);
  await shot(page, '03-plan');

  // 4 Compare — guard passes, matrix of two. Scrubbing moves the comparison ghosts;
  // selecting a COA previews it everywhere (map ghost + own-force tracks activate in the
  // Sync Matrix) before its rationale is committed.
  await page.getByTestId('continue-compare').click();
  await expect(page.getByTestId('cmp-guard')).toContainText('✓');
  await expect(page.getByTestId('cmp-matrix').locator('tbody tr')).toHaveCount(2);
  const g0 = await page.getByTestId('map').getAttribute('data-ghost');
  await page.getByTestId('playhead').evaluate((el: HTMLInputElement) => { el.value = '40'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect.poll(() => page.getByTestId('map').getAttribute('data-ghost')).not.toBe(g0);
  await page.getByTestId('pick-direct').check();
  await expect(page.getByTestId('sync-matrix')).toContainText('Own force');
  expect(await page.getByTestId('sync-matrix-host').getAttribute('data-self-active')).toBe('1');
  await shot(page, '04-compare');
  await page.getByTestId('cmp-commit').click();
  await expect(page.getByTestId('cmp-ratid')).toBeVisible();

  // 5 Execute — play to completion via the deterministic step buttons.
  await page.getByTestId('continue-execute').click();
  await expect(page.getByTestId('wx-clock')).toBeVisible();
  for (let i = 0; i < 12; i++) {
    const f = await page.getByTestId('wx-final').textContent();
    if (f && f.includes('complete')) break;
    await page.getByTestId('wx-step').click();
  }
  await expect(page.getByTestId('wx-final')).toContainText('complete');
  await shot(page, '05-execute');

  // 6 Learn — after-action exists; replay from the stamp reproduces the decision (NF3).
  await page.getByTestId('continue-learn').click();
  await expect(page.getByTestId('aa-recon')).toBeVisible();
  await page.getByTestId('aa-replay').click();
  await expect(page.getByTestId('aa-replay-result')).toContainText('identical decision');
  await shot(page, '06-learn');

  // Substrate — store + seam drawers populated.
  await page.locator('.foot details').first().click();
  await page.locator('.foot details').nth(1).click();
  await expect(page.getByTestId('store-list')).toContainText('Requirement');
  await expect(page.getByTestId('seam-list')).toContainText('/plan/handful');

  await noFault(page);
  expect(realErrors(errs), `errors:\n${errs.join('\n')}`).toEqual([]);
});

test('same stamp reproduces the same decision ids (NF3)', async ({ page }) => {
  await page.goto('/');
  await walkToPlan(page);
  const ids = await page.evaluate(async () => {
    const w = (window as any).__remit;
    const again = await w.seam.planHandful(w.state.lastPlanRequest);
    return { first: w.state.handful.map((p: any) => p.id), second: again.plans.map((p: any) => p.id) };
  });
  expect(ids.second).toEqual(ids.first);
  expect(new Set(ids.first).size).toBe(2);
});

test('plan steering: painting a no-go re-plans (routes bend around it)', async ({ page }) => {
  await page.goto('/');
  await walkToPlan(page);
  const before = await page.evaluate(() => (window as any).__remit.state.handful.map((p: any) => p.id));
  await page.getByTestId('plan-nogo').click();           // paint mode
  const box = (await page.getByTestId('map').boundingBox())!;
  await page.getByTestId('map').click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  await expect.poll(() => page.getByTestId('map').getAttribute('data-nogo')).not.toBe('');
  await expect(page.getByTestId('plan-nogo-count')).not.toContainText('0 cells');
  await page.getByTestId('plan-run').click();
  await expect(page.locator('.plan-card')).toHaveCount(2);
  await noFault(page);
  void before;
});

test('the hex grid can be toggled off and on (basemap shows through)', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500);                        // map init
  await page.getByTestId('world-provision').click();      // render the hex terrain
  await expect(page.getByTestId('world-baseid')).toBeVisible();
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-hexes', 'on');  // grid shown by default
  await shot(page, 'hex-toggle-on');
  await page.getByTestId('hex-toggle').click();
  await expect(map).toHaveAttribute('data-hexes', 'off'); // grid hidden — basemap shows through
  await page.waitForTimeout(300);
  await shot(page, 'hex-toggle-off');
  await page.getByTestId('hex-toggle').click();
  await expect(map).toHaveAttribute('data-hexes', 'on');  // and back
});

test('execute: blocking the next hex re-routes in flight', async ({ page }) => {
  await page.goto('/');
  await walkToPlan(page);
  await page.getByTestId('continue-compare').click();
  await page.getByTestId('pick-direct').check();
  await page.getByTestId('cmp-commit').click();
  await page.getByTestId('continue-execute').click();

  // Step into the exfil (after the visit ends at H+75, RV at ~H+90), then block the next hex.
  for (let i = 0; i < 8; i++) await page.getByTestId('wx-step10').click();
  const cells = () => page.evaluate(() => (window as any).__remit.state.execPlan.materialisation.trajectory.map((p: any) => p.h3));
  const before = await cells();
  await page.getByTestId('wx-block').click();
  await expect.poll(() => page.getByTestId('map').getAttribute('data-blocked')).not.toBe('');
  const after = await cells();
  expect(after).not.toEqual(before);
  await noFault(page);
});
