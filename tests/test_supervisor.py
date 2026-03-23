"""Tests for the LangGraph supervisor."""
from __future__ import annotations

import pytest

from soulgraph.supervisor import build_graph, classify_intent, supervisor_node
from tests.conftest import MockRAGAgent


class TestClassifyIntent:
    def test_returns_question_answering_for_any_input(self) -> None:
        assert classify_intent("What is RAG?") == "question_answering"

    def test_returns_question_answering_for_empty_string(self) -> None:
        assert classify_intent("") == "question_answering"

    def test_returns_question_answering_for_long_query(self) -> None:
        assert classify_intent("a" * 1000) == "question_answering"


class TestSupervisorNode:
    def test_sets_next_agent_to_rag(self) -> None:
        state = {
            "question": "What is RAG?",
            "messages": [],
            "documents": [],
            "answer": "",
            "eval_report": {},
            "next_agent": "",
            "session_id": "test",
        }
        result = supervisor_node(state)  # type: ignore[arg-type]
        assert result["next_agent"] == "rag"

    def test_preserves_all_state_fields(self) -> None:
        state = {
            "question": "Test?",
            "messages": ["msg1"],
            "documents": ["doc1"],
            "answer": "existing answer",
            "eval_report": {"score": 0.9},
            "next_agent": "",
            "session_id": "sess-1",
        }
        result = supervisor_node(state)  # type: ignore[arg-type]
        assert result["question"] == "Test?"
        assert result["session_id"] == "sess-1"
        assert result["answer"] == "existing answer"


class TestBuildGraph:
    def test_graph_compiles_without_error(self) -> None:
        rag = MockRAGAgent()
        graph = build_graph(rag_agent=rag)
        assert graph is not None

    def test_graph_invoke_returns_state_with_documents(self) -> None:
        rag = MockRAGAgent(fixed_docs=["Document about RAG.", "Another document."])
        graph = build_graph(rag_agent=rag)
        initial = {
            "question": "What is retrieval-augmented generation?",
            "messages": [],
            "documents": [],
            "answer": "",
            "eval_report": {},
            "next_agent": "",
            "session_id": "test",
        }
        result = graph.invoke(initial)
        assert "documents" in result
        assert len(result["documents"]) > 0

    def test_graph_invoke_returns_eval_report(self) -> None:
        rag = MockRAGAgent()
        graph = build_graph(rag_agent=rag)
        initial = {
            "question": "What is RAG?",
            "messages": [],
            "documents": [],
            "answer": "",
            "eval_report": {},
            "next_agent": "",
            "session_id": "test",
        }
        result = graph.invoke(initial)
        assert "eval_report" in result
        assert "question" in result["eval_report"]
