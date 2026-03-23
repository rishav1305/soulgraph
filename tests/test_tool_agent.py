"""Tests for the Tool agent."""

from __future__ import annotations

from soulgraph.agents.tool_agent import TOOLS, ToolAgent, safe_calculate


class TestSafeCalculate:
    def test_addition(self) -> None:
        assert safe_calculate("2 + 2") == "4"

    def test_multiplication(self) -> None:
        assert safe_calculate("3 * 7") == "21"

    def test_division(self) -> None:
        assert safe_calculate("10 / 4") == "2.5"

    def test_division_by_zero_returns_error(self) -> None:
        result = safe_calculate("1 / 0")
        assert "error" in result.lower()

    def test_non_numeric_returns_error(self) -> None:
        result = safe_calculate("import os")
        assert "error" in result.lower()

    def test_float_result(self) -> None:
        result = safe_calculate("1.5 + 2.5")
        assert result == "4.0"


class TestToolRegistry:
    def test_tools_is_nonempty(self) -> None:
        assert len(TOOLS) > 0

    def test_all_tools_have_name_attribute(self) -> None:
        for tool in TOOLS:
            assert hasattr(tool, "name")


class TestToolAgent:
    def _make_state(self, question: str) -> dict:  # type: ignore[type-arg]
        return {
            "question": question,
            "messages": [],
            "documents": [],
            "answer": "",
            "eval_report": {},
            "next_agent": "tool",
            "session_id": "test",
            "tool_results": [],
        }

    def test_calculator_question_returns_result(self) -> None:
        agent = ToolAgent()
        state = self._make_state("calculate 10 + 5")
        result = agent(state)  # type: ignore[arg-type]
        assert "15" in result["answer"]

    def test_unknown_question_returns_fallback(self) -> None:
        agent = ToolAgent()
        state = self._make_state("what is the meaning of life")
        result = agent(state)  # type: ignore[arg-type]
        assert "answer" in result
        assert isinstance(result["answer"], str)

    def test_tool_results_populated_on_match(self) -> None:
        agent = ToolAgent()
        state = self._make_state("calculate 3 * 7")
        result = agent(state)  # type: ignore[arg-type]
        assert len(result["tool_results"]) > 0
        assert result["tool_results"][0]["tool"] == "calculator"
