"""Redis checkpoint factory for LangGraph session persistence."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _connect(redis_url: str) -> Any:
    """Verify Redis is reachable and return a RedisSaver context manager.

    Separated for clean mocking in tests.
    Raises an exception if the Redis server is unreachable.
    """
    import redis as redis_lib
    from langgraph.checkpoint.redis import RedisSaver

    # Probe the connection before returning the saver — fail fast if Redis is down.
    client = redis_lib.Redis.from_url(redis_url, socket_connect_timeout=2)
    try:
        client.ping()
    finally:
        client.close()

    return RedisSaver.from_conn_string(redis_url)


def get_checkpointer(redis_url: str) -> Any | None:
    """Return a RedisSaver checkpointer, or None if Redis is unavailable."""
    try:
        saver = _connect(redis_url)
        logger.info("Redis checkpoint connected: %s", redis_url)
        return saver
    except Exception as exc:
        logger.warning("Redis checkpoint unavailable (%s) — running stateless", exc)
        return None
