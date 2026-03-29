"""Redis checkpoint factory for LangGraph session persistence."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _connect(redis_url: str) -> Any:
    """Verify Redis is reachable and return a RedisSaver instance.

    Separated for clean mocking in tests.
    Raises an exception if the Redis server is unreachable.

    Note: RedisSaver.from_conn_string() is a context manager — do NOT use it
    here. Instead, ping first to detect availability, then instantiate directly
    via RedisSaver(redis_url=...) to get a real BaseCheckpointSaver instance.
    """
    import redis as redis_lib
    from langgraph.checkpoint.redis import RedisSaver

    # Probe the connection — fail fast if Redis is down.
    client = redis_lib.Redis.from_url(redis_url, socket_connect_timeout=1)
    try:
        client.ping()
    finally:
        client.close()

    # Instantiate directly — NOT via from_conn_string() which is a @contextmanager.
    saver = RedisSaver(redis_url=redis_url)

    # Create RediSearch indices (checkpoint_write, checkpoint_blobs, etc.)
    # on first use. This is idempotent — safe to call on every startup.
    # Without this, queries fail with "No such index checkpoint_write".
    saver.setup()

    return saver


def get_checkpointer(redis_url: str) -> Any | None:
    """Return a RedisSaver checkpointer, or None if Redis is unavailable."""
    try:
        saver = _connect(redis_url)
        logger.info("Redis checkpoint connected: %s", redis_url)
        return saver
    except Exception as exc:
        logger.warning("Redis checkpoint unavailable (%s) — running stateless", exc)
        return None
