"""FastAPI application — REST + WebSocket streaming + static UI serving for SoulGraph."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ── Static file paths ──
# web/dist/ is built by `cd web && npm run build`.
_WEB_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"

app = FastAPI(
    title="SoulGraph API",
    description="Multi-agent RAG: give it a question, get a grounded answer with evaluation.",
    version="0.2.0",
)


class QueryRequest(BaseModel):
    question: str
    session_id: str = "default"


class QueryResponse(BaseModel):
    answer: str
    eval_report: dict[str, Any] = {}
    session_id: str


def _make_initial_state(question: str, session_id: str) -> dict[str, Any]:
    return {
        "question": question,
        "messages": [],
        "documents": [],
        "answer": "",
        "eval_report": {},
        "next_agent": "",
        "session_id": session_id,
        "tool_results": [],
    }


_graph: Any = None


def _get_graph() -> Any:
    """Return the compiled LangGraph graph (lazy singleton)."""
    global _graph
    if _graph is None:
        from soulgraph.checkpoint import get_checkpointer
        from soulgraph.config import get_settings
        from soulgraph.supervisor import build_graph

        s = get_settings()
        _graph = build_graph(checkpointer=get_checkpointer(s.redis_url))
    return _graph


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.2.0"}


@app.post("/query")
async def query(request: QueryRequest) -> JSONResponse:
    """Synchronous REST endpoint — runs the full agent graph and returns the answer."""
    from soulgraph.tracing import setup_tracing

    callbacks = setup_tracing()
    try:
        graph = _get_graph()
        state = _make_initial_state(request.question, request.session_id)
        config: dict[str, Any] = {
            "configurable": {"thread_id": request.session_id},
            "callbacks": callbacks,
        }
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: graph.invoke(state, config=config))
        return JSONResponse(
            content={
                "answer": result.get("answer", ""),
                "eval_report": result.get("eval_report", {}),
                "session_id": request.session_id,
            }
        )
    except Exception as exc:
        logger.error("Graph execution error: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"error": "Service temporarily unavailable", "detail": str(exc)},
        )


@app.websocket("/ws/query")
async def ws_query(websocket: WebSocket) -> None:
    """WebSocket streaming endpoint.

    Protocol:
      Client → Server: {"question": "...", "session_id": "..."}
      Server → Client: {"type": "token", "content": "..."} (one per word)
                       {"type": "eval", "report": {...}}      (if eval_report present)
                       {"type": "done", "answer": "..."}      (final)
                       {"type": "error", "message": "..."}    (on error)
    """
    await websocket.accept()
    session_id = "default"
    try:
        data = await websocket.receive_json()
        question = data.get("question", "")
        session_id = data.get("session_id", "default")

        if not question:
            await websocket.send_json({"type": "error", "message": "question is required"})
            return

        from soulgraph.tracing import setup_tracing

        callbacks = setup_tracing()
        graph = _get_graph()
        state = _make_initial_state(question, session_id)
        config: dict[str, Any] = {
            "configurable": {"thread_id": session_id},
            "callbacks": callbacks,
        }

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: graph.invoke(state, config=config))

        answer: str = result.get("answer", "")
        eval_report: dict[str, Any] = result.get("eval_report", {})

        # Stream answer word-by-word (Phase 2 approximation; Phase 3 uses async streaming).
        for word in answer.split():
            await websocket.send_json({"type": "token", "content": word + " "})
            await asyncio.sleep(0)  # yield to event loop

        if eval_report:
            await websocket.send_json({"type": "eval", "report": eval_report})

        await websocket.send_json({"type": "done", "answer": answer})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: session=%s", session_id)
    except Exception as exc:
        logger.error("WebSocket error: %s", exc)
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass


def main() -> None:
    """Start the API server via uvicorn."""
    import uvicorn

    from soulgraph.config import get_settings

    s = get_settings()
    uvicorn.run(app, host=s.api_host, port=s.api_port, log_level=s.log_level.lower())


if __name__ == "__main__":
    main()


# ---------------------------------------------------------------------------
# Agent fine-tuning endpoints (Phase 3 Wave 3)
# ---------------------------------------------------------------------------


@app.get("/tune/status")
async def tune_status() -> JSONResponse:
    """Return current tuning parameters and eval history."""
    from soulgraph.tuner import get_tuner

    return JSONResponse(content=get_tuner().status())


@app.post("/tune/reset")
async def tune_reset() -> JSONResponse:
    """Reset all tuning parameters and history to defaults."""
    from soulgraph.tuner import get_tuner

    get_tuner().reset()
    return JSONResponse(content={"status": "reset", "params": get_tuner().get_params().to_dict()})


# ---------------------------------------------------------------------------
# Static UI serving (web/dist/)
# ---------------------------------------------------------------------------
# Mount AFTER all API routes so /health, /query, /ws/query, /tune/* take priority.
# StaticFiles serves JS/CSS/images. The catch-all below handles SPA routing
# (any path not matched by an API route or static file returns index.html).

if _WEB_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_WEB_DIST / "assets")), name="static-assets")

    @app.get("/{path:path}")
    async def spa_fallback(request: Request, path: str) -> FileResponse:
        """Serve static files or fall back to index.html for SPA routing."""
        file_path = _WEB_DIST / path
        if file_path.is_file() and file_path.resolve().is_relative_to(_WEB_DIST.resolve()):
            return FileResponse(str(file_path))
        return FileResponse(str(_WEB_DIST / "index.html"))
else:
    logger.info(
        "Web UI not found at %s — run 'cd web && npm run build' to enable. API-only mode.",
        _WEB_DIST,
    )
