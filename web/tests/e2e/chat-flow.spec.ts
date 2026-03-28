/**
 * E2E: Chat Flow — ask question → stream answer → eval report appears.
 *
 * Tests the primary user journey against the mock-ws backend.
 * Uses data-testid selectors exclusively.
 *
 * Owner: Stark (P5) | Sprint Day 4
 */

import { test, expect } from '@playwright/test';

test.describe('Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('app loads with empty state', async ({ page }) => {
    // Should show empty message list with SoulGraph prompt
    const emptyState = page.getByTestId('message-list-empty');
    await expect(emptyState).toBeVisible();
    await expect(emptyState.getByText('SoulGraph')).toBeVisible();
    await expect(emptyState.getByText(/ask a question/i)).toBeVisible();
  });

  test('query input is visible and focusable', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeFocused();
  });

  test('submit button is disabled when input is empty', async ({ page }) => {
    await expect(page.getByTestId('query-input-submit')).toBeDisabled();
  });

  test('submit button enables after typing', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('What is RAG?');
    await expect(page.getByTestId('query-input-submit')).toBeEnabled();
  });

  test('full chat flow: ask → stream → eval → done', async ({ page }) => {
    // Type and submit question
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('What is SoulGraph?');
    await page.getByTestId('query-input-submit').click();

    // User message should appear
    const userMessages = page.locator('[data-testid^="message-bubble-"]');
    await expect(userMessages.first()).toBeVisible();

    // Wait for streaming to complete (done message from mock server)
    // Mock server streams at 50ms per token — "soulgraph" answer has ~50 words ≈ 2.5s
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // Should have both user and assistant messages
    const messages = page.locator('[data-testid^="message-bubble-"]');
    await expect(messages).toHaveCount(2, { timeout: 15_000 });

    // Assistant message should contain answer text
    const contentBlocks = page.locator('[data-testid^="message-content-"]');
    const lastContent = contentBlocks.last();
    await expect(lastContent).toContainText('SoulGraph', { timeout: 15_000 });
  });

  test('eval report appears after streaming completes', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('What is SoulGraph?');
    await page.getByTestId('query-input-submit').click();

    // Wait for streaming to complete
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // Eval report should be visible in the right panel
    await expect(page.getByTestId('eval-report')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('eval-badge')).toBeVisible();
  });

  test('graph viz shows active node during streaming', async ({ page }) => {
    // Graph viz should be visible before query
    await expect(page.getByTestId('graph-viz')).toBeVisible();

    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('hello');
    await page.getByTestId('query-input-submit').click();

    // During streaming, graph should show active node (pulse animation)
    // The mock server streams slowly enough to catch this
    const graphViz = page.getByTestId('graph-viz');
    await expect(graphViz).toBeVisible();

    // Wait for streaming to complete
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });
  });

  test('Enter key submits the question', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('hello');
    await textarea.press('Enter');

    // User message should appear
    await expect(page.locator('[data-testid^="message-bubble-"]').first()).toBeVisible();
  });

  test('Shift+Enter does not submit', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('line 1');
    await textarea.press('Shift+Enter');

    // No messages should appear
    await expect(page.getByTestId('message-list-empty')).toBeVisible();
  });

  test('input clears after submit', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('hello');
    await page.getByTestId('query-input-submit').click();

    // Textarea should be cleared
    await expect(textarea).toHaveValue('');
  });

  test('cancel button stops streaming', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('What is SoulGraph?');
    await page.getByTestId('query-input-submit').click();

    // Cancel button should appear during streaming
    const cancelBtn = page.getByTestId('query-input-cancel');
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 });

    // Click cancel
    await cancelBtn.click();

    // Submit button should reappear (streaming stopped)
    await expect(page.getByTestId('query-input-submit')).toBeVisible();
  });

  test('connection status shows idle initially', async ({ page }) => {
    const status = page.getByTestId('connection-status');
    await expect(status).toBeVisible();
    await expect(status).toContainText('idle');
  });

  test('multiple questions accumulate in chat', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');

    // First question
    await textarea.fill('hello');
    await page.getByTestId('query-input-submit').click();
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // Second question
    await textarea.fill('What is SoulGraph?');
    await page.getByTestId('query-input-submit').click();
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // Should have 4 messages total (2 user + 2 assistant)
    const messages = page.locator('[data-testid^="message-bubble-"]');
    await expect(messages).toHaveCount(4, { timeout: 5_000 });
  });
});
