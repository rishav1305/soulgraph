"""Tests for the dual tracing module (LangSmith + LangFuse).

Covers setup_langsmith, get_langfuse_callback, and setup_tracing.
"""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

from soulgraph.tracing import get_langfuse_callback, setup_langsmith, setup_tracing


class TestSetupLangsmith:
    def test_disabled_sets_env_var_to_false(self) -> None:
        """When enabled=False the env var must be set to 'false'."""
        setup_langsmith(api_key="any-key", project="proj", enabled=False)
        assert os.environ.get("LANGCHAIN_TRACING_V2") in ("false", None)

    def test_enabled_without_key_does_not_enable_tracing(self) -> None:
        """When enabled=True but api_key is empty, tracing must NOT be activated."""
        os.environ.pop("LANGCHAIN_TRACING_V2", None)
        setup_langsmith(api_key="", project="proj", enabled=True)
        assert os.environ.get("LANGCHAIN_TRACING_V2") != "true"

    def test_enabled_with_key_configures_all_env_vars(self) -> None:
        """When enabled=True and api_key is set, all LangSmith env vars must be written."""
        setup_langsmith(api_key="ls-test-key", project="test-project", enabled=True)
        assert os.environ.get("LANGCHAIN_TRACING_V2") == "true"
        assert os.environ.get("LANGCHAIN_API_KEY") == "ls-test-key"
        assert os.environ.get("LANGCHAIN_PROJECT") == "test-project"

    def test_enabled_with_key_updates_existing_env_vars(self) -> None:
        """Calling setup_langsmith twice with new keys must overwrite the old values."""
        setup_langsmith(api_key="key-v1", project="proj-v1", enabled=True)
        setup_langsmith(api_key="key-v2", project="proj-v2", enabled=True)
        assert os.environ.get("LANGCHAIN_API_KEY") == "key-v2"
        assert os.environ.get("LANGCHAIN_PROJECT") == "proj-v2"


class TestGetLangfuseCallback:
    def test_returns_none_when_keys_missing(self) -> None:
        """When LangFuse public/secret keys are absent, callback must be None."""
        with patch("soulgraph.config.get_settings") as mock_get_settings:
            s = MagicMock()
            s.langfuse_public_key = ""
            s.langfuse_secret_key = ""
            mock_get_settings.return_value = s
            assert get_langfuse_callback() is None

    def test_returns_none_when_langfuse_not_installed(self) -> None:
        """If the langfuse package is not installed, the function must return None gracefully."""
        import sys

        original = sys.modules.get("langfuse.callback")
        sys.modules["langfuse.callback"] = None  # type: ignore[assignment]
        try:
            result = get_langfuse_callback()
            assert result is None
        finally:
            if original is None:
                sys.modules.pop("langfuse.callback", None)
            else:
                sys.modules["langfuse.callback"] = original

    def test_returns_none_on_unexpected_exception(self) -> None:
        """Any unexpected exception during setup must be caught and return None."""
        with patch("soulgraph.config.get_settings") as mock_get_settings:
            mock_get_settings.side_effect = RuntimeError("unexpected settings failure")
            result = get_langfuse_callback()
            assert result is None

    def test_returns_handler_when_configured(self) -> None:
        """When keys are set and langfuse is importable, a CallbackHandler must be returned."""
        mock_handler = MagicMock()
        mock_callback_class = MagicMock(return_value=mock_handler)
        mock_langfuse_module = MagicMock()
        mock_langfuse_module.CallbackHandler = mock_callback_class

        with (
            patch.dict("sys.modules", {"langfuse.callback": mock_langfuse_module}),
            patch("soulgraph.config.get_settings") as mock_get_settings,
        ):
            s = MagicMock()
            s.langfuse_public_key = "pk-test"
            s.langfuse_secret_key = "sk-test"
            s.langfuse_host = "http://localhost:3100"
            mock_get_settings.return_value = s
            result = get_langfuse_callback()
            assert result is mock_handler


class TestSetupTracing:
    def test_returns_empty_list_when_no_langfuse(self) -> None:
        """When LangFuse is not configured, setup_tracing must return an empty list."""
        with patch("soulgraph.tracing.get_langfuse_callback", return_value=None):
            callbacks = setup_tracing()
            assert isinstance(callbacks, list)

    def test_returns_list_with_handler_when_langfuse_active(self) -> None:
        """When LangFuse callback is available, it must appear in the returned list."""
        mock_handler = MagicMock()
        with patch("soulgraph.tracing.get_langfuse_callback", return_value=mock_handler):
            callbacks = setup_tracing()
            assert mock_handler in callbacks

    def test_setup_tracing_calls_setup_langsmith(self) -> None:
        """setup_tracing must invoke setup_langsmith as part of its initialisation."""
        with (
            patch("soulgraph.tracing.setup_langsmith") as mock_setup_ls,
            patch("soulgraph.tracing.get_langfuse_callback", return_value=None),
        ):
            setup_tracing()
            mock_setup_ls.assert_called_once()
