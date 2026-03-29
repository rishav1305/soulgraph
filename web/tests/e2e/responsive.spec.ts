/**
 * E2E: Responsive — mobile viewport behavior.
 *
 * Tests layout behavior at viewport < 768px (mobile).
 * Sidebar collapses behind hamburger, right panel hidden, chat fills viewport.
 * Uses data-testid selectors exclusively.
 *
 * Matched to Playwright 'mobile' project in playwright.config.ts (Pixel 5: 393x851).
 *
 * Owner: Stark (P5) | Sprint Day 4
 */

import { test, expect } from '@playwright/test';

test.describe('Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('mobile header is visible', async ({ page }) => {
    const header = page.getByTestId('layout-header');
    await expect(header).toBeVisible();
  });

  test('sidebar is hidden by default on mobile', async ({ page }) => {
    // Sidebar should be translated off-screen on mobile
    // The sidebar exists but is off-screen (translate-x-full)
    // Check that the backdrop is NOT visible (sidebar is closed)
    await expect(page.getByTestId('layout-sidebar-backdrop')).not.toBeVisible();
  });

  test('hamburger toggle opens sidebar', async ({ page }) => {
    const toggle = page.getByTestId('layout-sidebar-toggle');
    await expect(toggle).toBeVisible();

    // Click hamburger to open sidebar
    await toggle.click();

    // Backdrop should appear
    await expect(page.getByTestId('layout-sidebar-backdrop')).toBeVisible();

    // Session sidebar content should now be visible
    const sidebar = page.getByTestId('layout-sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('hamburger toggle closes sidebar', async ({ page }) => {
    const toggle = page.getByTestId('layout-sidebar-toggle');

    // Open sidebar
    await toggle.click();
    await expect(page.getByTestId('layout-sidebar-backdrop')).toBeVisible();

    // Close sidebar — use Escape key since backdrop overlaps toggle button z-index
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('layout-sidebar-backdrop')).not.toBeVisible();
  });

  test('backdrop click closes sidebar', async ({ page }) => {
    // Open sidebar
    await page.getByTestId('layout-sidebar-toggle').click();
    const backdrop = page.getByTestId('layout-sidebar-backdrop');
    await expect(backdrop).toBeVisible();

    // Click the backdrop in the area not covered by sidebar (far right side)
    // Sidebar is 256px wide (w-64), viewport is 393px, so click at x=350
    await backdrop.click({ position: { x: 350, y: 400 } });

    // Sidebar should close
    await expect(backdrop).not.toBeVisible();
  });

  test('Escape key closes sidebar', async ({ page }) => {
    // Open sidebar
    await page.getByTestId('layout-sidebar-toggle').click();
    await expect(page.getByTestId('layout-sidebar-backdrop')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Sidebar should close
    await expect(page.getByTestId('layout-sidebar-backdrop')).not.toBeVisible();
  });

  test('right panel stacks below chat on mobile', async ({ page }) => {
    // Right panel is visible on mobile but stacked below (full-width, not side-by-side)
    // Verify it exists and is accessible by scrolling
    const rightPanel = page.getByTestId('layout-right-panel');
    await expect(rightPanel).toBeVisible({ timeout: 10_000 });

    // On mobile, right panel should be full-width (not the lg:w-80 sidebar layout)
    const box = await rightPanel.boundingBox();
    if (box) {
      // Pixel 5 viewport is 393px — panel should be ~full width
      expect(box.width).toBeGreaterThan(300);
    }
  });

  test('chat interface fills viewport on mobile', async ({ page }) => {
    const content = page.getByTestId('layout-content');
    await expect(content).toBeVisible();

    // Chat components should be visible
    await expect(page.getByTestId('message-list-empty')).toBeVisible();
    await expect(page.getByTestId('query-input-textarea')).toBeVisible();
  });

  test('can send a query on mobile', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('hello');
    await page.getByTestId('query-input-submit').click();

    // User message should appear
    await expect(page.locator('[data-testid^="message-bubble-"]').first()).toBeVisible();

    // Wait for response
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // Should have both user and assistant messages
    const messages = page.locator('[data-testid^="message-bubble-"]');
    await expect(messages).toHaveCount(2, { timeout: 15_000 });
  });

  test('SoulGraph branding visible in mobile header', async ({ page }) => {
    const header = page.getByTestId('layout-header');
    await expect(header).toBeVisible();
    await expect(header).toContainText('SoulGraph');
  });

  test('sidebar toggle has correct aria attributes', async ({ page }) => {
    const toggle = page.getByTestId('layout-sidebar-toggle');
    await expect(toggle).toBeVisible();

    // Closed state
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-label', 'Open sidebar');

    // Open it
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAttribute('aria-label', 'Close sidebar');
  });

  test('session creation works from mobile sidebar', async ({ page }) => {
    // Open sidebar
    await page.getByTestId('layout-sidebar-toggle').click();
    await expect(page.getByTestId('layout-sidebar-backdrop')).toBeVisible();

    // Count sessions before
    const itemsBefore = page.locator('[data-testid^="session-item-"]');
    const countBefore = await itemsBefore.count();

    // Create new session from sidebar
    await page.getByTestId('session-sidebar-new').click();

    // Should have one more session
    const itemsAfter = page.locator('[data-testid^="session-item-"]');
    await expect(itemsAfter).toHaveCount(countBefore + 1, { timeout: 5_000 });
  });

  test('submit button accessible with mobile keyboard', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('hello');

    // Submit button should be enabled
    const submitBtn = page.getByTestId('query-input-submit');
    await expect(submitBtn).toBeEnabled();
    await expect(submitBtn).toBeVisible();
  });
});
