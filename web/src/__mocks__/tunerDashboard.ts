/**
 * Mock data for TunerDashboard.tsx (C8) + useTuner hook
 * Based on types.ts TunerStatus, TuningParams, EvalHistoryEntry interfaces.
 * Reflects AgentTuner behavior from soulgraph/tuner.py.
 */

import type {
  TunerStatus,
  TuningParams,
  EvalHistoryEntry,
  TunerDashboardProps,
} from '@/lib/types';

// ── Default params (matches tune_params.py defaults) ──
export const mockDefaultParams: TuningParams = {
  rag_k: 4,
  eval_threshold: 0.7,
  prefer_reasoning_model: false,
};

// ── Tuned params — after several adjustments ──
export const mockTunedParams: TuningParams = {
  rag_k: 6,
  eval_threshold: 0.65,
  prefer_reasoning_model: true,
};

// ── History entries — simulates eval progression ──
export const mockEvalHistory: EvalHistoryEntry[] = [
  // Early evals — lower scores
  {
    faithfulness: 0.52,
    answer_relevancy: 0.48,
    context_precision: 0.41,
    context_recall: 0.55,
    passed: false,
  },
  {
    faithfulness: 0.61,
    answer_relevancy: 0.55,
    context_precision: 0.50,
    context_recall: 0.58,
    passed: false,
  },
  // Tuner adjusted rag_k 4→5
  {
    faithfulness: 0.68,
    answer_relevancy: 0.72,
    context_precision: 0.65,
    context_recall: 0.63,
    passed: false,
  },
  {
    faithfulness: 0.75,
    answer_relevancy: 0.78,
    context_precision: 0.71,
    context_recall: 0.70,
    passed: true,
  },
  // Tuner adjusted rag_k 5→6
  {
    faithfulness: 0.82,
    answer_relevancy: 0.85,
    context_precision: 0.78,
    context_recall: 0.74,
    passed: true,
  },
  {
    faithfulness: 0.79,
    answer_relevancy: 0.88,
    context_precision: 0.82,
    context_recall: 0.76,
    passed: true,
  },
  // Tuner lowered threshold 0.7→0.65, enabled reasoning model
  {
    faithfulness: 0.91,
    answer_relevancy: 0.89,
    context_precision: 0.85,
    context_recall: 0.81,
    passed: true,
  },
  {
    faithfulness: 0.88,
    answer_relevancy: 0.92,
    context_precision: 0.87,
    context_recall: 0.83,
    passed: true,
  },
];

// ── Adjustment log — human-readable tuner decisions ──
const mockAdjustments: string[] = [
  'Increased rag_k from 4 to 5 (low context_precision detected)',
  'Increased rag_k from 5 to 6 (context_recall improving but below threshold)',
  'Lowered eval_threshold from 0.7 to 0.65 (consistent improvement trend)',
  'Enabled prefer_reasoning_model (complex queries detected)',
];

// ── Full tuner status — active session with history ──
export const mockTunerStatusActive: TunerStatus = {
  params: mockTunedParams,
  history: mockEvalHistory,
  adjustments: mockAdjustments,
};

// ── Fresh tuner — just started, no history ──
export const mockTunerStatusFresh: TunerStatus = {
  params: mockDefaultParams,
  history: [],
  adjustments: [],
};

// ── Tuner with single eval — edge case ──
export const mockTunerStatusSingleEval: TunerStatus = {
  params: mockDefaultParams,
  history: [mockEvalHistory[0]!],
  adjustments: [],
};

// ── Tuner with null scores in history ──
export const mockTunerStatusWithNulls: TunerStatus = {
  params: mockTunedParams,
  history: [
    ...mockEvalHistory.slice(0, 3),
    {
      faithfulness: null,
      answer_relevancy: 0.72,
      context_precision: null,
      context_recall: 0.65,
      passed: null,
    },
    ...mockEvalHistory.slice(5),
  ],
  adjustments: mockAdjustments.slice(0, 2),
};

// ── Props combinations for component testing ──
export const mockTunerDashboardPropsActive: TunerDashboardProps = {
  status: mockTunerStatusActive,
  onReset: () => console.log('[mock] Tuner reset triggered'),
};

export const mockTunerDashboardPropsFresh: TunerDashboardProps = {
  status: mockTunerStatusFresh,
  onReset: () => console.log('[mock] Tuner reset triggered'),
};

// ── All mock statuses for iteration ──
export const allMockTunerStatuses: TunerStatus[] = [
  mockTunerStatusActive,
  mockTunerStatusFresh,
  mockTunerStatusSingleEval,
  mockTunerStatusWithNulls,
];
