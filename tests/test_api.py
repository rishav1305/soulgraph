"""Tests for the FastAPI HTTP + WebSocket API."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    from soulgraph.api import app

    return TestClient(app)


def _make_mock_graph(result: dict[str, Any]) -> MagicMock:
    """Return a mock LangGraph object whose .invoke() returns *result*."""
    g = MagicMock()
    g.invoke.return_value = result
    return g


class TestHealthEndpoint:
    def test_returns_200(self, client: TestClient) -> None:
        assert client.get("/health").status_code == 200

    def test_returns_ok_status(self, client: TestClient) -> None:
        assert client.get("/health").json()["status"] == "ok"

    def test_returns_version(self, client: TestClient) -> None:
        assert "version" in client.get("/health").json()


class TestQueryEndpoint:
    def test_missing_question_returns_422(self, client: TestClient) -> None:
        response = client.post("/query", json={"session_id": "test"})
        assert response.status_code == 422

    def test_valid_request_returns_non_500(self, client: TestClient) -> None:
        # Tool agent handles this without ChromaDB/LiteLLM — accepts 200 or service errors
        response = client.post(
            "/query",
            json={
                "question": "calculate 2 + 2",
                "session_id": "test-api",
            },
        )
        assert response.status_code in (200, 503)


class TestQueryEndpointSuccess:
    def test_successful_query_returns_200_with_answer(self, client: TestClient) -> None:
        """When the graph succeeds, /query must return 200 with answer + eval_report."""
        import soulgraph.api as api_mod

        mock_result = {
            "answer": "Paris is the capital of France.",
            "eval_report": {"score": 0.92},
        }
        with patch.object(api_mod, "_get_graph", return_value=_make_mock_graph(mock_result)):
            response = client.post(
                "/query",
                json={"question": "What is the capital of France?", "session_id": "t1"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["answer"] == "Paris is the capital of France."
        assert data["session_id"] == "t1"

    def test_successful_query_includes_eval_report(self, client: TestClient) -> None:
        """The eval_report from graph result must be forwarded in the response."""
        import soulgraph.api as api_mod

        mock_result = {"answer": "42", "eval_report": {"faithfulness": 0.99}}
        with patch.object(api_mod, "_get_graph", return_value=_make_mock_graph(mock_result)):
            response = client.post(
                "/query",
                json={"question": "Ultimate answer?", "session_id": "t2"},
            )
        assert response.status_code == 200
        assert response.json()["eval_report"]["faithfulness"] == 0.99


class TestWebSocketEndpoint:
    def test_ws_connects_and_receives_message(self, client: TestClient) -> None:
        with client.websocket_connect("/ws/query") as ws:
            ws.send_json({"question": "calculate 3 + 3", "session_id": "test-ws"})
            msg = ws.receive_json()
            assert "type" in msg

    def test_ws_empty_question_returns_error(self, client: TestClient) -> None:
        with client.websocket_connect("/ws/query") as ws:
            ws.send_json({"question": "", "session_id": "test-ws"})
            msg = ws.receive_json()
            assert msg["type"] == "error"

    def test_ws_streams_tokens_for_multi_word_answer(self, client: TestClient) -> None:
        """A multi-word answer must arrive as individual token messages followed by done."""
        import soulgraph.api as api_mod

        mock_result = {"answer": "The answer is forty two", "eval_report": {}}
        with patch.object(api_mod, "_get_graph", return_value=_make_mock_graph(mock_result)):
            with client.websocket_connect("/ws/query") as ws:
                ws.send_json({"question": "What is 6 x 7?", "session_id": "ws-t1"})
                messages: list[dict[str, Any]] = []
                for _ in range(20):
                    msg = ws.receive_json()
                    messages.append(msg)
                    if msg["type"] == "done":
                        break
        msg_types = {m["type"] for m in messages}
        assert "token" in msg_types
        assert "done" in msg_types

    def test_ws_sends_eval_message_when_report_present(self, client: TestClient) -> None:
        """When eval_report is non-empty, a type=eval message must be sent before done."""
        import soulgraph.api as api_mod

        mock_result = {"answer": "Four", "eval_report": {"faithfulness": 0.85}}
        with patch.object(api_mod, "_get_graph", return_value=_make_mock_graph(mock_result)):
            with client.websocket_connect("/ws/query") as ws:
                ws.send_json({"question": "2 + 2?", "session_id": "ws-t2"})
                messages: list[dict[str, Any]] = []
                for _ in range(20):
                    msg = ws.receive_json()
                    messages.append(msg)
                    if msg["type"] == "done":
                        break
        msg_types = {m["type"] for m in messages}
        assert "eval" in msg_types
        assert "done" in msg_types

    def test_ws_graph_exception_returns_error_message(self, client: TestClient) -> None:
        """If graph.invoke() raises, the WS must receive a type=error message."""
        import soulgraph.api as api_mod

        failing_graph = MagicMock()
        failing_graph.invoke.side_effect = RuntimeError("graph exploded")
        with patch.object(api_mod, "_get_graph", return_value=failing_graph):
            with client.websocket_connect("/ws/query") as ws:
                ws.send_json({"question": "trigger error", "session_id": "ws-err"})
                msg = ws.receive_json()
        assert msg["type"] == "error"


class TestAPIMainFunction:
    def test_main_invokes_uvicorn_run(self) -> None:
        """api.main() must call uvicorn.run exactly once with the FastAPI app."""
        mock_uvicorn = MagicMock()
        with patch.dict("sys.modules", {"uvicorn": mock_uvicorn}):
            # Re-import to pick up the patched module reference inside main()
            import importlib

            import soulgraph.api as api_mod

            importlib.reload(api_mod)
            api_mod.main()
            mock_uvicorn.run.assert_called_once()
