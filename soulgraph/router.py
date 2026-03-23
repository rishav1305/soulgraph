"""LiteLLM model router — task-based model selection."""

from __future__ import annotations

import logging
from enum import StrEnum
from typing import Any

import litellm

logger = logging.getLogger(__name__)
litellm.suppress_debug_info = True


class TaskType(StrEnum):
    REASONING = "reasoning"
    FAST = "fast"


class ModelRouter:
    """Routes LLM calls to the appropriate model based on task type."""

    def __init__(self, reasoning_model: str, fast_model: str) -> None:
        self._models: dict[TaskType, str] = {
            TaskType.REASONING: reasoning_model,
            TaskType.FAST: fast_model,
        }

    def get_model(self, task: TaskType) -> str:
        return self._models[task]

    def complete(self, task: TaskType, messages: list[dict[str, Any]], **kwargs: Any) -> str:
        model = self.get_model(task)
        logger.debug("Router: %s → %s", task.value, model)
        response = litellm.completion(model=model, messages=messages, **kwargs)
        if not response.choices:
            raise ValueError(f"LiteLLM returned empty response for model {model!r}")
        content: str = response.choices[0].message.content or ""
        return content


def router_from_settings() -> ModelRouter:
    from soulgraph.config import get_settings

    s = get_settings()
    return ModelRouter(reasoning_model=s.litellm_reasoning_model, fast_model=s.litellm_fast_model)
