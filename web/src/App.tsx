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
 *   │ Sessions │  (msg list +     │  TunerDashboard  │
 *   │          │   query input)   │  EvalReport      │
 *   └──────────┴──────────────────┴──────────────────┘
 */

import Layout from '@/components/Layout';
import GraphViz from '@/components/GraphViz';
import TunerDashboard from '@/components/TunerDashboard';
import EvalReport from '@/components/EvalReport';
import ChatInterface from '@/components/ChatInterface';
import SessionSidebar from '@/components/SessionSidebar';
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
  const { status: tunerStatus, reset: tunerReset } = useTuner();

  // ── Find the latest eval report (from most recent assistant message) ──
  const latestEval = [...messages]
    .reverse()
    .find((m) => m.evalReport)?.evalReport ?? null;

  return (
    <Layout
      sidebar={
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={setActiveSession}
          onNew={createSession}
          onDelete={deleteSession}
        />
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

          {/* Agent graph visualization */}
          <div>
            <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
              Agent Flow
            </h3>
            <GraphViz state={graphState} className="h-48" />
          </div>

          {/* Latest eval report */}
          {latestEval && (
            <div>
              <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
                Latest Evaluation
              </h3>
              <EvalReport report={latestEval} />
            </div>
          )}

          {/* Tuner dashboard */}
          {tunerStatus && (
            <TunerDashboard status={tunerStatus} onReset={tunerReset} />
          )}
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

        <ChatInterface
          messages={messages}
          streaming={streaming}
          onSend={send}
          onCancel={cancel}
        />
      </div>
    </Layout>
  );
}
