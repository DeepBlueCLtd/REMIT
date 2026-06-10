// e2e/skeleton.spec.ts — walks the DEC-44 lap end-to-end and captures the
// per-stage evidence screenshots. Assertions mirror the build-plan exit
// criteria (remit-build-plan.md §4).
import { test, expect, Page } from '@playwright/test';

// Evidence screenshots default to the committed spec evidence folder; point
// EVIDENCE_DIR elsewhere for ad-hoc verification runs (e.g. against the live
// deployed preview) so the canonical evidence isn't churned.
const EVIDENCE = process.env.EVIDENCE_DIR || 'specs/002-walking-skeleton/evidence/screenshots';
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${EVIDENCE}/${name}.png`, fullPage: true });

test('the walking skeleton walks the full lap', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.goto('/');
  await expect(page).toHaveTitle(/REMIT/);

  // --- 1 Capture: committed via echo-back, content-addressed, retrievable.
  await page.getByTestId('cap-dur').fill('45'); // touch a slot → confirmed
  await expect(page.getByTestId('cap-echo')).toContainText('holding observation for at least 45 min');
  await page.getByTestId('cap-commit').click();
  await expect(page.getByTestId('cap-reqid')).toBeVisible();
  await expect(page.locator('#cap-result')).toContainText('round-trip ✓');
  await shot(page, '01-capture');

  // --- 2 World: baseline + config core resolve and hash.
  await page.getByTestId('continue-world').click();
  await page.getByTestId('world-provision').click();
  await expect(page.getByTestId('world-baseid')).toBeVisible();
  await expect(page.locator('#world-result')).toContainText('config-core hash');
  await shot(page, '02-world');

  // --- 3 Plan: one stamped call → a handful of distinct banded plans.
  await page.getByTestId('continue-plan').click();
  await page.getByTestId('plan-run').click();
  await expect(page.getByTestId('plan-stampid')).toBeVisible();
  await expect(page.locator('.plan-card')).toHaveCount(3);
  for (const strat of ['direct', 'tracked', 'covered']) {
    await expect(page.getByTestId(`plan-card-${strat}`)).toBeVisible();
  }
  // Two-commitment requirement: every COA scores observe + exfil, and routes a
  // second leg (exfil E across the bridge).
  await expect(page.getByTestId('plan-card-direct')).toContainText('exfil');
  const shape = await page.evaluate(() => {
    const h = (window as any).__remit.state.handful;
    return {
      count: h.length,
      sats: h.map((p: any) => p.scores.satisfaction.length),
      allHaveExfil: h.every((p: any) => p.materialisation.schedule.some((s: any) => s.kind === 'exfil')),
    };
  });
  expect(shape.count).toBe(3);
  expect(shape.sats).toEqual([2, 2, 2]);
  expect(shape.allHaveExfil).toBe(true);
  await shot(page, '03-plan');

  // --- 4 Compare: guard passes, matrix shown; scrubbing the playhead races
  // all three candidate ghosts and drives the live measures strip (NF1).
  await page.getByTestId('continue-compare').click();
  await expect(page.getByTestId('cmp-guard')).toContainText('✓');
  await expect(page.getByTestId('cmp-matrix').locator('tbody tr')).toHaveCount(3);
  await expect(page.getByTestId('cmp-matrix')).toContainText('Observe OP');
  await expect(page.getByTestId('cmp-matrix')).toContainText('Exfil E');

  const ghosts = () => page.getByTestId('map').getAttribute('data-ghost');
  await page.getByTestId('playhead').evaluate((el: HTMLInputElement) => {
    el.value = '0';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const ghosts0 = await ghosts();
  await page.getByTestId('playhead').evaluate((el: HTMLInputElement) => {
    el.value = '40';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(ghosts).not.toBe(ghosts0);
  await expect(page.getByTestId('cmp-live')).toContainText('Direct');
  await expect(page.locator('.cmp-live-caption')).toContainText('H+40');
  await shot(page, '04-compare');

  await page.getByTestId('pick-direct').check();
  await page.getByTestId('cmp-commit').click();
  await expect(page.getByTestId('cmp-ratid')).toBeVisible();

  // --- 5 Views: scrubbing the playhead moves the map ghost (NF1 projection).
  // (Rail navigation still works for unlocked stages — hop away and back.)
  await page.getByTestId('rail-plan').click();
  await expect(page.getByTestId('plan-card-direct')).toBeVisible();
  await page.getByTestId('rail-compare').click();
  await page.getByTestId('continue-views').click();
  const ghostAt = () => page.getByTestId('map').getAttribute('data-ghost');
  const g0 = await ghostAt();
  await page.getByTestId('playhead').evaluate((el: HTMLInputElement) => {
    el.value = '15';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(ghostAt).not.toBe(g0);
  await shot(page, '05-views');
  await page.getByTestId('views-continue').click();      // jumps straight to Execute

  // --- 6 Execute: playback, band-crossing alerts, manual observation, log.
  // Speed slider drives the play button's acceleration label (no timers used
  // here — playback in tests stays on the deterministic Step buttons). The
  // slider now reaches down to ×2.
  await expect(page.getByTestId('wx-play')).toContainText('×64');
  await expect(page.getByTestId('wx-speed')).toHaveAttribute('min', '1');
  await page.getByTestId('wx-speed').evaluate((el: HTMLInputElement) => {
    el.value = '1';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.getByTestId('wx-play')).toContainText('×2');
  await page.getByTestId('wx-step10').click();           // τ=10, in transit
  await page.getByTestId('wx-delay').click();            // +25 → band drops
  await page.getByTestId('wx-delay').click();            // +50
  await page.getByTestId('wx-delay').click();            // +75 → violated for sure
  await expect(page.getByTestId('wx-alert').first()).toBeVisible();
  expect(await page.getByTestId('wx-alert').count()).toBeGreaterThanOrEqual(2);

  await page.getByTestId('wx-obs').fill('Track flooded at the culvert; detour holding');
  await page.getByTestId('wx-obs-add').click();
  await expect(page.getByTestId('wx-log')).toContainText('Track flooded at the culvert');

  for (let i = 0; i < 12; i++) {
    const done = await page.getByTestId('wx-final').textContent();
    if (done && done.includes('complete')) break;
    await page.getByTestId('wx-step').click();
  }
  await expect(page.getByTestId('wx-final')).toContainText('complete');
  await expect(page.getByTestId('wx-final')).toContainText('violated');
  await shot(page, '06-execute');

  // --- 7 Learn: after-action exists; replay from stamp is identical (NF3).
  await page.getByTestId('continue-learn').click();
  await expect(page.getByTestId('aa-recon')).toBeVisible();
  await expect(page.getByTestId('aa-recon')).toContainText('Exfil E'); // both commitments reconciled
  await page.getByTestId('aa-replay').click();
  await expect(page.getByTestId('aa-replay-result')).toContainText('identical decision');
  await shot(page, '07-learn');

  // --- substrate: store + seam drawers populated.
  await page.locator('.foot details').first().click();
  await page.locator('.foot details').nth(1).click();
  await expect(page.getByTestId('store-list')).toContainText('Requirement');
  await expect(page.getByTestId('store-list')).toContainText('Stamp');
  await expect(page.getByTestId('seam-list')).toContainText('/plan/handful');
  await shot(page, '08-substrate');

  await expect(page.locator('#fault')).toBeHidden(); // no silent (or loud) faults
  expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});

test('same stamp, same decision — re-issuing the identical request reproduces the ids (NF3)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('cap-commit').click();
  await page.getByTestId('continue-world').click();
  await page.getByTestId('world-provision').click();
  await page.getByTestId('continue-plan').click();
  await page.getByTestId('plan-run').click();
  await expect(page.locator('.plan-card')).toHaveCount(3);

  // NF3 is same STAMP → same decision. (Two separate capture acts are two
  // different requirements — their attribution timestamps are content — so the
  // honest check re-issues the same stamped request, as replay does.)
  const ids = await page.evaluate(async () => {
    const w = (window as any).__remit;
    const again = await w.seam.planHandful(w.state.lastPlanRequest);
    return {
      first: w.state.handful.map((p: any) => p.id),
      second: again.plans.map((p: any) => p.id),
    };
  });
  expect(ids.second).toEqual(ids.first);
  expect(new Set(ids.first).size).toBe(3); // distinct plans, no duplicate trajectories
});

/** Walk the lap as far as a mounted, ready Execute stage. */
async function gotoExecute(page: Page) {
  await page.goto('/');
  await page.getByTestId('cap-commit').click();
  await page.getByTestId('continue-world').click();
  await page.getByTestId('world-provision').click();
  await page.getByTestId('continue-plan').click();
  await page.getByTestId('plan-run').click();
  await expect(page.locator('.plan-card')).toHaveCount(3);
  await page.getByTestId('continue-compare').click();
  await page.getByTestId('pick-direct').check();
  await page.getByTestId('cmp-commit').click();
  await page.getByTestId('continue-views').click();   // → Views
  await page.getByTestId('views-continue').click();   // → Execute
  await expect(page.getByTestId('wx-clock')).toBeVisible();
}

test('execute: Restart resets the simulated run to H+0 with an empty log', async ({ page }) => {
  await gotoExecute(page);

  // Accumulate state: advance, then drive the band across with obstructions.
  await page.getByTestId('wx-step10').click();
  await page.getByTestId('wx-delay').click();
  await page.getByTestId('wx-delay').click();
  await page.getByTestId('wx-delay').click();
  await expect(page.getByTestId('wx-alert').first()).toBeVisible();
  expect(await page.getByTestId('wx-log').locator('li').count()).toBeGreaterThan(0);
  await expect(page.getByTestId('wx-clock')).not.toHaveText('H+0');

  // Restart → clock, alerts and log all reset.
  await page.getByTestId('wx-restart').click();
  await expect(page.getByTestId('wx-clock')).toHaveText('H+0');
  await expect(page.getByTestId('wx-alert')).toHaveCount(0);
  await expect(page.getByTestId('wx-log').locator('li')).toHaveCount(0);

  // And the run is live again: stepping advances from zero.
  await page.getByTestId('wx-step').click();
  await expect(page.getByTestId('wx-clock')).toHaveText('H+30');
  await expect(page.locator('#fault')).toBeHidden();
});
