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
    from soulgraph.checkpoint import get_checkpointer  # noqa: PLC0415
    from soulgraph.state import AgentState  # noqa: PLC0415
    from soulgraph.supervisor import build_graph  # noqa: PLC0415
    from soulgraph.tracing import setup_tracing  # noqa: PLC0415

    checkpointer = get_checkpointer(settings.redis_url)
    graph = build_graph(checkpointer=checkpointer)

    callbacks = setup_tracing()
    config = {
        "configurable": {"thread_id": args.session_id},
        "callbacks": callbacks,
    }

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

    result = graph.invoke(initial_state, config=config)

    print(f"\nAnswer:\n{result.get('answer', '(no answer generated)')}\n")
    if result.get("eval_report"):
        print("Evaluation Report:")
        print(json.dumps(result["eval_report"], indent=2))


def tune_main() -> None:
    """CLI entrypoint for soulgraph-tune — agent fine-tuning inspection."""
    parser = argparse.ArgumentParser(
        prog="soulgraph-tune",
        description="Inspect and reset agent fine-tuning parameters.",
    )
    parser.add_argument(
        "action",
        choices=["status", "reset"],
        help="status: show current params + eval history. reset: restore defaults.",
    )
    args = parser.parse_args()

    from soulgraph.tuner import get_tuner  # noqa: PLC0415

    tuner = get_tuner()

    if args.action == "status":
        status = tuner.status()
        print("\nAgent Fine-Tuning Status")
        print("========================")
        print("\nCurrent Parameters:")
        for k, v in status["params"].items():
            print(f"  {k}: {v}")
        history = status["history"]
        print(f"\nEval History (last {len(history)} evals):")
        for i, h in enumerate(history, 1):
            faith = h.get("faithfulness", "N/A")
            relev = h.get("answer_relevancy", "N/A")
            passed = "PASS" if h.get("passed") else "FAIL"
            print(f"  #{i:2d}  faithfulness={faith}  relevancy={relev}  {passed}")
        adjustments = status["adjustments"]
        if adjustments:
            print("\nAuto-Adjustments Made:")
            for adj in adjustments:
                print(f"  {adj}")
        else:
            print("\nNo adjustments made yet.")
    elif args.action == "reset":
        tuner.reset()
        print("AgentTuner reset to defaults.")
        for k, v in tuner.get_params().to_dict().items():
            print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
