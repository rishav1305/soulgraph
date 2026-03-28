/**
 * SessionSidebar.tsx — Session list with new/delete/switch.
 * C5: Happy — Sprint Day 2
 *
 * Props: SessionSidebarProps from types.ts
 * Features:
 *   - "New Session" button at top
 *   - Scrollable session list
 *   - Active session highlighted with soul accent
 *   - Delete button per session (hover reveal)
 *   - Last message preview + relative timestamp
 *   - Empty state when no sessions
 */

import type { SessionSidebarProps } from '@/lib/types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
}: SessionSidebarProps) {
  return (
    <div data-testid="session-sidebar" className="flex flex-col h-full">
      {/* New session button */}
      <div className="px-3 py-3">
        <button
          type="button"
          data-testid="session-sidebar-new"
          onClick={onNew}
          aria-label="Create new session"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-soul/10 text-soul hover:bg-soul/20 transition-colors text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-soul"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          New Session
        </button>
      </div>

      {/* Session list */}
      <div data-testid="session-sidebar-list" className="flex-1 overflow-y-auto px-2">
        {sessions.length === 0 ? (
          <div data-testid="session-sidebar-empty" className="px-3 py-8 text-center">
            <p className="text-sm text-fg-muted">No sessions yet</p>
            <p className="text-xs text-fg-muted mt-1">Start a new conversation above</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1" role="list" aria-label="Chat sessions">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    data-testid={`session-item-${session.id}`}
                    onClick={() => onSelect(session.id)}
                    aria-current={isActive ? 'true' : undefined}
                    className={`group w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-soul ${
                      isActive
                        ? 'bg-soul/10 border border-soul/25'
                        : 'hover:bg-elevated border border-transparent'
                    }`}
                  >
                    {/* Session label */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        data-testid={`session-label-${session.id}`}
                        className={`text-sm font-medium truncate ${
                          isActive ? 'text-soul' : 'text-fg'
                        }`}
                      >
                        {session.label}
                      </span>

                      {/* Delete button — visible on hover or active */}
                      <span
                        role="button"
                        tabIndex={0}
                        data-testid={`session-delete-${session.id}`}
                        aria-label={`Delete session: ${session.label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(session.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete(session.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0 w-5 h-5 flex items-center justify-center rounded text-fg-muted hover:text-fail hover:bg-fail/10 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fail"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M3 3l6 6M9 3l-6 6" />
                        </svg>
                      </span>
                    </div>

                    {/* Last message preview + time */}
                    <div className="flex items-center gap-2 mt-1">
                      {session.last_message && (
                        <span
                          data-testid={`session-preview-${session.id}`}
                          className="text-xs text-fg-muted truncate flex-1"
                        >
                          {session.last_message}
                        </span>
                      )}
                      <span
                        data-testid={`session-time-${session.id}`}
                        className="text-[10px] text-fg-muted shrink-0"
                      >
                        {timeAgo(session.created_at)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
