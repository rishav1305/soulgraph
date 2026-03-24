"""Tests for the eval report formatter (T6 — Phase 3 Wave 1)."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from soulgraph.report import EvalReport, format_report


class TestEvalReport:
    """Tests for the EvalReport dataclass and formatting."""

    def _sample_report_data(self) -> dict:
        return {
            "question": "What is RAG?",
            "answer_length": 45,
            "num_documents": 3,
            "scores": {
                "faithfulness": 0.92,
                "answer_relevancy": 0.88,
                "context_precision": 0.75,
                "context_recall": 0.81,
            },
            "passed": True,
            "threshold": 0.7,
        }

    def test_from_dict_creates_instance(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        assert report.question == "What is RAG?"
        assert report.answer_length == 45
        assert report.num_documents == 3
        assert report.passed is True
        assert report.threshold == 0.7

    def test_from_dict_parses_scores(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        assert report.scores["faithfulness"] == pytest.approx(0.92)
        assert report.scores["answer_relevancy"] == pytest.approx(0.88)

    def test_from_dict_handles_error_field(self) -> None:
        data = self._sample_report_data()
        data["error"] = "RAGAS unavailable"
        data["passed"] = None
        report = EvalReport.from_dict(data)
        assert report.error == "RAGAS unavailable"
        assert report.passed is None

    def test_from_dict_defaults_missing_error(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        assert report.error is None

    def test_to_json_returns_valid_json(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        json_str = report.to_json()
        parsed = json.loads(json_str)
        assert isinstance(parsed, dict)

    def test_to_json_includes_all_fields(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        parsed = json.loads(report.to_json())
        assert parsed["question"] == "What is RAG?"
        assert parsed["answer_length"] == 45
        assert parsed["num_documents"] == 3
        assert parsed["passed"] is True
        assert parsed["threshold"] == 0.7
        assert "scores" in parsed
        assert "faithfulness" in parsed["scores"]

    def test_to_json_includes_summary(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        parsed = json.loads(report.to_json())
        assert "summary" in parsed
        assert parsed["summary"]["status"] == "PASS"
        assert "avg_score" in parsed["summary"]

    def test_to_json_summary_avg_score_correct(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        parsed = json.loads(report.to_json())
        scores = [0.92, 0.88, 0.75, 0.81]
        expected_avg = sum(scores) / len(scores)
        assert parsed["summary"]["avg_score"] == pytest.approx(expected_avg, abs=0.001)

    def test_to_json_status_fail_when_not_passed(self) -> None:
        data = self._sample_report_data()
        data["passed"] = False
        report = EvalReport.from_dict(data)
        parsed = json.loads(report.to_json())
        assert parsed["summary"]["status"] == "FAIL"

    def test_to_json_status_unknown_when_none(self) -> None:
        data = self._sample_report_data()
        data["passed"] = None
        report = EvalReport.from_dict(data)
        parsed = json.loads(report.to_json())
        assert parsed["summary"]["status"] == "UNKNOWN"

    def test_to_html_returns_string(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        html = report.to_html()
        assert isinstance(html, str)
        assert len(html) > 0

    def test_to_html_contains_question(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        html = report.to_html()
        assert "What is RAG?" in html

    def test_to_html_contains_all_metric_names(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        html = report.to_html()
        assert "faithfulness" in html
        assert "answer_relevancy" in html
        assert "context_precision" in html
        assert "context_recall" in html

    def test_to_html_contains_pass_indicator(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        html = report.to_html()
        assert "PASS" in html

    def test_to_html_contains_fail_indicator_when_failed(self) -> None:
        data = self._sample_report_data()
        data["passed"] = False
        report = EvalReport.from_dict(data)
        html = report.to_html()
        assert "FAIL" in html

    def test_save_json_writes_file(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "eval_report.json"
            report.save(path)
            assert path.exists()
            saved = json.loads(path.read_text())
            assert saved["question"] == "What is RAG?"

    def test_save_html_writes_file(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "eval_report.html"
            report.save(path, fmt="html")
            assert path.exists()
            content = path.read_text()
            assert "faithfulness" in content

    def test_save_raises_for_unknown_format(self) -> None:
        data = self._sample_report_data()
        report = EvalReport.from_dict(data)
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "report.xml"
            with pytest.raises(ValueError, match="fmt"):
                report.save(path, fmt="xml")


class TestFormatReport:
    """Tests for the top-level format_report helper."""

    def test_format_report_returns_eval_report(self) -> None:
        data = {
            "question": "test",
            "answer_length": 10,
            "num_documents": 1,
            "scores": {"faithfulness": 0.9},
            "passed": True,
            "threshold": 0.7,
        }
        report = format_report(data)
        assert isinstance(report, EvalReport)

    def test_format_report_roundtrip(self) -> None:
        data = {
            "question": "test",
            "answer_length": 10,
            "num_documents": 1,
            "scores": {"faithfulness": 0.9},
            "passed": True,
            "threshold": 0.7,
        }
        report = format_report(data)
        parsed = json.loads(report.to_json())
        assert parsed["question"] == "test"
        assert parsed["scores"]["faithfulness"] == pytest.approx(0.9)
