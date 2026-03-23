"""Shared state schema for all SoulGraph agents."""
from __future__ import annotations

from typing import Annotated, Any
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """Shared state passed between all agents in the graph.

    All fields are immutable — agents return new state dicts, never mutate in place.
    """

    # The user's original question.
    question: str

    # Messages accumulated during the conversation (append-only via add_messages).
    messages: Annotated[list[Any], add_messages]

    # Retrieved documents from the RAG agent.
    documents: list[str]

    # Final answer from the RAG agent.
    answer: str

    # Evaluation report from the Evaluator agent (structured JSON).
    eval_report: dict[str, Any]

    # Routing decision made by the supervisor.
    next_agent: str

    # Session identifier for Redis state tracking.
    session_id: str
