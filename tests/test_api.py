"""Tests for the FastAPI HTTP + WebSocket API."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    from soulgraph.api import app

    return TestClient(app)


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
