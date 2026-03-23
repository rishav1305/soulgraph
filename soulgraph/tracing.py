"""Dual tracing: LangSmith (managed) + LangFuse (self-hosted).

Both are optional — if keys are missing, they're silently skipped.
Safe to import even if langfuse package is not installed.
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


def setup_langsmith(api_key: str, project: str, enabled: bool) -> None:
    """Configure LangSmith via environment variables.

    LangSmith integrates automatically when LANGCHAIN_TRACING_V2=true.
    This function just ensures the env vars are set correctly.
    """
    if not enabled:
        os.environ.setdefault("LANGCHAIN_TRACING_V2", "false")
        return
    if not api_key:
        logger.warning("LangSmith: LANGCHAIN_API_KEY not set — tracing disabled")
        return
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = api_key
    os.environ["LANGCHAIN_PROJECT"] = project
    logger.info("LangSmith tracing enabled: project=%s", project)


def get_langfuse_callback() -> Any | None:
    """Return a LangFuse CallbackHandler, or None if not configured.

    Returns:
        langfuse.callback.CallbackHandler if keys are set, else None.
    """
    try:
        from langfuse.callback import CallbackHandler

        from soulgraph.config import get_settings

        s = get_settings()
        if not s.langfuse_public_key or not s.langfuse_secret_key:
            logger.debug("LangFuse: keys not set — skipping")
            return None
        handler = CallbackHandler(
            public_key=s.langfuse_public_key,
            secret_key=s.langfuse_secret_key,
            host=s.langfuse_host,
        )
        logger.info("LangFuse tracing enabled: host=%s", s.langfuse_host)
        return handler
    except ImportError:
        logger.debug("langfuse package not installed — skipping")
        return None
    except Exception as exc:
        logger.warning("LangFuse setup failed: %s", exc)
        return None


def setup_tracing() -> list[Any]:
    """Configure all tracing backends and return active callback handlers.

    Call once at application startup. Pass returned callbacks to graph.invoke()
    via config={"callbacks": callbacks}.

    Returns:
        List of active callback handlers (may be empty if no tracing configured).
    """
    from soulgraph.config import get_settings

    s = get_settings()
    setup_langsmith(
        api_key=s.langchain_api_key,
        project=s.langchain_project,
        enabled=s.langchain_tracing_v2,
    )
    callbacks: list[Any] = []
    lf = get_langfuse_callback()
    if lf is not None:
        callbacks.append(lf)
    return callbacks
