"""Tests for the Evaluator agent."""

from __future__ import annotations

from soulgraph.agents.evaluator import RAGAS_METRICS, EvaluatorAgent


class TestEvaluatorAgent:
    def test_evaluate_returns_dict(self, evaluator: EvaluatorAgent) -> None:
        report = evaluator.evaluate("What is RAG?", "RAG combines retrieval and generation.", [])
        assert isinstance(report, dict)

    def test_evaluate_includes_all_ragas_metrics(self, evaluator: EvaluatorAgent) -> None:
        report = evaluator.evaluate("question", "answer", ["doc1"])
        for metric in RAGAS_METRICS:
            assert metric in report["scores"], f"Missing RAGAS metric: {metric}"

    def test_evaluate_includes_threshold(self, evaluator: EvaluatorAgent) -> None:
        report = evaluator.evaluate("q", "a", [])
        assert report["threshold"] == evaluator.threshold

    def test_evaluate_records_question(self, evaluator: EvaluatorAgent) -> None:
        report = evaluator.evaluate("My question?", "answer", [])
        assert report["question"] == "My question?"

    def test_evaluate_counts_documents(self, evaluator: EvaluatorAgent) -> None:
        docs = ["doc1", "doc2", "doc3"]
        report = evaluator.evaluate("q", "a", docs)
        assert report["num_documents"] == 3

    def test_call_updates_state(self, evaluator: EvaluatorAgent) -> None:
        state = {
            "question": "What is RAG?",
            "messages": [],
            "documents": ["doc1"],
            "answer": "RAG is...",
            "eval_report": {},
            "next_agent": "evaluator",
            "session_id": "test",
        }
        result = evaluator(state)
        assert "eval_report" in result
        assert result["eval_report"]["question"] == "What is RAG?"

    def test_call_sets_next_agent_to_end(self, evaluator: EvaluatorAgent) -> None:
        state = {
            "question": "q",
            "messages": [],
            "documents": [],
            "answer": "a",
            "eval_report": {},
            "next_agent": "",
            "session_id": "test",
        }
        result = evaluator(state)
        assert result["next_agent"] == "END"

    def test_threshold_is_configurable(self) -> None:
        evaluator = EvaluatorAgent(threshold=0.9)
        assert evaluator.threshold == 0.9
