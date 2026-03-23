"""Tests for Phase 2 config settings."""

from __future__ import annotations

import pytest

from soulgraph.config import Settings


class TestPhase2Settings:
    def test_litellm_reasoning_model_has_default(self) -> None:
        s = Settings()
        assert s.litellm_reasoning_model != ""

    def test_litellm_fast_model_has_default(self) -> None:
        s = Settings()
        assert s.litellm_fast_model != ""

    def test_langsmith_tracing_disabled_by_default(self) -> None:
        s = Settings()
        assert s.langchain_tracing_v2 is False

    def test_langfuse_host_has_default(self) -> None:
        s = Settings()
        assert s.langfuse_host == "http://localhost:3100"

    def test_api_port_default(self) -> None:
        s = Settings()
        assert s.api_port == 8080

    def test_langchain_tracing_reads_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("LANGCHAIN_TRACING_V2", "true")
        from soulgraph import config as cfg_module

        cfg_module._settings = None  # reset singleton
        s = Settings()
        assert s.langchain_tracing_v2 is True
        cfg_module._settings = None  # cleanup
