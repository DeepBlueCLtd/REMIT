// e2e/shell.spec.ts — the role tab shell (DEC-61 seed) and the Data Analysis
// drill-down monitor: tab switching, the object/graph browser, search, change
// glow, and pop-out windows that share the same live store.
import { test, expect, Page } from '@playwright/test';

const EVIDENCE = process.env.EVIDENCE_DIR || 'specs/003-role-tabs/evidence/screenshots';
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${EVIDENCE}/${name}.png`, fullPage: true });

/** Walk the Overview lap far enough to commit Stamp + Plans into the store. */
async function planOnOverview(page: Page) {
  await page.getByTestId('world-provision').click();
  await page.getByTestId('continue-capture').click();
  await page.getByTestId('cap-commit').click();
  await page.getByTestId('continue-plan').click();
  await page.getByTestId('plan-run').click();
  await expect(page.locator('.plan-card')).toHaveCount(3);
}

test('tab bar: seven roles, switching, and the stub placeholders', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.goto('/');
  await expect(page.getByTestId('tabbar')).toBeVisible();
  for (const id of ['overview', 'co', 'duty-plans', 'sme-env', 'sme-int', 'duty-ops', 'data-analysis']) {
    await expect(page.getByTestId(`tab-${id}`)).toBeVisible();
  }

  // Overview is the default active tab and the original UI still works.
  await expect(page.getByTestId('tab-overview')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('view-overview')).toBeVisible();
  await expect(page.getByTestId('world-provision')).toBeVisible();
  await shot(page, '01-tabbar');

  // A stub role shows a "coming soon" placeholder.
  await page.getByTestId('tab-co').click();
  await expect(page.getByTestId('tab-co')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('stub-co')).toContainText('coming soon');
  await expect(page.getByTestId('view-overview')).toBeHidden();

  // Switch to Data Analysis.
  await page.getByTestId('tab-data-analysis').click();
  await expect(page.getByTestId('view-data-analysis')).toBeVisible();
  await expect(page.getByTestId('data-analysis')).toBeVisible();
  await expect(page.locator('#fault')).toBeHidden();
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
});

test('data analysis: empty state → provision → index populates', async ({ page }) => {
  await page.goto('/#tab=data-analysis');               // deep-link survives load
  await expect(page.getByTestId('tab-data-analysis')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('view-data-analysis')).toBeVisible();

  await expect(page.getByTestId('da-empty')).toBeVisible();
  await page.getByTestId('da-provision').click();

  const index = page.getByTestId('da-index');
  await expect(index).toContainText('Baseline');
  await expect(index).toContainText('Profile');
  await expect(index).toContainText('ConfigCore');
  await shot(page, '02-data-analysis-index');
  await expect(page.locator('#fault')).toBeHidden();
});

test('data analysis: drill a content-id reference and breadcrumb back', async ({ page }) => {
  await page.goto('/');
  await planOnOverview(page);                            // commits Stamp + Plans
  await page.getByTestId('tab-data-analysis').click();

  const index = page.getByTestId('da-index');
  await expect(index).toContainText('Plan');
  await expect(index).toContainText('Stamp');
  await expect(index).toContainText('Baseline');

  // Open the first Plan, then drill its stamp's baseline_version reference.
  await page.locator('.da-group[data-group="Plan"] .da-row').first().click();
  const detail = page.getByTestId('da-detail');
  await expect(detail).toContainText('stamp');

  await detail.locator('.da-ref', { hasText: 'Baseline' }).first().click();
  await expect(detail).toContainText('Kara Crossing');   // the baseline's name
  await expect(detail).toContainText('medium');

  const crumbs = page.getByTestId('da-crumbs');
  await expect(crumbs).toContainText('Plan');
  await expect(crumbs).toContainText('Baseline');
  await shot(page, '03-data-analysis-drilldown');

  // Click the first crumb (the Plan) → detail returns to the Plan.
  await crumbs.locator('button').first().click();
  await expect(detail).toContainText('strategy');
  await expect(page.locator('#fault')).toBeHidden();
});

test('data analysis: search filters by name or value', async ({ page }) => {
  await page.goto('/#tab=data-analysis');
  await page.getByTestId('da-provision').click();
  const index = page.getByTestId('da-index');
  await expect(index).toContainText('Baseline');

  // "rover" appears only in the Profile (ROVER-1) → Baseline filtered out.
  await page.getByTestId('da-search').fill('rover');
  await expect(index).toContainText('Profile');
  await expect(index).not.toContainText('Baseline');

  // Clearing restores the full index.
  await page.getByTestId('da-search').fill('');
  await expect(index).toContainText('Baseline');
  await expect(page.locator('#fault')).toBeHidden();
});

test('data analysis: new objects glow, the glow persists, and a later change moves it', async ({ page }) => {
  await page.goto('/#tab=data-analysis');
  await page.getByTestId('da-provision').click();        // seeds the baseline (no glow)
  await expect(page.getByTestId('da-index')).toContainText('Baseline');

  // Commit a new object into the shared store while the monitor is visible: it
  // appears and glows (the same hook future mock feeds will fire).
  await page.evaluate(() =>
    (window as any).__remit.seam.putObject('Requirement', { id: 'probe-1', intent: 'glow probe one' }));
  const probe1 = page.locator('.da-row', { hasText: 'glow probe one' });
  await expect(probe1).toHaveClass(/glow/);

  // It stays lit well past the old ~1.8s fade (persistent until the next change).
  await page.waitForTimeout(2200);
  await expect(probe1).toHaveClass(/glow/);

  // A later change moves the glow: the new object lights up, the previous one stops.
  await page.evaluate(() =>
    (window as any).__remit.seam.putObject('Requirement', { id: 'probe-2', intent: 'glow probe two' }));
  const probe2 = page.locator('.da-row', { hasText: 'glow probe two' });
  await expect(probe2).toHaveClass(/glow/);
  await expect(probe1).not.toHaveClass(/glow/);
  await expect(page.locator('#fault')).toBeHidden();
});

test('pop-out: a separate window shares the same live store', async ({ page, context }) => {
  await page.goto('/#tab=data-analysis');
  await page.getByTestId('da-provision').click();
  await expect(page.getByTestId('da-index')).toContainText('Baseline');

  // Pop the monitor out into its own window.
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.getByTestId('popout-data-analysis').click(),
  ]);
  await popup.waitForLoadState();
  await expect(popup.getByTestId('popout-root')).toBeVisible();
  await expect(popup.getByTestId('da-index')).toContainText('Baseline');   // reads the opener's store

  // A change made in the MAIN window appears live in the popped-out window.
  await page.evaluate(() =>
    (window as any).__remit.seam.putObject('Requirement', { id: 'probe-2', intent: 'cross-window probe' }));
  await expect(popup.getByTestId('da-index')).toContainText('cross-window probe');
  await shot(page, '04-popout-main');

  // Closing the popped-out window pops the view back in (poll detects the close).
  await popup.close();
  await expect(page.getByTestId('tab-data-analysis')).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
  await expect(page.getByTestId('data-analysis')).toBeVisible();
  await expect(page.locator('#fault')).toBeHidden();
});
