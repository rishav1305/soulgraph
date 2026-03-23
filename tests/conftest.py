"""Shared test fixtures."""
from __future__ import annotations

import pytest

from soulgraph.agents.evaluator import EvaluatorAgent
from soulgraph.agents.rag import RAGAgent


class MockRAGAgent(RAGAgent):
    """RAG agent that returns fixed documents without hitting ChromaDB."""

    def __init__(self, fixed_docs: list[str] | None = None) -> None:
        super().__init__()
        self.fixed_docs = fixed_docs if fixed_docs is not None else [
            "Retrieval-Augmented Generation (RAG) combines retrieval with generation.",
            "RAG improves factual accuracy by grounding responses in retrieved documents.",
        ]

    def retrieve(self, query: str, n_results: int = 5) -> list[str]:  # noqa: ARG002
        return self.fixed_docs[: min(n_results, len(self.fixed_docs))]


@pytest.fixture
def mock_rag_agent() -> MockRAGAgent:
    return MockRAGAgent()


@pytest.fixture
def evaluator() -> EvaluatorAgent:
    return EvaluatorAgent(threshold=0.7)
