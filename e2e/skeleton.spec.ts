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

  // --- 1 World (now first): provision the AO so Capture can see the map.
  await page.getByTestId('world-provision').click();
  await expect(page.getByTestId('world-baseid')).toBeVisible();
  await expect(page.locator('#world-result')).toContainText('config-core hash');
  await shot(page, '01-world');

  // --- 2 Capture: with the AO on the map, the picked OP is highlighted, and
  // changing it moves the highlight; committed via echo-back, retrievable.
  await page.getByTestId('continue-capture').click();
  const hi0 = await page.getByTestId('map').getAttribute('data-highlight');
  await page.getByTestId('cap-where').selectOption('OP-C');
  await expect.poll(() => page.getByTestId('map').getAttribute('data-highlight')).not.toBe(hi0);
  await page.getByTestId('cap-where').selectOption('OP-A'); // default for the rest of the lap
  await page.getByTestId('cap-dur').fill('45'); // touch a slot → confirmed
  await expect(page.getByTestId('cap-echo')).toContainText('holding observation for at least 45 min');
  await page.getByTestId('cap-commit').click();
  await expect(page.getByTestId('cap-reqid')).toBeVisible();
  await expect(page.locator('#cap-result')).toContainText('round-trip ✓');
  await shot(page, '02-capture');

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

  // Implementer controls (DEC-6): appetites recommend a COA; the armed-escort
  // mitigation buys robustness for a cost.
  await expect(page.getByTestId('rec-tag')).toHaveCount(1);
  await page.getByTestId('cmp-escort').check();
  await expect(page.getByTestId('band-mod').first()).toBeVisible();
  await page.getByTestId('cmp-escort').uncheck();
  await page.getByTestId('cmp-exposure').selectOption('cautious');
  await expect(page.getByTestId('rec-tag')).toHaveCount(1);

  // Appetites visibly re-rank: cautious vs rapid/bold recommend different COAs.
  const recPick = () => page.evaluate(() =>
    document.querySelector('.matrix tr.recommended [data-testid^="pick-"]')?.getAttribute('data-testid'));
  const recCautious = await recPick();
  await page.getByTestId('cmp-exposure').selectOption('bold');
  await page.getByTestId('cmp-tempo').selectOption('rapid');
  expect(await recPick()).not.toBe(recCautious);
  await page.getByTestId('cmp-exposure').selectOption('balanced');
  await page.getByTestId('cmp-tempo').selectOption('balanced');

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
  // Sync Matrix (D6): own-force tracks fill in once a COA is selected.
  await expect(page.getByTestId('sync-matrix')).toContainText('Own force · phase');
  expect(await page.getByTestId('sync-matrix-host').getAttribute('data-self-active')).toBe('1');
  await shot(page, '05-views');
  await page.getByTestId('views-continue').click();      // jumps straight to Execute

  // --- 6 Execute: playback, band-crossing alerts, manual observation, log.
  // Speed slider drives the play button's rate label (no timers used here —
  // playback in tests stays on the deterministic Step buttons). The label is
  // sim-minutes per real second; the slider reaches down to 2 min/s.
  await expect(page.getByTestId('wx-play')).toContainText('64 min/s');
  await expect(page.getByTestId('wx-speed')).toHaveAttribute('min', '1');
  await page.getByTestId('wx-speed').evaluate((el: HTMLInputElement) => {
    el.value = '1';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.getByTestId('wx-play')).toContainText('2 min/s');

  // The playhead scrubs the route during execution (review elapsed / preview).
  await page.getByTestId('playhead').evaluate((el: HTMLInputElement) => {
    el.value = '60'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const exScrub = await page.getByTestId('map').getAttribute('data-ghost');
  await page.getByTestId('playhead').evaluate((el: HTMLInputElement) => {
    el.value = '0'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(await page.getByTestId('map').getAttribute('data-ghost')).not.toBe(exScrub);

  await page.getByTestId('wx-step10').click();           // τ=10, in transit
  await page.getByTestId('wx-delay').click();            // +25 → band drops
  await page.getByTestId('wx-delay').click();            // +50
  await page.getByTestId('wx-delay').click();            // +75 → violated for sure
  await expect(page.getByTestId('wx-alert').first()).toBeVisible();
  expect(await page.getByTestId('wx-alert').count()).toBeGreaterThanOrEqual(2);

  // Mid-mission obstructions insert at the current position (the clock does NOT
  // jump back to the start) and drop markers on the track.
  await expect(page.getByTestId('wx-clock')).toHaveText('H+10');
  await expect.poll(() => page.getByTestId('map').getAttribute('data-obstructions')).not.toBe('');

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

  // Learn: the playback scrubber drives the map (replay the chosen route).
  const lnGhost0 = await page.getByTestId('map').getAttribute('data-ghost');
  await page.getByTestId('playhead').evaluate((el: HTMLInputElement) => {
    el.value = '90'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(() => page.getByTestId('map').getAttribute('data-ghost')).not.toBe(lnGhost0);
  await shot(page, '07-learn');

  // --- substrate: store + seam drawers populated.
  await page.locator('.foot details').first().click();
  await page.locator('.foot details').nth(1).click();
  await expect(page.getByTestId('store-list')).toContainText('Requirement');
  await expect(page.getByTestId('store-list')).toContainText('Stamp');
  await expect(page.getByTestId('seam-list')).toContainText('/plan/handful');
  await shot(page, '08-substrate');

  // Top bar stays compact: the identity hashes are collapsed into a disclosure.
  await expect(page.locator('#chips')).toBeHidden();
  await expect(page.locator('#chips-count')).toHaveText('5'); // req·baseline·config-core·stamp·plan
  await page.locator('#idchips > summary').click();
  await expect(page.locator('#chips')).toContainText('config-core');

  await expect(page.locator('#fault')).toBeHidden(); // no silent (or loud) faults
  expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});

test('same stamp, same decision — re-issuing the identical request reproduces the ids (NF3)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('world-provision').click();
  await page.getByTestId('continue-capture').click();
  await page.getByTestId('cap-commit').click();
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
  await page.getByTestId('world-provision').click();
  await page.getByTestId('continue-capture').click();
  await page.getByTestId('cap-commit').click();
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

  // Restart → clock, alerts, log and obstruction markers all reset.
  await page.getByTestId('wx-restart').click();
  await expect(page.getByTestId('wx-clock')).toHaveText('H+0');
  await expect(page.getByTestId('wx-alert')).toHaveCount(0);
  await expect(page.getByTestId('wx-log').locator('li')).toHaveCount(0);
  await expect.poll(() => page.getByTestId('map').getAttribute('data-obstructions')).toBe('');

  // And the run is live again: stepping advances from zero.
  await page.getByTestId('wx-step').click();
  await expect(page.getByTestId('wx-clock')).toHaveText('H+30');
  await expect(page.locator('#fault')).toBeHidden();
});

test('execute: +5 obstruction, and blocking the next cell re-routes in flight', async ({ page }) => {
  await gotoExecute(page);
  await page.getByTestId('wx-step10').click();           // τ=10, in transit

  // +5 min obstruction (the smaller delay).
  await page.getByTestId('wx-delay5').click();
  await expect(page.getByTestId('wx-log')).toContainText('+5 min');

  const cells = () => page.evaluate(() =>
    (window as any).__remit.state.execPlan.materialisation.trajectory.map(
      (p: any) => `${Math.round(p.x)},${Math.round(p.y)}`));
  const before = await cells();

  // Block the next cell → the wingman re-plans around it in flight.
  await page.getByTestId('wx-block').click();
  await expect.poll(() => page.getByTestId('map').getAttribute('data-blocked')).not.toBe('');
  const blocked = (await page.getByTestId('map').getAttribute('data-blocked'))!.split('|')[0];
  const after = await cells();

  expect(before).toContain(blocked);        // the blocked cell was on the original route
  expect(after).not.toContain(blocked);     // the re-routed path avoids it
  expect(after).not.toEqual(before);
  await expect(page.locator('#fault')).toBeHidden();
});

test('sync matrix: tide + satellite tracks project from the World step; own-force fills in later', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('world-provision').click();

  // From the World step on: the forecast tide and provider satellite tracks are
  // already projected (no plan needed); own-force tracks are not yet active.
  const sm = page.getByTestId('sync-matrix');
  await expect(sm).toContainText('Tide · height + window');
  await expect(sm).toContainText('IKAROS-3 pass');
  await expect(sm).toContainText('forecast');                 // tide provenance
  await expect(sm).toContainText('provider');                 // satellite provenance
  await expect(sm).toContainText('select a COA');             // own-force placeholder
  expect(await page.getByTestId('sync-matrix-host').getAttribute('data-self-active')).toBe('0');
  expect(await page.getByTestId('sync-matrix-host').getAttribute('data-tracks')).toBe('4');

  // The cursor readout reports the coincidence at H+t (forecast + provider, NF1).
  await page.getByTestId('playhead').evaluate((el: HTMLInputElement) => {
    el.value = '60'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.getByTestId('sm-coincide')).toContainText('sat overhead');  // first pass ≈ H+51–69
  await page.getByTestId('playhead').evaluate((el: HTMLInputElement) => {
    el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.getByTestId('sm-coincide')).toContainText('sat below horizon');
  await expect(page.getByTestId('sm-coincide')).toContainText('ford open');      // window opens H+88

  // Selecting a COA activates the own-force tracks (self provenance).
  await page.getByTestId('continue-capture').click();
  await page.getByTestId('cap-commit').click();
  await page.getByTestId('continue-plan').click();
  await page.getByTestId('plan-run').click();
  await page.getByTestId('continue-compare').click();
  await page.getByTestId('pick-direct').check();
  await page.getByTestId('cmp-commit').click();
  await page.getByTestId('continue-views').click();
  await expect(sm).toContainText('Own force · fuel');
  await expect(sm).toContainText('self');
  expect(await page.getByTestId('sync-matrix-host').getAttribute('data-self-active')).toBe('1');

  // Advisory coincidence (H1-lite, DEC-53): declared conjunctions of aspect-predicates
  // surface as advisory windows — the imagery window (sat overhead during the OP
  // dwell) and the tide-aligned crossing — clearly labelled advisory/C10-lite.
  await expect(sm).toContainText('Coincidence');
  await expect(sm).toContainText('advisory');
  const coincidences = await page.getByTestId('sync-matrix-host').getAttribute('data-coincidences');
  expect(coincidences).toContain('imagery:51-69');
  expect(coincidences).toContain('open-ford-pass:146-164');   // plan-free (forecast × provider)
  // The cursor inside the imagery window (H+60) → it's named, marked advisory.
  await page.getByTestId('playhead').evaluate((el: HTMLInputElement) => {
    el.value = '60'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.getByTestId('sm-advisory')).toContainText('Imagery window');
  await expect(page.getByTestId('sm-advisory')).toContainText('advisory');
  // Outside any window → no advisory cue (e.g. H+10, still in transit).
  await page.getByTestId('playhead').evaluate((el: HTMLInputElement) => {
    el.value = '10'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.getByTestId('sm-advisory')).toHaveCount(0);

  // Dragging the matrix scrubs the shared playhead (map ghost moves with it).
  const ghost0 = await page.getByTestId('map').getAttribute('data-ghost');
  const box = await sm.boundingBox();
  await page.mouse.click(box!.x + box!.width * 0.85, box!.y + box!.height * 0.5);
  await expect.poll(() => page.getByTestId('map').getAttribute('data-ghost')).not.toBe(ghost0);
  await expect(page.locator('#fault')).toBeHidden();
});

test('tidal ford: the optimiser weighs wait-for-tide against the K-9 detour', async ({ page }) => {
  // Scenario 1 — default 45 min dwell: exfil reaches the bank ~11 min before
  // the low-tide window opens (H+88). Waiting beats the K-9 detour, so the
  // plan holds at the bank; covered arrives after opening and just crosses.
  await page.goto('/');
  await page.getByTestId('world-provision').click();
  await expect(page.getByTestId('world-tide')).toContainText('closed');
  await expect(page.getByTestId('world-tide')).toContainText('opens H+88');

  // The map renders the ford by tide state at the projected time.
  await expect.poll(() => page.getByTestId('map').getAttribute('data-ford-state')).toBe('closed');

  await page.getByTestId('continue-capture').click();
  await page.getByTestId('cap-commit').click();
  await page.getByTestId('continue-plan').click();
  await page.getByTestId('plan-run').click();
  await expect(page.locator('.plan-card')).toHaveCount(3);

  await expect(page.getByTestId('tide-direct')).toContainText('WAIT');
  await expect(page.getByTestId('tide-covered')).toContainText('open at the bank');
  const schedule = (key: string) => page.evaluate((k) => {
    const p = (window as any).__remit.state.handful.find((q: any) => q.strategy.key === k);
    return p.materialisation.schedule.map((s: any) => s.label).join(' | ');
  }, key);
  expect(await schedule('direct')).toContain('Await low tide — ford opens H+88');
  expect(await schedule('covered')).toContain('ford K-7 (tide open)');

  // Scrubbing the playhead past H+88 flips the rendered ford state to open.
  await page.getByTestId('playhead').evaluate((el: HTMLInputElement) => {
    el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(() => page.getByTestId('map').getAttribute('data-ford-state')).toBe('open');

  // During execution the vehicle visibly pauses at the bank: phase 'hold'
  // inside the exfil, then crosses once the window opens.
  await page.getByTestId('continue-compare').click();
  await page.getByTestId('pick-direct').check();
  await page.getByTestId('cmp-commit').click();
  await page.getByTestId('continue-views').click();
  await page.getByTestId('views-continue').click();
  for (let i = 0; i < 8; i++) await page.getByTestId('wx-step10').click();   // τ=80 — mid-hold
  await expect(page.locator('#wx-phase')).toHaveText('hold');
  await page.getByTestId('wx-step10').click();                               // τ=90 — crossing
  await expect(page.locator('#wx-phase')).toHaveText('exfil');
  await expect(page.locator('#fault')).toBeHidden();
});

test('execution re-assessment: holds absorb delays; a forfeited window re-plans via K-9', async ({ page }) => {
  await gotoExecute(page);
  await page.getByTestId('wx-step10').click();          // τ=10, in transit

  // +5 min: fully absorbed by the tide hold — RV unchanged at H+95.5.
  await page.getByTestId('wx-delay5').click();
  await expect(page.getByTestId('wx-log')).toContainText('holds absorbed 5 min');
  const rv = () => page.evaluate(() =>
    (window as any).__remit.state.execPlan.materialisation.schedule.at(-1).end_min);
  expect(await rv()).toBe(95.5);

  // +25 more (extends the standing blockage): the bank is now reached after the
  // window opens — the wingman re-assesses the tide decision and flags it.
  await page.getByTestId('wx-delay').click();
  await expect(page.getByTestId('wx-tide-alert')).toContainText('wait → open');
  expect(await rv()).toBe(110.5);

  // Pile on +350 more: the bank slips past the window close (H+448); the
  // re-plan forfeits the ford and flips to the K-9 detour.
  for (let i = 0; i < 14; i++) await page.getByTestId('wx-delay').click();
  await expect(page.getByTestId('wx-tide-alert').nth(1)).toContainText('open → detour');
  const labels = await page.evaluate(() =>
    (window as any).__remit.state.execPlan.materialisation.schedule.map((s: any) => s.label).join(' | '));
  expect(labels).toContain('via K-9 bridge');
  await expect(page.locator('#fault')).toBeHidden();
});

test('tidal ford: a short dwell flips the choice to the K-9 detour', async ({ page }) => {
  // Scenario 2 — 15 min dwell: the bank is reached ~43 min before the window;
  // waiting now loses to the detour, so every plan exfils via the K-9 bridge.
  await page.goto('/');
  await page.getByTestId('world-provision').click();
  await page.getByTestId('continue-capture').click();
  await page.getByTestId('cap-dur').fill('15');
  await page.getByTestId('cap-commit').click();
  await page.getByTestId('continue-plan').click();
  await page.getByTestId('plan-run').click();
  await expect(page.locator('.plan-card')).toHaveCount(3);

  await expect(page.getByTestId('tide-direct')).toContainText('DETOUR');
  const directLabels = await page.evaluate(() => {
    const p = (window as any).__remit.state.handful.find((q: any) => q.strategy.key === 'direct');
    return p.materialisation.schedule.map((s: any) => s.label).join(' | ');
  });
  expect(directLabels).toContain('via K-9 bridge');
  expect(directLabels).not.toContain('Await low tide');
  await expect(page.locator('#fault')).toBeHidden();
});

test('plan steering: a no-go on the K-7 bridge makes exfil infeasible (re-plan)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('world-provision').click();
  await page.getByTestId('continue-capture').click();
  await page.getByTestId('cap-commit').click();
  await page.getByTestId('continue-plan').click();
  await page.getByTestId('plan-run').click();
  await expect(page.locator('.plan-card')).toHaveCount(3);
  const before = await page.evaluate(() => (window as any).__remit.state.handful.map((p: any) => p.id));

  // Paint mode, then click map cells. The river has two crossings: K-7 (23,5)
  // and the southern highway (23,15).
  await page.getByTestId('plan-nogo').click();
  const box = (await page.getByTestId('map').boundingBox())!;
  const clickCell = (cx: number, cy: number) =>
    page.getByTestId('map').click({ position: { x: ((cx + 0.5) / 28) * box.width, y: ((cy + 0.5) / 18) * box.height } });

  // Block only K-7: routes detour south to the highway crossing — a different
  // plan (re-plan), still feasible.
  await clickCell(23, 5);
  await expect.poll(() => page.getByTestId('map').getAttribute('data-nogo')).toContain('23,5');
  await page.getByTestId('plan-run').click();
  expect(await page.evaluate(() => (window as any).__remit.state.handful.map((p: any) => p.id))).not.toEqual(before);

  // Also block the southern crossing (23,15): now there is no way across the
  // river, so exfil is infeasible for every COA.
  await clickCell(23, 15);
  await expect.poll(() => page.getByTestId('map').getAttribute('data-nogo')).toContain('23,15');
  await page.getByTestId('plan-run').click();
  const after = await page.evaluate(() => (window as any).__remit.state.handful);
  const exfilVerdicts = after.map((p: any) =>
    p.scores.satisfaction.find((s: any) => s.label === 'Exfil E')?.verdict);
  expect(exfilVerdicts.every((v: string) => v === 'violated')).toBe(true);
  await expect(page.locator('#fault')).toBeHidden();
});
