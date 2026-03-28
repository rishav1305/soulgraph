/**
 * MockWebSocket — deterministic WebSocket mock for testing useGraph and WS-dependent components.
 *
 * Matches the EXACT SoulGraph WS protocol:
 *   Client → Server: { question: string, session_id: string }
 *   Server → Client: { type: "token", content: "<word> " }
 *                     { type: "eval", report: {...} }
 *                     { type: "done", answer: "<full answer>" }
 *                     { type: "error", message: "<error text>" }
 *
 * Usage:
 *   const mock = installMockWebSocket(scenarios.happyPath);
 *   // ... trigger hook/component that opens a WebSocket ...
 *   await mock.waitForSend();       // wait for client to send the question
 *   await mock.streamAllMessages(); // deliver all tokens + eval + done
 *   expect(mock.receivedMessages).toHaveLength(1);
 */

import type { EvalReport, WSMessage } from '@/lib/types';

// ─── Scenario Definition ────────────────────────────────────

export interface MockWSScenario {
  /** Answer to stream token-by-token. Empty string = no tokens. */
  answer: string;
  /** Eval report to send after tokens. Omit or undefined = no eval message. */
  evalReport?: EvalReport;
  /** If set, send an error message instead of streaming answer. */
  error?: string;
  /** Delay between token messages in ms (default: 0). */
  tokenDelay?: number;
  /** Disconnect after N token messages (simulates server crash mid-stream). */
  disconnectAfterTokens?: number;
}

// ─── Pre-built Scenarios ────────────────────────────────────

export const scenarios = {
  happyPath: {
    answer: 'RAG combines retrieval with generation for grounded answers.',
    evalReport: {
      question: 'What is RAG?',
      answer_length: 58,
      num_documents: 3,
      scores: {
        faithfulness: 0.92,
        answer_relevancy: 0.88,
        context_precision: 0.85,
        context_recall: 0.9,
      },
      passed: true,
      threshold: 0.7,
    },
  },

  singleWord: {
    answer: 'Yes',
  },

  emptyQuestion: {
    answer: '',
    error: 'question is required',
  },

  graphError: {
    answer: '',
    error: 'ChromaDB connection refused',
  },

  partialEval: {
    answer: 'The answer depends on context.',
    evalReport: {
      question: 'Ambiguous question',
      answer_length: 30,
      num_documents: 1,
      scores: {
        faithfulness: 0.75,
        answer_relevancy: null,
        context_precision: null,
        context_recall: 0.6,
      },
      passed: null,
      threshold: 0.7,
    },
  },

  failedEval: {
    answer: 'I am not sure about that.',
    evalReport: {
      question: 'Hard question',
      answer_length: 25,
      num_documents: 2,
      scores: {
        faithfulness: 0.45,
        answer_relevancy: 0.3,
        context_precision: 0.5,
        context_recall: 0.4,
      },
      passed: false,
      threshold: 0.7,
    },
  },

  slowStream: {
    answer:
      'This is a long answer that takes a while to stream because each token has a delay.',
    tokenDelay: 50,
    evalReport: {
      question: 'Slow question',
      answer_length: 80,
      num_documents: 2,
      scores: { faithfulness: 0.8, answer_relevancy: 0.75, context_precision: 0.7, context_recall: 0.72 },
      passed: true,
      threshold: 0.7,
    },
  },

  midStreamDisconnect: {
    answer:
      'This answer will be cut off mid stream because the server disconnects unexpectedly',
    disconnectAfterTokens: 5,
  },

  emptyAnswer: {
    answer: '',
  },
} as const satisfies Record<string, MockWSScenario>;

// ─── Mock WebSocket Class ───────────────────────────────────

type WSReadyState = 0 | 1 | 2 | 3;
const CONNECTING: WSReadyState = 0;
const OPEN: WSReadyState = 1;
const CLOSING: WSReadyState = 2;
const CLOSED: WSReadyState = 3;

export class MockWebSocket {
  // WebSocket interface fields
  readonly url: string;
  readyState: WSReadyState = CONNECTING;
  readonly CONNECTING = CONNECTING;
  readonly OPEN = OPEN;
  readonly CLOSING = CLOSING;
  readonly CLOSED = CLOSED;

  // Event handlers (set by the code under test)
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  // Event listener maps
  private _listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  // Tracking
  readonly sentMessages: string[] = [];
  readonly receivedMessages: unknown[] = [];

  // Internal
  private readonly _scenario: MockWSScenario;
  private _sendResolve: (() => void) | null = null;
  private _closed = false;

  constructor(url: string, scenario: MockWSScenario) {
    this.url = url;
    this._scenario = scenario;

    // Simulate async connection open (microtask, not setTimeout)
    queueMicrotask(() => {
      if (!this._closed) {
        this.readyState = OPEN;
        const event = new Event('open');
        this.onopen?.(event);
        this._emit('open', event);
      }
    });
  }

  // ── WebSocket API ──

  send(data: string): void {
    if (this.readyState !== OPEN) {
      throw new DOMException('WebSocket is not open', 'InvalidStateError');
    }
    this.sentMessages.push(data);

    // Parse and record
    try {
      this.receivedMessages.push(JSON.parse(data));
    } catch {
      this.receivedMessages.push(data);
    }

    // Resolve any waitForSend() promise
    this._sendResolve?.();
    this._sendResolve = null;
  }

  close(code?: number, reason?: string): void {
    if (this._closed) return;
    this._closed = true;
    this.readyState = CLOSING;

    queueMicrotask(() => {
      this.readyState = CLOSED;
      const event = new CloseEvent('close', {
        code: code ?? 1000,
        reason: reason ?? '',
        wasClean: true,
      });
      this.onclose?.(event);
      this._emit('close', event);
    });
  }

  addEventListener(type: string, listener: (...args: unknown[]) => void): void {
    (this._listeners[type] ??= []).push(listener);
  }

  removeEventListener(
    type: string,
    listener: (...args: unknown[]) => void,
  ): void {
    const arr = this._listeners[type];
    if (arr) {
      this._listeners[type] = arr.filter((l) => l !== listener);
    }
  }

  dispatchEvent(_event: Event): boolean {
    return true;
  }

  // ── Test Control API ──

  /** Wait for the code under test to call send(). */
  waitForSend(): Promise<void> {
    if (this.sentMessages.length > 0) return Promise.resolve();
    return new Promise((resolve) => {
      this._sendResolve = resolve;
    });
  }

  /** Deliver all messages for the scenario (tokens + eval + done or error). */
  async streamAllMessages(): Promise<WSMessage[]> {
    const messages: WSMessage[] = [];

    if (this._scenario.error) {
      const msg: WSMessage = {
        type: 'error',
        message: this._scenario.error,
      };
      messages.push(msg);
      this._deliverMessage(msg);
      return messages;
    }

    // Stream tokens
    const words = this._scenario.answer
      ? this._scenario.answer.split(/\s+/)
      : [];

    for (let i = 0; i < words.length; i++) {
      if (this._closed) break;

      // Check disconnect threshold
      if (
        this._scenario.disconnectAfterTokens !== undefined &&
        i >= this._scenario.disconnectAfterTokens
      ) {
        this.close(1006, 'Server disconnected');
        return messages;
      }

      const msg: WSMessage = {
        type: 'token',
        content: words[i]! + ' ',
      };
      messages.push(msg);
      this._deliverMessage(msg);

      if (this._scenario.tokenDelay) {
        await delay(this._scenario.tokenDelay);
      }
    }

    // Eval report (only if non-empty)
    if (this._scenario.evalReport && !this._closed) {
      const msg: WSMessage = {
        type: 'eval',
        report: this._scenario.evalReport,
      };
      messages.push(msg);
      this._deliverMessage(msg);
    }

    // Done
    if (!this._closed) {
      const msg: WSMessage = {
        type: 'done',
        answer: this._scenario.answer,
      };
      messages.push(msg);
      this._deliverMessage(msg);
    }

    return messages;
  }

  /** Deliver a single arbitrary message (for custom test scenarios). */
  deliverMessage(msg: WSMessage): void {
    this._deliverMessage(msg);
  }

  /** Simulate a server-side error event. */
  triggerError(): void {
    const event = new Event('error');
    this.onerror?.(event);
    this._emit('error', event);
  }

  // ── Internal ──

  private _deliverMessage(msg: WSMessage): void {
    if (this._closed) return;
    const event = new MessageEvent('message', {
      data: JSON.stringify(msg),
    });
    this.onmessage?.(event);
    this._emit('message', event);
  }

  private _emit(type: string, event: Event): void {
    for (const listener of this._listeners[type] ?? []) {
      listener(event);
    }
  }
}

// ─── Installation Helper ────────────────────────────────────

export interface MockWSInstallation {
  /** The mock WebSocket instance (set after the code under test creates one). */
  getInstance: () => MockWebSocket | null;
  /** Restore the original WebSocket constructor. */
  restore: () => void;
  /** All instances created during this installation. */
  instances: MockWebSocket[];
}

/**
 * Replace globalThis.WebSocket with a mock that uses the given scenario.
 * Returns helpers to access instances and restore the original.
 *
 * Usage:
 *   const mock = installMockWebSocket(scenarios.happyPath);
 *   // ... render component / call hook that creates WebSocket ...
 *   const ws = mock.getInstance()!;
 *   await ws.waitForSend();
 *   await ws.streamAllMessages();
 *   mock.restore();
 */
export function installMockWebSocket(
  scenario: MockWSScenario,
): MockWSInstallation {
  const instances: MockWebSocket[] = [];
  const OriginalWS = globalThis.WebSocket;

  // Use a proper class so `new WebSocket(url)` works
  class BoundMockWebSocket extends MockWebSocket {
    static readonly CONNECTING = 0 as const;
    static readonly OPEN = 1 as const;
    static readonly CLOSING = 2 as const;
    static readonly CLOSED = 3 as const;

    constructor(url: string, _protocols?: string | string[]) {
      super(url, scenario);
      instances.push(this);
    }
  }

  globalThis.WebSocket = BoundMockWebSocket as unknown as typeof WebSocket;

  return {
    getInstance: () => instances[instances.length - 1] ?? null,
    restore: () => {
      globalThis.WebSocket = OriginalWS;
    },
    instances,
  };
}

// ─── Utilities ──────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flush all pending microtasks and timers.
 * Use after installMockWebSocket to let the connection "open".
 */
export async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
