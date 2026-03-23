"""Shared test fixtures."""

from __future__ import annotations

from typing import Any as _Any

import pytest

from soulgraph.agents.evaluator import EvaluatorAgent
from soulgraph.agents.rag import RAGAgent


class MockRAGAgent(RAGAgent):
    """RAG agent that returns fixed documents without hitting ChromaDB."""

    def __init__(self, fixed_docs: list[str] | None = None) -> None:
        super().__init__()
        self.fixed_docs = (
            fixed_docs
            if fixed_docs is not None
            else [
                "Retrieval-Augmented Generation (RAG) combines retrieval with generation.",
                "RAG improves factual accuracy by grounding responses in retrieved documents.",
            ]
        )

    def retrieve(self, query: str, n_results: int = 5) -> list[str]:  # noqa: ARG002
        return self.fixed_docs[: min(n_results, len(self.fixed_docs))]


class MockRouter:
    """Stub router for tests."""

    def __init__(self, response: str = "question_answering", raises: bool = False) -> None:
        self._response = response
        self._raises = raises

    def complete(self, task: _Any, messages: _Any, **kwargs: _Any) -> str:
        if self._raises:
            raise RuntimeError("mock failure")
        return self._response


@pytest.fixture
def mock_rag_agent() -> MockRAGAgent:
    return MockRAGAgent()


@pytest.fixture
def evaluator() -> EvaluatorAgent:
    return EvaluatorAgent(threshold=0.7)
