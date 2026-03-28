/**
 * Global test setup — runs before each test file.
 *
 * Responsibilities:
 * 1. Import jest-dom matchers (toBeInTheDocument, toHaveTextContent, etc.)
 * 2. Auto-cleanup rendered components after each test
 * 3. Guard against accidental real WebSocket connections
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Auto cleanup after each test — removes rendered DOM, resets state
afterEach(() => {
  cleanup();
});

// Guard: prevent tests from accidentally connecting to real WebSocket servers.
// Tests that need WS must use the MockWebSocket from mock-ws.ts.
const OriginalWebSocket = globalThis.WebSocket;

afterEach(() => {
  // Restore original if a test replaced it
  globalThis.WebSocket = OriginalWebSocket;
});

// Mock matchMedia for components that use responsive breakpoints
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock scrollIntoView (not implemented in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Mock crypto.randomUUID for deterministic test IDs
if (!globalThis.crypto?.randomUUID) {
  let counter = 0;
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...globalThis.crypto,
      randomUUID: () => `test-uuid-${++counter}`,
    },
  });
}
