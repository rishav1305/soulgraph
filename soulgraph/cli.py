"""CLI entrypoint for SoulGraph."""

from __future__ import annotations

import argparse
import json
import logging
import sys

from soulgraph.config import get_settings


def main() -> None:
    """Run SoulGraph from the command line."""
    parser = argparse.ArgumentParser(
        prog="soulgraph",
        description="SoulGraph — multi-agent RAG system. Give it a question, get a grounded answer.",
    )
    parser.add_argument("question", help="The question to answer")
    parser.add_argument("--session-id", default="default", help="Session ID for state tracking")
    parser.add_argument("--log-level", default=None, help="Override log level (DEBUG/INFO/WARNING)")
    args = parser.parse_args()

    settings = get_settings()
    log_level = args.log_level or settings.log_level
    logging.basicConfig(level=getattr(logging, log_level.upper(), logging.INFO))

    try:
        settings.validate()
    except ValueError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        sys.exit(1)

    # Import here to avoid slow startup when --help is used.
    from soulgraph.state import AgentState  # noqa: PLC0415
    from soulgraph.supervisor import build_graph  # noqa: PLC0415

    graph = build_graph()
    initial_state: AgentState = {
        "question": args.question,
        "messages": [],
        "documents": [],
        "answer": "",
        "eval_report": {},
        "next_agent": "",
        "session_id": args.session_id,
        "tool_results": [],
    }

    result = graph.invoke(initial_state)

    print(f"\nAnswer:\n{result.get('answer', '(no answer generated)')}\n")
    if result.get("eval_report"):
        print("Evaluation Report:")
        print(json.dumps(result["eval_report"], indent=2))


if __name__ == "__main__":
    main()
