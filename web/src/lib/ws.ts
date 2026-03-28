/**
 * ws.ts — WebSocket streaming client for SoulGraph.
 *
 * Manages connection lifecycle, message parsing, and reconnection.
 * Used by useGraph hook — not called directly by components.
 *
 * Protocol (matches soulgraph/api.py /ws/query):
 *   Client → Server: { question: string, session_id: string }
 *   Server → Client: { type: 'token', content: string }  (one per word)
 *                     { type: 'eval',  report: EvalReport }
 *                     { type: 'done',  answer: string }
 *                     { type: 'error', message: string }
 */

import type { QueryMessage, WSMessage } from './types';
import { getWSUrl } from './api';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

/** Base delay between reconnection attempts (ms). */
const RECONNECT_BASE_MS = 1_000;

/** Maximum reconnection delay cap (ms). */
const RECONNECT_MAX_MS = 30_000;

/** Exponential backoff multiplier. */
const RECONNECT_FACTOR = 2;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface WSClientOptions {
  /** Called for every parsed WSMessage from the server. */
  onMessage: (msg: WSMessage) => void;
  /** Called when connection status changes. */
  onStatusChange: (status: ConnectionStatus) => void;
  /** Called on unrecoverable error (connection lost, parse failure, etc). */
  onError: (error: string) => void;
  /** Max reconnection attempts before giving up. 0 = no auto-reconnect. Default: 3. */
  maxReconnects?: number;
}

// ─────────────────────────────────────────────────────────────
// WSClient
// ─────────────────────────────────────────────────────────────

/**
 * Manages a single query-response WebSocket session.
 *
 * Lifecycle:
 *   1. `send(query)` opens a WS, sends the query JSON
 *   2. Server streams token → eval → done/error
 *   3. On done/error, WS is closed cleanly
 *   4. On unexpected close before any message: retry with backoff
 *   5. On unexpected close mid-stream: surface error (no retry — partial data)
 *   6. `close()` tears down immediately, cancelling any pending reconnect
 */
export class WSClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private hasReceivedMessage = false;
  private readonly maxReconnects: number;
  private readonly options: WSClientOptions;

  constructor(options: WSClientOptions) {
    this.options = options;
    this.maxReconnects = options.maxReconnects ?? 3;
  }

  // ─────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────

  /** Open a new WebSocket connection and send the query. */
  send(query: QueryMessage): void {
    // Tear down any existing connection first.
    this.teardown();
    this.intentionallyClosed = false;
    this.hasReceivedMessage = false;
    this.reconnectAttempts = 0;
    this.options.onStatusChange('connecting');

    const url = getWSUrl();
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.options.onStatusChange('connected');
      this.ws?.send(JSON.stringify(query));
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.hasReceivedMessage = true;
      try {
        const msg = JSON.parse(event.data as string) as WSMessage;
        this.options.onMessage(msg);

        // Terminal messages — close cleanly.
        if (msg.type === 'done' || msg.type === 'error') {
          this.intentionallyClosed = true;
          this.ws?.close();
          this.options.onStatusChange('idle');
        }
      } catch {
        this.options.onError('Failed to parse server message');
      }
    };

    this.ws.onerror = () => {
      // onerror is always followed by onclose — handle reconnect there.
    };

    this.ws.onclose = () => {
      if (this.intentionallyClosed) return;

      if (this.hasReceivedMessage) {
        // Mid-stream disconnect — don't retry (partial data is unreliable).
        this.options.onError('Connection lost during streaming');
        this.options.onStatusChange('error');
      } else {
        // Connection failed before any data — retry with backoff.
        this.scheduleReconnect(query);
      }
    };
  }

  /** Close the connection and cancel any pending reconnection. */
  close(): void {
    this.intentionallyClosed = true;
    this.teardown();
    this.options.onStatusChange('idle');
  }

  /** True if the underlying WebSocket is currently open. */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ─────────────────────────────────────────────────────────
  // Internals
  // ─────────────────────────────────────────────────────────

  /** Detach all handlers and close the socket. */
  private teardown(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws !== null) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  /** Schedule a reconnection attempt with exponential backoff. */
  private scheduleReconnect(query: QueryMessage): void {
    if (this.reconnectAttempts >= this.maxReconnects) {
      this.options.onError(
        `Connection failed after ${this.maxReconnects} attempts`,
      );
      this.options.onStatusChange('error');
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_MS * RECONNECT_FACTOR ** this.reconnectAttempts,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.send(query);
    }, delay);
  }
}
