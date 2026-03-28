/**
 * ErrorBoundary.tsx — Reusable React error boundary with styled fallback.
 * I5.1: Happy — Sprint Day 3
 *
 * Usage: Wrap any panel in App.tsx to isolate crashes.
 *   <ErrorBoundary name="sidebar">
 *     <SessionSidebar ... />
 *   </ErrorBoundary>
 *
 * Features:
 *   - Catches render errors without crashing the whole app
 *   - Styled fallback with error message + retry button
 *   - Panel name for identification in fallback UI
 *   - data-testid for verification
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  /** Display name shown in fallback UI (e.g. "sidebar", "chat", "visualization") */
  name: string;
  /** Content to render when no error */
  children: ReactNode;
  /** Optional compact mode for smaller panels */
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console for debugging — structured for observability
    console.error(`[ErrorBoundary:${this.props.name}]`, error, errorInfo.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { name, compact = false } = this.props;

      if (compact) {
        return (
          <div
            data-testid={`error-boundary-${name}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fail/5 border border-fail/20 text-fail"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3M8 10.5v.5" />
            </svg>
            <span className="text-xs flex-1 truncate">
              {name} error
            </span>
            <button
              type="button"
              data-testid={`error-boundary-retry-${name}`}
              onClick={this.handleRetry}
              className="text-xs text-fail hover:text-fail/80 underline cursor-pointer shrink-0"
              aria-label={`Retry ${name}`}
            >
              Retry
            </button>
          </div>
        );
      }

      return (
        <div
          data-testid={`error-boundary-${name}`}
          className="flex flex-col items-center justify-center gap-3 p-6 text-center h-full min-h-[120px]"
        >
          {/* Error icon */}
          <div className="w-10 h-10 rounded-full bg-fail/10 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--color-fail)" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="10" cy="10" r="8" />
              <path d="M10 6v4M10 13v.5" />
            </svg>
          </div>

          {/* Error message */}
          <div>
            <p className="text-sm font-medium text-fg mb-0.5">
              Something went wrong
            </p>
            <p className="text-xs text-fg-muted max-w-[200px]">
              The {name} panel encountered an error.
            </p>
          </div>

          {/* Retry button */}
          <button
            type="button"
            data-testid={`error-boundary-retry-${name}`}
            onClick={this.handleRetry}
            aria-label={`Retry loading ${name}`}
            className="px-3 py-1.5 rounded-lg bg-fail/10 text-fail text-xs font-medium hover:bg-fail/20 transition-colors cursor-pointer border border-fail/20"
          >
            Try Again
          </button>

          {/* Error details (dev only, collapsed) */}
          {this.state.error && (
            <details className="w-full max-w-[280px]">
              <summary className="text-[10px] text-fg-muted cursor-pointer hover:text-fg-secondary">
                Error details
              </summary>
              <pre className="mt-1 text-[10px] text-fail/70 font-mono whitespace-pre-wrap break-all bg-fail/5 rounded p-2 max-h-24 overflow-y-auto">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
