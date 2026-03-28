/**
 * Mock data for EvalReport.tsx (C6)
 * Based on types.ts EvalReport + EvalReportProps interfaces.
 * Uses real-world RAGAS score ranges from SoulGraph backend.
 */

import type { EvalReport, EvalReportProps } from '@/lib/types';

// ── Passing report — all metrics above threshold ──
export const mockEvalReportPassing: EvalReport = {
  question: 'What were the key factors in the Battle of Gettysburg?',
  answer_length: 342,
  num_documents: 4,
  scores: {
    faithfulness: 0.89,
    answer_relevancy: 0.92,
    context_precision: 0.85,
    context_recall: 0.78,
  },
  passed: true,
  threshold: 0.7,
};

// ── Failing report — some metrics below threshold ──
export const mockEvalReportFailing: EvalReport = {
  question: 'Explain quantum entanglement in simple terms.',
  answer_length: 156,
  num_documents: 2,
  scores: {
    faithfulness: 0.45,
    answer_relevancy: 0.72,
    context_precision: 0.38,
    context_recall: 0.55,
  },
  passed: false,
  threshold: 0.7,
};

// ── Partial null scores — evaluator couldn't compute some metrics ──
export const mockEvalReportPartial: EvalReport = {
  question: 'What is the capital of France?',
  answer_length: 28,
  num_documents: 1,
  scores: {
    faithfulness: 0.95,
    answer_relevancy: 0.98,
    context_precision: null,
    context_recall: null,
  },
  passed: null,
  threshold: 0.7,
};

// ── Error report — evaluation failed ──
export const mockEvalReportError: EvalReport = {
  question: 'Calculate the optimal trajectory for a Mars mission.',
  answer_length: 0,
  num_documents: 0,
  scores: {
    faithfulness: null,
    answer_relevancy: null,
    context_precision: null,
    context_recall: null,
  },
  passed: null,
  threshold: 0.7,
  error: 'Evaluation timeout: RAGAS metrics computation exceeded 30s limit',
};

// ── Edge case: perfect scores ──
export const mockEvalReportPerfect: EvalReport = {
  question: 'Who wrote Hamlet?',
  answer_length: 42,
  num_documents: 3,
  scores: {
    faithfulness: 1.0,
    answer_relevancy: 1.0,
    context_precision: 1.0,
    context_recall: 1.0,
  },
  passed: true,
  threshold: 0.7,
};

// ── Edge case: borderline (scores near threshold) ──
export const mockEvalReportBorderline: EvalReport = {
  question: 'What are the main causes of climate change?',
  answer_length: 215,
  num_documents: 5,
  scores: {
    faithfulness: 0.71,
    answer_relevancy: 0.69,
    context_precision: 0.73,
    context_recall: 0.68,
  },
  passed: false,
  threshold: 0.7,
};

// ── Props combinations for component testing ──
export const mockEvalReportPropsDefault: EvalReportProps = {
  report: mockEvalReportPassing,
};

export const mockEvalReportPropsCompact: EvalReportProps = {
  report: mockEvalReportPassing,
  compact: true,
};

export const mockEvalReportPropsFailCompact: EvalReportProps = {
  report: mockEvalReportFailing,
  compact: true,
};

// ── All mock reports for iteration testing ──
export const allMockEvalReports: EvalReport[] = [
  mockEvalReportPassing,
  mockEvalReportFailing,
  mockEvalReportPartial,
  mockEvalReportError,
  mockEvalReportPerfect,
  mockEvalReportBorderline,
];
