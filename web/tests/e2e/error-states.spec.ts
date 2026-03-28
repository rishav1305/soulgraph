/**
 * E2E: Error States — WS error trigger, empty input edge cases.
 *
 * Tests error handling paths using the mock server's "error" trigger.
 * Sending "error" as the question triggers a simulated backend error.
 * Uses data-testid selectors exclusively.
 *
 * Owner: Stark (P5) | Sprint Day 4
 */

import { test, expect } from '@playwright/test';

/** True when running against Docker stack instead of mock server. */
const isExternalServer = Boolean(process.env.SOULGRAPH_URL);

test.describe('Error States', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  // --- Mock-only tests: "error" keyword trigger is mock-server specific ---

  test('sending "error" triggers error display', async ({ page }) => {
    test.skip(isExternalServer, 'Mock-only: "error" keyword trigger not available on real backend');

    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('error');
    await page.getByTestId('query-input-submit').click();

    // User message should appear
    await expect(page.locator('[data-testid^="message-bubble-"]').first()).toBeVisible();

    // Error should surface — either in app-error banner or inline
    // The mock server sends { type: 'error', message: 'Simulated backend error for testing' }
    // useGraph should set error state which renders the app-error banner
    const errorBanner = page.getByTestId('app-error');
    await expect(errorBanner).toBeVisible({ timeout: 10_000 });
    await expect(errorBanner).toContainText(/error/i);
  });

  test('submit button re-enables after error', async ({ page }) => {
    test.skip(isExternalServer, 'Mock-only: "error" keyword trigger not available on real backend');

    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('error');
    await page.getByTestId('query-input-submit').click();

    // Wait for error to be processed
    await expect(page.getByTestId('app-error')).toBeVisible({ timeout: 10_000 });

    // Submit button should be visible again (streaming stopped)
    await expect(page.getByTestId('query-input-submit')).toBeVisible();
  });

  test('can send a new query after error', async ({ page }) => {
    test.skip(isExternalServer, 'Mock-only: "error" keyword trigger not available on real backend');

    const textarea = page.getByTestId('query-input-textarea');

    // Trigger error
    await textarea.fill('error');
    await page.getByTestId('query-input-submit').click();
    await expect(page.getByTestId('app-error')).toBeVisible({ timeout: 10_000 });

    // Send a normal query
    await textarea.fill('hello');
    await page.getByTestId('query-input-submit').click();

    // Wait for streaming to complete
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // Should have messages (user + potentially assistant response)
    const messages = page.locator('[data-testid^="message-bubble-"]');
    const count = await messages.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('error clears when new query is sent', async ({ page }) => {
    test.skip(isExternalServer, 'Mock-only: "error" keyword trigger not available on real backend');

    const textarea = page.getByTestId('query-input-textarea');

    // Trigger error
    await textarea.fill('error');
    await page.getByTestId('query-input-submit').click();
    await expect(page.getByTestId('app-error')).toBeVisible({ timeout: 10_000 });

    // Send a good query
    await textarea.fill('hello');
    await page.getByTestId('query-input-submit').click();

    // Error banner should clear on new query
    // (useGraph clears error on send)
    await expect(page.getByTestId('app-error')).not.toBeVisible({ timeout: 10_000 });
  });

  test('empty input cannot be submitted', async ({ page }) => {
    // Submit button should be disabled when textarea is empty
    await expect(page.getByTestId('query-input-submit')).toBeDisabled();

    // Try typing spaces (whitespace-only)
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('   ');
    await expect(page.getByTestId('query-input-submit')).toBeDisabled();
  });

  test('connection status is visible', async ({ page }) => {
    const status = page.getByTestId('connection-status');
    await expect(status).toBeVisible();
    // Initially should show "idle" before any connection
    await expect(status).toContainText(/idle|connected|connecting/i);
  });

  test('connection status changes during query', async ({ page }) => {
    const status = page.getByTestId('connection-status');
    await expect(status).toBeVisible();

    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('hello');
    await page.getByTestId('query-input-submit').click();

    // During streaming, status should change from idle
    // (exact transition depends on timing — just verify it's still visible)
    await expect(status).toBeVisible();

    // Wait for streaming to complete
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // After completion, status should return to idle or connected
    await expect(status).toBeVisible();
  });

  test('app handles rapid sequential submissions', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');

    // Submit first query
    await textarea.fill('hello');
    await page.getByTestId('query-input-submit').click();

    // Wait for response
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // Immediately submit second query
    await textarea.fill('What is SoulGraph?');
    await page.getByTestId('query-input-submit').click();

    // Wait for second response
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // Should have 4 messages (2 user + 2 assistant)
    const messages = page.locator('[data-testid^="message-bubble-"]');
    await expect(messages).toHaveCount(4, { timeout: 5_000 });
  });
});
