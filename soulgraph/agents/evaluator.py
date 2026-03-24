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
        try:
            from datasets import Dataset
            from ragas import evaluate as ragas_evaluate
            from ragas.metrics import (
                answer_relevancy,
                context_precision,
                context_recall,
                faithfulness,
            )

            ds = Dataset.from_dict(
                {
                    "question": [question],
                    "answer": [answer],
                    "contexts": [documents if documents else ["(no context)"]],
                    "ground_truth": [answer],
                }
            )
            result = ragas_evaluate(
                ds,
                metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
            )
            scores = result.to_pandas().iloc[0].to_dict()  # type: ignore[union-attr]
            metric_scores = {m: scores.get(m) for m in RAGAS_METRICS}
            passed = all(v is None or v >= self.threshold for v in metric_scores.values())
            logger.info(
                "RAGAS eval: %d docs, answer %d chars, passed=%s",
                len(documents),
                len(answer),
                passed,
            )
            return {
                "question": question,
                "answer_length": len(answer),
                "num_documents": len(documents),
                "scores": metric_scores,
                "passed": passed,
                "threshold": self.threshold,
            }
        except Exception as exc:
            logger.warning("RAGAS evaluation failed: %s — returning placeholder", exc)
            return {
                "question": question,
                "answer_length": len(answer),
                "num_documents": len(documents),
                "scores": {metric: None for metric in RAGAS_METRICS},
                "passed": None,
                "threshold": self.threshold,
                "error": str(exc),
            }

    def __call__(self, state: AgentState) -> dict[str, Any]:
        """Process state: evaluate answer quality and update state."""
        question = state.get("question", "")
        answer = state.get("answer", "")
        documents = state.get("documents", [])
        eval_report = self.evaluate(question, answer, documents)
        return {"eval_report": eval_report, "next_agent": "END"}
