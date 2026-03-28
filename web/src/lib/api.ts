/**
 * api.ts — HTTP client for SoulGraph REST endpoints.
 *
 * All paths are relative — Vite dev proxy forwards to the backend (see vite.config.ts).
 * In production, paths resolve against the serving origin.
 *
 * Backend reference: soulgraph/api.py
 */

import type { TunerStatus } from './types';

// ─────────────────────────────────────────────────────────────
// Response Types (backend-specific, not re-exported)
// ─────────────────────────────────────────────────────────────

/** POST /query response shape (soulgraph/api.py QueryResponse). */
export interface QueryResponse {
  answer: string;
  eval_report: Record<string, unknown>;
  session_id: string;
}

/** GET /health response shape. */
export interface HealthResponse {
  status: string;
  version: string;
}

/** POST /tune/reset response shape. */
export interface TuneResetResponse {
  status: string;
  params: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Error Handling
// ─────────────────────────────────────────────────────────────

/** Typed API error with HTTP status and optional backend detail. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Parse a fetch Response into JSON, throwing ApiError on non-2xx.
 * Attempts to extract `detail`, `error`, or `message` from error bodies.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail: string | undefined;
    try {
      const body: Record<string, unknown> = await response.json();
      detail =
        (body.detail as string | undefined) ??
        (body.error as string | undefined) ??
        (body.message as string | undefined);
    } catch {
      // Response body isn't JSON — that's fine.
    }
    throw new ApiError(
      `API ${response.status} ${response.statusText}`,
      response.status,
      detail,
    );
  }
  return response.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export const api = {
  /**
   * POST /query — run the full agent graph synchronously.
   * Returns the complete answer + eval report.
   */
  async query(
    question: string,
    sessionId: string = 'default',
  ): Promise<QueryResponse> {
    const res = await fetch('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, session_id: sessionId }),
    });
    return handleResponse<QueryResponse>(res);
  },

  /** GET /tune/status — current tuning parameters + eval history. */
  async tunerStatus(): Promise<TunerStatus> {
    const res = await fetch('/tune/status');
    return handleResponse<TunerStatus>(res);
  },

  /** POST /tune/reset — reset all tuning parameters to defaults. */
  async tunerReset(): Promise<TuneResetResponse> {
    const res = await fetch('/tune/reset', { method: 'POST' });
    return handleResponse<TuneResetResponse>(res);
  },

  /** GET /health — service liveness check. */
  async health(): Promise<HealthResponse> {
    const res = await fetch('/health');
    return handleResponse<HealthResponse>(res);
  },
} as const;

// ─────────────────────────────────────────────────────────────
// WebSocket URL Helper
// ─────────────────────────────────────────────────────────────

/**
 * Derive the WebSocket URL for streaming queries.
 *
 * Dev:  ws://localhost:5173/ws/query (Vite proxy → ws://localhost:8080/ws/query)
 * Prod: wss://origin/ws/query
 */
export function getWSUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/query`;
}
