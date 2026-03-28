/**
 * Mock data for GraphViz.tsx (C7)
 * Based on types.ts GraphState, GraphNodeId, GraphEdge interfaces.
 * Represents the SoulGraph supervisor → agent routing flow.
 *
 * Graph structure (from supervisor.py build_graph()):
 *   supervisor → conditional(rag | tool) → evaluator → END
 *   - supervisor decides: rag or tool based on intent
 *   - rag → evaluator (always)
 *   - tool → END (direct, no evaluation)
 */

import type { GraphState, GraphNodeId, GraphEdge, GraphVizProps } from '@/lib/types';

// ── Standard edge set (matches supervisor.py build_graph()) ──
const STANDARD_EDGES: GraphEdge[] = [
  { from: 'supervisor', to: 'rag' },
  { from: 'supervisor', to: 'tool' },
  { from: 'rag', to: 'evaluator' },
  // tool → END is implicit (no evaluator node target)
];

const ALL_NODES: GraphNodeId[] = ['supervisor', 'rag', 'evaluator', 'tool'];

// ── Idle state — no active query ──
export const mockGraphStateIdle: GraphState = {
  nodes: ALL_NODES,
  edges: STANDARD_EDGES,
  activeNode: null,
  intent: null,
};

// ── Supervisor deciding — query just received ──
export const mockGraphStateSupervisor: GraphState = {
  nodes: ALL_NODES,
  edges: STANDARD_EDGES,
  activeNode: 'supervisor',
  intent: 'Routing query: analyzing intent...',
};

// ── RAG agent active — retrieving documents ──
export const mockGraphStateRag: GraphState = {
  nodes: ALL_NODES,
  edges: STANDARD_EDGES,
  activeNode: 'rag',
  intent: 'RAG retrieval: searching ChromaDB for relevant documents',
};

// ── Tool agent active — running calculation ──
export const mockGraphStateTool: GraphState = {
  nodes: ALL_NODES,
  edges: STANDARD_EDGES,
  activeNode: 'tool',
  intent: 'Tool execution: running safe AST calculator',
};

// ── Evaluator active — computing RAGAS metrics ──
export const mockGraphStateEvaluator: GraphState = {
  nodes: ALL_NODES,
  edges: STANDARD_EDGES,
  activeNode: 'evaluator',
  intent: 'Evaluation: computing RAGAS metrics (faithfulness, relevancy, precision, recall)',
};

// ── Props combinations ──
export const mockGraphVizPropsIdle: GraphVizProps = {
  state: mockGraphStateIdle,
};

export const mockGraphVizPropsActive: GraphVizProps = {
  state: mockGraphStateRag,
  className: 'h-64',
};

// ── Animation sequence — simulates a full query lifecycle ──
export const mockGraphAnimationSequence: GraphState[] = [
  mockGraphStateSupervisor,  // Step 1: supervisor routes
  mockGraphStateRag,         // Step 2: RAG retrieves
  mockGraphStateEvaluator,   // Step 3: evaluator scores
  mockGraphStateIdle,        // Step 4: done
];

// ── Tool path animation sequence ──
export const mockGraphToolSequence: GraphState[] = [
  mockGraphStateSupervisor,  // Step 1: supervisor routes
  mockGraphStateTool,        // Step 2: tool executes
  mockGraphStateIdle,        // Step 3: done (no evaluator)
];

/**
 * Node layout positions for SVG rendering.
 * Diamond pattern: supervisor top, rag left, tool right, evaluator bottom.
 * Coordinates are relative to a 400x300 viewBox.
 */
export const NODE_POSITIONS: Record<GraphNodeId, { x: number; y: number }> = {
  supervisor: { x: 200, y: 40 },
  rag: { x: 80, y: 150 },
  tool: { x: 320, y: 150 },
  evaluator: { x: 200, y: 260 },
};

/**
 * Node display labels and icons.
 */
export const NODE_LABELS: Record<GraphNodeId, { label: string; icon: string }> = {
  supervisor: { label: 'Supervisor', icon: 'brain' },
  rag: { label: 'RAG Agent', icon: 'search' },
  tool: { label: 'Tool Agent', icon: 'wrench' },
  evaluator: { label: 'Evaluator', icon: 'chart' },
};
