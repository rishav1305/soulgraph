/**
 * useTuner.ts — Hook for AgentTuner status and control.
 *
 * Fetches tuner state from GET /tune/status via api.tunerStatus()
 * and provides a reset action via api.tunerReset().
 *
 * Owner: Banner (C8) | Sprint Day 2
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { TunerStatus, UseTunerReturn } from '@/lib/types';
import { api, ApiError } from '@/lib/api';

/** Interval for auto-refresh (ms). Set to 0 to disable. */
const AUTO_REFRESH_MS = 30_000;

export function useTuner(): UseTunerReturn {
  const [status, setStatus] = useState<TunerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.tunerStatus();
      if (mountedRef.current) {
        setStatus(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        const message =
          err instanceof ApiError
            ? `${err.message}${err.detail ? `: ${err.detail}` : ''}`
            : err instanceof Error
              ? err.message
              : 'Failed to fetch tuner status';
        setError(message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const reset = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      await api.tunerReset();

      // Refresh status after reset to get new defaults
      await refresh();
    } catch (err) {
      if (mountedRef.current) {
        const message =
          err instanceof ApiError
            ? `${err.message}${err.detail ? `: ${err.detail}` : ''}`
            : err instanceof Error
              ? err.message
              : 'Failed to reset tuner';
        setError(message);
        setLoading(false);
      }
    }
  }, [refresh]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (AUTO_REFRESH_MS > 0) {
      intervalId = setInterval(() => void refresh(), AUTO_REFRESH_MS);
    }

    return () => {
      mountedRef.current = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [refresh]);

  return { status, loading, error, refresh, reset };
}
