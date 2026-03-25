# SoulGraph

[![CI](https://github.com/rishav1305/soulgraph/actions/workflows/ci.yml/badge.svg)](https://github.com/rishav1305/soulgraph/actions/workflows/ci.yml)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2+-green.svg)](https://langchain-ai.github.io/langgraph/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**A production-grade multi-agent AI system built on LangGraph.** Feed it documents, ask a question — it retrieves, answers, and *automatically evaluates its own output quality* using RAGAS metrics. Every response is traceable, every answer is scored.

Built to explore the full stack of production AI engineering: orchestration, RAG, evaluation, multi-model routing, state persistence, and observability — wired together in one coherent system.

---

## What It Does

```
$ soulgraph "What is retrieval-augmented generation?" --session-id demo

✓ RAG Agent    → Retrieved 4 relevant documents (ChromaDB)
✓ Tool Agent   → No tool calls required
✓ Evaluator    → faithfulness: 0.91  relevancy: 0.88  precision: 0.85  recall: 0.82

Answer: Retrieval-Augmented Generation (RAG) combines a retrieval system
with a language model. The retriever fetches relevant documents from a
knowledge base; the model generates answers grounded in those documents
rather than relying on parametric memory alone — reducing hallucination
and enabling domain-specific knowledge without fine-tuning.

Eval: PASS (avg 0.87) | Session resumed: demo | Tokens: 312
```

```
# REST API
curl -s -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"question": "calculate 6 * 7", "session_id": "demo"}'

{"answer": "Tool result (calculator): 42", "eval": {"score": 1.0, "pass": true}}
```

---

## Architecture

```
                          ┌──────────────────────────────────────────────┐
                          │           LangGraph Supervisor               │
                          │   StateGraph · Intent Routing · State Bus    │
                          └──────────┬───────────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
   │    RAG Agent    │    │   Tool Agent    │    │ Evaluator Agent │
   │  ChromaDB +     │    │  AST calculator │    │ RAGAS metrics   │
   │  HotpotQA data  │    │  (safe eval)    │    │ JSON report     │
   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
            │                      │                      │
            └──────────────────────┴──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │  Redis State Bus │  │  LiteLLM Router  │  │  Observability   │
   │  pub/sub +       │  │  claude-3 · gpt  │  │  LangSmith +     │
   │  checkpoints     │  │  vLLM backend    │  │  LangFuse UI     │
   └──────────────────┘  └──────────────────┘  └──────────────────┘
              │
              ▼
   ┌──────────────────┐
   │   FastAPI Server │
   │  REST + WebSocket│
   │  streaming       │
   └──────────────────┘
```

**Supervisor** routes queries to specialist agents via LangGraph `StateGraph`. Intent classification selects RAG (knowledge questions) or Tool Agent (compute tasks). State is typed, immutable, and persisted in Redis between turns.

**RAG Agent** retrieves from ChromaDB (seeded with HotpotQA for multi-hop reasoning), generates grounded answers via Claude, and passes context to the Evaluator.

**Evaluator Agent** runs four RAGAS metrics (faithfulness, answer_relevancy, context_precision, context_recall) and emits structured JSON quality reports. Every query is scored.

**LiteLLM Router** selects model by task type (reasoning vs. fast) and supports vLLM self-hosted inference as a drop-in backend — swap cloud API for local GPU with one env var.

**Redis** provides shared agent state bus (pub/sub) and LangGraph checkpoint persistence. Same `--session-id` resumes any conversation exactly where it left off.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Orchestration** | LangGraph `StateGraph` | Type-safe, cyclical agent graphs; clean state passing between agents |
| **LLM Abstraction** | LiteLLM | Model-agnostic routing; swap Claude ↔ GPT-4 ↔ vLLM without code changes |
| **Vector Store** | ChromaDB | Embedded, no infra overhead; persistence via Docker volume |
| **State Bus** | Redis pub/sub + `RedisSaver` | Cross-agent coordination + LangGraph checkpoint persistence in one service |
| **Evaluation** | RAGAS | Industry-standard RAG eval: faithfulness, relevancy, precision, recall |
| **Tracing** | LangSmith + LangFuse | Dual tracing support; LangFuse runs locally via Docker |
| **API** | FastAPI + WebSocket | Async REST + real-time token streaming |
| **Inference backend** | vLLM (optional) | Self-hosted GPU inference via LiteLLM's OpenAI-compatible shim |
| **CI** | GitHub Actions | Ruff + Mypy + Pytest on every push; green main policy |

---

## Quick Start

**Prerequisites:** Docker, Python 3.11+, Anthropic API key

```bash
# Clone
git clone https://github.com/rishav1305/soulgraph.git
cd soulgraph

# Start infrastructure (Redis + ChromaDB)
docker compose up -d

# Install
cp .env.example .env          # Add your ANTHROPIC_API_KEY
pip install -e ".[dev]"

# Ask a question
soulgraph "What is multi-hop reasoning?" --session-id my-session

# Or use the streaming REST API
soulgraph-api &
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"question": "calculate 15 * 8", "session_id": "demo"}'
```

**Optional: LangFuse tracing UI (http://localhost:3100)**
```bash
docker compose --profile langfuse up -d
# Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY in .env
```

**Optional: Switch to vLLM self-hosted inference**
```bash
export VLLM_BASE_URL=http://localhost:8000
export VLLM_MODEL=meta-llama/Llama-3-8B-Instruct
soulgraph "your question"   # routes to local GPU, no cloud API calls
```

---

## Evaluation Pipeline

Every query runs four RAGAS metrics:

| Metric | What It Measures |
|--------|-----------------|
| **Faithfulness** | Does the answer stick to the retrieved context? (hallucination detection) |
| **Answer Relevancy** | Does the answer actually address the question? |
| **Context Precision** | Is the retrieved context relevant to the question? |
| **Context Recall** | Was all necessary context retrieved? |

Results are returned as structured JSON alongside every answer — making quality regression visible over time:

```json
{
  "answer": "...",
  "eval": {
    "faithfulness": 0.91,
    "answer_relevancy": 0.88,
    "context_precision": 0.85,
    "context_recall": 0.82,
    "pass": true,
    "latency_ms": 1240
  }
}
```

---

## Development

```bash
make ci          # Full CI: lint + type check + test (53 tests, 79% coverage)
make test        # Run pytest
make lint        # Ruff lint + format check
make type        # Mypy type check
make infra-up    # Start Redis + ChromaDB
make infra-down  # Stop services
```

---

## Project Status

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 0** | Repo scaffold + Docker + CI | ✅ Done |
| **Phase 1** | Supervisor + RAG Agent + Evaluator | ✅ Done (Mar 23) |
| **Phase 2** | Redis state bus + LiteLLM router + FastAPI + LangFuse + vLLM | ✅ Done (Mar 25) |
| **Phase 3** | Eval pipeline + feedback loops + Jupyter notebook | 🔜 Planned (Apr 11) |

Phase 3 will add: continuous eval tracking across sessions, a dataset builder for fine-tuning, and an end-to-end Jupyter walkthrough of the full system.

---

## Contributing

PRs welcome. See [CLAUDE.md](CLAUDE.md) for development conventions, architecture decisions, and CI policy.
