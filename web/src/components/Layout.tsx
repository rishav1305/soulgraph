/**
 * Layout.tsx — App shell with sidebar + main content area.
 * S7: Happy — Sprint Day 1
 *
 * Responsive:
 *   - Desktop (>=768px): sidebar visible, main content fills remaining space
 *   - Mobile (<768px): sidebar collapsed, hamburger toggle, overlay mode
 *
 * Accessibility:
 *   - Skip-to-content link
 *   - role="navigation" on sidebar
 *   - aria-labels on all icon-only buttons
 *   - aria-expanded on collapsible sidebar
 */

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';

interface LayoutProps {
  /** Sidebar content (SessionSidebar component) */
  sidebar: ReactNode;
  /** Main content area (ChatInterface, EvalReport, etc.) */
  children: ReactNode;
  /** Optional right panel (GraphViz, TunerDashboard) */
  rightPanel?: ReactNode;
}

export default function Layout({ sidebar, children, rightPanel }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarToggleRef = useRef<HTMLButtonElement>(null);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    // Return focus to toggle button when closing
    sidebarToggleRef.current?.focus();
  }, []);

  // Escape key closes mobile sidebar
  useEffect(() => {
    if (!sidebarOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSidebar();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, closeSidebar]);

  return (
    <div data-testid="layout-root" className="h-screen flex flex-col bg-deep text-fg overflow-hidden">
      {/* Skip-to-content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-soul focus:text-deep focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* ── Top bar (mobile only) ── */}
      <header
        data-testid="layout-header"
        className="md:hidden flex items-center h-12 px-4 bg-surface border-b border-border-default shrink-0"
      >
        <button
          ref={sidebarToggleRef}
          type="button"
          data-testid="layout-sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={sidebarOpen}
          aria-controls="layout-sidebar-nav"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-fg-secondary hover:text-fg hover:bg-elevated transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-soul"
        >
          {sidebarOpen ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 5h12M3 9h12M3 13h12" />
            </svg>
          )}
        </button>
        <div className="flex items-center gap-2 ml-3">
          <span className="text-soul text-lg leading-none">&#9670;</span>
          <span className="font-display text-sm font-bold text-fg">SoulGraph</span>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Sidebar (desktop: always visible, mobile: overlay) ── */}

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            data-testid="layout-sidebar-backdrop"
            aria-hidden="true"
            className="md:hidden fixed inset-0 z-30 bg-black/50"
            onClick={closeSidebar}
          />
        )}

        <nav
          id="layout-sidebar-nav"
          data-testid="layout-sidebar"
          role="navigation"
          aria-label="Session navigation"
          className={`
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0
            fixed md:relative
            z-40 md:z-auto
            w-64 md:w-64
            h-full
            bg-surface
            border-r border-border-default
            flex flex-col
            transition-transform duration-200
            shrink-0
          `}
        >
          {/* Sidebar header (desktop) */}
          <div data-testid="layout-sidebar-header" className="hidden md:flex items-center gap-2 px-4 h-14 border-b border-border-default shrink-0">
            <span className="relative">
              <span className="absolute inset-0 -m-1 bg-soul/15 rounded-full blur-md animate-soul-pulse pointer-events-none" />
              <span className="relative text-2xl text-soul leading-none drop-shadow-[0_0_8px_var(--color-soul)]">&#9670;</span>
            </span>
            <span className="font-display text-lg font-bold text-fg tracking-tight">SoulGraph</span>
          </div>

          {/* Sidebar content — SessionSidebar goes here */}
          <div data-testid="layout-sidebar-content" className="flex-1 min-h-0 overflow-y-auto">
            {sidebar}
          </div>

          {/* Sidebar footer — connection status, version */}
          <div data-testid="layout-sidebar-footer" className="px-4 py-3 border-t border-border-default shrink-0">
            <div className="text-[10px] text-fg-muted font-mono">SoulGraph v0.2.0</div>
          </div>
        </nav>

        {/* ── Main content area ── */}
        <main
          id="main-content"
          data-testid="layout-main"
          className="flex-1 flex min-h-0 min-w-0 overflow-hidden"
        >
          {/* Primary content (ChatInterface) */}
          <div data-testid="layout-content" className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            {children}
          </div>

          {/* Right panel (GraphViz, TunerDashboard — desktop only) */}
          {rightPanel && (
            <aside
              data-testid="layout-right-panel"
              aria-label="Agent visualization"
              className="hidden lg:flex flex-col w-80 xl:w-96 h-full bg-surface border-l border-border-default shrink-0 overflow-y-auto"
            >
              {rightPanel}
            </aside>
          )}
        </main>
      </div>
    </div>
  );
}
