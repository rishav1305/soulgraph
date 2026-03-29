/**
 * api.test.ts — Unit tests for the SoulGraph HTTP client.
 *
 * Tests:
 * - ApiError class: construction, properties, inheritance
 * - handleResponse (via api methods): success JSON, non-2xx with detail, non-2xx without JSON
 * - api.query: POST /query with correct body, session_id default
 * - api.tunerStatus: GET /tune/status
 * - api.tunerReset: POST /tune/reset
 * - api.health: GET /health
 * - getWSUrl: protocol selection (ws: vs wss:)
 *
 * Owner: Happy (QA) | Coverage expansion — api.ts from 14% → ~95%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, getWSUrl } from '@/lib/api';
import type { QueryResponse, HealthResponse, TuneResetResponse } from '@/lib/api';

// ─── fetch mock ────────────────────────────────────────────────

const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ─── Helpers ───────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(body: string, status: number, statusText: string): Response {
  return new Response(body, { status, statusText });
}

// ─── Tests ─────────────────────────────────────────────────────

describe('ApiError', () => {
  it('constructs with message, status, and detail', () => {
    const err = new ApiError('API 500 Internal Server Error', 500, 'db connection lost');
    expect(err.message).toBe('API 500 Internal Server Error');
    expect(err.status).toBe(500);
    expect(err.detail).toBe('db connection lost');
    expect(err.name).toBe('ApiError');
  });

  it('constructs without detail', () => {
    const err = new ApiError('API 404 Not Found', 404);
    expect(err.status).toBe(404);
    expect(err.detail).toBeUndefined();
  });

  it('is an instance of Error', () => {
    const err = new ApiError('test', 500);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('api.query', () => {
  it('sends POST /query with question and default session_id', async () => {
    const responseBody: QueryResponse = {
      answer: 'RAG is retrieval-augmented generation.',
      eval_report: { faithfulness: 0.9 },
      session_id: 'default',
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(responseBody));

    const result = await api.query('What is RAG?');

    expect(mockFetch).toHaveBeenCalledWith('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is RAG?', session_id: 'default' }),
    });
    expect(result).toEqual(responseBody);
  });

  it('sends custom session_id when provided', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ answer: 'ok', eval_report: {}, session_id: 'sess-42' }));

    await api.query('Hello', 'sess-42');

    expect(mockFetch).toHaveBeenCalledWith('/query', expect.objectContaining({
      body: JSON.stringify({ question: 'Hello', session_id: 'sess-42' }),
    }));
  });

  it('throws ApiError on 500 with JSON error body (detail field)', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ detail: 'ChromaDB connection refused' }, 500, 'Internal Server Error'),
    );

    await expect(api.query('test')).rejects.toThrow(ApiError);
    try {
      await api.query('test');
    } catch (err) {
      // Second call — need fresh mock
    }

    // Verify the error structure from the first call
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ detail: 'ChromaDB connection refused' }, 500, 'Internal Server Error'),
    );
    try {
      await api.query('test');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(500);
      expect((err as ApiError).detail).toBe('ChromaDB connection refused');
    }
  });

  it('throws ApiError on error response with "error" field', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: 'rate limited' }, 429, 'Too Many Requests'),
    );

    try {
      await api.query('test');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(429);
      expect((err as ApiError).detail).toBe('rate limited');
    }
  });

  it('throws ApiError on error response with "message" field', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ message: 'invalid input' }, 400, 'Bad Request'),
    );

    try {
      await api.query('test');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(400);
      expect((err as ApiError).detail).toBe('invalid input');
    }
  });

  it('throws ApiError with no detail when error body is not JSON', async () => {
    mockFetch.mockResolvedValueOnce(
      textResponse('Internal Server Error', 500, 'Internal Server Error'),
    );

    try {
      await api.query('test');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(500);
      expect((err as ApiError).detail).toBeUndefined();
      expect((err as ApiError).message).toBe('API 500 Internal Server Error');
    }
  });
});

describe('api.tunerStatus', () => {
  it('sends GET /tune/status and returns tuner status', async () => {
    const status = {
      params: { rag_k: 5, eval_threshold: 0.7, prefer_reasoning_model: false },
      history: [],
      adjustments: [],
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(status));

    const result = await api.tunerStatus();

    expect(mockFetch).toHaveBeenCalledWith('/tune/status');
    expect(result).toEqual(status);
  });

  it('throws ApiError on non-2xx', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ detail: 'not found' }, 404, 'Not Found'));

    await expect(api.tunerStatus()).rejects.toThrow(ApiError);
  });
});

describe('api.tunerReset', () => {
  it('sends POST /tune/reset and returns result', async () => {
    const response: TuneResetResponse = {
      status: 'ok',
      params: { rag_k: 5, eval_threshold: 0.7, prefer_reasoning_model: false },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await api.tunerReset();

    expect(mockFetch).toHaveBeenCalledWith('/tune/reset', { method: 'POST' });
    expect(result).toEqual(response);
  });
});

describe('api.health', () => {
  it('sends GET /health and returns health response', async () => {
    const health: HealthResponse = { status: 'ok', version: '1.0.0' };
    mockFetch.mockResolvedValueOnce(jsonResponse(health));

    const result = await api.health();

    expect(mockFetch).toHaveBeenCalledWith('/health');
    expect(result).toEqual(health);
  });

  it('throws ApiError on 503 Service Unavailable', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ detail: 'service starting' }, 503, 'Service Unavailable'),
    );

    try {
      await api.health();
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(503);
      expect((err as ApiError).detail).toBe('service starting');
    }
  });
});

describe('getWSUrl', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('returns ws: URL for http: pages', () => {
    Object.defineProperty(window, 'location', {
      value: { protocol: 'http:', host: 'localhost:5173' },
      writable: true,
    });
    expect(getWSUrl()).toBe('ws://localhost:5173/ws/query');
  });

  it('returns wss: URL for https: pages', () => {
    Object.defineProperty(window, 'location', {
      value: { protocol: 'https:', host: 'soulgraph.titan.local' },
      writable: true,
    });
    expect(getWSUrl()).toBe('wss://soulgraph.titan.local/ws/query');
  });
});
