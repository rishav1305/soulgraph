"""Tests for the LiteLLM model router."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from soulgraph.router import ModelRouter, TaskType


class TestTaskType:
    def test_reasoning_and_fast_types_exist(self) -> None:
        assert TaskType.REASONING is not None
        assert TaskType.FAST is not None


class TestModelRouter:
    def test_get_model_reasoning(self) -> None:
        router = ModelRouter(reasoning_model="model-x", fast_model="model-y")
        assert router.get_model(TaskType.REASONING) == "model-x"

    def test_get_model_fast(self) -> None:
        router = ModelRouter(reasoning_model="model-x", fast_model="model-y")
        assert router.get_model(TaskType.FAST) == "model-y"

    def test_complete_calls_litellm_and_returns_content(self) -> None:
        router = ModelRouter(reasoning_model="m", fast_model="m")
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock(message=MagicMock(content="the answer"))]
        with patch("soulgraph.router.litellm.completion", return_value=mock_resp):
            result = router.complete(TaskType.FAST, [{"role": "user", "content": "hi"}])
        assert result == "the answer"

    def test_complete_raises_on_empty_choices(self) -> None:
        router = ModelRouter(reasoning_model="m", fast_model="m")
        mock_resp = MagicMock()
        mock_resp.choices = []
        with patch("soulgraph.router.litellm.completion", return_value=mock_resp):
            with pytest.raises(ValueError, match="empty response"):
                router.complete(TaskType.FAST, [{"role": "user", "content": "hi"}])


class TestModelRouterVLLM:
    """Tests for vLLM backend integration (T5 — Phase 3 Wave 1)."""

    def test_using_vllm_false_by_default(self) -> None:
        router = ModelRouter(reasoning_model="m", fast_model="m")
        assert router.using_vllm is False

    def test_using_vllm_true_when_base_url_set(self) -> None:
        router = ModelRouter(
            reasoning_model="m",
            fast_model="m",
            vllm_base_url="http://vllm:8000/v1",
            vllm_model="mistralai/Mistral-7B",
        )
        assert router.using_vllm is True

    def test_get_model_returns_vllm_model_string_when_vllm_enabled(self) -> None:
        router = ModelRouter(
            reasoning_model="cloud-big",
            fast_model="cloud-small",
            vllm_base_url="http://vllm:8000/v1",
            vllm_model="mistralai/Mistral-7B",
        )
        # Both task types should use the vLLM model with openai/ prefix
        assert router.get_model(TaskType.REASONING) == "openai/mistralai/Mistral-7B"
        assert router.get_model(TaskType.FAST) == "openai/mistralai/Mistral-7B"

    def test_get_model_uses_cloud_model_when_vllm_disabled(self) -> None:
        router = ModelRouter(reasoning_model="claude-big", fast_model="claude-small")
        assert router.get_model(TaskType.REASONING) == "claude-big"
        assert router.get_model(TaskType.FAST) == "claude-small"

    def test_complete_injects_api_base_when_vllm_enabled(self) -> None:
        router = ModelRouter(
            reasoning_model="m",
            fast_model="m",
            vllm_base_url="http://vllm:8000/v1",
            vllm_model="mistralai/Mistral-7B",
        )
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock(message=MagicMock(content="vllm answer"))]
        with patch("soulgraph.router.litellm.completion", return_value=mock_resp) as mock_call:
            result = router.complete(TaskType.FAST, [{"role": "user", "content": "test"}])
            # api_base must be injected for vLLM routing
            call_kwargs = mock_call.call_args.kwargs
            assert call_kwargs.get("api_base") == "http://vllm:8000/v1"
        assert result == "vllm answer"

    def test_complete_does_not_inject_api_base_when_vllm_disabled(self) -> None:
        router = ModelRouter(reasoning_model="m", fast_model="m")
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock(message=MagicMock(content="cloud answer"))]
        with patch("soulgraph.router.litellm.completion", return_value=mock_resp) as mock_call:
            router.complete(TaskType.FAST, [{"role": "user", "content": "test"}])
            call_kwargs = mock_call.call_args.kwargs
            assert "api_base" not in call_kwargs

    def test_vllm_base_url_trailing_slash_stripped(self) -> None:
        router = ModelRouter(
            reasoning_model="m",
            fast_model="m",
            vllm_base_url="http://vllm:8000/v1/",
            vllm_model="some-model",
        )
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock(message=MagicMock(content="ok"))]
        with patch("soulgraph.router.litellm.completion", return_value=mock_resp) as mock_call:
            router.complete(TaskType.FAST, [{"role": "user", "content": "hi"}])
            call_kwargs = mock_call.call_args.kwargs
            assert not call_kwargs["api_base"].endswith("/"), (
                "Trailing slash should be stripped from api_base"
            )
