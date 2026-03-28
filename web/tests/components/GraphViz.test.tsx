/**
 * GraphViz.test.tsx — Unit tests for the SVG agent graph visualization.
 *
 * Tests:
 * - Rendering: nodes, edges, END markers, SVG structure
 * - Active node states: supervisor, rag, tool, evaluator, idle (null)
 * - Edge highlighting: edges to/from active node get active styling
 * - Intent display: shown when present, hidden when null
 * - Accessibility: role="img" and aria-label
 *
 * Owner: Stark (C10) | Sprint Day 2
 */

import { describe, it, expect } from 'vitest';
import GraphViz from '@/components/GraphViz';
import { render, screen } from '../helpers/render';
import { createGraphState, createActiveGraphState } from '../helpers/factories';
import type { GraphState, GraphNodeId } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────

function renderGraphViz(overrides?: Partial<GraphState>, className?: string) {
  const state = createGraphState(overrides);
  return render(<GraphViz state={state} className={className} />);
}

// ─── Rendering Basics ─────────────────────────────────────────

describe('GraphViz — Rendering', () => {
  it('renders without crashing', () => {
    renderGraphViz();
    expect(screen.getByTestId('graph-viz')).toBeInTheDocument();
  });

  it('renders all four agent nodes', () => {
    renderGraphViz();
    expect(screen.getByTestId('graph-node-supervisor')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node-rag')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node-tool')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node-evaluator')).toBeInTheDocument();
  });

  it('renders END node marker', () => {
    renderGraphViz();
    expect(screen.getByTestId('graph-node-end')).toBeInTheDocument();
  });

  it('renders edges between nodes', () => {
    renderGraphViz();
    expect(screen.getByTestId('graph-edge-supervisor-rag')).toBeInTheDocument();
    expect(screen.getByTestId('graph-edge-supervisor-tool')).toBeInTheDocument();
    expect(screen.getByTestId('graph-edge-rag-evaluator')).toBeInTheDocument();
  });

  it('renders SVG with correct viewBox', () => {
    renderGraphViz();
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('viewBox', '0 0 400 320');
  });

  it('renders SVG with aria-label', () => {
    renderGraphViz();
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('aria-label', 'SoulGraph agent routing diagram');
  });

  it('renders node labels', () => {
    renderGraphViz();
    const supervisorNode = screen.getByTestId('graph-node-supervisor');
    expect(supervisorNode).toHaveTextContent('Supervisor');

    const ragNode = screen.getByTestId('graph-node-rag');
    expect(ragNode).toHaveTextContent('RAG Agent');

    const toolNode = screen.getByTestId('graph-node-tool');
    expect(toolNode).toHaveTextContent('Tool Agent');

    const evaluatorNode = screen.getByTestId('graph-node-evaluator');
    expect(evaluatorNode).toHaveTextContent('Evaluator');
  });

  it('applies custom className', () => {
    renderGraphViz(undefined, 'my-custom-class');
    const container = screen.getByTestId('graph-viz');
    expect(container.className).toContain('my-custom-class');
  });
});

// ─── Active Node States ───────────────────────────────────────

describe('GraphViz — Idle State (no active node)', () => {
  it('does not display intent when null', () => {
    renderGraphViz({ activeNode: null, intent: null });
    expect(screen.queryByTestId('graph-intent')).not.toBeInTheDocument();
  });
});

describe('GraphViz — Active Node States', () => {
  const nodeIds: GraphNodeId[] = ['supervisor', 'rag', 'tool', 'evaluator'];

  nodeIds.forEach((nodeId) => {
    it(`renders active glow for ${nodeId} when active`, () => {
      const state = createActiveGraphState(nodeId, 'question_answering');
      render(<GraphViz state={state} />);

      const node = screen.getByTestId(`graph-node-${nodeId}`);
      // Active node should have the pulse animation class in its glow rect
      const rects = node.querySelectorAll('rect');
      const hasGlowRect = Array.from(rects).some(
        (rect) => rect.classList.contains('animate-pulse-soul'),
      );
      expect(hasGlowRect).toBe(true);
    });
  });

  it('only the active node has glow animation', () => {
    const state = createActiveGraphState('rag', 'question_answering');
    render(<GraphViz state={state} />);

    // rag should have glow
    const ragNode = screen.getByTestId('graph-node-rag');
    const ragGlow = ragNode.querySelectorAll('.animate-pulse-soul');
    expect(ragGlow.length).toBe(1);

    // supervisor should NOT have glow
    const supNode = screen.getByTestId('graph-node-supervisor');
    const supGlow = supNode.querySelectorAll('.animate-pulse-soul');
    expect(supGlow.length).toBe(0);

    // tool should NOT have glow
    const toolNode = screen.getByTestId('graph-node-tool');
    const toolGlow = toolNode.querySelectorAll('.animate-pulse-soul');
    expect(toolGlow.length).toBe(0);
  });
});

// ─── Edge Highlighting ────────────────────────────────────────

describe('GraphViz — Edge Highlighting', () => {
  it('highlights edges TO the active node', () => {
    const state = createActiveGraphState('rag');
    render(<GraphViz state={state} />);

    // Edge supervisor → rag should be highlighted (rag is active, edge.to === rag)
    const edge = screen.getByTestId('graph-edge-supervisor-rag');
    const path = edge.querySelector('path');
    // Active edge has strokeWidth of 2
    expect(path?.getAttribute('stroke-width')).toBe('2');
  });

  it('highlights edges FROM the active node', () => {
    const state = createActiveGraphState('rag');
    render(<GraphViz state={state} />);

    // Edge rag → evaluator should be highlighted (rag is active, edge.from === rag)
    const edge = screen.getByTestId('graph-edge-rag-evaluator');
    const path = edge.querySelector('path');
    expect(path?.getAttribute('stroke-width')).toBe('2');
  });

  it('does not highlight unrelated edges', () => {
    const state = createActiveGraphState('evaluator');
    render(<GraphViz state={state} />);

    // Edge supervisor → tool has nothing to do with evaluator
    const edge = screen.getByTestId('graph-edge-supervisor-tool');
    const path = edge.querySelector('path');
    expect(path?.getAttribute('stroke-width')).toBe('1');
  });

  it('no edges are highlighted when idle', () => {
    renderGraphViz({ activeNode: null });

    // All edges should have strokeWidth 1
    const edges = ['supervisor-rag', 'supervisor-tool', 'rag-evaluator'];
    edges.forEach((key) => {
      const edge = screen.getByTestId(`graph-edge-${key}`);
      const path = edge.querySelector('path');
      expect(path?.getAttribute('stroke-width')).toBe('1');
    });
  });

  it('shows animated flow dot on active edges', () => {
    const state = createActiveGraphState('rag');
    render(<GraphViz state={state} />);

    // Edge supervisor → rag should have animateMotion element
    const edge = screen.getByTestId('graph-edge-supervisor-rag');
    const animateMotion = edge.querySelector('animateMotion');
    expect(animateMotion).not.toBeNull();
  });

  it('does not show animated flow dot on inactive edges', () => {
    const state = createActiveGraphState('evaluator');
    render(<GraphViz state={state} />);

    // Edge supervisor → tool is not on evaluator path
    const edge = screen.getByTestId('graph-edge-supervisor-tool');
    const animateMotion = edge.querySelector('animateMotion');
    expect(animateMotion).toBeNull();
  });
});

// ─── Intent Display ───────────────────────────────────────────

describe('GraphViz — Intent Display', () => {
  it('shows intent text when present', () => {
    const state = createActiveGraphState('supervisor', 'question_answering');
    render(<GraphViz state={state} />);
    const intent = screen.getByTestId('graph-intent');
    expect(intent).toHaveTextContent('question_answering');
  });

  it('hides intent when null', () => {
    renderGraphViz({ activeNode: 'rag', intent: null });
    expect(screen.queryByTestId('graph-intent')).not.toBeInTheDocument();
  });

  it('shows different intent strings', () => {
    const state = createActiveGraphState('tool', 'tool_execution');
    render(<GraphViz state={state} />);
    expect(screen.getByTestId('graph-intent')).toHaveTextContent('tool_execution');
  });
});

// ─── Edge Cases ───────────────────────────────────────────────

describe('GraphViz — Edge Cases', () => {
  it('renders with minimal graph (no edges)', () => {
    render(
      <GraphViz
        state={{
          nodes: ['supervisor', 'rag', 'evaluator', 'tool'],
          edges: [],
          activeNode: null,
          intent: null,
        }}
      />,
    );
    expect(screen.getByTestId('graph-viz')).toBeInTheDocument();
    // Nodes still render
    expect(screen.getByTestId('graph-node-supervisor')).toBeInTheDocument();
  });

  it('renders with empty className', () => {
    renderGraphViz(undefined, '');
    expect(screen.getByTestId('graph-viz')).toBeInTheDocument();
  });

  it('renders arrow markers in defs', () => {
    renderGraphViz();
    const svg = screen.getByRole('img');
    const activeMarker = svg.querySelector('#arrow-active');
    const inactiveMarker = svg.querySelector('#arrow-inactive');
    expect(activeMarker).not.toBeNull();
    expect(inactiveMarker).not.toBeNull();
  });
});
