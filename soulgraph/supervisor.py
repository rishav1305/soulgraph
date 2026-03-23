"""LangGraph Supervisor — routes queries to specialist agents."""

from __future__ import annotations

import logging
from typing import Any, cast

from langgraph.graph import END, StateGraph

from soulgraph.agents.evaluator import EvaluatorAgent
from soulgraph.agents.rag import RAGAgent
from soulgraph.state import AgentState

logger = logging.getLogger(__name__)

# Routing table: intent name → next agent node name.
INTENT_ROUTES: dict[str, str] = {
    "question_answering": "rag",
    "default": "rag",
}


def classify_intent(question: str) -> str:
    """Classify the user's intent.

    Phase 1: hardcoded routing — all queries go to RAG.
    Phase 2: Model Router sub-agent with intent classification.

    Args:
        question: The user's input question.

    Returns:
        Intent string key from INTENT_ROUTES.
    """
    _ = question  # unused in Phase 1
    return "question_answering"


def supervisor_node(state: AgentState) -> AgentState:
    """Supervisor node: classify intent and set next_agent."""
    intent = classify_intent(state["question"])
    next_agent = INTENT_ROUTES.get(intent, INTENT_ROUTES["default"])
    logger.info("Supervisor: intent=%s → next=%s", intent, next_agent)
    return cast(AgentState, dict(state) | {"next_agent": next_agent})


def route_from_supervisor(state: AgentState) -> str:
    """Conditional edge function: return the next node based on state."""
    return state.get("next_agent", "rag")


def build_graph(
    rag_agent: RAGAgent | None = None,
    evaluator: EvaluatorAgent | None = None,
    checkpointer: Any | None = None,
) -> Any:
    """Build and compile the SoulGraph StateGraph.

    Args:
        rag_agent: RAG agent instance. Uses defaults if None.
        evaluator: Evaluator agent instance. Uses defaults if None.
        checkpointer: Optional LangGraph checkpointer (e.g. RedisSaver). None = stateless.

    Returns:
        Compiled LangGraph graph ready for invocation.
    """
    if rag_agent is None:
        rag_agent = RAGAgent()
    if evaluator is None:
        evaluator = EvaluatorAgent()

    graph = StateGraph(AgentState)

    # Add nodes.
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("rag", rag_agent)
    graph.add_node("evaluator", evaluator)

    # Entry point.
    graph.set_entry_point("supervisor")

    # Routing edges.
    graph.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {"rag": "rag"},
    )
    graph.add_edge("rag", "evaluator")
    graph.add_edge("evaluator", END)

    return graph.compile(checkpointer=checkpointer)
