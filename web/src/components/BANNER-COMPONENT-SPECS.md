# Banner Component Layout Specs
**Date:** March 28, 2026 | **Sprint Day:** 1 (prep) | **For:** Day 2 implementation

---

## C6: EvalReport.tsx

### Full Mode Layout (default)
```
+-------------------------------------------------------------+
| [PASS badge]  Evaluation Report               [4 docs] [342 chars] |
+-------------------------------------------------------------+
| faithfulness     |=============================|-----| 0.89  |
| answer_relevancy |================================|--| 0.92  |
| context_precision|===========================|-------| 0.85  |
| context_recall   |========================|----------| 0.78  |
+-------------------------------------------------------------+
|                    ▼ threshold line at 0.70                   |
+-------------------------------------------------------------+
```

### Compact Mode Layout
```
[PASS] 0.89 / 0.92 / 0.85 / 0.78  (4 docs, 342 chars)
```

### Design Decisions
- **Metric bars**: Horizontal, full-width. Fill color: pass (green-500) if >= threshold, fail (red-500) if below.
- **Threshold line**: Vertical dashed line at threshold position (default 0.70 = 70% width).
- **Pass/Fail badge**: Top-left. Green bg for pass, red for fail, amber for null/unknown.
- **Null scores**: Show "N/A" text, gray bar with diagonal stripes.
- **Error state**: Red border, error message in place of metric bars.
- **Responsive**: Stacks vertically on <640px. Metric labels above bars instead of beside.
- **data-testid**: `eval-report`, `eval-badge`, `eval-metric-{name}`, `eval-threshold-line`, `eval-error`.

### Color Mapping
| State | Background | Text | Border |
|-------|-----------|------|--------|
| Pass | bg-pass/10 | text-pass | border-pass |
| Fail | bg-fail/10 | text-fail | border-fail |
| Null | bg-elevated | text-fg-muted | border-default |
| Error | bg-fail/5 | text-fail | border-fail |

---

## C7: GraphViz.tsx

### SVG Layout (400x300 viewBox)
```
              [Supervisor]
             /            \
            /              \
      [RAG Agent]    [Tool Agent]
            \
             \
          [Evaluator]
               |
             [END]
```

### Node Positions (viewBox 400x300)
| Node | x | y | Reason |
|------|---|---|--------|
| supervisor | 200 | 40 | Top center — entry point |
| rag | 80 | 150 | Left middle — primary path |
| tool | 320 | 150 | Right middle — secondary path |
| evaluator | 200 | 260 | Bottom center — terminal |

### Edge Routing
| Edge | Type | Style |
|------|------|-------|
| supervisor → rag | Conditional | Dashed when inactive, solid when RAG path taken |
| supervisor → tool | Conditional | Dashed when inactive, solid when tool path taken |
| rag → evaluator | Always | Solid line |
| tool → (implicit END) | Always | Solid line to small "END" circle |

### Node Design
- **Shape**: Rounded rectangle, 100x40px
- **Inactive**: bg-elevated, border-default, text-fg-secondary
- **Active**: bg-soul/20, border-soul, text-soul, pulse animation (scale 1.0→1.05→1.0, 1.5s infinite)
- **Labels**: Node name centered, icon left of text (optional)
- **Intent text**: Below the graph, text-fg-muted, shows current intent string

### Animations
- **Active node pulse**: CSS keyframe, scale + box-shadow glow (#CA8A04 shadow)
- **Edge flow**: SVG animated circle traveling along active edge path (2s duration, repeating)
- **Transition**: 300ms ease-in-out for node state changes

### data-testid
- `graph-viz`, `graph-node-{id}`, `graph-edge-{from}-{to}`, `graph-intent`

---

## C8: TunerDashboard.tsx

### Layout (two-column on >=768px, stacked on mobile)
```
+---------------------------+-------------------------------+
| Tuner Parameters          | Evaluation History            |
|                           |                               |
| rag_k:          [6]       |  1.0 |        ___  ____       |
| eval_threshold: [0.65]    |      |   __--'   ''    '--    |
| reasoning:      [ON]      |  0.5 |--'                     |
|                           |      |   — faithfulness        |
|                           |  0.0 |   — relevancy           |
|                           |      +--1--2--3--4--5--6--7--8 |
+---------------------------+-------------------------------+
| Adjustments Log                           [Reset Tuner]   |
| > Increased rag_k from 4 to 5                             |
| > Enabled prefer_reasoning_model                          |
+-----------------------------------------------------------+
```

### Params Card
- **Layout**: Vertical stack of 3 param rows
- **rag_k**: Label + value badge (number, bg-elevated)
- **eval_threshold**: Label + value badge (decimal, bg-elevated)
- **prefer_reasoning_model**: Label + toggle indicator (ON=soul color, OFF=fg-muted)

### History Chart
- **Type**: SVG sparkline (no chart library — keep bundle clean)
- **Lines**: 4 metrics, each with distinct color:
  - faithfulness: #22c55e (green-500)
  - answer_relevancy: #3b82f6 (blue-500)
  - context_precision: #f59e0b (amber-500)
  - context_recall: #a855f7 (purple-500)
- **X-axis**: Eval number (1 to N)
- **Y-axis**: Score (0.0 to 1.0)
- **Null handling**: Skip null points (break line, don't interpolate)
- **Threshold line**: Horizontal dashed line at current eval_threshold

### Adjustments Log
- **Layout**: Scrollable list below chart, max-height 120px
- **Style**: Monospace font, text-fg-secondary, bullet prefix

### Reset Button
- **Default**: "Reset Tuner" button, bg-fail/10, text-fail, border-fail
- **Confirm**: Click once → "Confirm Reset?" (amber), click again → triggers onReset
- **Disabled**: During reset operation (loading spinner)

### Empty State
- History: "No evaluations yet. Ask a question to start the tuner."
- Adjustments: Hidden when empty

### data-testid
- `tuner-dashboard`, `tuner-param-{name}`, `tuner-history-chart`, `tuner-adjustments`, `tuner-reset-btn`

---

## Shared Patterns

### Animation Utility Classes (for app.css)
```css
@keyframes pulse-soul {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(202, 138, 4, 0.4); }
  50% { transform: scale(1.05); box-shadow: 0 0 12px 4px rgba(202, 138, 4, 0.2); }
}

@keyframes flow-dot {
  0% { offset-distance: 0%; }
  100% { offset-distance: 100%; }
}

.animate-pulse-soul {
  animation: pulse-soul 1.5s ease-in-out infinite;
}
```

### Responsive Breakpoints
- **<640px**: Stack everything vertically, full-width bars
- **640-1024px**: Side-by-side where sensible (TunerDashboard params|chart)
- **>1024px**: Full layout as designed above
