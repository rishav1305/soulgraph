/**
 * ErrorBoundary.test.tsx — Unit tests for the reusable error boundary.
 *
 * Tests:
 * - Normal rendering: children render when no error
 * - Error catching: fallback UI shown when child throws
 * - Compact mode: smaller inline fallback
 * - Full mode: centered fallback with icon + details
 * - Retry: clicking retry clears error and re-renders children
 * - data-testid: boundary and retry button use name prop
 * - Logging: componentDidCatch logs with [ErrorBoundary:{name}] prefix
 *
 * Owner: Happy (I5.1 proactive test coverage) | Sprint Day 5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import ErrorBoundary from '@/components/ErrorBoundary';
import { render, screen, fireEvent } from '../helpers/render';

// ─── Helpers ─────────────────────────────────────────────────

/** Component that throws on render — triggers error boundary. */
function ThrowingChild({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render error');
  }
  return <div data-testid="child-content">Child rendered OK</div>;
}

// Suppress console.error noise from React's error boundary logging
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ─── Normal Rendering ────────────────────────────────────────

describe('ErrorBoundary — Normal Rendering', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary name="test-panel">
        <div data-testid="child-content">Hello</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('child-content')).toHaveTextContent('Hello');
    expect(screen.queryByTestId('error-boundary-test-panel')).not.toBeInTheDocument();
  });

  it('does not show retry button when no error', () => {
    render(
      <ErrorBoundary name="sidebar">
        <div>Working fine</div>
      </ErrorBoundary>,
    );
    expect(screen.queryByTestId('error-boundary-retry-sidebar')).not.toBeInTheDocument();
  });
});

// ─── Full Mode (Default) ────────────────────────────────────

describe('ErrorBoundary — Full Mode', () => {
  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary name="chat">
        <ThrowingChild />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('error-boundary-chat')).toBeInTheDocument();
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
  });

  it('shows "Something went wrong" message', () => {
    render(
      <ErrorBoundary name="visualization">
        <ThrowingChild />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('error-boundary-visualization')).toHaveTextContent(
      'Something went wrong',
    );
  });

  it('shows panel name in error description', () => {
    render(
      <ErrorBoundary name="visualization">
        <ThrowingChild />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('error-boundary-visualization')).toHaveTextContent(
      'The visualization panel encountered an error',
    );
  });

  it('renders retry button with correct data-testid', () => {
    render(
      <ErrorBoundary name="chat">
        <ThrowingChild />
      </ErrorBoundary>,
    );
    const retryBtn = screen.getByTestId('error-boundary-retry-chat');
    expect(retryBtn).toBeInTheDocument();
    expect(retryBtn).toHaveTextContent('Try Again');
  });

  it('retry button has accessible label', () => {
    render(
      <ErrorBoundary name="chat">
        <ThrowingChild />
      </ErrorBoundary>,
    );
    const retryBtn = screen.getByTestId('error-boundary-retry-chat');
    expect(retryBtn).toHaveAttribute('aria-label', 'Retry loading chat');
  });

  it('shows error details in collapsible section', () => {
    render(
      <ErrorBoundary name="chat">
        <ThrowingChild />
      </ErrorBoundary>,
    );
    // Details element with error message
    const details = screen.getByTestId('error-boundary-chat').querySelector('details');
    expect(details).not.toBeNull();
    expect(details!.textContent).toContain('Test render error');
  });
});

// ─── Compact Mode ───────────────────────────────────────────

describe('ErrorBoundary — Compact Mode', () => {
  it('renders compact fallback when compact=true', () => {
    render(
      <ErrorBoundary name="sidebar" compact>
        <ThrowingChild />
      </ErrorBoundary>,
    );
    const boundary = screen.getByTestId('error-boundary-sidebar');
    expect(boundary).toBeInTheDocument();
    expect(boundary).toHaveTextContent('sidebar error');
  });

  it('compact mode does not show "Something went wrong"', () => {
    render(
      <ErrorBoundary name="tuner" compact>
        <ThrowingChild />
      </ErrorBoundary>,
    );
    const boundary = screen.getByTestId('error-boundary-tuner');
    expect(boundary).not.toHaveTextContent('Something went wrong');
  });

  it('compact mode has retry button with correct data-testid', () => {
    render(
      <ErrorBoundary name="tuner" compact>
        <ThrowingChild />
      </ErrorBoundary>,
    );
    const retryBtn = screen.getByTestId('error-boundary-retry-tuner');
    expect(retryBtn).toBeInTheDocument();
    expect(retryBtn).toHaveTextContent('Retry');
  });

  it('compact retry button has accessible label', () => {
    render(
      <ErrorBoundary name="sidebar" compact>
        <ThrowingChild />
      </ErrorBoundary>,
    );
    const retryBtn = screen.getByTestId('error-boundary-retry-sidebar');
    expect(retryBtn).toHaveAttribute('aria-label', 'Retry sidebar');
  });

  it('compact mode does not show error details section', () => {
    render(
      <ErrorBoundary name="sidebar" compact>
        <ThrowingChild />
      </ErrorBoundary>,
    );
    const details = screen.getByTestId('error-boundary-sidebar').querySelector('details');
    expect(details).toBeNull();
  });
});

// ─── Retry Behavior ─────────────────────────────────────────

describe('ErrorBoundary — Retry', () => {
  it('clears error state when retry button clicked', () => {
    // First render with throwing child, then retry renders non-throwing child
    let shouldThrow = true;

    function ConditionalChild() {
      if (shouldThrow) {
        throw new Error('Temporary failure');
      }
      return <div data-testid="child-content">Recovered</div>;
    }

    render(
      <ErrorBoundary name="chat">
        <ConditionalChild />
      </ErrorBoundary>,
    );

    // Error state: fallback shown
    expect(screen.getByTestId('error-boundary-chat')).toBeInTheDocument();

    // Fix the error condition
    shouldThrow = false;

    // Click retry
    fireEvent.click(screen.getByTestId('error-boundary-retry-chat'));

    // Children should re-render successfully
    expect(screen.getByTestId('child-content')).toHaveTextContent('Recovered');
    expect(screen.queryByTestId('error-boundary-chat')).not.toBeInTheDocument();
  });

  it('compact mode retry also clears error state', () => {
    let shouldThrow = true;

    function ConditionalChild() {
      if (shouldThrow) {
        throw new Error('Temporary failure');
      }
      return <div data-testid="child-content">OK</div>;
    }

    render(
      <ErrorBoundary name="sidebar" compact>
        <ConditionalChild />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('error-boundary-sidebar')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByTestId('error-boundary-retry-sidebar'));

    expect(screen.getByTestId('child-content')).toHaveTextContent('OK');
  });
});

// ─── Logging ─────────────────────────────────────────────────

describe('ErrorBoundary — Logging', () => {
  it('logs error with boundary name prefix', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary name="graph-viz">
        <ThrowingChild />
      </ErrorBoundary>,
    );

    // React calls console.error multiple times — find our structured log
    const structuredCall = consoleSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('[ErrorBoundary:graph-viz]'),
    );
    expect(structuredCall).toBeDefined();
  });
});

// ─── data-testid with different names ────────────────────────

describe('ErrorBoundary — Name Prop', () => {
  it.each(['sidebar', 'chat', 'visualization', 'tuner', 'documents'])(
    'uses "%s" in data-testid',
    (name) => {
      render(
        <ErrorBoundary name={name}>
          <ThrowingChild />
        </ErrorBoundary>,
      );
      expect(screen.getByTestId(`error-boundary-${name}`)).toBeInTheDocument();
      expect(screen.getByTestId(`error-boundary-retry-${name}`)).toBeInTheDocument();
    },
  );
});
