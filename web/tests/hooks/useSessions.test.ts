/**
 * useSessions.test.ts — Integration tests for session management hook.
 *
 * Tests against localStorage persistence:
 * - Initial state: auto-creates default session if empty
 * - Create: adds session, makes it active
 * - Delete: removes session, handles active deletion
 * - Select: switches active session
 * - Persistence: read/write to localStorage
 * - Edge cases: delete last session, corrupt localStorage
 *
 * Owner: Stark (I4) | Sprint Day 3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessions } from '@/hooks/useSessions';

// ─── Setup ────────────────────────────────────────────────────

const STORAGE_KEY = 'soulgraph:sessions';
const ACTIVE_KEY = 'soulgraph:active-session';

beforeEach(() => {
  localStorage.clear();
});

// ─── Initial State ────────────────────────────────────────────

describe('useSessions — Initial State', () => {
  it('creates a default session when localStorage is empty', () => {
    const { result } = renderHook(() => useSessions());

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]!.label).toBe('New Chat');
    expect(result.current.activeSessionId).toBe(result.current.sessions[0]!.id);
  });

  it('persists default session to localStorage', () => {
    renderHook(() => useSessions());

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(1);
  });

  it('restores sessions from localStorage', () => {
    const existing = [
      { id: 's-1', label: 'First', created_at: '2026-03-28T10:00:00Z' },
      { id: 's-2', label: 'Second', created_at: '2026-03-28T11:00:00Z' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    localStorage.setItem(ACTIVE_KEY, 's-2');

    const { result } = renderHook(() => useSessions());

    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.activeSessionId).toBe('s-2');
  });

  it('falls back to first session if active ID is stale', () => {
    const existing = [
      { id: 's-1', label: 'First', created_at: '2026-03-28T10:00:00Z' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    localStorage.setItem(ACTIVE_KEY, 'deleted-id');

    const { result } = renderHook(() => useSessions());

    expect(result.current.activeSessionId).toBe('s-1');
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json!!!');

    const { result } = renderHook(() => useSessions());

    // Should create a new default session
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]!.label).toBe('New Chat');
  });
});

// ─── Create Session ───────────────────────────────────────────

describe('useSessions — Create Session', () => {
  it('creates a new session and makes it active', () => {
    const { result } = renderHook(() => useSessions());

    let newId: string = '';
    act(() => {
      newId = result.current.createSession();
    });

    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.activeSessionId).toBe(newId);
  });

  it('new session is prepended to list', () => {
    const { result } = renderHook(() => useSessions());

    const originalId = result.current.sessions[0]!.id;

    act(() => {
      result.current.createSession();
    });

    // New session should be first
    expect(result.current.sessions[0]!.id).not.toBe(originalId);
    expect(result.current.sessions[1]!.id).toBe(originalId);
  });

  it('generates sequential labels', () => {
    const { result } = renderHook(() => useSessions());

    act(() => {
      result.current.createSession();
    });

    expect(result.current.sessions[0]!.label).toBe('Chat 2');
  });

  it('persists new session to localStorage', () => {
    const { result } = renderHook(() => useSessions());

    act(() => {
      result.current.createSession();
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(2);
  });

  it('returns the new session ID', () => {
    const { result } = renderHook(() => useSessions());

    let id: string = '';
    act(() => {
      id = result.current.createSession();
    });

    expect(id).toBeTruthy();
    expect(result.current.sessions.some((s) => s.id === id)).toBe(true);
  });
});

// ─── Delete Session ───────────────────────────────────────────

describe('useSessions — Delete Session', () => {
  it('removes session from list', () => {
    const existing = [
      { id: 's-1', label: 'First', created_at: '2026-03-28T10:00:00Z' },
      { id: 's-2', label: 'Second', created_at: '2026-03-28T11:00:00Z' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    localStorage.setItem(ACTIVE_KEY, 's-1');

    const { result } = renderHook(() => useSessions());

    act(() => {
      result.current.deleteSession('s-2');
    });

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]!.id).toBe('s-1');
  });

  it('switches active to first remaining when active session deleted', () => {
    const existing = [
      { id: 's-1', label: 'First', created_at: '2026-03-28T10:00:00Z' },
      { id: 's-2', label: 'Second', created_at: '2026-03-28T11:00:00Z' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    localStorage.setItem(ACTIVE_KEY, 's-1');

    const { result } = renderHook(() => useSessions());

    act(() => {
      result.current.deleteSession('s-1');
    });

    expect(result.current.activeSessionId).toBe('s-2');
  });

  it('creates fallback session when deleting the last session', () => {
    const { result } = renderHook(() => useSessions());

    const soleId = result.current.sessions[0]!.id;

    act(() => {
      result.current.deleteSession(soleId);
    });

    // Should have created a new default session
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]!.id).not.toBe(soleId);
    expect(result.current.sessions[0]!.label).toBe('New Chat');
  });

  it('persists deletion to localStorage', () => {
    const existing = [
      { id: 's-1', label: 'First', created_at: '2026-03-28T10:00:00Z' },
      { id: 's-2', label: 'Second', created_at: '2026-03-28T11:00:00Z' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    localStorage.setItem(ACTIVE_KEY, 's-1');

    const { result } = renderHook(() => useSessions());

    act(() => {
      result.current.deleteSession('s-2');
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(1);
  });
});

// ─── Select Session ───────────────────────────────────────────

describe('useSessions — Select Session', () => {
  it('switches active session', () => {
    const existing = [
      { id: 's-1', label: 'First', created_at: '2026-03-28T10:00:00Z' },
      { id: 's-2', label: 'Second', created_at: '2026-03-28T11:00:00Z' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    localStorage.setItem(ACTIVE_KEY, 's-1');

    const { result } = renderHook(() => useSessions());

    act(() => {
      result.current.setActiveSession('s-2');
    });

    expect(result.current.activeSessionId).toBe('s-2');
  });

  it('ignores selection of non-existent session', () => {
    const { result } = renderHook(() => useSessions());

    const originalId = result.current.activeSessionId;

    act(() => {
      result.current.setActiveSession('non-existent');
    });

    expect(result.current.activeSessionId).toBe(originalId);
  });

  it('persists active session to localStorage', () => {
    const existing = [
      { id: 's-1', label: 'First', created_at: '2026-03-28T10:00:00Z' },
      { id: 's-2', label: 'Second', created_at: '2026-03-28T11:00:00Z' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    localStorage.setItem(ACTIVE_KEY, 's-1');

    const { result } = renderHook(() => useSessions());

    act(() => {
      result.current.setActiveSession('s-2');
    });

    expect(localStorage.getItem(ACTIVE_KEY)).toBe('s-2');
  });
});

// ─── Edge Cases ───────────────────────────────────────────────

describe('useSessions — Edge Cases', () => {
  it('handles non-array localStorage value', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }));

    const { result } = renderHook(() => useSessions());

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]!.label).toBe('New Chat');
  });

  it('each created session has a unique id', () => {
    const { result } = renderHook(() => useSessions());

    const ids: string[] = [result.current.sessions[0]!.id];

    act(() => {
      ids.push(result.current.createSession());
    });
    act(() => {
      ids.push(result.current.createSession());
    });

    const unique = new Set(ids);
    expect(unique.size).toBe(3);
  });

  it('sessions have created_at timestamps', () => {
    const { result } = renderHook(() => useSessions());

    expect(result.current.sessions[0]!.created_at).toBeTruthy();
    // Should be a valid ISO string
    expect(() => new Date(result.current.sessions[0]!.created_at)).not.toThrow();
  });
});
