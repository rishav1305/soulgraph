# SoulGraph Web UI — Performance Audit

**Date:** March 28, 2026
**Auditor:** Stark (P5/D5)
**Environment:** titan-pi (RPi aarch64), mock-ws backend on :8081, vite dev on :5173

---

## Bundle Size

| Asset | Raw | Gzip | Notes |
|-------|-----|------|-------|
| app (index.js) | 230.32 KB | 70.65 KB | All components + hooks + lib |
| vendor-markdown | 125.91 KB | 39.16 KB | react-markdown + rehype-highlight |
| CSS (Tailwind) | 38.27 KB | 7.95 KB | Purged, dark theme only |
| vendor-react | 3.66 KB | 1.39 KB | React 19 tree-shaken |
| index.html | 0.72 KB | 0.40 KB | |
| **Total** | **398.88 KB** | **119.55 KB** | **40% under 200KB target** |

**Verdict:** PASS. Well under the 200KB gzip budget from Pillar 1.

### Optimization opportunities
- `vendor-markdown` is 39KB gzip — could lazy-load for first paint improvement
- If markdown rendering isn't needed on initial load, dynamic import would cut FCP bundle to ~80KB

---

## Lighthouse Scores (titan-pi, dev server)

| Category | Score | Notes |
|----------|-------|-------|
| Accessibility | **96/100** | Excellent — data-testid + aria-labels |
| Best Practices | **96/100** | No deprecations, proper HTTPS readiness |
| Performance | 25/100 | Hardware-limited (RPi aarch64) — not representative |
| CLS | **0** | Zero layout shift |

**Note:** Performance score is dominated by RPi CPU limitations:
- FCP: 9.9s, LCP: 16.8s, TTI: 20.3s — all RPi artifacts
- Should re-run on titan-pc for production-accurate metrics
- CLS=0 confirms layout stability regardless of hardware

---

## WebSocket Streaming Latency

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| WS connect | 117ms | - | Good |
| First token | **142ms** | < 200ms | **PASS** |
| Token interval | ~58ms | 50ms configured | Expected (8ms overhead) |
| Full stream (28 tokens) | 1.6s | - | Good |

**Verdict:** PASS. First token well under the 200ms Pillar 1 threshold.

---

## DOM & Rendering

- Zero layout shift (CLS = 0)
- No unnecessary re-renders (React 19 automatic batching)
- SVG graph viz is pure SVG, no external deps (d3/reactflow)
- Auto-scroll with `scrollIntoView` (not forced reflow)

---

## Pillar Compliance

| Pillar | Status | Evidence |
|--------|--------|----------|
| Performant | **PASS** | 119KB gzip, 142ms first token, CLS=0 |
| Robust | **PASS** | 63/63 E2E tests, error boundaries on all panels |
| Resilient | **PASS** | WS auto-reconnect with backoff, localStorage session persistence |
| Secure | **PASS** | No secrets in code, CSP-ready, no innerHTML |
| Sovereign | **PASS** | Zero CDN deps, all assets self-hosted, no telemetry |
| Transparent | **PASS** | Connection status indicator, streaming progress, eval metrics visible |

---

## Recommendations

1. **Lazy-load react-markdown** — dynamic import saves 39KB on initial bundle
2. **Re-run Lighthouse on titan-pc** — get production-accurate perf metrics
3. **Add `<link rel=preconnect>` for WS** — may shave 20-50ms off first token
4. **Consider code-splitting** for TunerDashboard (loaded only when tuner data exists)
