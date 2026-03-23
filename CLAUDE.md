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
    evaluator.py        RAGAS metrics evaluator, structured JSON output
  state.py              Shared TypedDict state schema for all agents
  config.py             Settings (env var loading, dataclasses)
  cli.py                CLI entrypoint
  api.py                FastAPI app (streaming responses)
tests/
  __init__.py
  test_supervisor.py    Supervisor routing + state transitions
  test_rag_agent.py     RAG retrieval + answer generation
  test_evaluator.py     RAGAS metrics + report structure
  conftest.py           Shared fixtures (test ChromaDB, mock Redis)
scripts/
  seed_hotpotqa.py      Seed ChromaDB with HotpotQA dataset
docker-compose.yml      Redis + ChromaDB containers
pyproject.toml          Project metadata + dependencies
Makefile                Convenience targets
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
- Coverage target: 80% per module

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

| Phase | Scope | Deadline |
|-------|-------|----------|
| Phase 0 | Repo + Docker + Scaffold | Mar 23 |
| Phase 1 | Supervisor + RAG Agent + Evaluator | Mar 27 |
| Phase 2 | Redis state bus + Model Router | Apr 3 |
| Phase 3 | Full POC + Eval pipeline + Notebook | Apr 11 |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `REDIS_URL` | No (default: redis://localhost:6379) | Redis connection |
| `CHROMA_HOST` | No (default: localhost) | ChromaDB host |
| `CHROMA_PORT` | No (default: 8001) | ChromaDB port |
| `SOULGRAPH_LOG_LEVEL` | No (default: INFO) | Logging level |
