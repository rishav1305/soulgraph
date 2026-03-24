"""Eval report formatter — structured JSON and HTML output (T6, Phase 3 Wave 1).

Consumes the raw evaluation dict from EvaluatorAgent and produces:
- A well-typed EvalReport dataclass
- JSON output with a structured summary block
- HTML report with a styled scorecard for human inspection
- save() to write JSON or HTML to a file path
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class EvalReport:
    """Structured evaluation report wrapping RAGAS metric output.

    Attributes:
        question:       The original user question evaluated.
        answer_length:  Character length of the generated answer.
        num_documents:  Number of context documents retrieved.
        scores:         Dict mapping metric name → float score (or None if unavailable).
        passed:         True if all available scores exceed threshold, None if unknown.
        threshold:      Minimum acceptable score for pass/fail determination.
        error:          Error message if evaluation failed; None on success.
    """

    question: str
    answer_length: int
    num_documents: int
    scores: dict[str, float | None]
    passed: bool | None
    threshold: float
    error: str | None = field(default=None)

    # ------------------------------------------------------------------ #
    # Construction                                                          #
    # ------------------------------------------------------------------ #

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> EvalReport:
        """Build an EvalReport from the raw dict returned by EvaluatorAgent."""
        return cls(
            question=data.get("question", ""),
            answer_length=data.get("answer_length", 0),
            num_documents=data.get("num_documents", 0),
            scores=dict(data.get("scores", {})),
            passed=data.get("passed"),
            threshold=data.get("threshold", 0.7),
            error=data.get("error"),
        )

    # ------------------------------------------------------------------ #
    # Summary helpers                                                       #
    # ------------------------------------------------------------------ #

    def _avg_score(self) -> float | None:
        """Return average of available (non-None) scores, or None if none available."""
        available = [v for v in self.scores.values() if v is not None]
        if not available:
            return None
        return sum(available) / len(available)

    def _status(self) -> str:
        if self.passed is True:
            return "PASS"
        if self.passed is False:
            return "FAIL"
        return "UNKNOWN"

    # ------------------------------------------------------------------ #
    # JSON output                                                           #
    # ------------------------------------------------------------------ #

    def to_json(self, indent: int = 2) -> str:
        """Serialise to a formatted JSON string with a summary block.

        The output is designed to be both machine-readable (scores as floats)
        and human-scannable (summary.status + avg_score at the top level).
        """
        avg = self._avg_score()
        payload: dict[str, Any] = {
            "summary": {
                "status": self._status(),
                "avg_score": round(avg, 4) if avg is not None else None,
                "threshold": self.threshold,
                "num_metrics": len(self.scores),
            },
            "question": self.question,
            "answer_length": self.answer_length,
            "num_documents": self.num_documents,
            "scores": {k: round(v, 4) if v is not None else None for k, v in self.scores.items()},
            "passed": self.passed,
            "threshold": self.threshold,
        }
        if self.error is not None:
            payload["error"] = self.error
        return json.dumps(payload, indent=indent)

    # ------------------------------------------------------------------ #
    # HTML output                                                           #
    # ------------------------------------------------------------------ #

    def to_html(self) -> str:
        """Render a styled HTML scorecard suitable for browser or email."""
        status = self._status()
        avg = self._avg_score()
        avg_str = f"{avg:.2%}" if avg is not None else "N/A"

        status_colour = {"PASS": "#22c55e", "FAIL": "#ef4444", "UNKNOWN": "#f59e0b"}[status]

        rows = ""
        for metric, score in self.scores.items():
            score_str = f"{score:.2%}" if score is not None else "N/A"
            threshold_ok = score is None or score >= self.threshold
            row_colour = "#16a34a" if threshold_ok else "#dc2626"
            indicator = "✓" if threshold_ok else "✗"
            rows += (
                f"<tr>"
                f"<td style='padding:6px 12px;font-family:monospace'>{metric}</td>"
                f"<td style='padding:6px 12px;text-align:right'>{score_str}</td>"
                f"<td style='padding:6px 12px;text-align:center;color:{row_colour}'>{indicator}</td>"
                f"</tr>"
            )

        error_block = ""
        if self.error:
            error_block = (
                f"<p style='color:#ef4444;font-size:0.85em'>"
                f"<strong>Error:</strong> {self.error}</p>"
            )

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SoulGraph Eval Report</title>
  <style>
    body {{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
           background:#0f172a;color:#e2e8f0;max-width:640px;margin:40px auto;padding:0 16px}}
    h1 {{font-size:1.2rem;color:#94a3b8;margin-bottom:4px}}
    .badge {{display:inline-block;padding:4px 14px;border-radius:999px;font-weight:700;
             font-size:0.95rem;background:{status_colour};color:#fff}}
    .meta {{color:#94a3b8;font-size:0.85em;margin:8px 0 20px}}
    table {{width:100%;border-collapse:collapse;background:#1e293b;
            border-radius:8px;overflow:hidden}}
    th {{background:#334155;padding:8px 12px;text-align:left;
         font-size:0.8rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}}
    tr:nth-child(even) td {{background:#243044}}
    .avg {{margin-top:12px;font-size:0.85em;color:#94a3b8}}
  </style>
</head>
<body>
  <h1>SoulGraph — Evaluation Report</h1>
  <span class="badge">{status}</span>
  <div class="meta">
    <strong>Question:</strong> {self.question}<br>
    <strong>Documents retrieved:</strong> {self.num_documents} &nbsp;|&nbsp;
    <strong>Answer length:</strong> {self.answer_length} chars &nbsp;|&nbsp;
    <strong>Threshold:</strong> {self.threshold:.0%}
  </div>
  {error_block}
  <table>
    <thead>
      <tr>
        <th>Metric</th>
        <th style="text-align:right">Score</th>
        <th style="text-align:center">Pass?</th>
      </tr>
    </thead>
    <tbody>
      {rows}
    </tbody>
  </table>
  <p class="avg">Average score: <strong>{avg_str}</strong></p>
</body>
</html>"""
        return html

    # ------------------------------------------------------------------ #
    # Save                                                                  #
    # ------------------------------------------------------------------ #

    def save(self, path: Path | str, fmt: str = "json") -> None:
        """Write the report to *path* in the specified format.

        Args:
            path: Destination file path.
            fmt:  ``"json"`` (default) or ``"html"``.

        Raises:
            ValueError: If *fmt* is neither ``"json"`` nor ``"html"``.
        """
        path = Path(path)
        if fmt == "json":
            path.write_text(self.to_json(), encoding="utf-8")
        elif fmt == "html":
            path.write_text(self.to_html(), encoding="utf-8")
        else:
            raise ValueError(f"Unsupported fmt={fmt!r}. Use 'json' or 'html'.")


# ------------------------------------------------------------------ #
# Public helper                                                         #
# ------------------------------------------------------------------ #


def format_report(eval_dict: dict[str, Any]) -> EvalReport:
    """Convert a raw evaluator output dict to an EvalReport.

    Convenience wrapper over ``EvalReport.from_dict()`` for use in
    supervisor pipelines and API response formatting.

    Args:
        eval_dict: Dict returned by ``EvaluatorAgent.evaluate()``.

    Returns:
        Typed ``EvalReport`` with JSON and HTML rendering capabilities.
    """
    return EvalReport.from_dict(eval_dict)
