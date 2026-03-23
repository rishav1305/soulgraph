"""Tool Agent — keyword-detected tools with safe arithmetic evaluator."""

from __future__ import annotations

import ast
import logging
import operator
import re
from typing import Any

from langchain_core.tools import tool

from soulgraph.state import AgentState

logger = logging.getLogger(__name__)

_OPERATORS: dict[type[ast.AST], Any] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
}


def _safe_eval_node(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return float(node.value)
    if isinstance(node, ast.BinOp) and type(node.op) in _OPERATORS:
        result: float = _OPERATORS[type(node.op)](
            _safe_eval_node(node.left), _safe_eval_node(node.right)
        )
        return result
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPERATORS:
        unary_result: float = _OPERATORS[type(node.op)](_safe_eval_node(node.operand))
        return unary_result
    raise ValueError(f"Unsupported expression node: {type(node).__name__}")


def safe_calculate(expression: str) -> str:
    """Safely evaluate a mathematical expression using AST parsing (no eval)."""
    cleaned = re.sub(r"[^0-9\s\+\-\*\/\.\(\)\^]", "", expression).strip()
    if not cleaned:
        return "Error: no numeric expression found"
    try:
        tree = ast.parse(cleaned, mode="eval")
        result = _safe_eval_node(tree.body)
        # Preserve float format if the expression contained decimal literals.
        has_decimal = "." in cleaned
        if not has_decimal and result == int(result):
            return str(int(result))
        return str(result)
    except ZeroDivisionError:
        return "Error: division by zero"
    except Exception as exc:
        return f"Error: {exc}"


@tool
def calculator(expression: str) -> str:
    """Evaluate a mathematical expression like '2 + 2' or '10 / 4'."""
    return safe_calculate(expression)


@tool
def word_count(text: str) -> str:
    """Count the number of words in a text."""
    count = len(text.split())
    return f"{count} words"


TOOLS = [calculator, word_count]
_TOOL_MAP = {t.name: t for t in TOOLS}


class ToolAgent:
    """Detects and executes tool calls based on question keywords."""

    _CALC_PATTERN = re.compile(r"[\d][\d\s\+\-\*\/\.\(\)]*[\d\.]")

    def _detect_tool(self, question: str) -> tuple[str, str] | None:
        q = question.lower()
        calc_keywords = {"calculate", "compute", "divide", "multiply", "add", "subtract", "what is"}
        if any(kw in q for kw in calc_keywords):
            match = self._CALC_PATTERN.search(question)
            if match:
                return ("calculator", match.group(0))
        if "how many words" in q or "word count" in q:
            return ("word_count", question)
        return None

    def __call__(self, state: AgentState) -> dict[str, Any]:
        question = state.get("question", "")
        tool_results: list[dict[str, Any]] = []
        answer = ""

        tool_call = self._detect_tool(question)
        if tool_call:
            tool_name, arg = tool_call
            if tool_name in _TOOL_MAP:
                try:
                    output = _TOOL_MAP[tool_name].invoke(arg)
                    tool_results.append({"tool": tool_name, "input": arg, "output": output})
                    answer = f"Tool result ({tool_name}): {output}"
                    logger.info("Tool %s(%r) → %r", tool_name, arg, output)
                except Exception as exc:
                    answer = f"Tool {tool_name!r} failed: {exc}"
            else:
                answer = f"Unknown tool: {tool_name!r}"
        else:
            answer = "No matching tool found for this question. Try the RAG agent."

        return {**state, "tool_results": tool_results, "answer": answer}
