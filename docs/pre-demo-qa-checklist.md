# SoulGraph — Pre-Demo QA Checklist

**Demo Date:** April 4, 2026
**QA Lead:** Happy (Implementation Support Engineer)
**Audit Date:** March 28, 2026
**Demo Script:** `docs/demo-script-apr4.md`

---

## 1. Build Verification

| Check | Command | Expected | Actual (Mar 28) | Status |
|-------|---------|----------|-----------------|--------|
| TypeScript | `npx tsc --noEmit` | 0 errors | 0 errors | PASS |
| Vite build | `npx vite build` | No errors, bundle < 200KB | 119.20 KB gzip | PASS |
| Unit + integration tests | `npx vitest run` | All pass | 301/301 pass (14 files) | PASS |
| E2E tests (mock) | `npx playwright test` | All pass | 63/63 pass | PASS |

### Run before demo:
```bash
cd ~/soulgraph/web
npx tsc --noEmit && npx vitest run && npx vite build
```

---

## 2. Bundle Size

| Asset | Gzip | Budget | Status |
|-------|------|--------|--------|
| app (index.js) | 70.65 KB | - | - |
| vendor-markdown | 39.16 KB | - | - |
| CSS (Tailwind) | 7.60 KB | - | - |
| vendor-react | 1.39 KB | - | - |
| index.html | 0.40 KB | - | - |
| **Total** | **119.20 KB** | **200 KB** | **PASS (40% under)** |

---

## 3. Docker Stack Health

### Pre-demo startup:
```bash
cd ~/soulgraph
docker compose up -d
docker compose ps   # All 4 services healthy
curl -s http://localhost:9080/health | jq
# Expected: {"status": "ok", "version": "0.2.0"}
```

### Required services:

| Service | Container | Port | Health Check |
|---------|-----------|------|-------------|
| Redis | soulgraph-redis | 6379 | `redis-cli ping` |
| ChromaDB | soulgraph-chromadb | 8001 | TCP connect |
| LangFuse | soulgraph-langfuse | 3100 | HTTP readiness |
| SoulGraph API | (soulgraph) | 9080 | `GET /health` |

### Fallback (if Docker unavailable):
```bash
cd ~/soulgraph/web
npm run dev              # Vite dev server on :5173
npx tsx scripts/mock-ws.ts   # Mock WS + REST on :8081
```

---

## 4. Mock WebSocket Server Verification

All 4 backup demo questions verified clean (Mar 28):

| Question | Expected Route | Answer Key | Verified |
|----------|---------------|------------|----------|
| "What is RAG and how does multi-hop reasoning improve it?" | RAG → docs + tokens + eval | `retrieval` (longest-match-first) | PASS |
| "Calculate 15 * 23 + 47" | Tool Agent (no docs) | `calculate` + isToolQuery() | PASS |
| "Compare ChromaDB and Pinecone for production RAG" | RAG → docs + tokens + eval | `chromadb` (longest-match-first) | PASS |
| "What metrics does RAGAS use to evaluate RAG pipelines?" | RAG → docs + tokens + eval | `metrics` (longest-match-first) | PASS |

### Keyword routing:
- Mock uses longest-match-first sort to prevent short keys ("rag") matching before specific keys ("chromadb", "ragas", "metrics")
- Tool agent routing via `isToolQuery()` regex — skips document retrieval entirely
- Error trigger: query "error" returns simulated 503

---

## 5. UI Functionality Matrix

### Act 3: Live Query Flow
- [ ] Type question in textarea, submit with Enter or click Send
- [ ] Supervisor node activates (blue pulse) in GraphViz
- [ ] RAG Agent node activates (green glow)
- [ ] Retrieved Documents section appears (4 cards with staggered animation)
- [ ] Document cards are expandable/collapsible
- [ ] Tokens stream word-by-word in chat bubble
- [ ] Chat auto-scrolls during streaming
- [ ] Eval scorecard appears: PASS/FAIL badge + 4 metric bars with animation
- [ ] Threshold line visible on each metric bar
- [ ] Evaluator node shows green checkmark
- [ ] All traversed edges turn green
- [ ] Completion flash animation plays

### Act 4: Tuner Dashboard
- [ ] Parameters panel shows: rag_k=5, eval_threshold=0.70, reasoning=OFF
- [ ] Sparkline chart renders with 4 metric lines
- [ ] Chart tooltip shows on hover with per-evaluation scores
- [ ] Adjustments log shows 3 entries with reasons
- [ ] Reset button present (don't click during demo)

### Act 5: Session Management
- [ ] "+ New Session" creates new session, clears chat
- [ ] Click back to first session — messages preserved
- [ ] Session label and timestamp visible
- [ ] Active session highlighted with soul accent

### Act 6: Connection Status
- [ ] Green dot shows "connected" when WS active
- [ ] Amber dot (reconnecting) when connection drops
- [ ] Red dot (error) on backend failure
- [ ] Auto-reconnect with exponential backoff

---

## 6. Accessibility Scores

### SoulGraph Web UI (verified Mar 28)
- Lighthouse a11y: **96/100** (from PERFORMANCE.md)
- data-testid coverage: **73 attributes** across all components
- ARIA attributes: **25** across 8 component files
- Interactive elements: **12/12** keyboard navigable
- focus-visible: all elements styled
- CLS: **0** (zero layout shift)

### 4 Minor Findings (non-blocking):
1. Connection status missing `aria-live="polite"` (LOW)
2. Eval badge missing `role="status"` (LOW)
3. Heading hierarchy starts at h2, no h1 (LOW)
4. No skip-to-content link (MEDIUM)

---

## 7. Performance Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Bundle gzip | 119.20 KB | < 200 KB | PASS |
| First WS token | 142 ms | < 200 ms | PASS |
| CLS | 0 | 0 | PASS |
| Lighthouse a11y | 96/100 | > 90 | PASS |
| Lighthouse best practices | 96/100 | > 90 | PASS |

---

## 8. Test Pyramid

| Layer | Count | Framework | Status |
|-------|-------|-----------|--------|
| Unit tests | 188 | Vitest + RTL | PASS |
| Integration tests | 68 | Vitest + RTL (hooks) | PASS |
| Smoke/factory tests | 45 | Vitest | PASS |
| **Frontend subtotal** | **301** | | **PASS** |
| E2E tests | 63 | Playwright (6 specs) | PASS |
| **Frontend total** | **364** | | **PASS** |
| Backend tests | 148 | pytest (86% coverage) | PASS |
| **Grand total** | **512** | | **PASS** |

---

## 9. Portfolio Site Regression (verified Mar 28)

### Blog Posts (10/10 verified):

| Post | Status | Slug |
|------|--------|------|
| Benchmarks Don't Predict Production | LIVE | benchmarks-dont-predict-production |
| Classification Paradox | LIVE | classification-paradox |
| CARS 52-Model Benchmark | LIVE | cars-52-model-benchmark |
| 88% Agent Failure | LIVE | agent-failure-production |
| Why RAG Is Replacing Fine-Tuning | LIVE | why-rag-replacing-fine-tuning |
| AI Decision Intelligence | LIVE | ai-decision-intelligence |
| Agentic AI in Data Analytics | LIVE | agentic-ai-data-analytics |
| Enterprise AI Infrastructure | LIVE | enterprise-ai-infrastructure |
| AI Evaluation Reliability | LIVE | ai-evaluation-reliability |
| AI Consulting Landscape | LIVE | ai-consulting-landscape |

### Portfolio Lighthouse Scores (8 pages audited):

| Page | A11y | Best Practices |
|------|------|---------------|
| Homepage | 96 | 100 |
| About | 90 | 100 |
| Blog | 94 | 100 |
| Blog Post | 94 | 100 |
| Contact | 92 | 100 |
| CARS Evaluation | 100 | 100 |
| Projects | 94 | 100 |
| Resume | 94 | 100 |

**All pages: a11y >= 90, best-practices = 100.**

---

## 10. Known Issues (Non-Blocking)

| Issue | Severity | Impact on Demo | Fix Status |
|-------|----------|---------------|------------|
| Portfolio missing `<main>` landmark | LOW | No impact | Flagged for fix |
| Portfolio color-contrast (#64748B) | LOW | No impact | Flagged for fix |
| OG images 404 on blog posts | LOW | No impact (social sharing only) | Untracked file |
| SoulGraph Lighthouse perf 25/100 | N/A | RPi hardware artifact, not representative | Re-run on titan-pc |
| Demo script test counts outdated (319 vs 512) | LOW | Update before demo | Flagged |

---

## 11. Day-of-Demo Runbook

### T-30 minutes:
```bash
# 1. Start stack
cd ~/soulgraph && docker compose up -d

# 2. Wait for healthy (all 4 containers)
docker compose ps

# 3. Verify API
curl -s http://localhost:9080/health | jq

# 4. Open browser to http://localhost:9080
```

### T-5 minutes:
- [ ] Verify green connection dot in UI
- [ ] Send one test query to warm up
- [ ] Check tuner dashboard loads
- [ ] Check session sidebar empty state
- [ ] Close DevTools / other tabs

### During demo:
- Follow demo-script-apr4.md Acts 1-8
- Use backup questions from Appendix if needed
- If Docker fails: switch to mock server (see Section 3 fallback)

### Post-demo:
```bash
docker compose down   # Clean shutdown
```

---

## 12. Gate Review Sign-Off

| Gate | Reviewer | Status | Date |
|------|----------|--------|------|
| Build verification | Happy | PASS | Mar 28 |
| E2E Playwright (63 tests) | Stark + Happy | PASS | Mar 28 |
| Mock-ws demo scenarios | Happy | PASS | Mar 28 |
| Bundle size (119KB) | Stark | PASS | Mar 28 |
| WS latency (142ms) | Stark | PASS | Mar 28 |
| Accessibility (96/100) | Happy | PASS | Mar 28 |
| Portfolio regression (10/10 posts) | Happy | PASS | Mar 28 |
| Portfolio Lighthouse (8 pages) | Happy | PASS | Mar 28 |
| Docker stack health | - | PENDING (run day-of) | - |
| Live backend E2E | - | PENDING (run day-of) | - |

**Overall QA Verdict: GO for April 4 demo.**

All automated checks pass. All manual verification items documented. Fallback procedures in place. The system is demo-ready.
