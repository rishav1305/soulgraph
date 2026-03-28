/**
 * Mock data factories — typed builders for all SoulGraph domain types.
 *
 * Every factory returns a valid default object. Override any field via spread.
 * Types are imported from the source of truth: @/lib/types.ts.
 *
 * Usage:
 *   const msg = createChatMessage({ role: 'user', content: 'Hello' });
 *   const report = createEvalReport({ passed: false });
 */

import type {
  ChatMessage,
  EvalReport,
  EvalHistoryEntry,
  GraphEdge,
  GraphState,
  Session,
  TunerStatus,
  TuningParams,
} from '@/lib/types';

// ─── Counters for deterministic unique IDs ──────────────────

let messageCounter = 0;
let sessionCounter = 0;

/** Reset all counters — call in beforeEach if ID determinism matters. */
export function resetFactoryCounters(): void {
  messageCounter = 0;
  sessionCounter = 0;
}

// ─── Chat Message ───────────────────────────────────────────

export function createChatMessage(
  overrides?: Partial<ChatMessage>,
): ChatMessage {
  messageCounter++;
  return {
    id: `msg-${messageCounter}`,
    role: 'assistant',
    content: 'This is a test assistant response.',
    timestamp: '2026-03-30T10:00:00.000Z',
    ...overrides,
  };
}

export function createUserMessage(
  content: string,
  overrides?: Partial<ChatMessage>,
): ChatMessage {
  return createChatMessage({ role: 'user', content, ...overrides });
}

export function createAssistantMessage(
  content: string,
  overrides?: Partial<ChatMessage>,
): ChatMessage {
  return createChatMessage({ role: 'assistant', content, ...overrides });
}

// ─── Eval Report ────────────────────────────────────────────

export function createEvalReport(
  overrides?: Partial<EvalReport>,
): EvalReport {
  return {
    question: 'What is RAG?',
    answer_length: 58,
    num_documents: 3,
    scores: {
      faithfulness: 0.92,
      answer_relevancy: 0.88,
      context_precision: 0.85,
      context_recall: 0.9,
    },
    passed: true,
    threshold: 0.7,
    ...overrides,
  };
}

export function createFailedEvalReport(
  overrides?: Partial<EvalReport>,
): EvalReport {
  return createEvalReport({
    scores: {
      faithfulness: 0.45,
      answer_relevancy: 0.3,
      context_precision: 0.5,
      context_recall: 0.4,
    },
    passed: false,
    ...overrides,
  });
}

export function createPartialEvalReport(
  overrides?: Partial<EvalReport>,
): EvalReport {
  return createEvalReport({
    scores: {
      faithfulness: 0.75,
      answer_relevancy: null,
      context_precision: null,
      context_recall: 0.6,
    },
    passed: null,
    ...overrides,
  });
}

export function createErrorEvalReport(
  overrides?: Partial<EvalReport>,
): EvalReport {
  return createEvalReport({
    scores: {},
    passed: null,
    error: 'Evaluation failed: insufficient context documents',
    ...overrides,
  });
}

// ─── Eval History Entry ─────────────────────────────────────

export function createEvalHistoryEntry(
  overrides?: Partial<EvalHistoryEntry>,
): EvalHistoryEntry {
  return {
    faithfulness: 0.85,
    answer_relevancy: 0.8,
    context_precision: 0.78,
    context_recall: 0.82,
    passed: true,
    ...overrides,
  };
}

// ─── Graph State ────────────────────────────────────────────

export function createGraphState(
  overrides?: Partial<GraphState>,
): GraphState {
  return {
    nodes: ['supervisor', 'rag', 'evaluator', 'tool'],
    edges: [
      { from: 'supervisor', to: 'rag' },
      { from: 'supervisor', to: 'tool' },
      { from: 'rag', to: 'evaluator' },
    ] satisfies GraphEdge[],
    activeNode: null,
    intent: null,
    ...overrides,
  };
}

export function createActiveGraphState(
  activeNode: GraphState['activeNode'],
  intent: string = 'question_answering',
): GraphState {
  return createGraphState({ activeNode, intent });
}

// ─── Session ────────────────────────────────────────────────

export function createSession(overrides?: Partial<Session>): Session {
  sessionCounter++;
  return {
    id: `session-${sessionCounter}`,
    label: `Session ${sessionCounter}`,
    created_at: '2026-03-30T09:00:00.000Z',
    ...overrides,
  };
}

export function createSessionList(count: number): Session[] {
  return Array.from({ length: count }, (_, i) =>
    createSession({
      label: `Session ${i + 1}`,
      last_message: i === 0 ? 'What is RAG?' : undefined,
    }),
  );
}

// ─── Tuner Status ───────────────────────────────────────────

export function createTuningParams(
  overrides?: Partial<TuningParams>,
): TuningParams {
  return {
    rag_k: 5,
    eval_threshold: 0.7,
    prefer_reasoning_model: false,
    ...overrides,
  };
}

export function createTunerStatus(
  overrides?: Partial<TunerStatus>,
): TunerStatus {
  return {
    params: createTuningParams(),
    history: [],
    adjustments: [],
    ...overrides,
  };
}

export function createTunerStatusWithHistory(
  historyCount: number = 5,
): TunerStatus {
  return createTunerStatus({
    history: Array.from({ length: historyCount }, () =>
      createEvalHistoryEntry(),
    ),
    adjustments: historyCount > 3 ? ['rag_k: 5 → 7 (context_recall low)'] : [],
  });
}
