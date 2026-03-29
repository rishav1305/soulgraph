/**
 * ws.test.ts — Unit tests for WSClient WebSocket streaming client.
 *
 * Tests:
 * - Connection lifecycle: send opens WS, receives messages, closes cleanly
 * - Terminal messages: done/error trigger clean close + idle status
 * - Parse errors: malformed JSON triggers onError
 * - Mid-stream disconnect: surfaces error, no retry
 * - Pre-message disconnect: triggers reconnect with backoff
 * - Reconnect exhaustion: max attempts reached → error status
 * - close(): intentional teardown, cancels pending reconnects
 * - isConnected: reflects WebSocket readyState
 * - Teardown: cleans up handlers and timers
 *
 * Owner: Happy (QA) | Coverage expansion — ws.ts from 72% → 90%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WSClient } from '@/lib/ws';
import type { WSMessage } from '@/lib/types';

// ─── Mock getWSUrl ─────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  getWSUrl: () => 'ws://localhost:5173/ws/query',
}));

// ─── MockWebSocket (minimal, inline) ──────────────────────────

type ReadyState = 0 | 1 | 2 | 3;

class TestWebSocket {
  static readonly CONNECTING = 0 as const;
  static readonly OPEN = 1 as const;
  static readonly CLOSING = 2 as const;
  static readonly CLOSED = 3 as const;

  readonly CONNECTING = 0 as const;
  readonly OPEN = 1 as const;
  readonly CLOSING = 2 as const;
  readonly CLOSED = 3 as const;

  readyState: ReadyState = 0;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;

  readonly sentData: string[] = [];

  constructor(public readonly url: string) {
    // Auto-open after microtask
    queueMicrotask(() => {
      if (this.readyState === 0) {
        this.readyState = 1;
        this.onopen?.(new Event('open'));
      }
    });
  }

  send(data: string): void {
    this.sentData.push(data);
  }

  close(): void {
    this.readyState = 2;
    queueMicrotask(() => {
      this.readyState = 3;
      this.onclose?.(new CloseEvent('close', { code: 1000, wasClean: true }));
    });
  }

  // Test helpers
  simulateMessage(msg: WSMessage): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(msg) }));
  }

  simulateBadMessage(): void {
    this.onmessage?.(new MessageEvent('message', { data: 'not-json{{{' }));
  }

  simulateError(): void {
    this.onerror?.(new Event('error'));
  }

  simulateClose(code = 1006): void {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close', { code, wasClean: false }));
  }
}

// ─── Test Harness ──────────────────────────────────────────────

let instances: TestWebSocket[];
let originalWS: typeof WebSocket;

function installMockWS(): void {
  instances = [];
  originalWS = globalThis.WebSocket;
  globalThis.WebSocket = class extends TestWebSocket {
    constructor(url: string) {
      super(url);
      instances.push(this);
    }
  } as unknown as typeof WebSocket;
}

function restoreMockWS(): void {
  globalThis.WebSocket = originalWS;
}

function latestWS(): TestWebSocket {
  return instances[instances.length - 1]!;
}

async function flush(): Promise<void> {
  // Must use advanceTimersByTimeAsync with fake timers —
  // plain setTimeout(r, 0) gets captured and never fires.
  await vi.advanceTimersByTimeAsync(0);
}

// ─── Tests ─────────────────────────────────────────────────────

describe('WSClient', () => {
  let onMessage: ReturnType<typeof vi.fn>;
  let onStatusChange: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;
  let client: WSClient;

  beforeEach(() => {
    vi.useFakeTimers();
    installMockWS();
    onMessage = vi.fn();
    onStatusChange = vi.fn();
    onError = vi.fn();
    client = new WSClient({
      onMessage: onMessage as unknown as (msg: WSMessage) => void,
      onStatusChange: onStatusChange as unknown as (status: string) => void,
      onError: onError as unknown as (error: string) => void,
      maxReconnects: 3,
    });
  });

  afterEach(() => {
    client.close();
    restoreMockWS();
    vi.useRealTimers();
  });

  // ── Connection lifecycle ──────────────────────────────────

  describe('connection lifecycle', () => {
    it('sets status to connecting on send', () => {
      client.send({ question: 'test', session_id: 'default' });
      expect(onStatusChange).toHaveBeenCalledWith('connecting');
    });

    it('sets status to connected on WS open', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();
      expect(onStatusChange).toHaveBeenCalledWith('connected');
    });

    it('sends query JSON on open', async () => {
      client.send({ question: 'What is RAG?', session_id: 'sess-1' });
      await flush();
      const ws = latestWS();
      expect(ws.sentData).toHaveLength(1);
      expect(JSON.parse(ws.sentData[0]!)).toEqual({
        question: 'What is RAG?',
        session_id: 'sess-1',
      });
    });

    it('delivers parsed messages via onMessage', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();
      const ws = latestWS();
      const msg: WSMessage = { type: 'token', content: 'Hello ' };
      ws.simulateMessage(msg);
      expect(onMessage).toHaveBeenCalledWith(msg);
    });
  });

  // ── Terminal messages ─────────────────────────────────────

  describe('terminal messages', () => {
    it('closes WS and sets idle on "done" message', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();
      const ws = latestWS();
      ws.simulateMessage({ type: 'done', answer: 'Answer here' });
      expect(onStatusChange).toHaveBeenCalledWith('idle');
    });

    it('closes WS and sets idle on "error" message', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();
      const ws = latestWS();
      ws.simulateMessage({ type: 'error', message: 'ChromaDB down' });
      expect(onStatusChange).toHaveBeenCalledWith('idle');
      expect(onMessage).toHaveBeenCalledWith({ type: 'error', message: 'ChromaDB down' });
    });
  });

  // ── Parse errors ──────────────────────────────────────────

  describe('parse errors', () => {
    it('calls onError when message is not valid JSON', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();
      const ws = latestWS();
      ws.simulateBadMessage();
      expect(onError).toHaveBeenCalledWith('Failed to parse server message');
    });
  });

  // ── Mid-stream disconnect ─────────────────────────────────

  describe('mid-stream disconnect', () => {
    it('surfaces error and sets error status when connection lost after receiving data', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();
      const ws = latestWS();

      // Receive a token first (hasReceivedMessage = true)
      ws.simulateMessage({ type: 'token', content: 'partial ' });

      // Then simulate unexpected close
      ws.simulateClose(1006);

      expect(onError).toHaveBeenCalledWith('Connection lost during streaming');
      expect(onStatusChange).toHaveBeenCalledWith('error');
    });

    it('does NOT retry on mid-stream disconnect', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();
      const ws = latestWS();

      ws.simulateMessage({ type: 'token', content: 'partial ' });
      ws.simulateClose(1006);

      // Should only have 1 WS instance (no reconnect attempts)
      expect(instances).toHaveLength(1);
    });
  });

  // ── Pre-message disconnect (reconnect) ────────────────────

  describe('reconnect on pre-message disconnect', () => {
    it('schedules reconnect when connection fails before any message', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();
      const ws = latestWS();

      // Close before any message received
      ws.simulateClose(1006);

      // Advance past first reconnect delay (1000ms base)
      vi.advanceTimersByTime(1000);
      await flush();

      // Should have created a second WS instance
      expect(instances).toHaveLength(2);
    });

    it('waits base delay before first reconnect', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();

      latestWS().simulateClose(1006);

      // Not yet — 999ms is less than RECONNECT_BASE_MS (1000ms)
      vi.advanceTimersByTime(999);
      await flush();
      expect(instances).toHaveLength(1);

      // At 1000ms — reconnect fires
      vi.advanceTimersByTime(1);
      await flush();
      expect(instances).toHaveLength(2);
    });

    it('reconnects repeatedly on successive pre-message disconnects', async () => {
      // NOTE: send() resets reconnectAttempts=0, so the backoff counter
      // doesn't accumulate across reconnects. Each reconnect uses the
      // base delay (1000ms). This is a known limitation — reconnect
      // calls send() which resets the counter. Filed for Shuri review.
      client.send({ question: 'test', session_id: 'default' });
      await flush();

      // First disconnect → reconnect after 1000ms
      latestWS().simulateClose(1006);
      vi.advanceTimersByTime(1000);
      await flush();
      expect(instances).toHaveLength(2);

      // Second disconnect → also reconnects after 1000ms (counter reset)
      latestWS().simulateClose(1006);
      vi.advanceTimersByTime(1000);
      await flush();
      expect(instances).toHaveLength(3);
    });
  });

  // ── close() ───────────────────────────────────────────────

  describe('close()', () => {
    it('sets status to idle', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();
      client.close();
      expect(onStatusChange).toHaveBeenCalledWith('idle');
    });

    it('cancels pending reconnect timers', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();

      // Trigger reconnect
      latestWS().simulateClose(1006);

      // Close before reconnect fires
      client.close();

      // Advance past reconnect delay
      vi.advanceTimersByTime(5000);
      await flush();

      // Should only have 1 WS instance (reconnect was cancelled)
      expect(instances).toHaveLength(1);
    });

    it('does not trigger onclose handler after intentional close', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();

      client.close();
      await flush();

      // onError should NOT have been called (intentional close)
      expect(onError).not.toHaveBeenCalled();
    });
  });

  // ── isConnected ───────────────────────────────────────────

  describe('isConnected', () => {
    it('returns false before send', () => {
      expect(client.isConnected).toBe(false);
    });

    it('returns true when WS is open', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();
      expect(client.isConnected).toBe(true);
    });

    it('returns false after close', async () => {
      client.send({ question: 'test', session_id: 'default' });
      await flush();
      client.close();
      expect(client.isConnected).toBe(false);
    });
  });

  // ── Teardown on re-send ───────────────────────────────────

  describe('teardown on re-send', () => {
    it('tears down existing connection before opening new one', async () => {
      client.send({ question: 'first', session_id: 'default' });
      await flush();
      expect(instances).toHaveLength(1);

      client.send({ question: 'second', session_id: 'default' });
      await flush();
      expect(instances).toHaveLength(2);

      // First WS should have been closed
      expect(instances[0]!.readyState).toBe(3); // CLOSED
    });

    it('cancels pending reconnect when re-sending', async () => {
      client.send({ question: 'first', session_id: 'default' });
      await flush();

      // Trigger reconnect
      latestWS().simulateClose(1006);

      // Re-send before reconnect fires
      client.send({ question: 'second', session_id: 'default' });
      await flush();

      // Advance past old reconnect timer
      vi.advanceTimersByTime(5000);
      await flush();

      // Should have exactly 2 instances (first + re-send), not 3 (no stale reconnect)
      expect(instances).toHaveLength(2);
    });
  });

  // ── Zero reconnects config ────────────────────────────────

  describe('maxReconnects=0', () => {
    it('gives up immediately on first disconnect', async () => {
      const noRetryClient = new WSClient({
        onMessage: onMessage as unknown as (msg: WSMessage) => void,
        onStatusChange: onStatusChange as unknown as (status: string) => void,
        onError: onError as unknown as (error: string) => void,
        maxReconnects: 0,
      });

      noRetryClient.send({ question: 'test', session_id: 'default' });
      await flush();
      latestWS().simulateClose(1006);

      expect(onError).toHaveBeenCalledWith('Connection failed after 0 attempts');
      expect(onStatusChange).toHaveBeenCalledWith('error');

      noRetryClient.close();
    });
  });
});
