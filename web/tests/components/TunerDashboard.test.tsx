/**
 * TunerDashboard.test.tsx — Unit tests for the AgentTuner status panel.
 *
 * Tests:
 * - Rendering: params display, chart, adjustments, header
 * - Reset button: two-click confirmation, onReset callback, disabled during reset
 * - Empty states: no history, no adjustments
 * - History chart: renders with data, empty state message
 * - Params: rag_k, eval_threshold, prefer_reasoning_model display
 *
 * Owner: Stark (C10) | Sprint Day 2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TunerDashboard from '@/components/TunerDashboard';
import { render, screen, fireEvent, act } from '../helpers/render';
import {
  createTunerStatus,
  createTunerStatusWithHistory,
  createTuningParams,
  createEvalHistoryEntry,
} from '../helpers/factories';
import type { TunerStatus } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────

function renderDashboard(overrides?: Partial<TunerStatus>, onReset = vi.fn()) {
  const status = createTunerStatus(overrides);
  return { ...render(<TunerDashboard status={status} onReset={onReset} />), onReset };
}

// ─── Rendering Basics ─────────────────────────────────────────

describe('TunerDashboard — Rendering', () => {
  it('renders without crashing', () => {
    renderDashboard();
    expect(screen.getByTestId('tuner-dashboard')).toBeInTheDocument();
  });

  it('renders header with title', () => {
    renderDashboard();
    expect(screen.getByText('Agent Tuner')).toBeInTheDocument();
  });

  it('renders eval count in header', () => {
    renderDashboard({
      history: [createEvalHistoryEntry(), createEvalHistoryEntry(), createEvalHistoryEntry()],
    });
    expect(screen.getByText('3 evals')).toBeInTheDocument();
  });

  it('renders 0 evals when fresh', () => {
    renderDashboard({ history: [] });
    expect(screen.getByText('0 evals')).toBeInTheDocument();
  });
});

// ─── Parameter Display ────────────────────────────────────────

describe('TunerDashboard — Parameters', () => {
  it('displays rag_k parameter', () => {
    renderDashboard({ params: createTuningParams({ rag_k: 5 }) });
    const param = screen.getByTestId('tuner-param-rag_k');
    expect(param).toBeInTheDocument();
    expect(param).toHaveTextContent('5');
  });

  it('displays eval_threshold parameter', () => {
    renderDashboard({ params: createTuningParams({ eval_threshold: 0.7 }) });
    const param = screen.getByTestId('tuner-param-eval_threshold');
    expect(param).toBeInTheDocument();
    expect(param).toHaveTextContent('0.70');
  });

  it('displays prefer_reasoning_model as OFF when false', () => {
    renderDashboard({ params: createTuningParams({ prefer_reasoning_model: false }) });
    const param = screen.getByTestId('tuner-param-prefer_reasoning_model');
    expect(param).toHaveTextContent('OFF');
  });

  it('displays prefer_reasoning_model as ON when true', () => {
    renderDashboard({ params: createTuningParams({ prefer_reasoning_model: true }) });
    const param = screen.getByTestId('tuner-param-prefer_reasoning_model');
    expect(param).toHaveTextContent('ON');
  });

  it('displays custom rag_k values', () => {
    renderDashboard({ params: createTuningParams({ rag_k: 10 }) });
    const param = screen.getByTestId('tuner-param-rag_k');
    expect(param).toHaveTextContent('10');
  });

  it('displays custom eval_threshold values', () => {
    renderDashboard({ params: createTuningParams({ eval_threshold: 0.85 }) });
    const param = screen.getByTestId('tuner-param-eval_threshold');
    expect(param).toHaveTextContent('0.85');
  });

  it('shows parameter labels', () => {
    renderDashboard();
    expect(screen.getByText('RAG Documents (k)')).toBeInTheDocument();
    expect(screen.getByText('Eval Threshold')).toBeInTheDocument();
    expect(screen.getByText('Reasoning Model')).toBeInTheDocument();
  });
});

// ─── History Chart ────────────────────────────────────────────

describe('TunerDashboard — History Chart', () => {
  it('renders chart when history has entries', () => {
    const status = createTunerStatusWithHistory(5);
    render(<TunerDashboard status={status} onReset={vi.fn()} />);
    expect(screen.getByTestId('tuner-history-chart')).toBeInTheDocument();
  });

  it('renders chart SVG with correct viewBox', () => {
    const status = createTunerStatusWithHistory(3);
    render(<TunerDashboard status={status} onReset={vi.fn()} />);
    const chart = screen.getByTestId('tuner-history-chart');
    expect(chart).toHaveAttribute('viewBox', '0 0 280 140');
  });

  it('renders chart with aria-label', () => {
    const status = createTunerStatusWithHistory(3);
    render(<TunerDashboard status={status} onReset={vi.fn()} />);
    const chart = screen.getByTestId('tuner-history-chart');
    expect(chart).toHaveAttribute('aria-label', 'Evaluation history chart');
  });

  it('shows empty state message when no history', () => {
    renderDashboard({ history: [] });
    expect(screen.queryByTestId('tuner-history-chart')).not.toBeInTheDocument();
    expect(screen.getByText(/no evaluations yet/i)).toBeInTheDocument();
  });

  it('renders chart legend with metric labels', () => {
    const status = createTunerStatusWithHistory(3);
    render(<TunerDashboard status={status} onReset={vi.fn()} />);
    expect(screen.getByText('Faith.')).toBeInTheDocument();
    expect(screen.getByText('Relev.')).toBeInTheDocument();
    expect(screen.getByText('Prec.')).toBeInTheDocument();
    expect(screen.getByText('Recall')).toBeInTheDocument();
    expect(screen.getByText('Threshold')).toBeInTheDocument();
  });
});

// ─── Adjustments Log ──────────────────────────────────────────

describe('TunerDashboard — Adjustments', () => {
  it('renders adjustments when present', () => {
    renderDashboard({
      adjustments: ['rag_k: 5 -> 7 (context_recall low)'],
    });
    expect(screen.getByTestId('tuner-adjustments')).toBeInTheDocument();
    expect(screen.getByText(/rag_k: 5 -> 7/)).toBeInTheDocument();
  });

  it('does not render adjustments section when empty', () => {
    renderDashboard({ adjustments: [] });
    expect(screen.queryByTestId('tuner-adjustments')).not.toBeInTheDocument();
  });

  it('renders multiple adjustments', () => {
    renderDashboard({
      adjustments: [
        'rag_k: 5 -> 7 (context_recall low)',
        'eval_threshold: 0.7 -> 0.6 (too strict)',
      ],
    });
    expect(screen.getByText(/rag_k: 5 -> 7/)).toBeInTheDocument();
    expect(screen.getByText(/eval_threshold: 0.7 -> 0.6/)).toBeInTheDocument();
  });

  it('shows adjustments header', () => {
    renderDashboard({
      adjustments: ['test adjustment'],
    });
    expect(screen.getByText('Adjustments')).toBeInTheDocument();
  });
});

// ─── Reset Button ─────────────────────────────────────────────

describe('TunerDashboard — Reset Button', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders reset button with initial label', () => {
    renderDashboard();
    const btn = screen.getByTestId('tuner-reset-btn');
    expect(btn).toHaveTextContent('Reset Tuner');
  });

  it('first click shows confirmation text', () => {
    renderDashboard();
    const btn = screen.getByTestId('tuner-reset-btn');
    fireEvent.click(btn);
    expect(btn).toHaveTextContent('Confirm Reset?');
  });

  it('second click triggers onReset callback', () => {
    const onReset = vi.fn();
    renderDashboard(undefined, onReset);
    const btn = screen.getByTestId('tuner-reset-btn');

    // First click: confirm state
    fireEvent.click(btn);
    expect(onReset).not.toHaveBeenCalled();

    // Second click: triggers reset
    fireEvent.click(btn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('auto-cancels confirmation after 3 seconds', () => {
    renderDashboard();
    const btn = screen.getByTestId('tuner-reset-btn');

    fireEvent.click(btn);
    expect(btn).toHaveTextContent('Confirm Reset?');

    // Advance timers by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(btn).toHaveTextContent('Reset Tuner');
  });

  it('does not auto-cancel before 3 seconds', () => {
    renderDashboard();
    const btn = screen.getByTestId('tuner-reset-btn');

    fireEvent.click(btn);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(btn).toHaveTextContent('Confirm Reset?');
  });

  it('shows resetting state after confirm click', () => {
    const onReset = vi.fn();
    renderDashboard(undefined, onReset);
    const btn = screen.getByTestId('tuner-reset-btn');

    // Two clicks
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(btn).toHaveTextContent('Resetting...');
    expect(btn).toBeDisabled();
  });

  it('button recovers from resetting state after timeout', () => {
    const onReset = vi.fn();
    renderDashboard(undefined, onReset);
    const btn = screen.getByTestId('tuner-reset-btn');

    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(btn).toHaveTextContent('Resetting...');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(btn).toHaveTextContent('Reset Tuner');
    expect(btn).not.toBeDisabled();
  });

  it('has correct aria-label for initial state', () => {
    renderDashboard();
    const btn = screen.getByTestId('tuner-reset-btn');
    expect(btn).toHaveAttribute('aria-label', 'Reset tuner');
  });

  it('has correct aria-label for confirmation state', () => {
    renderDashboard();
    const btn = screen.getByTestId('tuner-reset-btn');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-label', 'Confirm tuner reset');
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

// ─── Hover Interactions ──────────────────────────────────────

describe('TunerDashboard — Chart Hover Interactions', () => {
  function renderWithHistory(count = 3) {
    const status = createTunerStatusWithHistory(count);
    return render(<TunerDashboard status={status} onReset={vi.fn()} />);
  }

  it('shows no tooltip initially (no hover)', () => {
    renderWithHistory();
    expect(screen.queryByTestId('tuner-tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on hover over a chart column', () => {
    renderWithHistory(3);
    const chart = screen.getByTestId('tuner-history-chart');
    // Hover zones are transparent rects — find them by cursor-crosshair class
    const hoverZones = chart.querySelectorAll('.cursor-crosshair');
    expect(hoverZones.length).toBe(3);

    // Hover over first zone
    fireEvent.mouseEnter(hoverZones[0]!);
    expect(screen.getByTestId('tuner-tooltip')).toBeInTheDocument();
  });

  it('tooltip has correct aria-label for hovered eval', () => {
    renderWithHistory(3);
    const chart = screen.getByTestId('tuner-history-chart');
    const hoverZones = chart.querySelectorAll('.cursor-crosshair');

    // Hover over second zone (index 1 → "Eval 2 metrics")
    fireEvent.mouseEnter(hoverZones[1]!);
    const tooltip = screen.getByTestId('tuner-tooltip');
    expect(tooltip).toHaveAttribute('aria-label', 'Eval 2 metrics');
  });

  it('tooltip has role="tooltip"', () => {
    renderWithHistory(3);
    const chart = screen.getByTestId('tuner-history-chart');
    const hoverZones = chart.querySelectorAll('.cursor-crosshair');

    fireEvent.mouseEnter(hoverZones[0]!);
    const tooltip = screen.getByTestId('tuner-tooltip');
    expect(tooltip).toHaveAttribute('role', 'tooltip');
  });

  it('tooltip disappears on mouse leave', () => {
    renderWithHistory(3);
    const chart = screen.getByTestId('tuner-history-chart');
    const hoverZones = chart.querySelectorAll('.cursor-crosshair');

    fireEvent.mouseEnter(hoverZones[0]!);
    expect(screen.getByTestId('tuner-tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(hoverZones[0]!);
    expect(screen.queryByTestId('tuner-tooltip')).not.toBeInTheDocument();
  });

  it('renders data point dots on hover', () => {
    renderWithHistory(3);
    const chart = screen.getByTestId('tuner-history-chart');
    const hoverZones = chart.querySelectorAll('.cursor-crosshair');

    // Before hover — verify no tooltip circles present
    expect(chart.querySelectorAll('circle[pointer-events="none"]').length).toBe(0);

    fireEvent.mouseEnter(hoverZones[0]!);

    // After hover — should have 4 metric dots (faithfulness, relevancy, precision, recall)
    // Plus the tooltip metric indicator circles (4 more inside tooltip)
    // The data point dots have pointerEvents="none" and are direct children of SVG
    const dotsAfter = chart.querySelectorAll('circle');
    expect(dotsAfter.length).toBeGreaterThan(0);
  });

  it('renders vertical guide line on hover', () => {
    renderWithHistory(3);
    const chart = screen.getByTestId('tuner-history-chart');
    const hoverZones = chart.querySelectorAll('.cursor-crosshair');

    // Count lines before hover
    const linesBefore = chart.querySelectorAll('line[pointer-events="none"]');
    const countBefore = linesBefore.length;

    fireEvent.mouseEnter(hoverZones[0]!);

    // After hover — should have additional guide line with pointerEvents="none"
    const linesAfter = chart.querySelectorAll('line[pointer-events="none"]');
    expect(linesAfter.length).toBeGreaterThan(countBefore);
  });

  it('hovering last column near right edge shows tooltip', () => {
    // With enough entries, the last column is near the right edge
    // and the tooltip should flip to the left
    renderWithHistory(5);
    const chart = screen.getByTestId('tuner-history-chart');
    const hoverZones = chart.querySelectorAll('.cursor-crosshair');

    // Hover over last zone (index 4 — rightmost)
    fireEvent.mouseEnter(hoverZones[hoverZones.length - 1]!);
    const tooltip = screen.getByTestId('tuner-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute('aria-label', `Eval ${hoverZones.length} metrics`);
  });

  it('switching hover between columns updates tooltip', () => {
    renderWithHistory(3);
    const chart = screen.getByTestId('tuner-history-chart');
    const hoverZones = chart.querySelectorAll('.cursor-crosshair');

    // Hover first column
    fireEvent.mouseEnter(hoverZones[0]!);
    expect(screen.getByTestId('tuner-tooltip')).toHaveAttribute('aria-label', 'Eval 1 metrics');

    // Move to second column
    fireEvent.mouseLeave(hoverZones[0]!);
    fireEvent.mouseEnter(hoverZones[1]!);
    expect(screen.getByTestId('tuner-tooltip')).toHaveAttribute('aria-label', 'Eval 2 metrics');
  });

  it('handles hover with null metric values gracefully', () => {
    const status = createTunerStatus({
      history: [
        createEvalHistoryEntry({
          faithfulness: 0.9,
          answer_relevancy: null,
          context_precision: null,
          context_recall: 0.8,
        }),
      ],
    });
    render(<TunerDashboard status={status} onReset={vi.fn()} />);

    const chart = screen.getByTestId('tuner-history-chart');
    const hoverZones = chart.querySelectorAll('.cursor-crosshair');

    fireEvent.mouseEnter(hoverZones[0]!);
    const tooltip = screen.getByTestId('tuner-tooltip');
    expect(tooltip).toBeInTheDocument();
  });

  it('single data point shows hover correctly', () => {
    renderWithHistory(1);
    const chart = screen.getByTestId('tuner-history-chart');
    const hoverZones = chart.querySelectorAll('.cursor-crosshair');
    expect(hoverZones.length).toBe(1);

    fireEvent.mouseEnter(hoverZones[0]!);
    expect(screen.getByTestId('tuner-tooltip')).toBeInTheDocument();
  });
});

// ─── Edge Cases ───────────────────────────────────────────────

describe('TunerDashboard — Edge Cases', () => {
  it('renders with single eval in history', () => {
    renderDashboard({ history: [createEvalHistoryEntry()] });
    expect(screen.getByTestId('tuner-history-chart')).toBeInTheDocument();
    expect(screen.getByText('1 evals')).toBeInTheDocument();
  });

  it('handles history with null scores', () => {
    renderDashboard({
      history: [
        createEvalHistoryEntry({
          faithfulness: null,
          answer_relevancy: null,
          context_precision: null,
          context_recall: null,
          passed: null,
        }),
      ],
    });
    expect(screen.getByTestId('tuner-history-chart')).toBeInTheDocument();
  });

  it('handles large history counts', () => {
    const status = createTunerStatusWithHistory(20);
    render(<TunerDashboard status={status} onReset={vi.fn()} />);
    expect(screen.getByTestId('tuner-history-chart')).toBeInTheDocument();
    expect(screen.getByText('20 evals')).toBeInTheDocument();
  });

  it('Parameters section always visible', () => {
    renderDashboard();
    expect(screen.getByText('Parameters')).toBeInTheDocument();
  });

  it('Evaluation History section always visible', () => {
    renderDashboard();
    expect(screen.getByText('Evaluation History')).toBeInTheDocument();
  });
});
