/**
 * TunerDashboard.tsx — AgentTuner status panel.
 *
 * Displays:
 * - Current tuning parameters (rag_k, eval_threshold, prefer_reasoning_model)
 * - Evaluation history as SVG sparkline chart (4 RAGAS metrics)
 * - Adjustment log (human-readable tuner decisions)
 * - Reset button with confirmation state
 *
 * Layout: Two-column on >=768px (params | chart), stacked on mobile.
 * Below: Adjustments log + reset button.
 *
 * Owner: Banner (C8) | Sprint Day 2
 */

import { useState, useMemo } from 'react';
import type { TunerDashboardProps, EvalHistoryEntry } from '@/lib/types';

// ── Sparkline Chart Constants ──

const CHART_W = 280;
const CHART_H = 140;
const CHART_PAD = { top: 10, right: 10, bottom: 24, left: 36 };
const PLOT_W = CHART_W - CHART_PAD.left - CHART_PAD.right;
const PLOT_H = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

/** Numeric metric keys from EvalHistoryEntry (excludes 'passed' which is boolean). */
type NumericMetricKey = 'faithfulness' | 'answer_relevancy' | 'context_precision' | 'context_recall';

/** Metric line colors (CSS classes defined in app.css). */
const METRIC_LINES: {
  key: NumericMetricKey;
  color: string;
  label: string;
}[] = [
  { key: 'faithfulness', color: '#22c55e', label: 'Faith.' },
  { key: 'answer_relevancy', color: '#3b82f6', label: 'Relev.' },
  { key: 'context_precision', color: '#f59e0b', label: 'Prec.' },
  { key: 'context_recall', color: '#a855f7', label: 'Recall' },
];

// ── Sub-components ──

function ParamRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: string | boolean;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5" data-testid={testId}>
      <span className="text-sm text-fg-secondary">{label}</span>
      {typeof value === 'boolean' ? (
        <span
          className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
            value
              ? 'bg-soul/15 text-soul'
              : 'bg-elevated text-fg-muted'
          }`}
        >
          {value ? 'ON' : 'OFF'}
        </span>
      ) : (
        <span className="font-mono text-sm text-fg bg-elevated px-2 py-0.5 rounded">
          {value}
        </span>
      )}
    </div>
  );
}

function HistoryChart({
  history,
  threshold,
}: {
  history: EvalHistoryEntry[];
  threshold: number;
}) {
  const paths = useMemo(() => {
    if (history.length === 0) return [];

    const n = history.length;
    const xStep = n > 1 ? PLOT_W / (n - 1) : PLOT_W / 2;

    return METRIC_LINES.map(({ key, color }) => {
      const points: string[] = [];
      let hasPoints = false;

      for (let i = 0; i < n; i++) {
        const val = history[i]?.[key];
        if (val === null || val === undefined) continue;

        const x = CHART_PAD.left + i * xStep;
        const y = CHART_PAD.top + PLOT_H * (1 - val);

        if (!hasPoints) {
          points.push(`M ${x} ${y}`);
          hasPoints = true;
        } else {
          points.push(`L ${x} ${y}`);
        }
      }

      return { key, color, d: points.join(' '), hasPoints };
    });
  }, [history]);

  const thresholdY = CHART_PAD.top + PLOT_H * (1 - threshold);

  return (
    <svg
      data-testid="tuner-history-chart"
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="w-full h-full"
      role="img"
      aria-label="Evaluation history chart"
    >
      {/* Y-axis labels */}
      {[0, 0.25, 0.5, 0.75, 1.0].map((val) => {
        const y = CHART_PAD.top + PLOT_H * (1 - val);
        return (
          <g key={val}>
            <text
              x={CHART_PAD.left - 4}
              y={y}
              fill="var(--color-fg-muted)"
              fontSize="8"
              fontFamily="var(--font-mono)"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {val.toFixed(1)}
            </text>
            <line
              x1={CHART_PAD.left}
              y1={y}
              x2={CHART_PAD.left + PLOT_W}
              y2={y}
              stroke="var(--color-border-default)"
              strokeWidth="0.5"
            />
          </g>
        );
      })}

      {/* X-axis labels */}
      {history.length > 0 &&
        history.map((_, i) => {
          const xStep = history.length > 1 ? PLOT_W / (history.length - 1) : PLOT_W / 2;
          const x = CHART_PAD.left + i * xStep;
          // Only show every Nth label to avoid crowding
          if (history.length > 10 && i % 2 !== 0 && i !== history.length - 1) return null;
          return (
            <text
              key={i}
              x={x}
              y={CHART_H - 4}
              fill="var(--color-fg-muted)"
              fontSize="7"
              fontFamily="var(--font-mono)"
              textAnchor="middle"
            >
              {i + 1}
            </text>
          );
        })}

      {/* Threshold line */}
      <line
        x1={CHART_PAD.left}
        y1={thresholdY}
        x2={CHART_PAD.left + PLOT_W}
        y2={thresholdY}
        stroke="var(--color-warn)"
        strokeWidth="1"
        strokeDasharray="4 3"
        opacity="0.7"
      />

      {/* Metric lines */}
      {paths.map(
        ({ key, color, d, hasPoints }) =>
          hasPoints && (
            <path
              key={key}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
      )}
    </svg>
  );
}

function ChartLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {METRIC_LINES.map(({ key, color, label }) => (
        <div key={key} className="flex items-center gap-1">
          <div
            className="w-3 h-0.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-[10px] text-fg-muted">{label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <div className="w-3 h-0.5 border-t border-dashed border-warn" />
        <span className="text-[10px] text-fg-muted">Threshold</span>
      </div>
    </div>
  );
}

// ── Main Component ──

export default function TunerDashboard({ status, onReset }: TunerDashboardProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      // Auto-cancel confirmation after 3 seconds
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }

    setResetting(true);
    setConfirmReset(false);
    try {
      onReset();
    } finally {
      // Reset loading state after a short delay for UX
      setTimeout(() => setResetting(false), 1000);
    }
  };

  const hasHistory = status.history.length > 0;
  const hasAdjustments = status.adjustments.length > 0;

  return (
    <div data-testid="tuner-dashboard" className="rounded-lg border border-border-default bg-surface p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-fg">Agent Tuner</h3>
        <span className="text-xs text-fg-muted font-mono">
          {status.history.length} evals
        </span>
      </div>

      {/* Two-column layout: Params | Chart */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        {/* Params card */}
        <div className="rounded-md border border-border-default bg-deep p-3">
          <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
            Parameters
          </div>
          <ParamRow
            label="RAG Documents (k)"
            value={String(status.params.rag_k)}
            testId="tuner-param-rag_k"
          />
          <ParamRow
            label="Eval Threshold"
            value={status.params.eval_threshold.toFixed(2)}
            testId="tuner-param-eval_threshold"
          />
          <ParamRow
            label="Reasoning Model"
            value={status.params.prefer_reasoning_model}
            testId="tuner-param-prefer_reasoning_model"
          />
        </div>

        {/* History chart */}
        <div className="rounded-md border border-border-default bg-deep p-3">
          <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
            Evaluation History
          </div>
          {hasHistory ? (
            <div className="h-36">
              <HistoryChart
                history={status.history}
                threshold={status.params.eval_threshold}
              />
              <ChartLegend />
            </div>
          ) : (
            <div className="h-36 flex items-center justify-center text-sm text-fg-muted">
              No evaluations yet. Ask a question to start the tuner.
            </div>
          )}
        </div>
      </div>

      {/* Adjustments log + Reset button */}
      <div className="mt-4 flex items-start justify-between gap-4">
        {/* Adjustments */}
        <div className="flex-1 min-w-0">
          {hasAdjustments && (
            <div data-testid="tuner-adjustments">
              <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1.5">
                Adjustments
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {status.adjustments.map((adj, i) => (
                  <div
                    key={i}
                    className="text-xs text-fg-secondary font-mono leading-relaxed"
                  >
                    <span className="text-fg-muted mr-1.5">&gt;</span>
                    {adj}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reset button */}
        <button
          data-testid="tuner-reset-btn"
          onClick={handleReset}
          disabled={resetting}
          className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            resetting
              ? 'border-border-default bg-elevated text-fg-muted cursor-not-allowed'
              : confirmReset
                ? 'border-warn bg-warn/10 text-warn hover:bg-warn/20'
                : 'border-fail/50 bg-fail/10 text-fail hover:bg-fail/20'
          }`}
          aria-label={confirmReset ? 'Confirm tuner reset' : 'Reset tuner'}
        >
          {resetting ? (
            <span className="flex items-center gap-1.5">
              <svg
                className="animate-spin h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
                />
              </svg>
              Resetting...
            </span>
          ) : confirmReset ? (
            'Confirm Reset?'
          ) : (
            'Reset Tuner'
          )}
        </button>
      </div>
    </div>
  );
}
