"""Tests for the Redis checkpoint factory."""

from __future__ import annotations

from unittest.mock import MagicMock, patch


class TestGetCheckpointer:
    def test_returns_none_when_redis_unavailable(self) -> None:
        from soulgraph.checkpoint import get_checkpointer

        result = get_checkpointer("redis://localhost:19999")
        assert result is None

    def test_returns_saver_when_connection_succeeds(self) -> None:
        from soulgraph.checkpoint import get_checkpointer

        mock_saver = MagicMock()
        with patch("soulgraph.checkpoint._connect", return_value=mock_saver):
            result = get_checkpointer("redis://localhost:6379")
        assert result is mock_saver

    def test_graph_compiles_with_none_checkpointer(self) -> None:
        from soulgraph.checkpoint import get_checkpointer
        from soulgraph.supervisor import build_graph
        from tests.conftest import MockRAGAgent  # noqa: F401

        checkpointer = get_checkpointer("redis://localhost:19999")
        assert checkpointer is None
        graph = build_graph(checkpointer=checkpointer)
        assert graph is not None
