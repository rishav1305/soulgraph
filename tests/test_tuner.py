"""Tests for AgentTuner — agent fine-tuning via eval feedback loops."""

from __future__ import annotations

import pytest

from soulgraph.tune_params import DEFAULT_RAG_K, TuningParams
from soulgraph.tuner import AgentTuner


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pass_report(**overrides) -> dict:
    """Build a passing eval report."""
    base = {
        "question": "q",
        "answer_length": 50,
        "num_documents": 4,
        "scores": {
            "faithfulness": 0.9,
            "answer_relevancy": 0.88,
            "context_precision": 0.85,
            "context_recall": 0.82,
        },
        "passed": True,
        "threshold": 0.7,
    }
    base.update(overrides)
    return base


def _fail_faithfulness() -> dict:
    """Report with consistently low faithfulness."""
    return _pass_report(
        scores={
            "faithfulness": 0.55,
            "answer_relevancy": 0.88,
            "context_precision": 0.85,
            "context_recall": 0.82,
        },
        passed=False,
    )


def _fail_relevancy() -> dict:
    """Report with consistently low answer_relevancy."""
    return _pass_report(
        scores={
            "faithfulness": 0.9,
            "answer_relevancy": 0.55,
            "context_precision": 0.85,
            "context_recall": 0.82,
        },
        passed=False,
    )


# ---------------------------------------------------------------------------
# TuningParams tests
# ---------------------------------------------------------------------------

class TestTuningParams:
    def test_defaults_are_sane(self) -> None:
        p = TuningParams()
        assert p.rag_k == DEFAULT_RAG_K
        assert p.eval_threshold == 0.7
        assert p.prefer_reasoning_model is False

    def test_to_dict_roundtrip(self) -> None:
        p = TuningParams(rag_k=6, eval_threshold=0.8, prefer_reasoning_model=True)
        d = p.to_dict()
        p2 = TuningParams.from_dict(d)
        assert p2.rag_k == 6
        assert p2.eval_threshold == 0.8
        assert p2.prefer_reasoning_model is True


# ---------------------------------------------------------------------------
# AgentTuner — basic behaviour
# ---------------------------------------------------------------------------

class TestAgentTuner:
    def test_initial_params_are_defaults(self) -> None:
        tuner = AgentTuner()
        assert tuner.get_params() == TuningParams()

    def test_observe_stores_eval(self) -> None:
        tuner = AgentTuner()
        tuner.observe(_pass_report())
        assert len(tuner.get_history()) == 1

    def test_history_is_capped_at_window(self) -> None:
        tuner = AgentTuner(window=3)
        for _ in range(10):
            tuner.observe(_pass_report())
        assert len(tuner.get_history()) == 3

    def test_reset_clears_history(self) -> None:
        tuner = AgentTuner()
        tuner.observe(_pass_report())
        tuner.reset()
        assert len(tuner.get_history()) == 0
        assert tuner.get_params() == TuningParams()


# ---------------------------------------------------------------------------
# Tuning rules — faithfulness
# ---------------------------------------------------------------------------

class TestFaithfulnessTuning:
    def test_rag_k_increases_after_3_faithfulness_failures(self) -> None:
        tuner = AgentTuner()
        initial_k = tuner.get_params().rag_k
        for _ in range(3):
            tuner.observe(_fail_faithfulness())
        assert tuner.get_params().rag_k > initial_k

    def test_rag_k_not_increased_after_2_failures(self) -> None:
        tuner = AgentTuner()
        initial_k = tuner.get_params().rag_k
        for _ in range(2):
            tuner.observe(_fail_faithfulness())
        assert tuner.get_params().rag_k == initial_k

    def test_rag_k_has_max_cap(self) -> None:
        tuner = AgentTuner()
        for _ in range(50):
            tuner.observe(_fail_faithfulness())
        assert tuner.get_params().rag_k <= 20


# ---------------------------------------------------------------------------
# Tuning rules — relevancy
# ---------------------------------------------------------------------------

class TestRelevancyTuning:
    def test_reasoning_model_preferred_after_3_relevancy_failures(self) -> None:
        tuner = AgentTuner()
        for _ in range(3):
            tuner.observe(_fail_relevancy())
        assert tuner.get_params().prefer_reasoning_model is True

    def test_reasoning_model_not_preferred_after_2_failures(self) -> None:
        tuner = AgentTuner()
        for _ in range(2):
            tuner.observe(_fail_relevancy())
        assert tuner.get_params().prefer_reasoning_model is False


# ---------------------------------------------------------------------------
# Tuning rules — recovery (relaxation)
# ---------------------------------------------------------------------------

class TestRecoveryTuning:
    def test_rag_k_decremented_after_consecutive_passes(self) -> None:
        tuner = AgentTuner()
        # First bump up rag_k
        for _ in range(3):
            tuner.observe(_fail_faithfulness())
        bumped_k = tuner.get_params().rag_k
        assert bumped_k > DEFAULT_RAG_K
        # Then recover
        for _ in range(5):
            tuner.observe(_pass_report())
        assert tuner.get_params().rag_k < bumped_k

    def test_rag_k_never_falls_below_minimum(self) -> None:
        tuner = AgentTuner()
        for _ in range(20):
            tuner.observe(_pass_report())
        assert tuner.get_params().rag_k >= DEFAULT_RAG_K

    def test_reasoning_model_relaxed_after_consecutive_passes(self) -> None:
        tuner = AgentTuner()
        # First trigger reasoning model
        for _ in range(3):
            tuner.observe(_fail_relevancy())
        assert tuner.get_params().prefer_reasoning_model is True
        # Then recover
        for _ in range(5):
            tuner.observe(_pass_report())
        assert tuner.get_params().prefer_reasoning_model is False


# ---------------------------------------------------------------------------
# Status output
# ---------------------------------------------------------------------------

class TestTunerStatus:
    def test_status_includes_params(self) -> None:
        tuner = AgentTuner()
        status = tuner.status()
        assert "params" in status
        assert "rag_k" in status["params"]

    def test_status_includes_history(self) -> None:
        tuner = AgentTuner()
        tuner.observe(_pass_report())
        status = tuner.status()
        assert "history" in status
        assert len(status["history"]) == 1

    def test_status_includes_adjustments_log(self) -> None:
        tuner = AgentTuner()
        for _ in range(3):
            tuner.observe(_fail_faithfulness())
        status = tuner.status()
        assert "adjustments" in status
        assert len(status["adjustments"]) > 0


# ---------------------------------------------------------------------------
# Graceful handling
# ---------------------------------------------------------------------------

class TestGracefulHandling:
    def test_observe_handles_none_scores(self) -> None:
        tuner = AgentTuner()
        report = _pass_report(scores={"faithfulness": None, "answer_relevancy": None, "context_precision": None, "context_recall": None})
        tuner.observe(report)  # should not raise

    def test_observe_handles_missing_scores(self) -> None:
        tuner = AgentTuner()
        tuner.observe({"passed": False})  # minimal report, should not raise
