/**
 * GraphViz.test.tsx — Unit tests for the SVG agent graph visualization.
 *
 * Tests:
 * - Rendering: nodes, edges, END markers, SVG structure
 * - Active node states: supervisor, rag, tool, evaluator, idle (null)
 * - Edge highlighting: edges to/from active node get active styling
 * - Intent display: shown when present, hidden when null
 * - Accessibility: role="img" and aria-label
 * - Path trace: node transitions, visited badges, completion flash
 * - Traversed edges: edges between visited nodes get traversed styling
 * - Conditional edges: dashed animation on supervisor→agent edges
 *
 * Owner: Stark (C10) | Sprint Day 2
 * Coverage expansion: Happy (QA) | GraphViz.tsx 81% → 95%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GraphViz from '@/components/GraphViz';
import { render, screen, act } from '../helpers/render';
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

  it('renders traversed arrow marker', () => {
    renderGraphViz();
    const svg = screen.getByRole('img');
    const traversedMarker = svg.querySelector('#arrow-traversed');
    expect(traversedMarker).not.toBeNull();
  });

  it('renders glow filter in defs', () => {
    renderGraphViz();
    const svg = screen.getByRole('img');
    const glowFilter = svg.querySelector('#glow-soul');
    expect(glowFilter).not.toBeNull();
  });
});

// ─── Path Trace (usePathTrace) ───────────────────────────────

describe('GraphViz — Path Trace', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks previous node as visited on transition', () => {
    // Supervisor active → rag active: supervisor becomes visited (checkmark badge)
    const state1 = createActiveGraphState('supervisor');
    const { rerender } = render(<GraphViz state={state1} />);

    // Supervisor is active — no checkmark yet
    const supNode = screen.getByTestId('graph-node-supervisor');
    expect(supNode.querySelectorAll('circle').length).toBe(0); // No checkmark badge

    // Transition: supervisor → rag
    const state2 = createActiveGraphState('rag');
    rerender(<GraphViz state={state2} />);

    // Supervisor should now have visited badge (circle + check path)
    const supNodeAfter = screen.getByTestId('graph-node-supervisor');
    const checkBadge = supNodeAfter.querySelector('circle');
    expect(checkBadge).not.toBeNull();
  });

  it('marks multiple nodes as visited through transitions', () => {
    // supervisor → rag → evaluator: supervisor + rag become visited
    const state1 = createActiveGraphState('supervisor');
    const { rerender } = render(<GraphViz state={state1} />);

    rerender(<GraphViz state={createActiveGraphState('rag')} />);
    rerender(<GraphViz state={createActiveGraphState('evaluator')} />);

    // Both supervisor and rag should have visited badges
    const supBadge = screen.getByTestId('graph-node-supervisor').querySelector('circle');
    const ragBadge = screen.getByTestId('graph-node-rag').querySelector('circle');
    expect(supBadge).not.toBeNull();
    expect(ragBadge).not.toBeNull();

    // Evaluator is active — has glow, not visited badge
    const evalGlow = screen
      .getByTestId('graph-node-evaluator')
      .querySelector('.animate-pulse-soul');
    expect(evalGlow).not.toBeNull();
  });

  it('shows completion flash when activeNode goes to null', async () => {
    // rag active → null: rag gets completion flash
    const state1 = createActiveGraphState('rag');
    const { rerender } = render(<GraphViz state={state1} />);

    // Transition to null (query complete)
    act(() => {
      rerender(<GraphViz state={createGraphState({ activeNode: null, intent: null })} />);
    });

    // Evaluator or rag should have completion flash class
    const ragNode = screen.getByTestId('graph-node-rag');
    const flashRect = ragNode.querySelector('.animate-completion-flash');
    expect(flashRect).not.toBeNull();
  });

  it('completion flash clears after timeout', async () => {
    const state1 = createActiveGraphState('evaluator');
    const { rerender } = render(<GraphViz state={state1} />);

    // Query complete
    act(() => {
      rerender(<GraphViz state={createGraphState({ activeNode: null, intent: null })} />);
    });

    // Completion flash should be present
    let evalNode = screen.getByTestId('graph-node-evaluator');
    expect(evalNode.querySelector('.animate-completion-flash')).not.toBeNull();

    // Advance past completion flash duration (1500ms)
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Flash should be cleared
    evalNode = screen.getByTestId('graph-node-evaluator');
    expect(evalNode.querySelector('.animate-completion-flash')).toBeNull();
  });

  it('clears visited state when new query starts', () => {
    // supervisor → rag → null → supervisor (new query)
    const state1 = createActiveGraphState('supervisor');
    const { rerender } = render(<GraphViz state={state1} />);

    rerender(<GraphViz state={createActiveGraphState('rag')} />);

    // Supervisor should be visited
    let supBadge = screen.getByTestId('graph-node-supervisor').querySelector('circle');
    expect(supBadge).not.toBeNull();

    // Query complete
    act(() => {
      rerender(<GraphViz state={createGraphState({ activeNode: null, intent: null })} />);
    });

    // Advance past all timers to clear visited state
    act(() => {
      vi.advanceTimersByTime(4000); // 1500 + 2000 + buffer
    });

    // New query starts
    rerender(<GraphViz state={createActiveGraphState('supervisor')} />);

    // Previous visited badges should be cleared
    // (supervisor is now active again, not visited — no badge circle)
    const supNode = screen.getByTestId('graph-node-supervisor');
    const supGlow = supNode.querySelector('.animate-pulse-soul');
    expect(supGlow).not.toBeNull(); // Active glow, not visited badge
  });
});

// ─── Traversed Edges ─────────────────────────────────────────

describe('GraphViz — Traversed Edges', () => {
  it('marks edges between visited and active nodes as traversed', () => {
    // supervisor → rag transition: supervisor is visited, rag is active
    // Edge supervisor→rag should be active (to active node)
    // But after supervisor→rag→evaluator:
    // Edge supervisor→rag is between visited nodes (supervisor) and visited (rag) → traversed
    const state1 = createActiveGraphState('supervisor');
    const { rerender } = render(<GraphViz state={state1} />);

    rerender(<GraphViz state={createActiveGraphState('rag')} />);
    rerender(<GraphViz state={createActiveGraphState('evaluator')} />);

    // Edge supervisor→rag: both nodes are visited/active → should be traversed
    const supRagEdge = screen.getByTestId('graph-edge-supervisor-rag');
    // Traversed edges have a glow underlay path with opacity 0.08
    const paths = supRagEdge.querySelectorAll('path');
    const hasGlowUnderlay = Array.from(paths).some(
      (p) => p.getAttribute('opacity') === '0.08',
    );
    expect(hasGlowUnderlay).toBe(true);
  });

  it('conditional edges show dash animation when inactive', () => {
    // supervisor→rag and supervisor→tool are conditional edges
    // When neither is active, they should have animated dashes
    renderGraphViz({ activeNode: null });

    const supRagEdge = screen.getByTestId('graph-edge-supervisor-rag');
    const animate = supRagEdge.querySelector('animate');
    expect(animate).not.toBeNull();
    expect(animate?.getAttribute('attributeName')).toBe('stroke-dashoffset');
  });

  it('conditional edges lose dash animation when on active path', () => {
    // When rag is active, supervisor→rag is on the active path — no dash animation
    const state = createActiveGraphState('rag');
    render(<GraphViz state={state} />);

    const supRagEdge = screen.getByTestId('graph-edge-supervisor-rag');
    // Active path edges get flow dot (animateMotion) instead of dash animation
    const dashAnimate = supRagEdge.querySelector('animate[attributeName="stroke-dashoffset"]');
    expect(dashAnimate).toBeNull();
  });
});
