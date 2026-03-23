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
