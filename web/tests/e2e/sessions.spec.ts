/**
 * E2E: Sessions — create, switch, delete sessions.
 *
 * Tests session lifecycle against the mock-ws backend.
 * Uses data-testid selectors exclusively.
 *
 * Owner: Stark (P5) | Sprint Day 4
 */

import { test, expect } from '@playwright/test';

test.describe('Sessions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('default session exists on first load', async ({ page }) => {
    // SessionSidebar should have at least one session item
    const sidebar = page.getByTestId('session-sidebar');
    await expect(sidebar).toBeVisible();

    // Should NOT show empty state (useSessions auto-creates a default)
    await expect(page.getByTestId('session-sidebar-empty')).not.toBeVisible();
  });

  test('new session button is visible', async ({ page }) => {
    const newBtn = page.getByTestId('session-sidebar-new');
    await expect(newBtn).toBeVisible();
    await expect(newBtn).toContainText('New Session');
  });

  test('create a new session', async ({ page }) => {
    // Count initial sessions
    const initialItems = page.locator('[data-testid^="session-item-"]');
    const initialCount = await initialItems.count();

    // Click "New Session"
    await page.getByTestId('session-sidebar-new').click();

    // Should have one more session
    const afterItems = page.locator('[data-testid^="session-item-"]');
    await expect(afterItems).toHaveCount(initialCount + 1);
  });

  test('new session becomes active', async ({ page }) => {
    // Create a new session
    await page.getByTestId('session-sidebar-new').click();

    // The newest session should have aria-current="true"
    const sessionItems = page.locator('[data-testid^="session-item-"]');
    const newest = sessionItems.first(); // Sessions prepend
    await expect(newest).toHaveAttribute('aria-current', 'true');
  });

  test('switch between sessions', async ({ page }) => {
    // Create a second session
    await page.getByTestId('session-sidebar-new').click();

    const sessionItems = page.locator('[data-testid^="session-item-"]');
    const count = await sessionItems.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Click the last (oldest) session
    const oldest = sessionItems.last();
    await oldest.click();

    // Oldest should now be active
    await expect(oldest).toHaveAttribute('aria-current', 'true');

    // First (newest) should not be active
    const newest = sessionItems.first();
    await expect(newest).not.toHaveAttribute('aria-current', 'true');
  });

  test('switching sessions updates active session', async ({ page }) => {
    // Send a message in the first session
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('hello');
    await page.getByTestId('query-input-submit').click();

    // Wait for response
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // Create a new session
    await page.getByTestId('session-sidebar-new').click();

    // The new session should now be active (aria-current on the newest item)
    const sessionItems = page.locator('[data-testid^="session-item-"]');
    const newest = sessionItems.first();
    await expect(newest).toHaveAttribute('aria-current', 'true');

    // The textarea should be ready for input (not disabled from streaming)
    await expect(textarea).toBeEnabled();
  });

  test('delete a session', async ({ page }) => {
    // Create an extra session so we have at least 2
    await page.getByTestId('session-sidebar-new').click();

    const itemsBefore = page.locator('[data-testid^="session-item-"]');
    const countBefore = await itemsBefore.count();

    // Find the delete button for the last session
    const deleteBtns = page.locator('[data-testid^="session-delete-"]');
    const lastDelete = deleteBtns.last();

    // Hover to reveal (delete is opacity-0 until hover)
    const lastItem = itemsBefore.last();
    await lastItem.hover();
    await lastDelete.click();

    // Should have one fewer session
    const itemsAfter = page.locator('[data-testid^="session-item-"]');
    await expect(itemsAfter).toHaveCount(countBefore - 1, { timeout: 5_000 });
  });

  test('deleting active session switches to another', async ({ page }) => {
    // Create a second session (it becomes active)
    await page.getByTestId('session-sidebar-new').click();

    const sessionItems = page.locator('[data-testid^="session-item-"]');
    const count = await sessionItems.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Delete the active (first/newest) session
    const firstItem = sessionItems.first();
    await firstItem.hover();
    const deleteBtns = page.locator('[data-testid^="session-delete-"]');
    await deleteBtns.first().click();

    // Some other session should now be active
    const remaining = page.locator('[data-testid^="session-item-"]');
    await expect(remaining).toHaveCount(count - 1, { timeout: 5_000 });

    // At least one should have aria-current
    const activeItem = page.locator('[data-testid^="session-item-"][aria-current="true"]');
    await expect(activeItem).toHaveCount(1);
  });

  test('sessions persist across page reload', async ({ page }) => {
    // Create a second session
    await page.getByTestId('session-sidebar-new').click();

    const itemsBefore = page.locator('[data-testid^="session-item-"]');
    const countBefore = await itemsBefore.count();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still have the same number of sessions
    const itemsAfter = page.locator('[data-testid^="session-item-"]');
    await expect(itemsAfter).toHaveCount(countBefore, { timeout: 5_000 });
  });

  test('session labels are sequential', async ({ page }) => {
    // Get the default session's label
    const labels = page.locator('[data-testid^="session-label-"]');
    const firstLabel = await labels.first().textContent();

    // Create a second session
    await page.getByTestId('session-sidebar-new').click();

    // The new session should have a different label
    const labelsAfter = page.locator('[data-testid^="session-label-"]');
    const newestLabel = await labelsAfter.first().textContent();
    expect(newestLabel).not.toBe(firstLabel);
  });
});
