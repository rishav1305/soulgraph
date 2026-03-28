/**
 * EvalReport.test.tsx — Unit tests for the RAGAS evaluation scorecard component.
 *
 * Tests:
 * - Full mode: pass badge, fail badge, N/A badge, metric bars, metadata
 * - Compact mode: inline single-line summary
 * - Error state: error message, no metric bars
 * - Null scores: N/A text, striped pattern (via null score value)
 * - Edge cases: empty scores, perfect scores, borderline scores
 *
 * Owner: Stark (C10) | Sprint Day 2
 */

import { describe, it, expect } from 'vitest';
import EvalReport from '@/components/EvalReport';
import { render, screen } from '../helpers/render';
import {
  createEvalReport,
  createFailedEvalReport,
  createPartialEvalReport,
  createErrorEvalReport,
} from '../helpers/factories';
import type { EvalReport as EvalReportType } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────

function renderEvalReport(overrides?: Partial<EvalReportType>, compact = false) {
  const report = createEvalReport(overrides);
  return render(<EvalReport report={report} compact={compact} />);
}

// ─── Full Mode: Rendering ─────────────────────────────────────

describe('EvalReport — Full Mode', () => {
  it('renders without crashing', () => {
    renderEvalReport();
    expect(screen.getByTestId('eval-report')).toBeInTheDocument();
  });

  it('renders PASS badge for passing report', () => {
    renderEvalReport({ passed: true });
    const badge = screen.getByTestId('eval-badge');
    expect(badge).toHaveTextContent('PASS');
  });

  it('renders FAIL badge for failing report', () => {
    const report = createFailedEvalReport();
    render(<EvalReport report={report} />);
    const badge = screen.getByTestId('eval-badge');
    expect(badge).toHaveTextContent('FAIL');
  });

  it('renders N/A badge when passed is null', () => {
    renderEvalReport({ passed: null });
    const badge = screen.getByTestId('eval-badge');
    expect(badge).toHaveTextContent('N/A');
  });

  it('renders all four RAGAS metric bars', () => {
    renderEvalReport();
    expect(screen.getByTestId('eval-metric-faithfulness')).toBeInTheDocument();
    expect(screen.getByTestId('eval-metric-answer_relevancy')).toBeInTheDocument();
    expect(screen.getByTestId('eval-metric-context_precision')).toBeInTheDocument();
    expect(screen.getByTestId('eval-metric-context_recall')).toBeInTheDocument();
  });

  it('displays correct score values for each metric', () => {
    renderEvalReport({
      scores: {
        faithfulness: 0.92,
        answer_relevancy: 0.88,
        context_precision: 0.85,
        context_recall: 0.9,
      },
    });

    const faith = screen.getByTestId('eval-metric-faithfulness');
    expect(faith).toHaveTextContent('0.92');

    const relev = screen.getByTestId('eval-metric-answer_relevancy');
    expect(relev).toHaveTextContent('0.88');

    const prec = screen.getByTestId('eval-metric-context_precision');
    expect(prec).toHaveTextContent('0.85');

    const recall = screen.getByTestId('eval-metric-context_recall');
    expect(recall).toHaveTextContent('0.90');
  });

  it('renders document count metadata', () => {
    renderEvalReport({ num_documents: 3 });
    const docCount = screen.getByTestId('eval-doc-count');
    expect(docCount).toHaveTextContent('3 docs');
  });

  it('renders answer length metadata', () => {
    renderEvalReport({ answer_length: 58 });
    const ansLen = screen.getByTestId('eval-answer-length');
    expect(ansLen).toHaveTextContent('58 chars');
  });

  it('renders threshold line in metric bars', () => {
    renderEvalReport();
    const thresholdLines = screen.getAllByTestId('eval-threshold-line');
    // One per metric bar (4 total)
    expect(thresholdLines.length).toBe(4);
  });
});

// ─── Full Mode: Null / Partial Scores ─────────────────────────

describe('EvalReport — Null & Partial Scores', () => {
  it('displays N/A text for null scores', () => {
    const report = createPartialEvalReport();
    render(<EvalReport report={report} />);

    // answer_relevancy and context_precision are null in partial report
    const relev = screen.getByTestId('eval-metric-answer_relevancy');
    expect(relev).toHaveTextContent('N/A');

    const prec = screen.getByTestId('eval-metric-context_precision');
    expect(prec).toHaveTextContent('N/A');
  });

  it('displays numeric values for non-null scores in partial report', () => {
    const report = createPartialEvalReport();
    render(<EvalReport report={report} />);

    const faith = screen.getByTestId('eval-metric-faithfulness');
    expect(faith).toHaveTextContent('0.75');

    const recall = screen.getByTestId('eval-metric-context_recall');
    expect(recall).toHaveTextContent('0.60');
  });

  it('renders all metric bars even with partial null scores', () => {
    const report = createPartialEvalReport();
    render(<EvalReport report={report} />);
    expect(screen.getByTestId('eval-metric-faithfulness')).toBeInTheDocument();
    expect(screen.getByTestId('eval-metric-answer_relevancy')).toBeInTheDocument();
    expect(screen.getByTestId('eval-metric-context_precision')).toBeInTheDocument();
    expect(screen.getByTestId('eval-metric-context_recall')).toBeInTheDocument();
  });
});

// ─── Error State ──────────────────────────────────────────────

describe('EvalReport — Error State', () => {
  it('renders error message when report has error', () => {
    const report = createErrorEvalReport();
    render(<EvalReport report={report} />);
    const errorEl = screen.getByTestId('eval-error');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent('Evaluation failed: insufficient context documents');
  });

  it('does not render metric bars in error state', () => {
    const report = createErrorEvalReport();
    render(<EvalReport report={report} />);
    expect(screen.queryByTestId('eval-metric-faithfulness')).not.toBeInTheDocument();
    expect(screen.queryByTestId('eval-metric-answer_relevancy')).not.toBeInTheDocument();
  });

  it('still renders badge in error state', () => {
    const report = createErrorEvalReport();
    render(<EvalReport report={report} />);
    expect(screen.getByTestId('eval-badge')).toBeInTheDocument();
  });

  it('renders custom error messages', () => {
    const report = createEvalReport({
      error: 'ChromaDB connection refused',
      scores: {},
      passed: null,
    });
    render(<EvalReport report={report} />);
    expect(screen.getByTestId('eval-error')).toHaveTextContent('ChromaDB connection refused');
  });
});

// ─── Compact Mode ─────────────────────────────────────────────

describe('EvalReport — Compact Mode', () => {
  it('renders compact view with data-testid', () => {
    const report = createEvalReport();
    render(<EvalReport report={report} compact />);
    expect(screen.getByTestId('eval-report')).toBeInTheDocument();
  });

  it('renders badge in compact mode', () => {
    const report = createEvalReport({ passed: true });
    render(<EvalReport report={report} compact />);
    const badge = screen.getByTestId('eval-badge');
    expect(badge).toHaveTextContent('PASS');
  });

  it('renders score values inline in compact mode', () => {
    const report = createEvalReport({
      scores: {
        faithfulness: 0.92,
        answer_relevancy: 0.88,
        context_precision: 0.85,
        context_recall: 0.90,
      },
    });
    render(<EvalReport report={report} compact />);
    const el = screen.getByTestId('eval-report');
    expect(el).toHaveTextContent('0.92');
    expect(el).toHaveTextContent('0.88');
    expect(el).toHaveTextContent('0.85');
    expect(el).toHaveTextContent('0.90');
  });

  it('renders N/A for null scores in compact mode', () => {
    const report = createPartialEvalReport();
    render(<EvalReport report={report} compact />);
    const el = screen.getByTestId('eval-report');
    expect(el).toHaveTextContent('N/A');
  });

  it('shows doc count and answer length in compact mode', () => {
    const report = createEvalReport({ num_documents: 5, answer_length: 120 });
    render(<EvalReport report={report} compact />);
    const el = screen.getByTestId('eval-report');
    expect(el).toHaveTextContent('5 docs');
    expect(el).toHaveTextContent('120 chars');
  });

  it('does not render metric bars in compact mode', () => {
    const report = createEvalReport();
    render(<EvalReport report={report} compact />);
    expect(screen.queryByTestId('eval-metric-faithfulness')).not.toBeInTheDocument();
  });
});

// ─── Edge Cases ───────────────────────────────────────────────

describe('EvalReport — Edge Cases', () => {
  it('handles empty scores object gracefully', () => {
    renderEvalReport({ scores: {} });
    // All metric bars should show N/A
    const faith = screen.getByTestId('eval-metric-faithfulness');
    expect(faith).toHaveTextContent('N/A');
  });

  it('handles perfect scores (all 1.0)', () => {
    renderEvalReport({
      scores: {
        faithfulness: 1.0,
        answer_relevancy: 1.0,
        context_precision: 1.0,
        context_recall: 1.0,
      },
      passed: true,
    });
    expect(screen.getByTestId('eval-badge')).toHaveTextContent('PASS');
    const faith = screen.getByTestId('eval-metric-faithfulness');
    expect(faith).toHaveTextContent('1.00');
  });

  it('handles borderline scores (exactly at threshold)', () => {
    renderEvalReport({
      scores: {
        faithfulness: 0.7,
        answer_relevancy: 0.7,
        context_precision: 0.7,
        context_recall: 0.7,
      },
      passed: true,
      threshold: 0.7,
    });
    expect(screen.getByTestId('eval-badge')).toHaveTextContent('PASS');
  });

  it('handles zero scores', () => {
    renderEvalReport({
      scores: {
        faithfulness: 0,
        answer_relevancy: 0,
        context_precision: 0,
        context_recall: 0,
      },
      passed: false,
    });
    const faith = screen.getByTestId('eval-metric-faithfulness');
    expect(faith).toHaveTextContent('0.00');
  });

  it('renders FAIL badge for failed report', () => {
    const report = createFailedEvalReport();
    render(<EvalReport report={report} />);
    expect(screen.getByTestId('eval-badge')).toHaveTextContent('FAIL');
  });

  it('handles report with 0 documents', () => {
    renderEvalReport({ num_documents: 0 });
    expect(screen.getByTestId('eval-doc-count')).toHaveTextContent('0 docs');
  });

  it('handles report with 0 answer length', () => {
    renderEvalReport({ answer_length: 0 });
    expect(screen.getByTestId('eval-answer-length')).toHaveTextContent('0 chars');
  });
});
