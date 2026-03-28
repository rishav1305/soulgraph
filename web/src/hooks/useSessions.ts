/**
 * useSessions.ts — Session management hook with localStorage persistence.
 *
 * Manages:
 *   - Session CRUD (create, read, delete)
 *   - Active session selection
 *   - Persistence to localStorage (SOVEREIGN — no external deps)
 *   - Auto-creation of initial session if none exist
 *
 * Sessions are lightweight metadata (id, label, created_at, last_message).
 * Actual chat history is managed per-session by useGraph.
 *
 * Implements the UseSessionsReturn contract from types.ts.
 */

import { useCallback, useState } from 'react';
import type { Session, UseSessionsReturn } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'soulgraph:sessions';
const ACTIVE_KEY = 'soulgraph:active-session';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

/** Read sessions from localStorage, returning [] on any error. */
function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Session[];
  } catch {
    return [];
  }
}

/** Write sessions to localStorage. */
function saveSessions(sessions: Session[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // localStorage full or unavailable — fail silently.
    // TRANSPARENT: we could log this, but there's no logger in the frontend yet.
  }
}

/** Read the active session ID from localStorage. */
function loadActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

/** Write the active session ID to localStorage. */
function saveActiveId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // Silent — see saveSessions comment.
  }
}

/** Create a default session (used when no sessions exist). */
function makeDefaultSession(): Session {
  return {
    id: generateId(),
    label: 'New Chat',
    created_at: nowISO(),
  };
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useSessions(): UseSessionsReturn {
  // Initialize from localStorage. If empty, create a default session.
  const [sessions, setSessionsRaw] = useState<Session[]>(() => {
    const stored = loadSessions();
    if (stored.length > 0) return stored;
    const initial = makeDefaultSession();
    saveSessions([initial]);
    saveActiveId(initial.id);
    return [initial];
  });

  const [activeSessionId, setActiveSessionIdRaw] = useState<string>(() => {
    const stored = loadActiveId();
    // Validate that the stored ID actually exists in sessions.
    const loaded = loadSessions();
    if (stored && loaded.some((s) => s.id === stored)) return stored;
    // Fall back to first session.
    return loaded[0]?.id ?? makeDefaultSession().id;
  });

  // Wrapper that syncs state + localStorage.
  const setSessions = useCallback((next: Session[]) => {
    setSessionsRaw(next);
    saveSessions(next);
  }, []);

  const setActiveId = useCallback((id: string) => {
    setActiveSessionIdRaw(id);
    saveActiveId(id);
  }, []);

  /** Switch to an existing session. */
  const setActiveSession = useCallback(
    (id: string) => {
      if (sessions.some((s) => s.id === id)) {
        setActiveId(id);
      }
    },
    [sessions, setActiveId],
  );

  /** Create a new session and make it active. Returns the new session ID. */
  const createSession = useCallback((): string => {
    const session: Session = {
      id: generateId(),
      label: `Chat ${sessions.length + 1}`,
      created_at: nowISO(),
    };
    const next = [session, ...sessions];
    setSessions(next);
    setActiveId(session.id);
    return session.id;
  }, [sessions, setSessions, setActiveId]);

  /** Delete a session. If deleting the active session, switch to the next one. */
  const deleteSession = useCallback(
    (id: string) => {
      const next = sessions.filter((s) => s.id !== id);

      // Never leave the user with zero sessions.
      if (next.length === 0) {
        const fallback = makeDefaultSession();
        setSessions([fallback]);
        setActiveId(fallback.id);
        return;
      }

      setSessions(next);

      // If we deleted the active session, pick the first remaining.
      if (id === activeSessionId) {
        setActiveId(next[0]!.id);
      }
    },
    [sessions, activeSessionId, setSessions, setActiveId],
  );

  return {
    sessions,
    activeSessionId,
    setActiveSession,
    createSession,
    deleteSession,
  };
}
