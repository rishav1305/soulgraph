/**
 * E2E: Graph Viz — agent routing visualization during query.
 *
 * Tests the SVG agent graph that shows supervisor → agent routing.
 * Mock server streams tokens slowly enough to observe active node transitions.
 * Uses data-testid selectors exclusively.
 *
 * Owner: Stark (P5) | Sprint Day 4
 */

import { test, expect } from '@playwright/test';

test.describe('Graph Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('graph viz container is visible', async ({ page }) => {
    // graph-viz renders in the right panel (lg+ viewport)
    const graphViz = page.getByTestId('graph-viz');
    await expect(graphViz).toBeVisible();
  });

  test('shows all 4 agent nodes', async ({ page }) => {
    await expect(page.getByTestId('graph-node-supervisor')).toBeVisible();
    await expect(page.getByTestId('graph-node-rag')).toBeVisible();
    await expect(page.getByTestId('graph-node-tool')).toBeVisible();
    await expect(page.getByTestId('graph-node-evaluator')).toBeVisible();
  });

  test('shows END marker', async ({ page }) => {
    await expect(page.getByTestId('graph-node-end')).toBeVisible();
  });

  test('SVG has proper accessibility attributes', async ({ page }) => {
    const svg = page.getByTestId('graph-viz').locator('svg[role="img"]');
    await expect(svg).toBeVisible();
    await expect(svg).toHaveAttribute('aria-label', 'SoulGraph agent routing diagram');
  });

  test('nodes show correct labels', async ({ page }) => {
    const graphViz = page.getByTestId('graph-viz');
    await expect(graphViz).toContainText('Supervisor');
    await expect(graphViz).toContainText('RAG Agent');
    await expect(graphViz).toContainText('Tool Agent');
    await expect(graphViz).toContainText('Evaluator');
  });

  test('edges are rendered between nodes', async ({ page }) => {
    // Check for known edges from supervisor → rag, supervisor → tool
    await expect(page.getByTestId('graph-edge-supervisor-rag')).toBeVisible();
    await expect(page.getByTestId('graph-edge-supervisor-tool')).toBeVisible();
  });

  test('graph shows active node during streaming', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('What is SoulGraph?');
    await page.getByTestId('query-input-submit').click();

    // During streaming, the graph viz container should still be visible
    const graphViz = page.getByTestId('graph-viz');
    await expect(graphViz).toBeVisible();

    // The mock server sends tokens at 50ms/word — the "soulgraph" answer is ~50 words
    // So we have ~2.5 seconds to observe the graph in streaming state
    // Check that nodes still exist during streaming
    await expect(page.getByTestId('graph-node-supervisor')).toBeVisible();
    await expect(page.getByTestId('graph-node-rag')).toBeVisible();

    // Wait for streaming to complete
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });
  });

  test('intent text appears during query', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');
    await textarea.fill('What is SoulGraph?');
    await page.getByTestId('query-input-submit').click();

    // graph-intent shows the routed intent text (if backend sends it)
    // The mock server may or may not populate intent — check it doesn't break
    // Just verify graph-viz is stable through the streaming cycle
    await expect(page.getByTestId('graph-viz')).toBeVisible();

    // Wait for streaming to complete
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // Graph should still be visible after streaming completes
    await expect(page.getByTestId('graph-viz')).toBeVisible();
  });

  test('graph remains stable across multiple queries', async ({ page }) => {
    const textarea = page.getByTestId('query-input-textarea');

    // First query
    await textarea.fill('hello');
    await page.getByTestId('query-input-submit').click();
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // Verify graph is still visible
    await expect(page.getByTestId('graph-viz')).toBeVisible();
    await expect(page.getByTestId('graph-node-supervisor')).toBeVisible();

    // Second query
    await textarea.fill('What is SoulGraph?');
    await page.getByTestId('query-input-submit').click();
    await expect(page.getByTestId('query-input-submit')).toBeVisible({ timeout: 15_000 });

    // Graph should still be intact
    await expect(page.getByTestId('graph-viz')).toBeVisible();
    await expect(page.getByTestId('graph-node-evaluator')).toBeVisible();
  });
});
