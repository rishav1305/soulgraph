"""Evaluator Agent — RAGAS metrics + structured JSON report."""

from __future__ import annotations

import logging
from typing import Any

from soulgraph.state import AgentState

logger = logging.getLogger(__name__)

# RAGAS metric names emitted in the eval report.
RAGAS_METRICS = ("faithfulness", "answer_relevancy", "context_precision", "context_recall")


class EvaluatorAgent:
    """Evaluates RAG output quality using RAGAS metrics.

    Phase 1 implementation:
    - Computes faithfulness, answer_relevancy, context_precision, context_recall
    - Returns structured JSON report with scores + quality thresholds
    """

    def __init__(self, threshold: float = 0.7) -> None:
        """Initialise the evaluator.

        Args:
            threshold: Minimum acceptable score (0-1). Results below this
                       are flagged as low quality in the report.
        """
        self.threshold = threshold

    def evaluate(
        self,
        question: str,
        answer: str,
        documents: list[str],
    ) -> dict[str, Any]:
        """Compute RAGAS metrics and return a structured report.

        Args:
            question: The original user question.
            answer: The generated answer from the RAG agent.
            documents: Retrieved context documents.

        Returns:
            Evaluation report with scores, pass/fail status, and metadata.
        """
        # Phase 1 stub: return a structured placeholder report.
        # Phase 2 will wire real RAGAS evaluation.
        report: dict[str, Any] = {
            "question": question,
            "answer_length": len(answer),
            "num_documents": len(documents),
            "scores": {metric: None for metric in RAGAS_METRICS},
            "passed": None,
            "threshold": self.threshold,
            "note": "Phase 1 stub — real RAGAS evaluation wired in Phase 2",
        }
        logger.info(
            "Eval report: %d docs, answer %d chars",
            len(documents),
            len(answer),
        )
        return report

    def __call__(self, state: AgentState) -> dict[str, Any]:
        """Process state: evaluate answer quality and update state."""
        question = state.get("question", "")
        answer = state.get("answer", "")
        documents = state.get("documents", [])
        eval_report = self.evaluate(question, answer, documents)
        return {"eval_report": eval_report, "next_agent": "END"}
