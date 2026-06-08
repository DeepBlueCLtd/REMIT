// e2e/example.spec.ts — REFERENCE sample. Replace with your real tests.
//
// Demonstrates capturing a screenshot into evidence/screenshots/, which feeds the
// per-feature evidence pipeline and the blog media (see CLAUDE.md).
import { test, expect } from '@playwright/test';

test('home page renders and is screenshotted', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
  await page.screenshot({ path: 'evidence/screenshots/home.png', fullPage: true });
});
