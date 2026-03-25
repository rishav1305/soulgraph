"""LangGraph Supervisor — routes queries to specialist agents."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, cast

from langgraph.graph import END, StateGraph

from soulgraph.agents.evaluator import EvaluatorAgent
from soulgraph.agents.rag import RAGAgent
from soulgraph.router import ModelRouter, TaskType, router_from_settings
from soulgraph.state import AgentState
from soulgraph.tuner import get_tuner

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

# Routing table: intent name → next agent node name.
INTENT_ROUTES: dict[str, str] = {
    "question_answering": "rag",
    "tool_use": "tool",
    "default": "rag",
}

# Module-level router singleton — lazy-initialised on first use.
_router: ModelRouter | None = None


def _get_router() -> ModelRouter:
    """Return the module-level router singleton, initialising if needed."""
    global _router
    if _router is None:
        _router = router_from_settings()
    return _router


def classify_intent(question: str, router: ModelRouter | None = None) -> str:
    """Classify the user's intent via the LiteLLM router.

    Args:
        question: The user's input question.
        router: Optional router override (used in tests). Falls back to module singleton.

    Returns:
        Intent string key from INTENT_ROUTES.
    """
    r = router or _get_router()
    try:
        response = r.complete(
            TaskType.FAST,
            [
                {
                    "role": "system",
                    "content": (
                        "You are an intent classifier. Reply with exactly one word. "
                        "Valid intents: question_answering, tool_use. "
                        "Use tool_use if the question asks for a calculation or counting. "
                        "Default to question_answering."
                    ),
                },
                {"role": "user", "content": question},
            ],
            max_tokens=10,
            temperature=0.0,
        )
        intent = response.strip().lower()
        if intent not in INTENT_ROUTES:
            logger.warning("Unknown intent %r — defaulting to question_answering", intent)
            return "question_answering"
        return intent
    except Exception as exc:
        logger.warning("Intent classification error: %s — defaulting to question_answering", exc)
        return "question_answering"


def supervisor_node(state: AgentState) -> AgentState:
    """Supervisor node: classify intent and set next_agent."""
    # Agent fine-tuning: pass router to classify_intent so prefer_reasoning_model
    # adjustments are respected (routing to a higher-tier model when needed).
    tuner_params = get_tuner().get_params()
    if tuner_params.prefer_reasoning_model:
        from soulgraph.router import ModelRouter, TaskType, router_from_settings
        base = _get_router()
        # Build a one-shot router that forces the reasoning model for this query.
        fast_model = base.get_model(TaskType.REASONING)  # use reasoning for both tiers
        routing_router = ModelRouter(
            reasoning_model=fast_model,
            fast_model=fast_model,
            vllm_base_url=base._vllm_base_url,
            vllm_model=base._vllm_model,
        )
        intent = classify_intent(state["question"], router=routing_router)
        logger.info("Supervisor: prefer_reasoning_model=True — using reasoning router")
    else:
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
    from soulgraph.agents.tool_agent import ToolAgent

    if rag_agent is None:
        rag_agent = RAGAgent()
    if evaluator is None:
        evaluator = EvaluatorAgent()
    tool_agent = ToolAgent()

    graph = StateGraph(AgentState)

    # Add nodes.
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("rag", rag_agent)
    graph.add_node("evaluator", evaluator)
    graph.add_node("tool", tool_agent)

    # Entry point.
    graph.set_entry_point("supervisor")

    # Routing edges.
    graph.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {"rag": "rag", "tool": "tool"},
    )
    graph.add_edge("rag", "evaluator")
    graph.add_edge("evaluator", END)
    graph.add_edge("tool", END)

    return graph.compile(checkpointer=checkpointer)
