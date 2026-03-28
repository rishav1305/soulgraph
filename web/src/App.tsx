/**
 * App.tsx — Root component. Wires hooks → Layout → components.
 *
 * Integration map:
 *   useGraph(sessionId) → ChatInterface (messages, streaming, send, cancel)
 *                        → GraphViz (graphState)
 *                        → error display
 *   useSessions()       → SessionSidebar (sessions, active, create, delete)
 *                        → sessionId for useGraph
 *   useTuner()          → TunerDashboard (status, reset)
 *
 * Layout:
 *   ┌──────────┬──────────────────┬──────────────────┐
 *   │ Sidebar  │  ChatInterface   │  GraphViz        │
 *   │ Sessions │  (msg list +     │  EvalReport      │
 *   │          │   query input)   │  DocumentViewer   │
 *   │          │                  │  TunerDashboard  │
 *   └──────────┴──────────────────┴──────────────────┘
 */

import Layout from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import GraphViz from '@/components/GraphViz';
import TunerDashboard from '@/components/TunerDashboard';
import EvalReport from '@/components/EvalReport';
import DocumentViewer from '@/components/DocumentViewer';
import ChatInterface from '@/components/ChatInterface';
import SessionSidebar from '@/components/SessionSidebar';
import { TunerSkeleton, EvalSkeleton } from '@/components/Skeleton';
import { useGraph } from '@/hooks/useGraph';
import { useSessions } from '@/hooks/useSessions';
import { useTuner } from '@/hooks/useTuner';

export default function App() {
  // ── Session management ──
  const {
    sessions,
    activeSessionId,
    setActiveSession,
    createSession,
    deleteSession,
  } = useSessions();

  // ── Agent graph interaction ──
  const {
    messages,
    streaming,
    send,
    cancel,
    graphState,
    connectionStatus,
    error,
  } = useGraph(activeSessionId);

  // ── Tuner state ──
  const { status: tunerStatus, loading: tunerLoading, error: tunerError, reset: tunerReset } = useTuner();

  // ── Find the latest eval report + documents (from most recent assistant message) ──
  const latestAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const latestEval = latestAssistant?.evalReport ?? null;
  const latestDocs = latestAssistant?.documents ?? [];

  return (
    <Layout
      sidebar={
        <ErrorBoundary name="sidebar" compact>
          <SessionSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelect={setActiveSession}
            onNew={createSession}
            onDelete={deleteSession}
          />
        </ErrorBoundary>
      }
      rightPanel={
        <div className="flex flex-col gap-4 p-4">
          {/* Connection status indicator */}
          <div
            data-testid="connection-status"
            className="flex items-center gap-2 text-xs text-fg-muted"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-pass'
                  : connectionStatus === 'connecting'
                    ? 'bg-warn animate-pulse'
                    : connectionStatus === 'error'
                      ? 'bg-fail'
                      : 'bg-fg-muted'
              }`}
            />
            <span className="font-mono capitalize">{connectionStatus}</span>
          </div>

          {/* Agent graph visualization + eval report */}
          <ErrorBoundary name="visualization">
            <div>
              <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
                Agent Flow
              </h3>
              <GraphViz state={graphState} className="h-48" />
            </div>

            {latestEval ? (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
                  Latest Evaluation
                </h3>
                <EvalReport report={latestEval} />
              </div>
            ) : streaming ? (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
                  Latest Evaluation
                </h3>
                <EvalSkeleton />
              </div>
            ) : null}
          </ErrorBoundary>

          {/* Retrieved documents */}
          {latestDocs.length > 0 && (
            <ErrorBoundary name="documents" compact>
              <DocumentViewer documents={latestDocs} />
            </ErrorBoundary>
          )}

          {/* Tuner dashboard */}
          {tunerStatus ? (
            <ErrorBoundary name="tuner" compact>
              <TunerDashboard status={tunerStatus} onReset={tunerReset} />
            </ErrorBoundary>
          ) : tunerLoading ? (
            <TunerSkeleton />
          ) : tunerError ? (
            <div
              data-testid="tuner-error"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fail/5 border border-fail/20 text-fail text-xs"
              role="alert"
            >
              <span className="truncate">Tuner: {tunerError}</span>
            </div>
          ) : null}
        </div>
      }
    >
      {/* Main content: Chat interface */}
      <div data-testid="app-root" className="flex flex-col h-full">
        {/* Error banner */}
        {error && (
          <div
            data-testid="app-error"
            className="mx-4 mt-2 px-4 py-2 rounded-lg bg-fail/10 border border-fail/30 text-fail text-sm animate-fade-in"
            role="alert"
          >
            {error}
          </div>
        )}

        <ErrorBoundary name="chat">
          <ChatInterface
            messages={messages}
            streaming={streaming}
            onSend={send}
            onCancel={cancel}
          />
        </ErrorBoundary>
      </div>
    </Layout>
  );
}
