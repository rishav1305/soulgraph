"""Settings loaded from environment variables."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class Settings:
    """Application settings loaded from environment variables."""

    anthropic_api_key: str = field(
        default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", "")
    )
    redis_url: str = field(
        default_factory=lambda: os.environ.get("REDIS_URL", "redis://localhost:6379")
    )
    chroma_host: str = field(
        default_factory=lambda: os.environ.get("CHROMA_HOST", "localhost")
    )
    chroma_port: int = field(
        default_factory=lambda: int(os.environ.get("CHROMA_PORT", "8001"))
    )
    log_level: str = field(
        default_factory=lambda: os.environ.get("SOULGRAPH_LOG_LEVEL", "INFO")
    )

    def validate(self) -> None:
        """Raise ValueError if required settings are missing."""
        if not self.anthropic_api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY environment variable is required. "
                "Set it to your Anthropic API key."
            )


# Module-level singleton — lazy-initialised on first import.
_settings: Settings | None = None


def get_settings() -> Settings:
    """Return the global Settings singleton."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
