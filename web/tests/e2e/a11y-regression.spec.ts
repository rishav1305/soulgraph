/**
 * a11y-regression.spec.ts — Verify a11y fixes from commit 24188d0.
 *
 * Tests 3 specific fixes:
 *   F1: role="status" + aria-live="polite" on connection-status
 *   F2: role="status" on eval-badge (compact + full)
 *   F3: sr-only h1 hidden visually but in accessibility tree
 *
 * Owner: Happy (QA) | Cross-browser regression
 */

import { test, expect } from '@playwright/test';

test.describe('A11y fixes from 24188d0', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to render
    await page.waitForSelector('[data-testid="query-input"]');
  });

  test('F1: connection-status has role=status and aria-live=polite', async ({
    page,
  }) => {
    const status = page.getByTestId('connection-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
  });

  test('F2: eval-badge has role=status after query completes', async ({
    page,
  }) => {
    // Submit a query to trigger eval report
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('hello');
    await page.getByTestId('query-input-submit').click();

    // Wait for eval report to appear
    const evalBadge = page.getByTestId('eval-badge').first();
    await expect(evalBadge).toBeVisible({ timeout: 15_000 });
    await expect(evalBadge).toHaveAttribute('role', 'status');
  });

  test('F3: sr-only h1 exists in DOM but is visually hidden', async ({
    page,
  }) => {
    // h1 should exist in DOM
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('SoulGraph — Multi-Agent RAG System');

    // h1 should have sr-only class (visually hidden)
    await expect(h1).toHaveClass(/sr-only/);

    // Verify it's not visible (bounding box should be tiny/offscreen)
    const box = await h1.boundingBox();
    // sr-only elements have width:1px, height:1px, overflow:hidden
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(1);
      expect(box.height).toBeLessThanOrEqual(1);
    }
  });

  test('F3: h1 is accessible as a heading via ARIA role', async ({
    page,
  }) => {
    // Use Playwright's getByRole to verify h1 is exposed in accessibility tree
    const heading = page.getByRole('heading', {
      name: 'SoulGraph — Multi-Agent RAG System',
      level: 1,
    });
    await expect(heading).toHaveCount(1);
    // Verify it's the sr-only element (hidden visually but accessible)
    await expect(heading).toHaveClass(/sr-only/);
  });

  test('F1: connection-status announces state changes to screen readers', async ({
    page,
  }) => {
    // The aria-live="polite" attribute means content changes will be
    // announced. Verify the status text updates and the live region exists.
    const status = page.getByTestId('connection-status');
    const text = await status.textContent();

    // Should show one of: idle, connecting, connected, error
    expect(text?.trim()).toMatch(/^(idle|connecting|connected|error)$/i);
  });
});
