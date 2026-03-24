# SoulGraph — Architectural Decisions

Significant decisions made during development, with context and rationale.

---

## ADR-001: LangGraph as orchestration backbone (Phase 0)

**Decision:** Use LangGraph `StateGraph` for multi-agent orchestration rather than a custom event loop.

**Context:** SoulGraph needs a supervised multi-agent architecture where a router delegates to specialised sub-agents (RAG, evaluator, tool) and state flows between them.

**Rationale:**
- LangGraph provides compiled graphs with type-safe `TypedDict` state, conditional edges, and built-in checkpointing
- `StateGraph.compile()` produces a testable `CompiledGraph` — easy to assert node presence and reachability
- Native streaming via `graph.astream()` with `END` node detection
- Active ecosystem: LangSmith + LangFuse integration is first-class

**Alternatives considered:** Custom asyncio event loop, Celery task chains, raw LangChain agents.

---

## ADR-002: RedisSaver with graceful None fallback (Phase 2)

**Decision:** Instantiate `RedisSaver` as an async context manager; fall back to `None` checkpointer when Redis is unavailable.

**Context:** Redis is not always present in dev/test environments; the graph must still run without checkpointing.

**Rationale:**
- `RedisSaver` requires `async with RedisSaver.from_conn_string(...) as saver:` — do NOT pass the instance directly; the context manager performs connection setup and teardown
- Passing `None` to `StateGraph.compile(checkpointer=None)` disables persistence gracefully
- Tests use `checkpointer=None` to avoid Redis dependency in CI

**Gotcha:** `RedisSaver` is NOT a regular object. Forgetting the async context manager causes attribute errors at runtime.

---

## ADR-003: LiteLLM for model routing, not direct Anthropic SDK (Phase 2)

**Decision:** All LLM calls go through `soulgraph.router.ModelRouter` (backed by LiteLLM), not direct `anthropic.Anthropic()` calls.

**Context:** SoulGraph needs to support both cloud APIs (Anthropic Claude) and self-hosted vLLM for the POC phase.

**Rationale:**
- LiteLLM provides a unified interface: switching from `claude-3-5-haiku` to `openai/<vllm_model>` is one line
- vLLM integration requires `api_base` injection — LiteLLM's OpenAI-compatible shim handles this transparently
- `ModelRouter` abstracts the routing logic: `TaskType.REASONING` vs `TaskType.FAST` → different models
- No vendor lock-in; model strings are environment variables

**vLLM pattern:** Set `VLLM_BASE_URL` → router uses `"openai/<model>"` + `api_base`. Leave empty → uses cloud APIs.

---

## ADR-004: RAGAS for evaluation metrics (Phase 1 → Phase 3)

**Decision:** Use RAGAS (`faithfulness`, `answer_relevancy`, `context_precision`, `context_recall`) as evaluation framework.

**Context:** SoulGraph needs automated quality scores on RAG-generated answers.

**Rationale:**
- RAGAS is the most widely adopted open-source RAG evaluation library
- Four metrics cover complementary axes: faithfulness (no hallucination), relevance (answer quality), precision (context selection), recall (coverage)
- Integrates with LangSmith/LangFuse for per-run tracing

**Implementation note:** RAGAS requires an LLM to evaluate — EvaluatorAgent uses `ModelRouter.FAST` for this to keep costs low.

---

## ADR-005: EvalReport dataclass for structured output (Phase 3 T6)

**Decision:** Introduce `EvalReport` dataclass wrapping raw evaluator dict, with `to_json()` and `to_html()` methods.

**Context:** Raw RAGAS output is an untyped dict; callers (API, CLI, CI) need structured, typed output.

**Rationale:**
- `from_dict()` + `to_json()` ensures a stable contract between the evaluator agent and consumers
- JSON output includes a `summary.status` (PASS/FAIL/UNKNOWN) block at the top — human-scannable without parsing the full payload
- HTML output is a self-contained styled scorecard — no external CSS dependencies
- `save(path, fmt)` covers both CI artifacts (JSON) and human review (HTML)

---

## ADR-006: FastAPI WebSocket for streaming (Phase 2)

**Decision:** Use FastAPI WebSocket endpoint `/ws/query` for streaming token output rather than SSE or polling.

**Context:** SoulGraph POC demos require visible streaming token output.

**Rationale:**
- WebSocket is bidirectional — client can send `session_id` and receive streamed tokens in one connection
- FastAPI has first-class WebSocket support with async handlers
- LangGraph `graph.astream()` yields state chunks that map directly to WebSocket messages
- `/health` HTTP endpoint provided separately for readiness checks

---

## ADR-007: Dual tracing — LangSmith + LangFuse (Phase 2)

**Decision:** Support both LangSmith and LangFuse tracing via callbacks, with graceful no-op fallback when keys are absent.

**Context:** Team uses LangSmith for run traces; self-hosted LangFuse for cost analysis. Both are optional.

**Rationale:**
- LangSmith is standard for LangGraph; LangFuse adds self-hosted cost visibility
- No-op fallback means tests don't require API keys
- `Settings.langchain_tracing_v2 = False` (default) disables LangSmith entirely

---

## ADR-008: vLLM backend as opt-in (Phase 3 T5)

**Decision:** vLLM is activated by setting `VLLM_BASE_URL` — empty by default, no code changes needed to switch.

**Context:** Phase 3 POC should run against a self-hosted Mistral model for cost/latency benchmarking.

**Rationale:**
- Feature flag via env var avoids runtime config changes
- `ModelRouter.using_vllm` property lets callers inspect the active backend
- `openai/<model>` LiteLLM prefix + `api_base` is the canonical pattern for vLLM routing
- Trailing slash stripped from `vllm_base_url` to prevent double-slash in API URLs

---

## Status

| Phase | Status | Key decisions |
|-------|--------|---------------|
| Phase 0 | Complete | ADR-001 (LangGraph) |
| Phase 1 | Complete | ADR-004 (RAGAS) |
| Phase 2 | Complete | ADR-002 (Redis), ADR-003 (LiteLLM), ADR-006 (WS), ADR-007 (tracing) |
| Phase 3 Wave 1 | Complete | ADR-005 (EvalReport), ADR-008 (vLLM) |
| Phase 3 Wave 2 | Planned Mar 29 | NeMo Guardrails (T2), pgvector (T4) |
