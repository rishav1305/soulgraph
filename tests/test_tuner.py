"""Tests for AgentTuner — agent fine-tuning via eval feedback loops."""

from __future__ import annotations

from soulgraph.tune_params import DEFAULT_RAG_K, TuningParams
from soulgraph.tuner import AgentTuner, get_tuner, reset_tuner

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
        report = _pass_report(
            scores={
                "faithfulness": None,
                "answer_relevancy": None,
                "context_precision": None,
                "context_recall": None,
            }
        )
        tuner.observe(report)  # should not raise

    def test_observe_handles_missing_scores(self) -> None:
        tuner = AgentTuner()
        tuner.observe({"passed": False})  # minimal report, should not raise

    def test_apply_rules_is_noop_on_empty_history(self) -> None:
        """_apply_rules early-return guard: empty history must not raise."""
        tuner = AgentTuner()
        # _history starts empty; calling _apply_rules directly should return safely.
        tuner._apply_rules()
        assert tuner.get_params() == TuningParams()  # nothing changed


# ---------------------------------------------------------------------------
# Redis persistence
# ---------------------------------------------------------------------------


class TestAgentTunerRedis:
    """Tests for Redis-backed persistence in AgentTuner.

    Uses a MagicMock to simulate Redis without requiring a live instance.
    """

    def _make_redis(self) -> MagicMock:  # noqa: F821
        from unittest.mock import MagicMock

        mock = MagicMock()
        # Simulate empty Redis on first load (no stored state).
        mock.get.return_value = None
        mock.lrange.return_value = []
        return mock

    def test_init_with_redis_calls_load(self) -> None:
        """AgentTuner.__init__ calls _load_from_redis when redis_client is given."""
        from unittest.mock import patch

        mock_redis = self._make_redis()
        with patch.object(AgentTuner, "_load_from_redis") as mock_load:
            AgentTuner(redis_client=mock_redis)
            mock_load.assert_called_once()

    def test_observe_with_redis_calls_save(self) -> None:
        """observe() calls _save_to_redis after applying rules."""
        from unittest.mock import patch

        mock_redis = self._make_redis()
        tuner = AgentTuner(redis_client=mock_redis)
        with patch.object(tuner, "_save_to_redis") as mock_save:
            tuner.observe(_pass_report())
            mock_save.assert_called_once()

    def test_reset_with_redis_deletes_keys(self) -> None:
        """reset() deletes all three Redis keys when redis_client is set."""
        from soulgraph.tuner import _REDIS_KEY_ADJUSTMENTS, _REDIS_KEY_HISTORY, _REDIS_KEY_PARAMS

        mock_redis = self._make_redis()
        tuner = AgentTuner(redis_client=mock_redis)
        tuner.observe(_pass_report())
        mock_redis.reset_mock()  # clear call history from init/observe
        tuner.reset()
        deleted_keys = {call.args[0] for call in mock_redis.delete.call_args_list}
        assert _REDIS_KEY_PARAMS in deleted_keys
        assert _REDIS_KEY_HISTORY in deleted_keys
        assert _REDIS_KEY_ADJUSTMENTS in deleted_keys

    def test_load_from_redis_restores_params(self) -> None:
        """_load_from_redis restores TuningParams from serialised Redis data."""
        import json

        from soulgraph.tuner import _REDIS_KEY_ADJUSTMENTS, _REDIS_KEY_HISTORY

        mock_redis = self._make_redis()
        stored_params = TuningParams(rag_k=12, prefer_reasoning_model=True)
        mock_redis.get.return_value = json.dumps(stored_params.to_dict()).encode()
        adjustment_msg = "rag_k: 4 \N{RIGHTWARDS ARROW} 12  [3 consecutive faithfulness < 0.7]"
        mock_redis.lrange.side_effect = lambda key, *_: (
            [json.dumps({"faithfulness": 0.9, "passed": True}).encode()]
            if key == _REDIS_KEY_HISTORY
            else [adjustment_msg.encode()]
            if key == _REDIS_KEY_ADJUSTMENTS
            else []
        )
        tuner = AgentTuner(redis_client=mock_redis)
        assert tuner.get_params().rag_k == 12
        assert tuner.get_params().prefer_reasoning_model is True
        assert len(tuner.get_history()) == 1
        assert len(tuner.status()["adjustments"]) == 1

    def test_load_from_redis_handles_error_gracefully(self) -> None:
        """_load_from_redis swallows Redis errors and falls back to defaults."""
        mock_redis = self._make_redis()
        mock_redis.get.side_effect = ConnectionError("Redis unavailable")
        # Should not raise — graceful degradation to in-memory defaults.
        tuner = AgentTuner(redis_client=mock_redis)
        assert tuner.get_params() == TuningParams()

    def test_save_to_redis_persists_state(self) -> None:
        """_save_to_redis writes params, history, and adjustments to Redis."""

        from soulgraph.tuner import _REDIS_KEY_HISTORY, _REDIS_KEY_PARAMS

        mock_redis = self._make_redis()
        tuner = AgentTuner(redis_client=mock_redis)
        tuner.observe(_pass_report())
        # Verify set was called with the params key.
        set_keys = {call.args[0] for call in mock_redis.set.call_args_list}
        assert _REDIS_KEY_PARAMS in set_keys
        # Verify rpush was called for history.
        rpush_keys = {call.args[0] for call in mock_redis.rpush.call_args_list}
        assert _REDIS_KEY_HISTORY in rpush_keys

    def test_save_to_redis_handles_error_gracefully(self) -> None:
        """_save_to_redis swallows Redis errors without crashing observe()."""
        mock_redis = self._make_redis()
        mock_redis.set.side_effect = ConnectionError("Redis write failed")
        tuner = AgentTuner(redis_client=mock_redis)
        # observe() must not raise even if save fails.
        tuner.observe(_pass_report())
        assert len(tuner.get_history()) == 1  # in-memory state unaffected

    def test_save_to_redis_persists_adjustments(self) -> None:
        """_save_to_redis pushes adjustment log entries to Redis."""
        from soulgraph.tuner import _REDIS_KEY_ADJUSTMENTS

        mock_redis = self._make_redis()
        tuner = AgentTuner(redis_client=mock_redis)
        # Trigger a tuning rule so _adjustments is non-empty.
        for _ in range(3):
            tuner.observe(_fail_faithfulness())
        assert len(tuner.status()["adjustments"]) > 0
        # Verify adjustments were pushed to Redis.
        rpush_keys = [call.args[0] for call in mock_redis.rpush.call_args_list]
        assert _REDIS_KEY_ADJUSTMENTS in rpush_keys


# ---------------------------------------------------------------------------
# Module-level singleton (get_tuner / reset_tuner)
# ---------------------------------------------------------------------------


class TestTunerSingleton:
    def setup_method(self) -> None:
        """Reset singleton state before each test."""
        reset_tuner()

    def teardown_method(self) -> None:
        """Clean up singleton after each test."""
        reset_tuner()

    def test_get_tuner_returns_same_instance(self) -> None:
        """get_tuner() returns the same singleton on repeated calls."""
        t1 = get_tuner()
        t2 = get_tuner()
        assert t1 is t2

    def test_reset_tuner_creates_fresh_instance(self) -> None:
        """reset_tuner() clears the singleton so next get_tuner() is fresh."""
        t1 = get_tuner()
        t1.observe(_pass_report())
        reset_tuner()
        t2 = get_tuner()
        assert t1 is not t2
        assert len(t2.get_history()) == 0
