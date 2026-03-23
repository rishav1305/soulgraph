# SoulGraph

[![CI](https://github.com/rishav1305/soulgraph/actions/workflows/ci.yml/badge.svg)](https://github.com/rishav1305/soulgraph/actions/workflows/ci.yml)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2+-green.svg)](https://langchain-ai.github.io/langgraph/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-0.5+-purple.svg)](https://trychroma.com)

> **A batteries-included LangGraph starter service. Give it documents and a question — it gets you a grounded, multi-agent answer, plus tooling to evaluate and improve the models.**

---

## Architecture

```
User Query
    │
    ▼
┌─────────────────────────────────────────────┐
│             LangGraph Supervisor             │
│       StateGraph with intent routing         │
└────────────────┬────────────────────────────┘
                 │
        ┌────────┴──────────────────────────┐
        │                                   │
        ▼                                   ▼
┌──────────────────┐              ┌──────────────────────┐
│    RAG Agent     │              │   Evaluator Agent    │
│  ChromaDB +      │──response──▶ │  RAGAS metrics +     │
│  HotpotQA        │              │  structured report   │
└──────────────────┘              └──────────────────────┘
        │
        ▼
  Redis State Bus
  (pub/sub + checkpoints)
```

**Supervisor** routes queries to specialist agents via LangGraph `StateGraph`. Phase 1 uses hardcoded routing; Phase 2 adds a Model Router with intent classification.

**RAG Agent** retrieves relevant documents from ChromaDB (seeded with HotpotQA for multi-hop reasoning) and generates grounded answers.

**Evaluator Agent** scores output quality using RAGAS metrics (faithfulness, answer relevancy, context precision, context recall) and emits a structured JSON report.

**Redis** provides shared state bus for agent coordination and checkpoint persistence.

---

## Why This Exists

Building production AI agent systems today requires stitching together 5+ tools — orchestration, RAG, evaluation, fine-tuning, and state management — that don't share state or speak the same interface. SoulGraph unifies all four into one cohesive system with shared state via Redis and ChromaDB, making it deployable from a single `docker compose up`.

---

## Quick Start

**Prerequisites:** Docker, Python 3.11+, Anthropic API key

```bash
# 1. Clone
git clone https://github.com/rishav1305/soulgraph.git
cd soulgraph

# 2. Start infrastructure
docker compose up -d

# 3. Install
cp .env.example .env          # Add your ANTHROPIC_API_KEY
pip install -e ".[dev]"

# 4. Ask a question
python -m soulgraph.cli "What is retrieval-augmented generation?"
```

**Expected output:**
```json
Answer:
Retrieval-Augmented Generation (RAG) combines retrieval with generation...

Evaluation Report:
{
  "question": "What is retrieval-augmented generation?",
  "num_documents": 5,
  "scores": { "faithfulness": null, "answer_relevancy": null, ... },
  "threshold": 0.7,
  "note": "Phase 1 stub — real RAGAS evaluation wired in Phase 2"
}
```

---

## Four Pillars

### 1. RAG Pipeline
ChromaDB vector store seeded with HotpotQA — a multi-hop reasoning dataset. The RAG agent retrieves relevant documents and generates grounded answers, reducing hallucination through citation.

### 2. Agentic Orchestration
LangGraph `StateGraph` supervisor coordinates specialist agents using immutable state passing. Phase 2 adds a Model Router sub-agent for dynamic intent classification and Redis pub/sub for agent coordination.

### 3. Model Evaluation
RAGAS metrics (faithfulness, answer_relevancy, context_precision, context_recall) assess output quality after every query. The Evaluator agent returns structured JSON reports with scores, pass/fail status, and metadata for quality tracking.

### 4. Fine-tuning Pipeline *(Phase 3)*
Every (question, answer, eval_score) triple becomes training data. The fine-tuning pipeline collects feedback loops and prepares datasets for domain-specific model improvement.

---

## Development

```bash
make ci          # Lint + type check + test (matches CI)
make test        # Run pytest
make lint        # Ruff lint + format check
make type        # Mypy type check
make infra-up    # Start Redis + ChromaDB
make infra-down  # Stop services
```

---

## Contributing / Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 0** | Repo + Docker + Scaffold | ✅ Done |
| **Phase 1** | Supervisor + RAG Agent + Evaluator | 🚧 In progress |
| **Phase 2** | Redis state bus + Model Router | Planned (Apr 3) |
| **Phase 3** | Full POC + Eval pipeline + Notebook | Planned (Apr 11) |
| **Ongoing** | One domain agent per week | Continuous |

PRs welcome. See [CLAUDE.md](CLAUDE.md) for conventions and development standards.
