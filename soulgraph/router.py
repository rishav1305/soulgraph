"""LiteLLM model router — task-based model selection.

Phase 3 T5: vLLM backend support.
When VLLM_BASE_URL is set, the router uses vLLM as a self-hosted inference
backend behind the existing LiteLLM proxy.  LiteLLM's openai-compatible
shim is used: model="openai/<vllm_model>" + api_base=<vllm_base_url>.
Cloud API fallback is used when VLLM_BASE_URL is empty (default).
"""

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
    """Routes LLM calls to the appropriate model based on task type.

    Supports two backends:
    - Cloud APIs (Anthropic, OpenAI, …) via LiteLLM model strings.
    - vLLM self-hosted inference via openai-compatible endpoint.

    vLLM is selected automatically when ``vllm_base_url`` is provided.
    The vLLM model is used for ALL task types (reasoning + fast) when
    vLLM is active — model selection per task type is still available
    via the ``_models`` map but defaults to the same vLLM model.
    """

    def __init__(
        self,
        reasoning_model: str,
        fast_model: str,
        vllm_base_url: str = "",
        vllm_model: str = "",
    ) -> None:
        self._models: dict[TaskType, str] = {
            TaskType.REASONING: reasoning_model,
            TaskType.FAST: fast_model,
        }
        self._vllm_base_url = vllm_base_url.rstrip("/")
        self._vllm_model = vllm_model
        if vllm_base_url:
            logger.info("vLLM backend enabled: base_url=%s model=%s", vllm_base_url, vllm_model)

    @property
    def using_vllm(self) -> bool:
        """True when a vLLM base URL is configured."""
        return bool(self._vllm_base_url)

    def get_model(self, task: TaskType) -> str:
        """Return the model string for the given task type."""
        if self.using_vllm:
            # vLLM uses LiteLLM's OpenAI-compatible shim.
            # Model string must be "openai/<hf_model_id>" when using a custom base.
            return f"openai/{self._vllm_model}"
        return self._models[task]

    def complete(self, task: TaskType, messages: list[dict[str, Any]], **kwargs: Any) -> str:
        """Call the LLM and return the response text.

        When vLLM is active, ``api_base`` is injected into the LiteLLM call
        so requests are routed to the self-hosted inference server.
        """
        model = self.get_model(task)
        logger.debug("Router: %s → %s (vllm=%s)", task.value, model, self.using_vllm)

        call_kwargs: dict[str, Any] = dict(kwargs)
        if self.using_vllm:
            call_kwargs["api_base"] = f"{self._vllm_base_url}"

        response = litellm.completion(model=model, messages=messages, **call_kwargs)
        if not response.choices:
            raise ValueError(f"LiteLLM returned empty response for model {model!r}")
        content: str = response.choices[0].message.content or ""
        return content


def router_from_settings() -> ModelRouter:
    """Build a ModelRouter from environment-derived Settings.

    If VLLM_BASE_URL is set, the router delegates to the vLLM backend.
    Otherwise it uses the configured cloud-API LiteLLM model strings.
    """
    from soulgraph.config import get_settings

    s = get_settings()
    return ModelRouter(
        reasoning_model=s.litellm_reasoning_model,
        fast_model=s.litellm_fast_model,
        vllm_base_url=s.vllm_base_url,
        vllm_model=s.vllm_model,
    )
