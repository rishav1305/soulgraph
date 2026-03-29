# SoulGraph Web UI — Demo Script

**Date:** April 4, 2026
**Presenter:** Rishav Chatterjee
**Duration:** 12-15 minutes
**Audience:** Stakeholders, team, prospective clients

---

## Pre-Demo Checklist (5 min before)

```bash
# 1. Start the full stack
cd ~/soulgraph
docker compose up -d

# 2. Wait for healthy state (all 4 containers + soulgraph API)
docker compose ps   # Expect: redis, chromadb, langfuse, soulgraph all "healthy"

# 3. Verify API responds
curl -s http://localhost:9080/health | jq
# Expected: {"status": "ok", "version": "0.2.0"}

# 4. Open the UI (keep terminal visible on second monitor for later)
xdg-open http://localhost:9080
```

**Fallback:** If Docker stack isn't ready in time, run the dev server with mock backend:

```bash
cd ~/soulgraph/web
npm run dev          # Vite dev server on :5173
node scripts/mock-ws.ts   # Mock WS + REST on :8080
```

---

## Act 1: The Problem (2 min)

> **Open on a blank browser tab. Don't show the UI yet.**

**Talking points:**

- "Enterprise teams using LLMs face a trust gap. The model gives you an answer — but how do you know it's grounded in your documents? How do you know it didn't hallucinate?"
- "Most RAG demos stop at 'here's your answer.' They don't show you *how* the system arrived at it, *which* documents it used, or *how well* it performed."
- "SoulGraph makes the invisible visible. It's a multi-agent system where every step — retrieval, reasoning, evaluation — is observable, measurable, and tunable."

**Transition:** "Let me show you."

---

## Act 2: First Impression — The Layout (1.5 min)

> **Switch to the SoulGraph tab. The UI loads into the three-panel layout.**

### What the audience sees

```
+------------------+---------------------------+------------------------+
|  Session         |                           |  [*] Connected         |
|  Sidebar         |     Chat Interface        |                        |
|                  |                           |  Agent Flow            |
|  [+ New Session] |     (empty state —        |  [SVG: supervisor →    |
|                  |      "Ask a question")    |   rag/tool → eval]     |
|                  |                           |                        |
|                  |                           |  (no eval yet)         |
|                  |                           |  (no documents yet)    |
|                  |                           |  (tuner loading)       |
+------------------+---------------------------+------------------------+
```

**Talking points:**

- "Three panels. Left: session management — every conversation is isolated and resumable. Center: the chat interface. Right: the observability panel."
- "Notice the green dot top-right — that's a live WebSocket connection to the backend. Real-time, not polling."
- "The agent flow diagram shows our graph: Supervisor routes to either the RAG Agent or the Tool Agent, then the Evaluator scores the response. Every node you'll see light up as the system processes your question."
- "Everything you see here is served from a single Docker container. No CDN, no external dependencies. Fully sovereign."

**Transition:** "Let's ask it something."

---

## Act 3: The Query — Live Streaming (3 min)

> **Click the chat input. Type (or paste) this question:**
>
> `What is Retrieval-Augmented Generation and how does multi-hop reasoning improve it?`
>
> **Press Enter (or click Send).**

### Sequence of events (narrate as they happen)

**Phase 1 — Supervisor routing (~instant):**

- The Supervisor node in the graph glows with a blue pulse
- A flow dot animates along the edge from Supervisor toward the RAG Agent
- Intent text appears below the graph: the classified intent

> "The Supervisor just classified this as a retrieval question and routed it to our RAG Agent. This routing decision happens in under 200 milliseconds."

**Phase 2 — RAG retrieval + document cards:**

- The RAG Agent node activates (green glow)
- The **Retrieved Documents** section appears in the right panel — 4 collapsible cards slide in with staggered animation
- Each card shows a numbered badge and preview snippet

> "The RAG Agent searched our ChromaDB vector store and pulled back four relevant documents. You can expand any card to read the full source text. This is the evidence the model will use to build its answer."

**Click on Document 1 to expand it.** Show the full text, then collapse.

> "Every document is traceable. In production, these would include metadata — source URL, page number, ingestion timestamp. No black box."

**Phase 3 — Token streaming:**

- Tokens appear in the chat area one by one (word-by-word streaming)
- The assistant message bubble grows as the answer streams in
- The chat auto-scrolls to follow new content

> "Now the model is generating its answer grounded in those four documents. Notice it streams token by token — the user gets the first word in under 200ms. No waiting for the full answer."

**Let the answer complete. Don't interrupt.**

**Phase 4 — Evaluation scorecard:**

- While streaming, the "Latest Evaluation" section shows a skeleton loader
- When the eval arrives, the skeleton is replaced with the full scorecard:
  - **PASS/FAIL badge** — green PASS or red FAIL
  - **Four horizontal metric bars** animating from left to right:
    - Faithfulness (green)
    - Answer Relevancy (blue)
    - Context Precision (amber)
    - Context Recall (purple)
  - **Threshold line** — vertical dashed marker on each bar
  - **Metadata**: document count, answer character length

> "Here's what sets SoulGraph apart. The Evaluator Agent just scored this answer on four RAGAS metrics — Faithfulness, Answer Relevancy, Context Precision, and Context Recall. Each bar shows the score relative to a configurable threshold."

**Point to the threshold line.**

> "Anything above the threshold passes. If the model hallucinated or the retrieval missed context, you'd see red bars and a FAIL badge. Automatically. On every single query."

**Phase 5 — Graph completion:**

- The Evaluator node shows a green checkmark badge
- All traversed edges turn green
- A brief completion flash animation plays on the Evaluator node

> "The graph trace shows the full path: Supervisor to RAG to Evaluator. Every node is checked off. If we'd asked a math question, you'd see it route through the Tool Agent instead."

---

## Act 4: The Tuner — Self-Improving System (2 min)

> **Scroll down (or draw attention to) the Agent Tuner panel in the bottom-right.**

### What the audience sees

```
+----------------------------+--------------------------------------+
|  PARAMETERS                |  EVALUATION HISTORY                  |
|  RAG Documents (k): 5     |  [Sparkline chart with 4 metric     |
|  Eval Threshold: 0.70     |   lines across N evaluations]        |
|  Reasoning Model: OFF     |  [Legend: Faith. Relev. Prec. Recall]|
+----------------------------+--------------------------------------+
|  ADJUSTMENTS                                      | [Reset Tuner]|
|  > Increased rag_k: faithfulness below threshold  |              |
|  > Enabled reasoning model: complex question...   |              |
+---------------------------------------------------+--------------+
```

**Talking points:**

- "The Tuner watches every evaluation result and adjusts the system automatically. Right now it's set to retrieve 5 documents with a 0.70 quality threshold."
- "If faithfulness drops below threshold three times in a row, the Tuner increases the retrieval count. If questions get too complex for the fast model, it switches to the reasoning model. All logged."

**Hover over the sparkline chart** — show the tooltip with per-evaluation scores.

> "This chart tracks quality over time. Hover any point to see exact scores. You can spot degradation trends before they become user-facing problems."

**Point to the Adjustments log.**

> "Every tuning decision is logged with the reason. Full transparency. The system explains *why* it changed a parameter."

**Point to the Reset button (don't click it).**

> "And if a tuning experiment goes wrong, one click resets everything to defaults. Safely."

---

## Act 5: Session Management (1 min)

> **Click "+ New Session" in the sidebar.**

**Talking points:**

- "Each session is isolated. Start a new conversation and the previous one stays intact."
- "Sessions are backed by Redis checkpoints. Restart the server, and your conversations are still there."

> **Click back to the first session to show it's preserved.**

> "Production teams need this for compliance, debugging, and audit trails."

---

## Act 6: Resilience & Architecture (1.5 min)

> **Optional: demonstrate one of these (pick based on audience interest)**

### Option A: Error handling

> **Disconnect the network (or stop Redis):**
> ```bash
> docker compose stop redis
> ```

- The connection status dot turns amber (reconnecting), then red (error)
- An error banner appears in the chat: "Service temporarily unavailable"
- ErrorBoundary wraps each panel — one failure doesn't crash the UI

> ```bash
> docker compose start redis
> ```

- The WebSocket auto-reconnects with exponential backoff
- The green dot returns

> "The system doesn't just crash. It tells you what's wrong, keeps the UI functional, and reconnects automatically."

### Option B: Mobile responsive

> **Open DevTools → toggle device toolbar → select iPhone 14**

- Layout switches to single-column stacking
- Right panel drops below the chat with a 40vh max height
- Document cards become collapsible on mobile regardless of length
- All touch targets remain accessible

> "Same app, fully responsive. No separate mobile build."

---

## Act 7: Under the Hood (1 min)

> **Show the terminal briefly.**

```bash
# The entire stack
docker compose ps
# 4 services: redis, chromadb, langfuse, soulgraph — all healthy

# Bundle size
ls -lh web/dist/assets/
# ~120KB gzip total (budget was 300KB)

# Test count
# 301 unit/integration tests + 63 E2E Playwright specs + 148 backend
```

**Talking points:**

- "Four containers. 120KB frontend bundle — 40% under budget. 512 tests across the full stack. Zero external runtime dependencies."
- "The stack runs on a single machine or scales horizontally. Redis handles pub/sub and checkpointing. ChromaDB is the vector store. LangFuse provides full observability traces."
- "Built in 5 days by a team of AI agents coordinated by a single developer."

---

## Act 7b: Quality Assurance — The Numbers (1 min)

> **Show terminal or slide with the test pyramid.**

```
Test Pyramid:
  ┌──────────────────┐
  │   63 E2E Tests   │  Playwright: 6 spec files, chromium + mobile
  │  (Playwright)    │  Chat flow, sessions, tuner, graph, errors, responsive
  ├──────────────────┤
  │   68 Integration │  Hooks: useGraph (29), useTuner (9), useSessions (13)
  │  (Vitest + RTL)  │  + component integration (17)
  ├──────────────────┤
  │  233 Unit Tests  │  8 components + smoke/factory tests
  │  (Vitest + RTL)  │  Data-testid selectors, typed factories, MockWebSocket
  └──────────────────┘
  Total: 364 frontend tests
  Backend: 148 tests, 86% coverage (pytest)
  Grand total: 512 tests
```

**Talking points:**

- "364 frontend tests across three layers. Every component, every hook, every user flow."
- "The E2E suite runs against a mock WebSocket server for deterministic results, then against the real Docker stack for integration confidence. Both pass."
- "Bundle size: 119KB gzip — 40% under the 200KB budget. First WebSocket token: 142ms — under the 200ms threshold. Accessibility score: 96/100. Zero cumulative layout shift. 512 tests across the full stack."
- "We don't self-report success. Every number comes from machine output — Playwright, Vitest, Lighthouse, `vite build`. The CI pipeline (`make web-ci`) runs typecheck → unit tests → production build on every commit."

> **If audience asks about testing philosophy:**
>
> "Every interactive element has a `data-testid` attribute. Tests never rely on CSS classes or DOM structure — they survive any design refactor. The WebSocket protocol is tested end-to-end: client sends question, server streams tokens, eval arrives, done signal closes the stream. All verified."

---

## Act 8: Close (1 min)

**Talking points:**

- "SoulGraph isn't just a chatbot. It's an observable, self-tuning, multi-agent system where every answer comes with proof."
- "The six pillars that guided this build: Performant, Robust, Resilient, Secure, Sovereign, Transparent. Every component was evaluated against all six."
- "What you saw today ships as a single `docker compose up`. No setup wizard, no cloud dependency, no subscription. Your data stays on your infrastructure."

**Transition:** "Questions?"

---

## Appendix: Backup Demo Questions

If the live backend is unavailable, use the mock server. These questions work well with mock data:

| Question | Why it's good for demo |
|----------|----------------------|
| "What is Retrieval-Augmented Generation and how does multi-hop reasoning improve it?" | Hits all panels: docs, streaming, eval, graph |
| "Calculate 15 * 23 + 47" | Shows Tool Agent routing (graph takes the right fork) |
| "Compare ChromaDB and Pinecone for production RAG systems" | Multi-document retrieval, longer answer, more eval variance |
| "What metrics does RAGAS use to evaluate RAG pipelines?" | Self-referential — shows the eval system evaluating a question about itself |

## Appendix: Key Metrics for Q&A

| Metric | Value |
|--------|-------|
| Frontend bundle size | 119.55KB gzip (budget: 200KB) — 40% under |
| First contentful paint | <200ms (vite dev) |
| WebSocket first token | 142ms (measured, target: <200ms) |
| Frontend unit tests | 233 (8 components + smoke/factory, Vitest + RTL) |
| Frontend integration tests | 68 (3 hooks + component integration) |
| E2E Playwright tests | 63 (6 specs: chat, sessions, tuner, graph, errors, responsive) |
| Frontend total | 364 tests |
| Backend tests | 148 tests, 86% coverage (pytest) |
| **Grand total** | **512 tests** |
| Accessibility (Lighthouse) | 96/100 |
| Best Practices (Lighthouse) | 96/100 |
| Cumulative Layout Shift | 0 |
| Docker services | 4 (Redis, ChromaDB, LangFuse, SoulGraph) |
| Default port | 9080 (configurable via `SOULGRAPH_PORT`) |
| Zero external runtime deps | No CDN, no SaaS, no telemetry |
| CI pipeline | `make web-ci` = tsc + vitest + vite build |
| Sprint completion | Day 3 gate reached on Day 1 |

## Appendix: Environment Setup

```bash
# Required: Anthropic API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Optional: LangFuse tracing
export LANGFUSE_PUBLIC_KEY="pk-..."
export LANGFUSE_SECRET_KEY="sk-..."

# Optional: Custom port (default: 9080)
export SOULGRAPH_PORT=9080

# Start everything
docker compose up -d
```
