/**
 * GraphViz.tsx — SVG agent graph visualization with animations.
 *
 * Renders the SoulGraph supervisor → agent routing flow as a pure SVG diagram.
 * No external dependencies (reactflow, d3). Hand-drawn SVG with CSS animations.
 *
 * Graph structure (from supervisor.py build_graph()):
 *   supervisor → conditional(rag | tool) → evaluator → END
 *
 * Layout: Diamond pattern in 400x320 viewBox
 *   - supervisor: top center
 *   - rag: left middle
 *   - tool: right middle
 *   - evaluator: bottom center
 *
 * Animation features (P3):
 *   - Per-node active colors with pulse glow
 *   - Path trace: visited nodes show completion checkmark
 *   - Edge flow dots colored per active node
 *   - Animated dash pattern on conditional edges
 *   - Completion flash on evaluator when query done
 *
 * Owner: Banner (C7 + P3) | Sprint Day 2-3
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import type { GraphVizProps, GraphNodeId, GraphEdge } from '@/lib/types';

// ── Layout Constants ──

const VIEWBOX_W = 400;
const VIEWBOX_H = 320;
const NODE_W = 110;
const NODE_H = 36;
const NODE_RX = 8;

/** Node positions (center coordinates). */
const NODE_POS: Record<GraphNodeId, { x: number; y: number }> = {
  supervisor: { x: 200, y: 44 },
  rag: { x: 85, y: 160 },
  tool: { x: 315, y: 160 },
  evaluator: { x: 200, y: 276 },
};

/** Display labels for each node. */
const NODE_LABELS: Record<GraphNodeId, string> = {
  supervisor: 'Supervisor',
  rag: 'RAG Agent',
  tool: 'Tool Agent',
  evaluator: 'Evaluator',
};

/** Per-node active colors (matches CSS variables from app.css). */
const NODE_ACTIVE_COLORS: Record<GraphNodeId, string> = {
  supervisor: 'var(--color-node-supervisor)',
  rag: 'var(--color-node-rag)',
  tool: 'var(--color-node-tool)',
  evaluator: 'var(--color-node-evaluator)',
};

/** SVG icons (simple path data, 16x16 viewBox). */
const NODE_ICONS: Record<GraphNodeId, string> = {
  supervisor: 'M8 2a6 6 0 100 12A6 6 0 008 2zm0 2a2 2 0 110 4 2 2 0 010-4zm-4 8c0-1.1.9-2 2-2h4a2 2 0 012 2',
  rag: 'M10 2a1 1 0 011 1v1h3a1 1 0 110 2h-1l-.7 7.4a2 2 0 01-2 1.6H5.7a2 2 0 01-2-1.6L3 6H2a1 1 0 110-2h3V3a1 1 0 011-1h4z',
  tool: 'M14.7 6.3a1 1 0 000-1.4l-1.6-1.6a1 1 0 00-1.4 0l-2 2 3 3 2-2zM3 12v3h3l7.3-7.3-3-3L3 12z',
  evaluator: 'M3 3v14h14V3H3zm2 2h10v2H5V5zm0 4h6v2H5V9zm0 4h8v2H5v-2z',
};

/** Checkmark path for visited nodes. */
const CHECK_PATH = 'M4 8l3 3 5-6';

// ── Edge Computation ──

interface EdgePath {
  edge: GraphEdge;
  d: string;
  isConditional: boolean;
}

function computeEdgePaths(edges: GraphEdge[]): EdgePath[] {
  return edges.map((edge) => {
    const from = NODE_POS[edge.from];
    const to = NODE_POS[edge.to];

    const startX = from.x;
    const startY = from.y + NODE_H / 2;
    const endX = to.x;
    const endY = to.y - NODE_H / 2;

    // Curved path using quadratic bezier
    const midY = (startY + endY) / 2;
    const d = `M ${startX} ${startY} Q ${startX} ${midY}, ${(startX + endX) / 2} ${midY} Q ${endX} ${midY}, ${endX} ${endY}`;

    const isConditional = edge.from === 'supervisor';

    return { edge, d, isConditional };
  });
}

// ── Sub-components ──

type NodeState = 'idle' | 'active' | 'visited' | 'completed';

function GraphNode({
  nodeId,
  nodeState,
}: {
  nodeId: GraphNodeId;
  nodeState: NodeState;
}) {
  const pos = NODE_POS[nodeId];
  const x = pos.x - NODE_W / 2;
  const y = pos.y - NODE_H / 2;

  const isActive = nodeState === 'active';
  const isVisited = nodeState === 'visited';
  const isCompleted = nodeState === 'completed';
  const activeColor = NODE_ACTIVE_COLORS[nodeId];

  // Determine visual states
  const strokeColor = isActive
    ? activeColor
    : isVisited || isCompleted
      ? 'var(--color-pass)'
      : 'var(--color-border-default)';

  const fillColor = isActive
    ? 'var(--color-soul-dim)'
    : isCompleted
      ? 'rgba(34, 197, 94, 0.08)'
      : 'var(--color-elevated)';

  const textColor = isActive
    ? activeColor
    : isVisited || isCompleted
      ? 'var(--color-pass)'
      : 'var(--color-fg-secondary)';

  const iconColor = isActive
    ? activeColor
    : isVisited || isCompleted
      ? 'var(--color-pass)'
      : 'var(--color-fg-muted)';

  return (
    <g data-testid={`graph-node-${nodeId}`}>
      {/* Active glow effect */}
      {isActive && (
        <rect
          x={x - 3}
          y={y - 3}
          width={NODE_W + 6}
          height={NODE_H + 6}
          rx={NODE_RX + 2}
          className="animate-pulse-soul"
          fill="none"
          stroke={activeColor}
          strokeWidth="2"
          opacity="0.6"
        />
      )}

      {/* Completion flash ring */}
      {isCompleted && (
        <rect
          x={x - 2}
          y={y - 2}
          width={NODE_W + 4}
          height={NODE_H + 4}
          rx={NODE_RX + 1}
          fill="none"
          stroke="var(--color-pass)"
          strokeWidth="1.5"
          opacity="0.4"
          className="animate-completion-flash"
        />
      )}

      {/* Node background */}
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={NODE_RX}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isActive ? 1.5 : 1}
        className="transition-all duration-300"
      />

      {/* Icon */}
      <g transform={`translate(${x + 10}, ${pos.y - 7}) scale(0.875)`}>
        <path
          d={NODE_ICONS[nodeId]}
          fill={iconColor}
          className="transition-colors duration-300"
        />
      </g>

      {/* Label */}
      <text
        x={x + 34}
        y={pos.y + 1}
        fill={textColor}
        fontSize="11"
        fontFamily="var(--font-body)"
        fontWeight={isActive ? '600' : '400'}
        dominantBaseline="middle"
        className="transition-colors duration-300 select-none"
      >
        {NODE_LABELS[nodeId]}
      </text>

      {/* Visited checkmark badge */}
      {(isVisited || isCompleted) && (
        <g transform={`translate(${x + NODE_W - 14}, ${y - 6})`}>
          <circle r="7" cx="7" cy="7" fill="var(--color-pass)" opacity="0.9" />
          <path
            d={CHECK_PATH}
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(1, 1) scale(0.75)"
          />
        </g>
      )}
    </g>
  );
}

function GraphEdgeElement({
  edgePath,
  isOnActivePath,
  activeNodeColor,
  isTraversed,
}: {
  edgePath: EdgePath;
  isOnActivePath: boolean;
  activeNodeColor: string | null;
  isTraversed: boolean;
}) {
  const { edge, d, isConditional } = edgePath;
  const edgeColor = isOnActivePath && activeNodeColor
    ? activeNodeColor
    : isTraversed
      ? 'var(--color-pass)'
      : 'var(--color-overlay)';

  // Animated dash for conditional edges
  const dashArray = isConditional && !isOnActivePath && !isTraversed
    ? '6 4'
    : 'none';

  return (
    <g data-testid={`graph-edge-${edge.from}-${edge.to}`}>
      {/* Traversed glow underlay */}
      {isTraversed && !isOnActivePath && (
        <path
          d={d}
          fill="none"
          stroke="var(--color-pass)"
          strokeWidth="4"
          opacity="0.08"
          strokeLinecap="round"
        />
      )}

      {/* Edge line */}
      <path
        d={d}
        fill="none"
        stroke={edgeColor}
        strokeWidth={isOnActivePath ? 2 : isTraversed ? 1.5 : 1}
        strokeDasharray={dashArray}
        opacity={isOnActivePath ? 1 : isTraversed ? 0.7 : 0.4}
        className="transition-all duration-300"
        markerEnd={`url(#arrow-${isOnActivePath ? 'active' : isTraversed ? 'traversed' : 'inactive'})`}
      />

      {/* Animated dash on conditional inactive edges */}
      {isConditional && !isOnActivePath && !isTraversed && (
        <path
          d={d}
          fill="none"
          stroke="var(--color-overlay)"
          strokeWidth="1"
          strokeDasharray="2 8"
          opacity="0.3"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-10"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </path>
      )}

      {/* Animated flow dot on active edges */}
      {isOnActivePath && (
        <circle
          r="3.5"
          fill={activeNodeColor ?? 'var(--color-soul)'}
          opacity="0.9"
        >
          <animateMotion dur="1.5s" repeatCount="indefinite" path={d} />
        </circle>
      )}
    </g>
  );
}

// ── Path Trace Hook ──

/**
 * Tracks visited nodes based on activeNode transitions.
 * Maintains a set of previously-active nodes for path trace visualization.
 */
function usePathTrace(activeNode: GraphNodeId | null) {
  const [visitedNodes, setVisitedNodes] = useState<Set<GraphNodeId>>(new Set());
  const [completedNode, setCompletedNode] = useState<GraphNodeId | null>(null);
  const prevActiveRef = useRef<GraphNodeId | null>(null);

  useEffect(() => {
    const prev = prevActiveRef.current;

    if (activeNode === null && prev !== null) {
      // Query completed — flash the last active node as "completed"
      setCompletedNode(prev);
      setVisitedNodes((s) => new Set([...s, prev]));

      // Clear completion flash after animation duration
      const timer = setTimeout(() => {
        setCompletedNode(null);
        // Clear all visited state after brief display
        const clearTimer = setTimeout(() => setVisitedNodes(new Set()), 2000);
        return () => clearTimeout(clearTimer);
      }, 1500);

      prevActiveRef.current = null;
      return () => clearTimeout(timer);
    }

    if (activeNode !== null && prev !== null && activeNode !== prev) {
      // Node transition — mark previous as visited
      setVisitedNodes((s) => new Set([...s, prev]));
    }

    if (activeNode !== null && prev === null) {
      // New query starting — clear visited state
      setVisitedNodes(new Set());
      setCompletedNode(null);
    }

    prevActiveRef.current = activeNode;
  }, [activeNode]);

  return { visitedNodes, completedNode };
}

// ── Main Component ──

export default function GraphViz({ state, className = '' }: GraphVizProps) {
  const edgePaths = useMemo(() => computeEdgePaths(state.edges), [state.edges]);
  const { visitedNodes, completedNode } = usePathTrace(state.activeNode);

  // Determine node states
  const getNodeState = (nodeId: GraphNodeId): NodeState => {
    if (state.activeNode === nodeId) return 'active';
    if (completedNode === nodeId) return 'completed';
    if (visitedNodes.has(nodeId)) return 'visited';
    return 'idle';
  };

  // Active edge computation — includes traversed edges
  const edgeStates = useMemo(() => {
    const active = new Set<string>();
    const traversed = new Set<string>();

    // Edges to/from active node are active
    if (state.activeNode) {
      for (const edge of state.edges) {
        if (edge.to === state.activeNode) {
          active.add(`${edge.from}-${edge.to}`);
        }
        if (edge.from === state.activeNode) {
          active.add(`${edge.from}-${edge.to}`);
        }
      }
    }

    // Edges between visited nodes are traversed
    for (const edge of state.edges) {
      const fromVisited = visitedNodes.has(edge.from) || state.activeNode === edge.from;
      const toVisited = visitedNodes.has(edge.to) || state.activeNode === edge.to;
      if (fromVisited && toVisited && !active.has(`${edge.from}-${edge.to}`)) {
        traversed.add(`${edge.from}-${edge.to}`);
      }
    }

    return { active, traversed };
  }, [state.activeNode, state.edges, visitedNodes]);

  // Get the active node's color for edge coloring
  const activeNodeColor = state.activeNode
    ? NODE_ACTIVE_COLORS[state.activeNode]
    : null;

  return (
    <div
      data-testid="graph-viz"
      className={`relative max-h-[200px] sm:max-h-[280px] md:max-h-none ${className}`}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="SoulGraph agent routing diagram"
      >
        {/* Defs: arrow markers + filters */}
        <defs>
          <marker
            id="arrow-active"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-soul)" />
          </marker>
          <marker
            id="arrow-inactive"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-overlay)" opacity="0.5" />
          </marker>
          <marker
            id="arrow-traversed"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-pass)" opacity="0.7" />
          </marker>

          {/* Glow filter for active nodes */}
          <filter id="glow-soul" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges (render before nodes so nodes appear on top) */}
        {edgePaths.map((ep) => {
          const key = `${ep.edge.from}-${ep.edge.to}`;
          return (
            <GraphEdgeElement
              key={key}
              edgePath={ep}
              isOnActivePath={edgeStates.active.has(key)}
              activeNodeColor={activeNodeColor}
              isTraversed={edgeStates.traversed.has(key)}
            />
          );
        })}

        {/* Nodes */}
        {state.nodes.map((nodeId) => (
          <GraphNode
            key={nodeId}
            nodeId={nodeId}
            nodeState={getNodeState(nodeId)}
          />
        ))}

        {/* END marker for tool path */}
        <g data-testid="graph-node-end">
          <circle
            cx={NODE_POS.tool.x}
            cy={NODE_POS.tool.y + NODE_H / 2 + 30}
            r={12}
            fill="var(--color-elevated)"
            stroke="var(--color-border-default)"
            strokeWidth="1"
          />
          <text
            x={NODE_POS.tool.x}
            y={NODE_POS.tool.y + NODE_H / 2 + 31}
            fill="var(--color-fg-muted)"
            fontSize="8"
            fontFamily="var(--font-mono)"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            END
          </text>
          <line
            x1={NODE_POS.tool.x}
            y1={NODE_POS.tool.y + NODE_H / 2}
            x2={NODE_POS.tool.x}
            y2={NODE_POS.tool.y + NODE_H / 2 + 18}
            stroke="var(--color-overlay)"
            strokeWidth="1"
            opacity="0.5"
            markerEnd="url(#arrow-inactive)"
          />
        </g>

        {/* END marker for evaluator path */}
        <g>
          <circle
            cx={NODE_POS.evaluator.x}
            cy={NODE_POS.evaluator.y + NODE_H / 2 + 16}
            r={10}
            fill="var(--color-elevated)"
            stroke="var(--color-border-default)"
            strokeWidth="1"
          />
          <text
            x={NODE_POS.evaluator.x}
            y={NODE_POS.evaluator.y + NODE_H / 2 + 17}
            fill="var(--color-fg-muted)"
            fontSize="7"
            fontFamily="var(--font-mono)"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            END
          </text>
        </g>
      </svg>

      {/* Intent text below graph */}
      {state.intent && (
        <div
          data-testid="graph-intent"
          className="mt-1 sm:mt-2 text-center text-[10px] sm:text-xs text-fg-muted font-mono line-clamp-2 sm:truncate px-2 sm:px-4 animate-fade-in"
        >
          {state.intent}
        </div>
      )}
    </div>
  );
}
