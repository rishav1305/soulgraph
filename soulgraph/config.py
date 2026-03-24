"""Settings loaded from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class Settings:
    """Application settings loaded from environment variables."""

    anthropic_api_key: str = field(default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", ""))
    redis_url: str = field(
        default_factory=lambda: os.environ.get("REDIS_URL", "redis://localhost:6379")
    )
    chroma_host: str = field(default_factory=lambda: os.environ.get("CHROMA_HOST", "localhost"))
    chroma_port: int = field(default_factory=lambda: int(os.environ.get("CHROMA_PORT", "8001")))
    log_level: str = field(default_factory=lambda: os.environ.get("SOULGRAPH_LOG_LEVEL", "INFO"))

    # Phase 2 — Model Router
    litellm_reasoning_model: str = field(
        default_factory=lambda: os.environ.get(
            "LITELLM_REASONING_MODEL", "claude-3-5-haiku-20241022"
        )
    )
    litellm_fast_model: str = field(
        default_factory=lambda: os.environ.get("LITELLM_FAST_MODEL", "claude-3-5-haiku-20241022")
    )

    # Phase 2 — LangSmith
    langchain_tracing_v2: bool = field(
        default_factory=lambda: os.environ.get("LANGCHAIN_TRACING_V2", "").lower() == "true"
    )
    langchain_api_key: str = field(default_factory=lambda: os.environ.get("LANGCHAIN_API_KEY", ""))
    langchain_project: str = field(
        default_factory=lambda: os.environ.get("LANGCHAIN_PROJECT", "soulgraph-dev")
    )

    # Phase 2 — LangFuse
    langfuse_host: str = field(
        default_factory=lambda: os.environ.get("LANGFUSE_HOST", "http://localhost:3100")
    )
    langfuse_public_key: str = field(
        default_factory=lambda: os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    )
    langfuse_secret_key: str = field(
        default_factory=lambda: os.environ.get("LANGFUSE_SECRET_KEY", "")
    )

    # Phase 3 — vLLM backend (T5)
    # When vllm_base_url is set, the ModelRouter uses vLLM as a self-hosted
    # inference backend via LiteLLM's openai-compatible endpoint.
    # LiteLLM model string: "openai/<model>" with api_base=vllm_base_url.
    #
    # Example .env:
    #   VLLM_BASE_URL=http://vllm:8000/v1
    #   VLLM_MODEL=mistralai/Mistral-7B-Instruct-v0.3
    #
    # Leave VLLM_BASE_URL empty (default) to disable vLLM and use cloud APIs.
    vllm_base_url: str = field(default_factory=lambda: os.environ.get("VLLM_BASE_URL", ""))
    vllm_model: str = field(
        default_factory=lambda: os.environ.get("VLLM_MODEL", "mistralai/Mistral-7B-Instruct-v0.3")
    )

    # Phase 2 — API
    api_host: str = field(default_factory=lambda: os.environ.get("SOULGRAPH_API_HOST", "0.0.0.0"))
    api_port: int = field(default_factory=lambda: int(os.environ.get("SOULGRAPH_API_PORT", "8080")))

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
