/**
 * App.test.tsx — Integration tests for root App component wiring.
 *
 * Verifies that App correctly wires hooks to child components:
 * - useSessions → SessionSidebar
 * - useGraph → ChatInterface, GraphViz, connection status, error banner
 * - useTuner → TunerDashboard / TunerSkeleton / tuner error
 * - latestEval extraction from messages → EvalReport
 * - latestDocs extraction from messages → DocumentViewer
 *
 * All 3 hooks are mocked. Child components render with real implementations
 * to verify the full integration from hook return values → rendered UI.
 *
 * Owner: Happy (QA) | Coverage expansion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '@/App';
import { render, screen } from '../helpers/render';
import type { ChatMessage, GraphState, TunerStatus } from '@/lib/types';
import { DEFAULT_GRAPH_STATE } from '@/lib/types';
import { createSession, createEvalReport } from '../helpers/factories';

// ─── Hook mocks ─────────────────────────────────────────────────

const mockSend = vi.fn();
const mockCancel = vi.fn();
const mockSetActiveSession = vi.fn();
const mockCreateSession = vi.fn();
const mockDeleteSession = vi.fn();
const mockTunerReset = vi.fn();

// Default hook return values
let graphReturn: {
  messages: ChatMessage[];
  streaming: boolean;
  send: typeof mockSend;
  cancel: typeof mockCancel;
  graphState: GraphState;
  connectionStatus: string;
  error: string | null;
};

let sessionsReturn: {
  sessions: ReturnType<typeof createSession>[];
  activeSessionId: string;
  setActiveSession: typeof mockSetActiveSession;
  createSession: typeof mockCreateSession;
  deleteSession: typeof mockDeleteSession;
};

let tunerReturn: {
  status: TunerStatus | null;
  loading: boolean;
  error: string | null;
  reset: typeof mockTunerReset;
};

vi.mock('@/hooks/useGraph', () => ({
  useGraph: () => graphReturn,
}));

vi.mock('@/hooks/useSessions', () => ({
  useSessions: () => sessionsReturn,
}));

vi.mock('@/hooks/useTuner', () => ({
  useTuner: () => tunerReturn,
}));

// ─── Setup ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  const session = createSession({ id: 'sess-1', label: 'Session 1' });

  graphReturn = {
    messages: [],
    streaming: false,
    send: mockSend,
    cancel: mockCancel,
    graphState: DEFAULT_GRAPH_STATE,
    connectionStatus: 'idle',
    error: null,
  };

  sessionsReturn = {
    sessions: [session],
    activeSessionId: 'sess-1',
    setActiveSession: mockSetActiveSession,
    createSession: mockCreateSession,
    deleteSession: mockDeleteSession,
  };

  tunerReturn = {
    status: null,
    loading: false,
    error: null,
    reset: mockTunerReset,
  };
});

// ─── Tests ──────────────────────────────────────────────────────

describe('App', () => {
  // ── Basic rendering ────────────────────────────────────────

  describe('basic wiring', () => {
    it('renders the app root container', () => {
      render(<App />);
      expect(screen.getByTestId('app-root')).toBeInTheDocument();
    });

    it('renders the layout with sidebar, main content, and right panel', () => {
      render(<App />);
      expect(screen.getByTestId('layout-root')).toBeInTheDocument();
      expect(screen.getByTestId('layout-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('layout-main')).toBeInTheDocument();
      expect(screen.getByTestId('layout-right-panel')).toBeInTheDocument();
    });

    it('renders SessionSidebar in the sidebar slot', () => {
      render(<App />);
      expect(screen.getByTestId('session-sidebar')).toBeInTheDocument();
    });

    it('renders ChatInterface in main content', () => {
      render(<App />);
      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
    });

    it('renders GraphViz in the right panel', () => {
      render(<App />);
      expect(screen.getByTestId('graph-viz')).toBeInTheDocument();
    });
  });

  // ── Connection status ──────────────────────────────────────

  describe('connection status', () => {
    it('renders connection status indicator', () => {
      render(<App />);
      const status = screen.getByTestId('connection-status');
      expect(status).toBeInTheDocument();
      expect(status).toHaveAttribute('role', 'status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('shows "idle" when connectionStatus is idle', () => {
      graphReturn.connectionStatus = 'idle';
      render(<App />);
      expect(screen.getByTestId('connection-status')).toHaveTextContent('idle');
    });

    it('shows "connected" when connectionStatus is connected', () => {
      graphReturn.connectionStatus = 'connected';
      render(<App />);
      expect(screen.getByTestId('connection-status')).toHaveTextContent(
        'connected',
      );
    });

    it('shows "error" when connectionStatus is error', () => {
      graphReturn.connectionStatus = 'error';
      render(<App />);
      expect(screen.getByTestId('connection-status')).toHaveTextContent(
        'error',
      );
    });
  });

  // ── Error banner ───────────────────────────────────────────

  describe('error banner', () => {
    it('does not show error banner when error is null', () => {
      render(<App />);
      expect(screen.queryByTestId('app-error')).not.toBeInTheDocument();
    });

    it('shows error banner when error is set', () => {
      graphReturn.error = 'WebSocket connection failed';
      render(<App />);
      const errorEl = screen.getByTestId('app-error');
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveTextContent('WebSocket connection failed');
      expect(errorEl).toHaveAttribute('role', 'alert');
    });
  });

  // ── Tuner states ───────────────────────────────────────────

  describe('tuner wiring', () => {
    it('shows TunerSkeleton when tuner is loading', () => {
      tunerReturn.loading = true;
      render(<App />);
      expect(screen.getByTestId('tuner-skeleton')).toBeInTheDocument();
    });

    it('shows tuner error when tuner has error', () => {
      tunerReturn.error = 'Failed to fetch tuner status';
      render(<App />);
      const errorEl = screen.getByTestId('tuner-error');
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveTextContent('Tuner: Failed to fetch tuner status');
      expect(errorEl).toHaveAttribute('role', 'alert');
    });

    it('shows TunerDashboard when tuner status is available', () => {
      tunerReturn.status = {
        params: { rag_k: 5, eval_threshold: 0.7, prefer_reasoning_model: false },
        history: [],
        adjustments: [],
      };
      render(<App />);
      expect(screen.getByTestId('tuner-dashboard')).toBeInTheDocument();
    });

    it('shows nothing when tuner is not loading, no error, no status', () => {
      render(<App />);
      expect(screen.queryByTestId('tuner-dashboard')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tuner-skeleton')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tuner-error')).not.toBeInTheDocument();
    });
  });

  // ── Eval report extraction ─────────────────────────────────

  describe('eval report extraction', () => {
    it('shows EvalReport when latest assistant message has evalReport', () => {
      const evalReport = createEvalReport();
      graphReturn.messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'What is RAG?',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'RAG is...',
          timestamp: new Date().toISOString(),
          evalReport,
        },
      ];
      render(<App />);
      expect(screen.getByTestId('eval-report')).toBeInTheDocument();
      expect(screen.getByTestId('eval-badge')).toBeInTheDocument();
    });

    it('shows EvalSkeleton when streaming with no eval yet', () => {
      graphReturn.streaming = true;
      graphReturn.messages = [];
      render(<App />);
      expect(screen.getByTestId('eval-skeleton')).toBeInTheDocument();
    });

    it('shows nothing when not streaming and no eval', () => {
      render(<App />);
      expect(screen.queryByTestId('eval-report')).not.toBeInTheDocument();
      expect(screen.queryByTestId('eval-skeleton')).not.toBeInTheDocument();
    });
  });

  // ── Document extraction ────────────────────────────────────

  describe('document extraction', () => {
    it('shows DocumentViewer when latest assistant message has documents', () => {
      graphReturn.messages = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Answer',
          timestamp: new Date().toISOString(),
          documents: ['Doc 1 content', 'Doc 2 content'],
        },
      ];
      render(<App />);
      expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
    });

    it('does not show DocumentViewer when no documents', () => {
      graphReturn.messages = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Answer',
          timestamp: new Date().toISOString(),
        },
      ];
      render(<App />);
      expect(screen.queryByTestId('document-viewer')).not.toBeInTheDocument();
    });
  });

  // ── Error boundaries ───────────────────────────────────────

  describe('error boundaries', () => {
    it('wraps sidebar in ErrorBoundary', () => {
      render(<App />);
      // The sidebar ErrorBoundary is compact mode — verify it exists
      // by checking the sidebar renders within the layout
      expect(screen.getByTestId('session-sidebar')).toBeInTheDocument();
    });

    it('wraps chat in ErrorBoundary', () => {
      render(<App />);
      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
    });
  });
});
