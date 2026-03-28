/**
 * types.ts — Source of truth for all SoulGraph Web UI types.
 *
 * RULES:
 * 1. Everyone imports from here. No local type definitions.
 * 2. Only Shuri modifies this file. Propose changes via team chat.
 * 3. Types must match the SoulGraph Python backend exactly.
 *
 * Backend reference:
 *   soulgraph/state.py        → AgentState
 *   soulgraph/api.py          → QueryRequest, QueryResponse, WS protocol
 *   soulgraph/report.py       → EvalReport fields
 *   soulgraph/tuner.py        → AgentTuner.status() shape
 *   soulgraph/tune_params.py  → TuningParams fields
 */

// ─────────────────────────────────────────────────────────────
// WebSocket Protocol
// ─────────────────────────────────────────────────────────────

/** Client → Server: sent as JSON over WebSocket after connection. */
export interface QueryMessage {
  question: string;
  session_id: string;
}

/** Server → Client: one of five message types streamed back. */
export type WSMessage =
  | { type: 'token'; content: string }
  | { type: 'documents'; documents: string[] }
  | { type: 'eval'; report: EvalReport }
  | { type: 'done'; answer: string }
  | { type: 'error'; message: string };

// ─────────────────────────────────────────────────────────────
// Domain Types
// ─────────────────────────────────────────────────────────────

/**
 * Evaluation report from RAGAS metrics.
 * Matches: soulgraph/report.py EvalReport + soulgraph/agents/evaluator.py output.
 */
export interface EvalReport {
  question: string;
  answer_length: number;
  num_documents: number;
  scores: Record<string, number | null>;
  passed: boolean | null;
  threshold: number;
  error?: string;
}

/**
 * Tuner status from GET /tune/status.
 * Matches: soulgraph/tuner.py AgentTuner.status()
 */
export interface TunerStatus {
  params: TuningParams;
  history: EvalHistoryEntry[];
  adjustments: string[];
}

/**
 * Tuning parameters controlled by the AgentTuner.
 * Matches: soulgraph/tune_params.py TuningParams
 */
export interface TuningParams {
  rag_k: number;
  eval_threshold: number;
  prefer_reasoning_model: boolean;
}

/** Compact eval report stored in tuner history window. */
export interface EvalHistoryEntry {
  faithfulness: number | null;
  answer_relevancy: number | null;
  context_precision: number | null;
  context_recall: number | null;
  passed: boolean | null;
}

// ─────────────────────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────────────────────

/** A chat session (stored in localStorage). */
export interface Session {
  id: string;
  label: string;
  created_at: string;
  last_message?: string;
}

// ─────────────────────────────────────────────────────────────
// Graph Visualization
// ─────────────────────────────────────────────────────────────

/** Node IDs matching the LangGraph StateGraph node names. */
export type GraphNodeId = 'supervisor' | 'rag' | 'evaluator' | 'tool';

/** Directed edge in the agent graph. */
export interface GraphEdge {
  from: GraphNodeId;
  to: GraphNodeId;
}

/** Current state of the agent graph for visualization. */
export interface GraphState {
  nodes: GraphNodeId[];
  edges: GraphEdge[];
  activeNode: GraphNodeId | null;
  intent: string | null;
}

/** Default graph structure matching build_graph() in supervisor.py. */
export const DEFAULT_GRAPH_STATE: GraphState = {
  nodes: ['supervisor', 'rag', 'evaluator', 'tool'],
  edges: [
    { from: 'supervisor', to: 'rag' },
    { from: 'supervisor', to: 'tool' },
    { from: 'rag', to: 'evaluator' },
  ],
  activeNode: null,
  intent: null,
};

// ─────────────────────────────────────────────────────────────
// Chat Messages (UI layer — not from backend)
// ─────────────────────────────────────────────────────────────

/** A message in the chat UI. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  evalReport?: EvalReport;
  graphState?: GraphState;
  /** RAG-retrieved documents (from ChromaDB via the documents WS message). */
  documents?: string[];
}

// ─────────────────────────────────────────────────────────────
// Component Props (Contracts)
// ─────────────────────────────────────────────────────────────

/** Props for ChatInterface.tsx (Happy, C4) */
export interface ChatInterfaceProps {
  messages: ChatMessage[];
  streaming: boolean;
  onSend: (question: string) => void;
  onCancel: () => void;
}

/** Props for QueryInput.tsx (Happy, C1) */
export interface QueryInputProps {
  onSend: (question: string) => void;
  streaming: boolean;
  onCancel: () => void;
}

/** Props for MessageBubble.tsx (Happy, C2) */
export interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

/** Props for MessageList.tsx (Happy, C3) */
export interface MessageListProps {
  messages: ChatMessage[];
  streaming: boolean;
}

/** Props for SessionSidebar.tsx (Happy, C5) */
export interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

/** Props for EvalReport.tsx (Banner, C6) */
export interface EvalReportProps {
  report: EvalReport;
  compact?: boolean;
}

/** Props for GraphViz.tsx (Banner, C7) */
export interface GraphVizProps {
  state: GraphState;
  className?: string;
}

/** Props for TunerDashboard.tsx (Banner, C8) */
export interface TunerDashboardProps {
  status: TunerStatus;
  onReset: () => void;
}

// ─────────────────────────────────────────────────────────────
// Hook Return Types
// ─────────────────────────────────────────────────────────────

/** Return type for useGraph hook (Shuri, S4) */
export interface UseGraphReturn {
  messages: ChatMessage[];
  streaming: boolean;
  send: (question: string) => void;
  cancel: () => void;
  graphState: GraphState;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'error';
  error: string | null;
}

/** Return type for useTuner hook (Banner, C8) */
export interface UseTunerReturn {
  status: TunerStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  reset: () => Promise<void>;
}

/** Return type for useSessions hook (Shuri, S5) */
export interface UseSessionsReturn {
  sessions: Session[];
  activeSessionId: string;
  setActiveSession: (id: string) => void;
  createSession: () => string;
  deleteSession: (id: string) => void;
}
