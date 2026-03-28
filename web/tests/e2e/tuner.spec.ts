/**
 * E2E: Tuner Dashboard — params, history chart, reset.
 *
 * Tests the AgentTuner panel rendered from GET /tune/status.
 * Mock server returns deterministic tuner state with 3 history entries.
 * Uses data-testid selectors exclusively.
 *
 * Owner: Stark (P5) | Sprint Day 4
 */

import { test, expect } from '@playwright/test';

test.describe('Tuner Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('tuner dashboard is visible', async ({ page }) => {
    // TunerDashboard renders in the right panel (desktop only, lg+ breakpoint)
    // Playwright Desktop Chrome viewport is 1280x720 which satisfies lg
    const dashboard = page.getByTestId('tuner-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 10_000 });
  });

  test('displays "Agent Tuner" heading', async ({ page }) => {
    const dashboard = page.getByTestId('tuner-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 10_000 });
    await expect(dashboard).toContainText('Agent Tuner');
  });

  test('shows tuner parameters', async ({ page }) => {
    // Wait for tuner to load (fetches /tune/status)
    await expect(page.getByTestId('tuner-param-rag_k')).toBeVisible({ timeout: 10_000 });

    // rag_k = 5
    await expect(page.getByTestId('tuner-param-rag_k')).toContainText('5');

    // eval_threshold = 0.70
    await expect(page.getByTestId('tuner-param-eval_threshold')).toContainText('0.70');

    // prefer_reasoning_model = false → OFF
    await expect(page.getByTestId('tuner-param-prefer_reasoning_model')).toContainText('OFF');
  });

  test('shows evaluation history chart', async ({ page }) => {
    const chart = page.getByTestId('tuner-history-chart');
    await expect(chart).toBeVisible({ timeout: 10_000 });

    // Chart should have SVG with proper viewBox
    await expect(chart).toHaveAttribute('viewBox');

    // Chart should have aria-label for accessibility
    await expect(chart).toHaveAttribute('aria-label', 'Evaluation history chart');
  });

  test('shows eval count from mock data', async ({ page }) => {
    const dashboard = page.getByTestId('tuner-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 10_000 });

    // Mock returns 3 history entries
    await expect(dashboard).toContainText('3 evals');
  });

  test('reset button is visible', async ({ page }) => {
    const resetBtn = page.getByTestId('tuner-reset-btn');
    await expect(resetBtn).toBeVisible({ timeout: 10_000 });
    await expect(resetBtn).toContainText('Reset Tuner');
  });

  test('reset button shows confirmation on first click', async ({ page }) => {
    const resetBtn = page.getByTestId('tuner-reset-btn');
    await expect(resetBtn).toBeVisible({ timeout: 10_000 });

    // First click → confirmation state
    await resetBtn.click();
    await expect(resetBtn).toContainText('Confirm Reset');
  });

  test('reset button completes on double click', async ({ page }) => {
    const resetBtn = page.getByTestId('tuner-reset-btn');
    await expect(resetBtn).toBeVisible({ timeout: 10_000 });

    // First click → confirm, second click → execute
    await resetBtn.click();
    await expect(resetBtn).toContainText('Confirm Reset');
    await resetBtn.click();

    // Should show "Resetting..." briefly then return to "Reset Tuner"
    await expect(resetBtn).toContainText('Reset Tuner', { timeout: 5_000 });
  });

  test('chart legend shows metric names', async ({ page }) => {
    const dashboard = page.getByTestId('tuner-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 10_000 });

    // Legend items from METRIC_LINES
    await expect(dashboard).toContainText('Faith.');
    await expect(dashboard).toContainText('Relev.');
    await expect(dashboard).toContainText('Prec.');
    await expect(dashboard).toContainText('Recall');
    await expect(dashboard).toContainText('Threshold');
  });

  test('tuner refreshes after query', async ({ page }) => {
    // Wait for initial tuner load
    await expect(page.getByTestId('tuner-dashboard')).toBeVisible({ timeout: 10_000 });

    // Send a query
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('hello');
    await page.getByTestId('query-input-submit').click();

    // Wait for response to complete
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // Tuner should still be visible (auto-refresh or post-query refresh)
    await expect(page.getByTestId('tuner-dashboard')).toBeVisible();
    await expect(page.getByTestId('tuner-param-rag_k')).toContainText('5');
  });
});
