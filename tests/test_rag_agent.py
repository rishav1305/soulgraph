"""Tests for the RAG agent."""
from __future__ import annotations

from tests.conftest import MockRAGAgent


class TestRAGAgent:
    def test_retrieve_returns_list(self) -> None:
        agent = MockRAGAgent()
        docs = agent.retrieve("What is RAG?")
        assert isinstance(docs, list)

    def test_retrieve_respects_n_results(self) -> None:
        agent = MockRAGAgent(fixed_docs=["doc1", "doc2", "doc3"])
        docs = agent.retrieve("query", n_results=2)
        assert len(docs) <= 2

    def test_retrieve_returns_empty_on_no_docs(self) -> None:
        agent = MockRAGAgent(fixed_docs=[])
        docs = agent.retrieve("query")
        assert docs == []

    def test_call_updates_state(self) -> None:
        agent = MockRAGAgent(fixed_docs=["retrieved doc"])
        state = {
            "question": "What is RAG?",
            "messages": [],
            "documents": [],
            "answer": "",
            "eval_report": {},
            "next_agent": "",
            "session_id": "test",
        }
        result = agent(state)
        assert "documents" in result
        assert result["documents"] == ["retrieved doc"]

    def test_call_sets_next_agent_to_evaluator(self) -> None:
        agent = MockRAGAgent()
        state = {
            "question": "Test?",
            "messages": [],
            "documents": [],
            "answer": "",
            "eval_report": {},
            "next_agent": "",
            "session_id": "test",
        }
        result = agent(state)
        assert result["next_agent"] == "evaluator"
