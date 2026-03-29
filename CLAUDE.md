# SoulGraph — CLAUDE.md

## Project Overview

SoulGraph is a batteries-included LangGraph multi-agent service. Give it documents and a question — it returns a grounded, multi-agent answer with quality evaluation.

## Quick Commands

```bash
# Infrastructure
docker compose up -d                      # Start Redis + ChromaDB
docker compose down                       # Stop services
docker compose ps                         # Check service health

# Development
pip install -e ".[dev]"                   # Install with dev deps
pytest                                    # Run all tests
pytest -k test_supervisor -v              # Run specific test
ruff check .                              # Lint
ruff format .                             # Format
mypy soulgraph/                           # Type check

# Run
python -m soulgraph.cli "your question"  # CLI
uvicorn soulgraph.api:app --reload       # Dev API server

# CI
make ci                                  # Full CI check (lint + type + test)
```

## Architecture

```
User Query
    │
    ▼
┌─────────────────────────────────────────┐
│          LangGraph Supervisor           │
│  (StateGraph with intent routing)       │
└────────────┬────────────────────────────┘
             │
    ┌────────┴──────────────────────────┐
    │                                   │
    ▼                                   ▼
┌──────────────┐              ┌──────────────────┐
│  RAG Agent   │              │ Evaluator Agent  │
│ ChromaDB +   │──response──▶ │ RAGAS metrics +  │
│ HotpotQA     │              │ JSON report      │
└──────────────┘              └──────────────────┘
         │
         ▼
    Redis State Bus
    (pub/sub + checkpoints)
```

## Module Structure

```
soulgraph/
  __init__.py           Package init + version
  supervisor.py         LangGraph StateGraph supervisor with intent routing
  agents/
    __init__.py
    rag.py              ChromaDB retrieval + answer generation
    evaluator.py        RAGAS metrics evaluator, structured JSON output (EvalReport)
    tool_agent.py       Safe AST calculator + tool dispatch agent
  state.py              Shared TypedDict state schema for all agents
  config.py             Settings (env var loading, dataclasses, pydantic-settings)
  checkpoint.py         Redis checkpointer with graceful None fallback
  router.py             LiteLLM model router (cloud + vLLM backends)
  report.py             EvalReport dataclass — to_json(), to_html(), save()
  tracing.py            Dual tracing: LangSmith (env-based) + LangFuse (callback)
  cli.py                CLI entrypoint
  api.py                FastAPI app — /health, /query, /ws/query (streaming)
tests/
  __init__.py
  conftest.py           Shared fixtures (test ChromaDB, mock Redis)
  test_supervisor.py    Supervisor routing + state transitions
  test_rag_agent.py     RAG retrieval + answer generation
  test_evaluator.py     RAGAS metrics + report structure
  test_tool_agent.py    Safe AST calculator + tool dispatch
  test_checkpoint.py    Redis checkpointer + None fallback
  test_router.py        LiteLLM routing (cloud + vLLM)
  test_report.py        EvalReport JSON/HTML output
  test_tracing.py       LangSmith + LangFuse setup and callbacks
  test_api.py           FastAPI REST + WebSocket endpoints
  test_cli.py           CLI config validation + help output
  test_config.py        Settings loading + env var overrides
  test_acceptance_criteria.py   Phase 3 acceptance criteria
docs/
  soulgraph_poc_demo.ipynb  (Phase 3 — planned) End-to-end walkthrough notebook
scripts/
  seed_hotpotqa.py      Seed ChromaDB with HotpotQA dataset
docker-compose.yml      Redis + ChromaDB + LangFuse containers
pyproject.toml          Project metadata + dependencies
Makefile                Convenience targets (ci, infra-up, infra-down)
DECISIONS.md            8 Architectural Decision Records (ADR-001 to ADR-008)
CLAUDE.md               This file
```

## Conventions

**Python:**
- Python 3.11+ required
- Type annotations on all public functions
- `pydantic.BaseModel` for data validation (not dataclasses for API types)
- No bare `except:` — always catch specific exceptions
- Async where possible (FastAPI, LangGraph streaming)
- Environment variables via `soulgraph.config.Settings` (pydantic-settings)

**Testing:**
- pytest + pytest-asyncio
- One test file per module
- Use `conftest.py` fixtures for shared resources
- Mock external LLM calls with `unittest.mock.patch`
- Never test against live Anthropic API in CI (use mock responses)
- Coverage target: 85% overall (currently 91%)

**LangGraph:**
- `TypedDict` state — immutable semantics (return new state, never mutate)
- `StateGraph.compile()` produces `CompiledGraph` — test the compiled graph, not the builder
- Streaming via `graph.astream()` — always handle `END` node

**Redis:**
- Pub/sub channel naming: `soulgraph:{session_id}:{topic}`
- Checkpoint key: `soulgraph:checkpoint:{session_id}`
- Always set TTL on checkpoint keys (default: 1 hour)

**CI Policy:**
- Green main policy — broken builds are rolled back, not worked around
- Loki works from tagged releases only — tag after each passing green build
- Tag format: `v{major}.{minor}.{patch}-phase{N}`
- If CI breaks: fix immediately or revert the commit (no "fix later" PRs)

**Security:**
- No API keys or secrets in code — use environment variables
- `.env` files are git-ignored — use `.env.example` for templates
- Anthropic API key: `ANTHROPIC_API_KEY` env var
- Never log full API responses (may contain sensitive user data)

## Phase Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 0 | Repo + Docker + Scaffold | ✅ Complete (Mar 23) |
| Phase 1 | Supervisor + RAG Agent + Evaluator | ✅ Complete (Mar 23) |
| Phase 2 | Redis + LiteLLM Router + ToolAgent + LangFuse + FastAPI | ✅ Complete (Mar 24) |
| Phase 3 Wave 1 | EvalReport + vLLM backend + acceptance tests | ✅ Complete (Mar 24) — 91/91 tests, 91% coverage |
| Phase 3 Wave 2 | Feedback store + Eval pipeline + API enhancements + Notebook | 🔜 Planned (deadline Apr 11) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `OPENAI_API_KEY` | No | OpenAI key — required for RAGAS evaluator metrics |
| `REDIS_URL` | No (default: redis://localhost:6379) | Redis connection |
| `CHROMA_HOST` | No (default: localhost) | ChromaDB host |
| `CHROMA_PORT` | No (default: 8001) | ChromaDB port |
| `SOULGRAPH_LOG_LEVEL` | No (default: INFO) | Logging level |
| `LITELLM_REASONING_MODEL` | No (default: claude-3-5-haiku-20241022) | Model for complex reasoning |
| `LITELLM_FAST_MODEL` | No (default: claude-3-5-haiku-20241022) | Model for fast inference |
| `VLLM_BASE_URL` | No | vLLM endpoint (e.g. http://vllm:8000/v1) — enables self-hosted inference |
| `VLLM_MODEL` | No (default: mistralai/Mistral-7B-Instruct-v0.3) | Model to serve via vLLM |
| `LANGCHAIN_TRACING_V2` | No (default: false) | Enable LangSmith tracing |
| `LANGCHAIN_API_KEY` | No | LangSmith API key |
| `LANGCHAIN_PROJECT` | No (default: soulgraph-dev) | LangSmith project name |
| `LANGFUSE_HOST` | No (default: http://localhost:3100) | Self-hosted LangFuse URL |
| `LANGFUSE_PUBLIC_KEY` | No | LangFuse public key |
| `LANGFUSE_SECRET_KEY` | No | LangFuse secret key |
| `SOULGRAPH_API_HOST` | No (default: 0.0.0.0) | API server bind host |
| `SOULGRAPH_API_PORT` | No (default: 8080) | API server port |
