/**
 * useTuner.test.ts — Integration tests for the AgentTuner hook.
 *
 * Tests:
 * - Initial fetch: loads tuner status on mount
 * - Refresh: manually triggers re-fetch
 * - Reset: calls reset endpoint then refreshes
 * - Error handling: ApiError with status/detail, generic errors
 * - Auto-refresh: interval-based polling
 * - Loading states: loading flag during fetch/reset
 *
 * Owner: Stark (I4) | Sprint Day 3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTuner } from '@/hooks/useTuner';
import {
  createTunerStatus,
  createTuningParams,
} from '../helpers/factories';

// ─── Mocks ────────────────────────────────────────────────────

// Mock the api module
vi.mock('@/lib/api', () => {
  const mockApi = {
    tunerStatus: vi.fn(),
    tunerReset: vi.fn(),
  };

  class MockApiError extends Error {
    status: number;
    detail?: string;
    constructor(message: string, status: number, detail?: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.detail = detail;
    }
  }

  return {
    api: mockApi,
    ApiError: MockApiError,
  };
});

// Import the mocked api so we can control return values
import { api, ApiError } from '@/lib/api';

const mockTunerStatus = vi.mocked(api.tunerStatus);
const mockTunerReset = vi.mocked(api.tunerReset);

// ─── Setup ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Initial Fetch ────────────────────────────────────────────

describe('useTuner — Initial Fetch', () => {
  it('starts with loading=true', () => {
    mockTunerStatus.mockResolvedValue(createTunerStatus());
    const { result } = renderHook(() => useTuner());

    expect(result.current.loading).toBe(true);
  });

  it('fetches tuner status on mount', async () => {
    const status = createTunerStatus();
    mockTunerStatus.mockResolvedValue(status);

    const { result } = renderHook(() => useTuner());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.status).toEqual(status);
    expect(result.current.error).toBeNull();
    expect(mockTunerStatus).toHaveBeenCalledTimes(1);
  });

  it('sets error on fetch failure', async () => {
    mockTunerStatus.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTuner());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.status).toBeNull();
  });

  it('extracts detail from ApiError', async () => {
    mockTunerStatus.mockRejectedValue(
      new ApiError('API 500 Internal Server Error', 500, 'Database connection failed'),
    );

    const { result } = renderHook(() => useTuner());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toContain('Database connection failed');
  });
});

// ─── Refresh ──────────────────────────────────────────────────

describe('useTuner — Refresh', () => {
  it('refresh re-fetches status', async () => {
    const status1 = createTunerStatus();
    const status2 = createTunerStatus({
      params: createTuningParams({ rag_k: 10 }),
    });
    mockTunerStatus.mockResolvedValueOnce(status1).mockResolvedValueOnce(status2);

    const { result } = renderHook(() => useTuner());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.status!.params.rag_k).toBe(5);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status!.params.rag_k).toBe(10);
    expect(mockTunerStatus).toHaveBeenCalledTimes(2);
  });
});

// ─── Reset ────────────────────────────────────────────────────

describe('useTuner — Reset', () => {
  it('calls tunerReset then refreshes status', async () => {
    const initialStatus = createTunerStatus({
      params: createTuningParams({ rag_k: 10 }),
    });
    const resetStatus = createTunerStatus({
      params: createTuningParams({ rag_k: 5 }),
    });

    mockTunerStatus
      .mockResolvedValueOnce(initialStatus)
      .mockResolvedValueOnce(resetStatus);
    mockTunerReset.mockResolvedValue({
      status: 'ok',
      params: {},
    });

    const { result } = renderHook(() => useTuner());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.reset();
    });

    expect(mockTunerReset).toHaveBeenCalledTimes(1);
    expect(result.current.status!.params.rag_k).toBe(5);
  });

  it('sets error if reset fails', async () => {
    mockTunerStatus.mockResolvedValue(createTunerStatus());
    mockTunerReset.mockRejectedValue(new Error('Reset failed'));

    const { result } = renderHook(() => useTuner());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.reset();
    });

    expect(result.current.error).toBe('Reset failed');
  });
});

// ─── Auto-Refresh ─────────────────────────────────────────────

describe('useTuner — Auto-Refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-refreshes every 30 seconds', async () => {
    mockTunerStatus.mockResolvedValue(createTunerStatus());

    renderHook(() => useTuner());

    await waitFor(() => {
      expect(mockTunerStatus).toHaveBeenCalledTimes(1);
    });

    // Advance 30 seconds
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    await waitFor(() => {
      expect(mockTunerStatus).toHaveBeenCalledTimes(2);
    });

    // Advance another 30 seconds
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    await waitFor(() => {
      expect(mockTunerStatus).toHaveBeenCalledTimes(3);
    });
  });

  it('stops auto-refresh on unmount', async () => {
    mockTunerStatus.mockResolvedValue(createTunerStatus());

    const { unmount } = renderHook(() => useTuner());

    await waitFor(() => {
      expect(mockTunerStatus).toHaveBeenCalledTimes(1);
    });

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    // Should not have been called again after unmount
    expect(mockTunerStatus).toHaveBeenCalledTimes(1);
  });
});
