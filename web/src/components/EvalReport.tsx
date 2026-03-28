/**
 * EvalReport.tsx — RAGAS evaluation scorecard component.
 *
 * Displays:
 * - Pass/fail badge with threshold comparison
 * - Horizontal metric bars for each RAGAS score
 * - Document count and answer length metadata
 * - Error state with message display
 *
 * Modes:
 * - Full (default): All metrics with bars + metadata
 * - Compact: Single-line summary for inline display
 *
 * Owner: Banner (C6) | Sprint Day 2
 */

import type { EvalReportProps } from '@/lib/types';

/** RAGAS metric display configuration. */
const METRIC_CONFIG: Record<string, { label: string; className: string }> = {
  faithfulness: { label: 'Faithfulness', className: 'metric-faithfulness' },
  answer_relevancy: { label: 'Answer Relevancy', className: 'metric-relevancy' },
  context_precision: { label: 'Context Precision', className: 'metric-precision' },
  context_recall: { label: 'Context Recall', className: 'metric-recall' },
};

/** Ordered metric keys for consistent rendering. */
const METRIC_ORDER = [
  'faithfulness',
  'answer_relevancy',
  'context_precision',
  'context_recall',
] as const;

function getBadgeState(passed: boolean | null): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  if (passed === true) {
    return {
      label: 'PASS',
      bgClass: 'bg-pass/10',
      textClass: 'text-pass',
      borderClass: 'border-pass',
    };
  }
  if (passed === false) {
    return {
      label: 'FAIL',
      bgClass: 'bg-fail/10',
      textClass: 'text-fail',
      borderClass: 'border-fail',
    };
  }
  return {
    label: 'N/A',
    bgClass: 'bg-elevated',
    textClass: 'text-warn',
    borderClass: 'border-warn',
  };
}

function formatScore(score: number | null): string {
  if (score === null) return 'N/A';
  return score.toFixed(2);
}

/** Compact single-line summary. */
function EvalReportCompact({ report }: EvalReportProps) {
  const badge = getBadgeState(report.passed);
  const scores = METRIC_ORDER.map((key) => formatScore(report.scores[key] ?? null));

  return (
    <div
      data-testid="eval-report"
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${badge.bgClass} ${badge.borderClass}`}
    >
      <span
        data-testid="eval-badge"
        className={`font-mono font-semibold ${badge.textClass}`}
      >
        {badge.label}
      </span>
      <span className="text-fg-secondary">
        {scores.join(' / ')}
      </span>
      <span className="text-fg-muted">
        ({report.num_documents} docs, {report.answer_length} chars)
      </span>
    </div>
  );
}

/** Single metric bar row. */
function MetricBar({
  metricKey,
  score,
  threshold,
}: {
  metricKey: string;
  score: number | null;
  threshold: number;
}) {
  const config = METRIC_CONFIG[metricKey];
  const isNull = score === null;
  const isPassing = !isNull && score >= threshold;

  return (
    <div data-testid={`eval-metric-${metricKey}`} className="flex items-center gap-3">
      {/* Label */}
      <span className="w-36 shrink-0 text-sm text-fg-secondary truncate">
        {config?.label ?? metricKey}
      </span>

      {/* Bar container */}
      <div className="relative flex-1 h-5 rounded-sm bg-elevated overflow-hidden">
        {/* Threshold marker */}
        <div
          data-testid="eval-threshold-line"
          className="absolute top-0 bottom-0 w-px bg-fg-muted/50 z-10"
          style={{ left: `${threshold * 100}%` }}
        />

        {isNull ? (
          /* Null state: striped pattern */
          <div
            className="h-full w-full opacity-20"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 4px, currentColor 4px, currentColor 5px)',
            }}
          />
        ) : (
          /* Score fill */
          <div
            className={`h-full rounded-sm transition-all duration-500 ease-out ${
              isPassing ? 'bg-pass' : 'bg-fail'
            }`}
            style={{ width: `${Math.min(score * 100, 100)}%` }}
          />
        )}
      </div>

      {/* Score value */}
      <span
        className={`w-10 text-right font-mono text-sm ${
          isNull ? 'text-fg-muted' : isPassing ? 'text-pass' : 'text-fail'
        }`}
      >
        {formatScore(score)}
      </span>
    </div>
  );
}

/** Full evaluation report card. */
export default function EvalReport({ report, compact = false }: EvalReportProps) {
  if (compact) {
    return <EvalReportCompact report={report} />;
  }

  const badge = getBadgeState(report.passed);
  const hasError = Boolean(report.error);

  return (
    <div
      data-testid="eval-report"
      className={`rounded-lg border p-4 ${
        hasError ? 'border-fail/50 bg-fail/5' : 'border-border-default bg-surface'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span
            data-testid="eval-badge"
            className={`inline-flex items-center rounded-md border px-2.5 py-0.5 font-mono text-xs font-bold ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
          >
            {badge.label}
          </span>
          <span className="text-sm font-medium text-fg">Evaluation Report</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-fg-muted">
          <span data-testid="eval-doc-count">{report.num_documents} docs</span>
          <span data-testid="eval-answer-length">{report.answer_length} chars</span>
        </div>
      </div>

      {/* Error state */}
      {hasError ? (
        <div
          data-testid="eval-error"
          className="rounded-md bg-fail/10 border border-fail/30 p-3 text-sm text-fail"
        >
          {report.error}
        </div>
      ) : (
        /* Metric bars */
        <div className="flex flex-col gap-2.5">
          {METRIC_ORDER.map((key) => (
            <MetricBar
              key={key}
              metricKey={key}
              score={report.scores[key] ?? null}
              threshold={report.threshold}
            />
          ))}
        </div>
      )}

      {/* Threshold legend */}
      {!hasError && (
        <div className="mt-3 flex items-center gap-2 text-xs text-fg-muted">
          <div className="w-4 h-px bg-fg-muted/50" />
          <span>Threshold: {report.threshold.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
