// e2e/orbat.spec.ts — ORBAT blue/red/green authoring (spec 004, DEC-60).
// Author → tune → see on the map / Sync Matrix → manage the roster → persist across reload,
// asserting the display-only invariants (NF9 honest floor, NF3 determinism): no asset tune
// changes the route or plan. Captures evidence screenshots along the way.
import { test, expect, Page } from '@playwright/test';

const EVIDENCE = process.env.EVIDENCE_DIR || 'specs/004-orbat-red-green-assets/evidence/screenshots';
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${EVIDENCE}/${name}.png`, fullPage: true });

const DRAFT_KEY = 'remit.orbat.M-001';
const draft = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), DRAFT_KEY);

/** Provision the world so the Overview map renders (and reconciles the own-force). */
async function provision(page: Page) {
  await page.goto('/');
  await page.getByTestId('world-provision').click();
  await expect(page.getByTestId('map')).toHaveAttribute('data-assets', /own-force:blue/);
}

async function openOrbat(page: Page) {
  await page.getByTestId('tab-sme-int').click();
  await expect(page.getByTestId('orbat-panel')).toBeVisible();
}

test('US1 — add & tune red assets; both render, isolated, no fabricated motion', async ({ page }) => {
  await provision(page);
  await openOrbat(page);

  // Empty red side shows "none".
  await expect(page.getByTestId('orbat-none-red')).toBeVisible();
  await shot(page, '01-empty-roster');

  // Add two red assets.
  await page.getByTestId('orbat-add-red').click();
  await page.getByTestId('orbat-add-red').click();
  await expect(page.locator('[data-testid="orbat-group-red"] .orbat-row')).toHaveCount(2);

  const d0 = await draft(page);
  const reds = d0.assets.filter((a: any) => a.allegiance === 'red');
  const [r1, r2] = reds.map((a: any) => a.id);

  // Tune the FIRST red's detection range + severity to their maxima (red uses the dual-range
  // control from spec 005, not a single extent).
  await page.getByTestId(`orbat-detection-${r1}`).fill('20000');
  await page.getByTestId(`orbat-detection-${r1}`).dispatchEvent('change');
  await page.getByTestId(`orbat-severity-${r1}`).fill('5');
  await page.getByTestId(`orbat-severity-${r1}`).dispatchEvent('change');

  // Isolation (SC-003): only r1 changed; r2 is byte-identical to before.
  const before2 = JSON.stringify(reds.find((a: any) => a.id === r2));
  const d1 = await draft(page);
  const a1 = d1.assets.find((a: any) => a.id === r1);
  const a2 = d1.assets.find((a: any) => a.id === r2);
  expect(a1.red.detection_range_m).toBe(20000);
  expect(a1.red.severity).toBe(5);
  expect(JSON.stringify(a2)).toBe(before2);

  // Both render on the map; honest floor — no plan/route was fabricated by authoring.
  await page.getByTestId('tab-overview').click();
  const assetsAttr = await page.getByTestId('map').getAttribute('data-assets');
  expect(assetsAttr).toContain(`${r1}:red`);
  expect(assetsAttr).toContain(`${r2}:red`);
  const plans = await page.evaluate(() =>
    (window as any).__remit.objects.list().filter((o: any) => o.type === 'Plan').length);
  expect(plans).toBe(0);                         // authoring created no plan (NF9)
  await shot(page, '02-two-red-tuned');
  await expect(page.locator('#fault')).toBeHidden();
});

test('US2 — add & tune green assets; distinct styling, isolated', async ({ page }) => {
  await provision(page);
  await openOrbat(page);

  await page.getByTestId('orbat-add-green').click();
  await page.getByTestId('orbat-add-green').click();
  await expect(page.locator('[data-testid="orbat-group-green"] .orbat-row')).toHaveCount(2);

  const d0 = await draft(page);
  const greens = d0.assets.filter((a: any) => a.allegiance === 'green');
  const [g1, g2] = greens.map((a: any) => a.id);

  await page.getByTestId(`orbat-sensitivity-${g1}`).fill('5');
  await page.getByTestId(`orbat-sensitivity-${g1}`).dispatchEvent('change');
  await page.getByTestId(`orbat-protection-${g1}`).selectOption('minimise_effect');

  const d1 = await draft(page);
  expect(d1.assets.find((a: any) => a.id === g1).green.sensitivity).toBe(5);
  expect(d1.assets.find((a: any) => a.id === g1).green.protection).toBe('minimise_effect');
  // g2 untouched.
  expect(d1.assets.find((a: any) => a.id === g2).green.sensitivity).toBe(3);

  await page.getByTestId('tab-overview').click();
  const attr = await page.getByTestId('map').getAttribute('data-assets');
  expect(attr).toContain(`${g1}:green`);
  expect(attr).toContain(`${g2}:green`);
  await shot(page, '03-green-assets');
  await expect(page.locator('#fault')).toBeHidden();
});

test('US3 — own-force reconciled & protected; blue tune leaves the route unchanged', async ({ page }) => {
  // Walk to a committed set of COAs so there is a route to prove unchanged.
  await page.goto('/');
  await page.getByTestId('world-provision').click();
  await page.getByTestId('continue-capture').click();
  await page.getByTestId('cap-commit').click();
  await page.getByTestId('continue-plan').click();
  await page.getByTestId('plan-run').click();
  await expect(page.locator('.plan-card')).toHaveCount(2);

  // Snapshot the committed Plan ids (the route identity).
  const plansBefore = await page.evaluate(() =>
    (window as any).__remit.objects.list().filter((o: any) => o.type === 'Plan').map((o: any) => o.id).sort());
  expect(plansBefore.length).toBe(2);

  await openOrbat(page);
  // The planned own-force (ROVER-1) is surfaced as the canonical blue asset, remove disabled.
  await expect(page.getByTestId('orbat-canon')).toBeVisible();
  await expect(page.getByTestId('orbat-remove-own-force')).toBeDisabled();

  // Add a blue pool asset and tune it.
  await page.getByTestId('orbat-add-blue').click();
  const d0 = await draft(page);
  const blue = d0.assets.find((a: any) => a.allegiance === 'blue' && !a.canonical_own_force);
  await page.getByTestId(`orbat-availability-${blue.id}`).selectOption('down');
  await page.getByTestId(`orbat-capabilities-${blue.id}`).fill('recce, comms');
  await page.getByTestId(`orbat-capabilities-${blue.id}`).dispatchEvent('change');

  // Display-only proof (NF9): the committed Plans are byte-for-byte the same set.
  const plansAfter = await page.evaluate(() =>
    (window as any).__remit.objects.list().filter((o: any) => o.type === 'Plan').map((o: any) => o.id).sort());
  expect(plansAfter).toEqual(plansBefore);

  await page.getByTestId('tab-overview').click();
  await expect(page.getByTestId('map')).toHaveAttribute('data-assets', new RegExp(`${blue.id}:blue`));
  await shot(page, '04-blue-pool-route-unchanged');
  await expect(page.locator('#fault')).toBeHidden();
});

test('US4 — duplicate, remove, and persistence across reload', async ({ page }) => {
  await provision(page);
  await openOrbat(page);

  await page.getByTestId('orbat-add-red').click();
  await page.getByTestId('orbat-add-green').click();
  let d = await draft(page);
  const red = d.assets.find((a: any) => a.allegiance === 'red');
  const green = d.assets.find((a: any) => a.allegiance === 'green');

  // Duplicate the red → an independent copy (new id).
  await page.getByTestId(`orbat-dup-${red.id}`).click();
  await expect(page.locator('[data-testid="orbat-group-red"] .orbat-row')).toHaveCount(2);

  // Remove the green → gone; the canonical own-force cannot be removed.
  await page.getByTestId(`orbat-remove-${green.id}`).click();
  await expect(page.getByTestId('orbat-none-green')).toBeVisible();
  await expect(page.getByTestId('orbat-remove-own-force')).toBeDisabled();

  // Commit the roster (mints an immutable version).
  await page.getByTestId('orbat-commit').click();
  await expect(page.getByTestId('orbat-commit-result')).toContainText('committed');

  const rosterBefore = (await draft(page)).assets
    .map((a: any) => `${a.id}:${a.allegiance}:${a.extent_m}`).sort();
  await shot(page, '05-roster-managed');

  // Reload → the full roster and tuned values are restored exactly (SC-004).
  await page.reload();
  await page.getByTestId('tab-sme-int').click();
  await expect(page.getByTestId('orbat-panel')).toBeVisible();
  const rosterAfter = (await draft(page)).assets
    .map((a: any) => `${a.id}:${a.allegiance}:${a.extent_m}`).sort();
  expect(rosterAfter).toEqual(rosterBefore);
  await expect(page.getByTestId('orbat-none-green')).toBeVisible();   // removal persisted
  await expect(page.locator('#fault')).toBeHidden();
});

test('US5 — a red active window projects as a Sync-Matrix track; selection highlights it', async ({ page }) => {
  await provision(page);

  // Baseline catalogue track count on the Overview Sync Matrix.
  const tracks0 = Number(await page.getByTestId('sync-matrix-host').getAttribute('data-tracks'));

  await openOrbat(page);
  await page.getByTestId('orbat-add-red').click();
  const d = await draft(page);
  const red = d.assets.find((a: any) => a.allegiance === 'red');

  // Give it an active window (H+30..H+60).
  await page.getByTestId(`orbat-redwin-${red.id}`).check();
  await page.locator(`[data-testid="orbat-row-${red.id}"] [data-act="redwin-start"]`).fill('30');
  await page.locator(`[data-testid="orbat-row-${red.id}"] [data-act="redwin-end"]`).fill('60');
  await page.locator(`[data-testid="orbat-row-${red.id}"] [data-act="redwin-end"]`).dispatchEvent('change');

  // Select the row → broadcast highlight to the other views.
  await page.locator(`[data-testid="orbat-row-${red.id}"] [data-act="select"]`).click();
  await expect(page.locator(`[data-testid="orbat-row-${red.id}"]`)).toHaveClass(/orbat-row-sel/);

  // On the Overview the Sync-Matrix gains the asset's track.
  await page.getByTestId('tab-overview').click();
  await expect
    .poll(() => page.getByTestId('sync-matrix-host').getAttribute('data-tracks'))
    .toBe(String(tracks0 + 1));
  await expect(page.getByTestId('map')).toHaveAttribute('data-assets', new RegExp(`${red.id}:red`));
  await shot(page, '06-sync-matrix-track');
  await expect(page.locator('#fault')).toBeHidden();
});

// --- spec 005 enrichment ---------------------------------------------------

test('US1 (005) — platform kind drives the map symbol; icon override + clear', async ({ page }) => {
  await provision(page);
  await openOrbat(page);
  await page.getByTestId('orbat-add-red').click();
  const id = (await draft(page)).assets.find((a: any) => a.allegiance === 'red').id;

  // Set kind → the map's data-assets exposes "id:red:emplacement:...".
  await page.getByTestId(`orbat-kind-${id}`).selectOption('emplacement');
  await page.getByTestId('tab-overview').click();
  await expect(page.getByTestId('map')).toHaveAttribute('data-assets', new RegExp(`${id}:red:emplacement`));

  // Icon override then clear (asserted on the persisted draft).
  await page.getByTestId('tab-sme-int').click();
  await page.getByTestId(`orbat-symbol-${id}`).fill('★');
  await page.getByTestId(`orbat-symbol-${id}`).dispatchEvent('change');
  expect((await draft(page)).assets.find((a: any) => a.id === id).symbol).toBe('★');
  await page.getByTestId(`orbat-symbol-clear-${id}`).click();
  expect('symbol' in (await draft(page)).assets.find((a: any) => a.id === id)).toBe(false);

  // Honest floor: authoring created no plan.
  await page.getByTestId('tab-overview').click();
  const plans = await page.evaluate(() => (window as any).__remit.objects.list().filter((o: any) => o.type === 'Plan').length);
  expect(plans).toBe(0);
  await shot(page, '07-kind-symbols');
  await expect(page.locator('#fault')).toBeHidden();
});

test('US2 (005) — intel confidence persists and shows on the map', async ({ page }) => {
  await provision(page);
  await openOrbat(page);
  await page.getByTestId('orbat-add-green').click();
  const id = (await draft(page)).assets.find((a: any) => a.allegiance === 'green').id;

  await page.getByTestId(`orbat-confidence-${id}`).selectOption('low');
  expect((await draft(page)).assets.find((a: any) => a.id === id).confidence).toBe('low');
  await page.getByTestId('tab-overview').click();
  await expect(page.getByTestId('map')).toHaveAttribute('data-assets', new RegExp(`${id}:green:[^:]*:low`));

  // Persists across reload.
  await page.reload();
  expect((await draft(page)).assets.find((a: any) => a.id === id).confidence).toBe('low');
  await expect(page.locator('#fault')).toBeHidden();
});

test('US3 (005) — red dual range reconciles engagement ≤ detection; green keeps single extent', async ({ page }) => {
  await provision(page);
  await openOrbat(page);
  await page.getByTestId('orbat-add-red').click();
  await page.getByTestId('orbat-add-green').click();
  const d0 = await draft(page);
  const red = d0.assets.find((a: any) => a.allegiance === 'red');
  const green = d0.assets.find((a: any) => a.allegiance === 'green');

  // Red shows detection + engagement (not a single extent); green shows a single extent.
  await expect(page.getByTestId(`orbat-detection-${red.id}`)).toBeVisible();
  await expect(page.getByTestId(`orbat-engagement-${red.id}`)).toBeVisible();
  await expect(page.getByTestId(`orbat-extent-${red.id}`)).toHaveCount(0);
  await expect(page.getByTestId(`orbat-extent-${green.id}`)).toBeVisible();

  // Set detection then an over-large engagement → reconciled to ≤ detection.
  await page.getByTestId(`orbat-detection-${red.id}`).fill('4000');
  await page.getByTestId(`orbat-detection-${red.id}`).dispatchEvent('change');
  await page.getByTestId(`orbat-engagement-${red.id}`).fill('9000');
  await page.getByTestId(`orbat-engagement-${red.id}`).dispatchEvent('change');
  const a = (await draft(page)).assets.find((x: any) => x.id === red.id);
  expect(a.red.detection_range_m).toBe(4000);
  expect(a.red.engagement_range_m).toBe(4000);          // reconciled ≤ detection
  await shot(page, '08-red-dual-range');
  await expect(page.locator('#fault')).toBeHidden();
});

test('US4 (005) — descriptive fields (strength/notes + threat/category/role) round-trip', async ({ page }) => {
  await provision(page);
  await openOrbat(page);
  await page.getByTestId('orbat-add-red').click();
  await page.getByTestId('orbat-add-green').click();
  await page.getByTestId('orbat-add-blue').click();
  const d0 = await draft(page);
  const red = d0.assets.find((a: any) => a.allegiance === 'red');
  const green = d0.assets.find((a: any) => a.allegiance === 'green');
  const blue = d0.assets.find((a: any) => a.allegiance === 'blue' && !a.canonical_own_force);

  for (const [tid, val] of [[`orbat-strength-${red.id}`, '×2'], [`orbat-notes-${red.id}`, 'dug in'], [`orbat-threat-${red.id}`, 'SAM'], [`orbat-role-${blue.id}`, 'recce']] as const) {
    await page.getByTestId(tid).fill(val);
    await page.getByTestId(tid).dispatchEvent('change');
  }
  await page.getByTestId(`orbat-category-${green.id}`).selectOption('hospital');

  // Persist across reload, then assert every descriptor survived.
  await page.reload();
  const d1 = await draft(page);
  const r = d1.assets.find((a: any) => a.id === red.id);
  expect(r.strength).toBe('×2');
  expect(r.notes).toBe('dug in');
  expect(r.red.threat_type).toBe('SAM');
  expect(d1.assets.find((a: any) => a.id === green.id).green.category).toBe('hospital');
  expect(d1.assets.find((a: any) => a.id === blue.id).blue.role).toBe('recce');
  await expect(page.locator('#fault')).toBeHidden();
});
