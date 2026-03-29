/**
 * SessionSidebar.test.tsx — Unit tests for the session sidebar component.
 *
 * Tests:
 * - Rendering: sidebar container, new session button, session list
 * - Empty state: "No sessions yet" message
 * - Session items: label, active highlight, delete button, time ago, preview
 * - Interactions: onSelect, onNew, onDelete callbacks
 * - Active session: highlighted with aria-current
 * - Edge cases: many sessions, sessions without last_message
 *
 * Owner: Stark (C9) | Sprint Day 2
 */

import { describe, it, expect, vi } from 'vitest';
import SessionSidebar from '@/components/SessionSidebar';
import { render, screen, fireEvent } from '../helpers/render';
import { createSession, createSessionList, resetFactoryCounters } from '../helpers/factories';
import type { Session } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────

function renderSidebar(
  sessions: Session[] = [],
  activeSessionId = '',
  onSelect = vi.fn(),
  onNew = vi.fn(),
  onDelete = vi.fn(),
) {
  return {
    ...render(
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
      />,
    ),
    onSelect,
    onNew,
    onDelete,
  };
}

// ─── Rendering ────────────────────────────────────────────────

describe('SessionSidebar — Rendering', () => {
  it('renders without crashing', () => {
    renderSidebar();
    expect(screen.getByTestId('session-sidebar')).toBeInTheDocument();
  });

  it('renders new session button', () => {
    renderSidebar();
    const btn = screen.getByTestId('session-sidebar-new');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('New Session');
  });

  it('new session button has aria-label', () => {
    renderSidebar();
    expect(screen.getByTestId('session-sidebar-new')).toHaveAttribute('aria-label', 'Create new session');
  });

  it('renders session list container', () => {
    renderSidebar();
    expect(screen.getByTestId('session-sidebar-list')).toBeInTheDocument();
  });
});

// ─── Empty State ──────────────────────────────────────────────

describe('SessionSidebar — Empty State', () => {
  it('shows empty state when no sessions', () => {
    renderSidebar([]);
    expect(screen.getByTestId('session-sidebar-empty')).toBeInTheDocument();
  });

  it('shows "No sessions yet" text', () => {
    renderSidebar([]);
    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
  });

  it('shows instruction text in empty state', () => {
    renderSidebar([]);
    expect(screen.getByText(/start a new conversation/i)).toBeInTheDocument();
  });
});

// ─── Session Items ────────────────────────────────────────────

describe('SessionSidebar — Session Items', () => {
  it('renders session item for each session', () => {
    resetFactoryCounters();
    const sessions = [createSession(), createSession()];
    renderSidebar(sessions);
    expect(screen.getByTestId(`session-item-${sessions[0]!.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`session-item-${sessions[1]!.id}`)).toBeInTheDocument();
  });

  it('shows session label', () => {
    resetFactoryCounters();
    const session = createSession({ label: 'My Session' });
    renderSidebar([session]);
    expect(screen.getByTestId(`session-label-${session.id}`)).toHaveTextContent('My Session');
  });

  it('shows delete button for each session', () => {
    resetFactoryCounters();
    const session = createSession();
    renderSidebar([session]);
    expect(screen.getByTestId(`session-delete-${session.id}`)).toBeInTheDocument();
  });

  it('delete button has aria-label', () => {
    resetFactoryCounters();
    const session = createSession({ label: 'Test Session' });
    renderSidebar([session]);
    expect(screen.getByTestId(`session-delete-${session.id}`)).toHaveAttribute(
      'aria-label',
      'Delete session: Test Session',
    );
  });

  it('shows time ago for each session', () => {
    resetFactoryCounters();
    const session = createSession();
    renderSidebar([session]);
    expect(screen.getByTestId(`session-time-${session.id}`)).toBeInTheDocument();
  });

  it('shows last message preview when present', () => {
    resetFactoryCounters();
    const session = createSession({ last_message: 'What is RAG?' });
    renderSidebar([session]);
    expect(screen.getByTestId(`session-preview-${session.id}`)).toHaveTextContent('What is RAG?');
  });

  it('does not show preview when no last_message', () => {
    resetFactoryCounters();
    const session = createSession();
    renderSidebar([session]);
    expect(screen.queryByTestId(`session-preview-${session.id}`)).not.toBeInTheDocument();
  });

  it('does not show empty state when sessions exist', () => {
    renderSidebar([createSession()]);
    expect(screen.queryByTestId('session-sidebar-empty')).not.toBeInTheDocument();
  });
});

// ─── Active Session ───────────────────────────────────────────

describe('SessionSidebar — Active Session', () => {
  it('marks active session with aria-current', () => {
    resetFactoryCounters();
    const sessions = [createSession(), createSession()];
    renderSidebar(sessions, sessions[0]!.id);

    const active = screen.getByTestId(`session-item-${sessions[0]!.id}`);
    expect(active).toHaveAttribute('aria-current', 'true');
  });

  it('inactive session does not have aria-current', () => {
    resetFactoryCounters();
    const sessions = [createSession(), createSession()];
    renderSidebar(sessions, sessions[0]!.id);

    const inactive = screen.getByTestId(`session-item-${sessions[1]!.id}`);
    expect(inactive).not.toHaveAttribute('aria-current');
  });
});

// ─── Interactions ─────────────────────────────────────────────

describe('SessionSidebar — Interactions', () => {
  it('calls onNew when new session button clicked', () => {
    const onNew = vi.fn();
    renderSidebar([], '', vi.fn(), onNew);
    fireEvent.click(screen.getByTestId('session-sidebar-new'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect with session id when session clicked', () => {
    resetFactoryCounters();
    const onSelect = vi.fn();
    const session = createSession();
    renderSidebar([session], '', onSelect);

    fireEvent.click(screen.getByTestId(`session-item-${session.id}`));
    expect(onSelect).toHaveBeenCalledWith(session.id);
  });

  it('calls onDelete with session id when delete clicked', () => {
    resetFactoryCounters();
    const onDelete = vi.fn();
    const session = createSession();
    renderSidebar([session], '', vi.fn(), vi.fn(), onDelete);

    fireEvent.click(screen.getByTestId(`session-delete-${session.id}`));
    expect(onDelete).toHaveBeenCalledWith(session.id);
  });

  it('delete click does not trigger onSelect (stopPropagation)', () => {
    resetFactoryCounters();
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    const session = createSession();
    renderSidebar([session], '', onSelect, vi.fn(), onDelete);

    fireEvent.click(screen.getByTestId(`session-delete-${session.id}`));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

// ─── Edge Cases ───────────────────────────────────────────────

describe('SessionSidebar — Edge Cases', () => {
  it('renders many sessions', () => {
    resetFactoryCounters();
    const sessions = createSessionList(10);
    renderSidebar(sessions);
    sessions.forEach((s) => {
      expect(screen.getByTestId(`session-item-${s.id}`)).toBeInTheDocument();
    });
  });

  it('renders session list with role="list" and aria-label', () => {
    renderSidebar([createSession()]);
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('aria-label', 'Chat sessions');
  });

  it('handles session with no activeSessionId match', () => {
    resetFactoryCounters();
    const sessions = [createSession()];
    renderSidebar(sessions, 'non-existent-id');
    // No session should have aria-current
    const item = screen.getByTestId(`session-item-${sessions[0]!.id}`);
    expect(item).not.toHaveAttribute('aria-current');
  });
});

// ─── timeAgo branches ────────────────────────────────────────

describe('SessionSidebar — timeAgo display', () => {
  it('shows "just now" for session created < 1 min ago', () => {
    resetFactoryCounters();
    const session = createSession({ created_at: new Date().toISOString() });
    renderSidebar([session]);
    expect(screen.getByTestId(`session-time-${session.id}`)).toHaveTextContent('just now');
  });

  it('shows minutes for session created minutes ago', () => {
    resetFactoryCounters();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const session = createSession({ created_at: fiveMinAgo });
    renderSidebar([session]);
    expect(screen.getByTestId(`session-time-${session.id}`)).toHaveTextContent('5m ago');
  });

  it('shows hours for session created hours ago', () => {
    resetFactoryCounters();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const session = createSession({ created_at: twoHoursAgo });
    renderSidebar([session]);
    expect(screen.getByTestId(`session-time-${session.id}`)).toHaveTextContent('2h ago');
  });

  it('shows days for session created days ago', () => {
    resetFactoryCounters();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const session = createSession({ created_at: threeDaysAgo });
    renderSidebar([session]);
    expect(screen.getByTestId(`session-time-${session.id}`)).toHaveTextContent('3d ago');
  });
});

// ─── Keyboard Navigation ─────────────────────────────────────

describe('SessionSidebar — Keyboard Interactions', () => {
  it('calls onDelete when Enter pressed on delete button', () => {
    resetFactoryCounters();
    const onDelete = vi.fn();
    const session = createSession();
    renderSidebar([session], '', vi.fn(), vi.fn(), onDelete);

    fireEvent.keyDown(screen.getByTestId(`session-delete-${session.id}`), { key: 'Enter' });
    expect(onDelete).toHaveBeenCalledWith(session.id);
  });

  it('calls onDelete when Space pressed on delete button', () => {
    resetFactoryCounters();
    const onDelete = vi.fn();
    const session = createSession();
    renderSidebar([session], '', vi.fn(), vi.fn(), onDelete);

    fireEvent.keyDown(screen.getByTestId(`session-delete-${session.id}`), { key: ' ' });
    expect(onDelete).toHaveBeenCalledWith(session.id);
  });

  it('does not call onDelete for other keys on delete button', () => {
    resetFactoryCounters();
    const onDelete = vi.fn();
    const session = createSession();
    renderSidebar([session], '', vi.fn(), vi.fn(), onDelete);

    fireEvent.keyDown(screen.getByTestId(`session-delete-${session.id}`), { key: 'Tab' });
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('keyboard delete does not trigger onSelect (stopPropagation)', () => {
    resetFactoryCounters();
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    const session = createSession();
    renderSidebar([session], '', onSelect, vi.fn(), onDelete);

    fireEvent.keyDown(screen.getByTestId(`session-delete-${session.id}`), { key: 'Enter' });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
