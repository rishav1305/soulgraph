"""AgentTuner — feedback loop that adjusts agent parameters from RAGAS eval results.

Agent fine-tuning (Phase 3 Wave 3) is distinct from LLM fine-tuning:
- NOT adjusting model weights
- IS adjusting agent parameters (rag_k, model tier, threshold) based on observed
  performance patterns across evaluations

The tuning loop works as follows:
1. After each query, the EvaluatorAgent calls tuner.observe(eval_report)
2. The tuner stores the report in a rolling window (last N evals)
3. Tuning rules fire when patterns are detected across the window
4. Adjusted TuningParams are applied to the next query transparently
5. All adjustments are logged with reasoning (audit trail)
"""

from __future__ import annotations

import json
import logging
from collections import deque
from typing import Any

from soulgraph.tune_params import DEFAULT_RAG_K, TuningParams

logger = logging.getLogger(__name__)

# Tuning rule thresholds
_FAILURE_TRIGGER = 3  # consecutive failures before adjusting
_RECOVERY_TRIGGER = 5  # consecutive passes before relaxing
_RAG_K_STEP = 2  # how much to increment rag_k per trigger
_RAG_K_MAX = 20  # hard cap on rag_k
_RAG_K_MIN = DEFAULT_RAG_K

# Redis key namespace
_REDIS_KEY_PARAMS = "soulgraph:tuner:params"
_REDIS_KEY_HISTORY = "soulgraph:tuner:history"
_REDIS_KEY_ADJUSTMENTS = "soulgraph:tuner:adjustments"


class AgentTuner:
    """Observes RAGAS eval reports and adjusts agent parameters.

    Stores state in Redis when available, falls back to in-memory for tests
    and offline usage.

    Usage (in EvaluatorAgent.__call__):
        tuner = get_tuner()
        tuner.observe(eval_report)
        # Next RAGAgent call will use tuner.get_params().rag_k automatically.

    Usage (inspection):
        print(tuner.status())
    """

    def __init__(
        self,
        window: int = 10,
        redis_client: Any | None = None,
    ) -> None:
        """Initialise the tuner.

        Args:
            window: Rolling window size for eval history.
            redis_client: Optional Redis client. If None, state is in-memory only.
        """
        self._window = window
        self._redis = redis_client
        self._params = TuningParams()
        self._history: deque[dict] = deque(maxlen=window)
        self._adjustments: list[str] = []

        if self._redis is not None:
            self._load_from_redis()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def observe(self, eval_report: dict[str, Any]) -> None:
        """Ingest an eval report and apply tuning rules.

        Args:
            eval_report: Output of EvaluatorAgent.evaluate() — must contain
                         'scores' dict and 'passed' bool.
        """
        scores = eval_report.get("scores") or {}
        passed = eval_report.get("passed")

        # Store a compact version of the report (avoid huge payloads in Redis).
        compact = {
            "faithfulness": scores.get("faithfulness"),
            "answer_relevancy": scores.get("answer_relevancy"),
            "context_precision": scores.get("context_precision"),
            "context_recall": scores.get("context_recall"),
            "passed": passed,
        }
        self._history.append(compact)

        self._apply_rules()

        if self._redis is not None:
            self._save_to_redis()

    def get_params(self) -> TuningParams:
        """Return the current tuning parameters."""
        return self._params

    def get_history(self) -> list[dict]:
        """Return eval history as a list (newest last)."""
        return list(self._history)

    def reset(self) -> None:
        """Reset all parameters and history to defaults."""
        self._params = TuningParams()
        self._history.clear()
        self._adjustments.clear()
        if self._redis is not None:
            self._redis.delete(_REDIS_KEY_PARAMS)
            self._redis.delete(_REDIS_KEY_HISTORY)
            self._redis.delete(_REDIS_KEY_ADJUSTMENTS)
        logger.info("AgentTuner: reset to defaults")

    def status(self) -> dict[str, Any]:
        """Return a summary suitable for CLI display or API response."""
        return {
            "params": self._params.to_dict(),
            "history": list(self._history),
            "adjustments": list(self._adjustments),
        }

    # ------------------------------------------------------------------
    # Tuning rules
    # ------------------------------------------------------------------

    def _apply_rules(self) -> None:
        """Apply all tuning rules against the current history window."""
        history = list(self._history)
        if not history:
            return

        self._rule_faithfulness_low(history)
        self._rule_relevancy_low(history)
        self._rule_recovery(history)

    def _rule_faithfulness_low(self, history: list[dict]) -> None:
        """Increase rag_k when faithfulness is consistently low."""
        recent = history[-_FAILURE_TRIGGER:]
        if len(recent) < _FAILURE_TRIGGER:
            return
        threshold = self._params.eval_threshold
        consistently_low = all((r.get("faithfulness") or 1.0) < threshold for r in recent)
        if consistently_low and self._params.rag_k < _RAG_K_MAX:
            old_k = self._params.rag_k
            self._params.rag_k = min(self._params.rag_k + _RAG_K_STEP, _RAG_K_MAX)
            msg = (
                f"rag_k: {old_k} → {self._params.rag_k}  "
                f"[{_FAILURE_TRIGGER} consecutive faithfulness < {threshold}]"
            )
            self._adjustments.append(msg)
            logger.info("AgentTuner adjustment: %s", msg)

    def _rule_relevancy_low(self, history: list[dict]) -> None:
        """Switch to reasoning model when answer_relevancy is consistently low."""
        recent = history[-_FAILURE_TRIGGER:]
        if len(recent) < _FAILURE_TRIGGER:
            return
        threshold = self._params.eval_threshold
        consistently_low = all((r.get("answer_relevancy") or 1.0) < threshold for r in recent)
        if consistently_low and not self._params.prefer_reasoning_model:
            self._params.prefer_reasoning_model = True
            msg = (
                f"prefer_reasoning_model: False → True  "
                f"[{_FAILURE_TRIGGER} consecutive answer_relevancy < {threshold}]"
            )
            self._adjustments.append(msg)
            logger.info("AgentTuner adjustment: %s", msg)

    def _rule_recovery(self, history: list[dict]) -> None:
        """Relax parameters when performance is consistently good."""
        recent = history[-_RECOVERY_TRIGGER:]
        if len(recent) < _RECOVERY_TRIGGER:
            return
        all_passed = all(r.get("passed") is True for r in recent)
        if not all_passed:
            return
        # Relax rag_k toward minimum (one step at a time).
        if self._params.rag_k > _RAG_K_MIN:
            old_k = self._params.rag_k
            self._params.rag_k = max(self._params.rag_k - _RAG_K_STEP, _RAG_K_MIN)
            msg = (
                f"rag_k: {old_k} → {self._params.rag_k}  "
                f"[{_RECOVERY_TRIGGER} consecutive passes — relaxing]"
            )
            self._adjustments.append(msg)
            logger.info("AgentTuner adjustment: %s", msg)
        # Relax reasoning model preference.
        if self._params.prefer_reasoning_model:
            self._params.prefer_reasoning_model = False
            msg = (
                f"prefer_reasoning_model: True → False  "
                f"[{_RECOVERY_TRIGGER} consecutive passes — relaxing]"
            )
            self._adjustments.append(msg)
            logger.info("AgentTuner adjustment: %s", msg)

    # ------------------------------------------------------------------
    # Redis persistence
    # ------------------------------------------------------------------

    def _load_from_redis(self) -> None:
        try:
            raw = self._redis.get(_REDIS_KEY_PARAMS)
            if raw:
                self._params = TuningParams.from_dict(json.loads(raw))
            history_raw = self._redis.lrange(_REDIS_KEY_HISTORY, 0, -1)
            for item in history_raw:
                self._history.append(json.loads(item))
            adjustments_raw = self._redis.lrange(_REDIS_KEY_ADJUSTMENTS, 0, -1)
            for item in adjustments_raw:
                self._adjustments.append(item.decode() if isinstance(item, bytes) else item)
        except Exception as exc:
            logger.warning("AgentTuner: failed to load from Redis (%s) — using defaults", exc)

    def _save_to_redis(self) -> None:
        try:
            self._redis.set(_REDIS_KEY_PARAMS, json.dumps(self._params.to_dict()))
            self._redis.delete(_REDIS_KEY_HISTORY)
            for item in self._history:
                self._redis.rpush(_REDIS_KEY_HISTORY, json.dumps(item))
            self._redis.delete(_REDIS_KEY_ADJUSTMENTS)
            for item in self._adjustments:
                self._redis.rpush(_REDIS_KEY_ADJUSTMENTS, item)
        except Exception as exc:
            logger.warning("AgentTuner: failed to save to Redis (%s) — params in-memory only", exc)


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_tuner: AgentTuner | None = None


def get_tuner(redis_client: Any | None = None) -> AgentTuner:
    """Return the global AgentTuner singleton.

    On first call, optionally accepts a Redis client to enable persistence.
    Subsequent calls ignore the redis_client argument (singleton).
    """
    global _tuner
    if _tuner is None:
        _tuner = AgentTuner(redis_client=redis_client)
    return _tuner


def reset_tuner() -> None:
    """Reset the global tuner singleton (used in tests)."""
    global _tuner
    _tuner = None
