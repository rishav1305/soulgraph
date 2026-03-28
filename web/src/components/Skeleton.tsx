/**
 * Skeleton.tsx — Reusable shimmer loading placeholders.
 * I5.2: Happy — Sprint Day 3
 *
 * Provides building blocks for loading states:
 *   - SkeletonLine: Single text line placeholder
 *   - SkeletonBar: Horizontal bar (metric bars, charts)
 *   - SkeletonBlock: Rectangular block (cards, panels)
 *   - TunerSkeleton: Full TunerDashboard loading state
 *   - EvalSkeleton: Full EvalReport loading state
 */

// ── Primitives ──

function SkeletonLine({ width = '100%', className = '' }: { width?: string; className?: string }) {
  return (
    <div
      className={`h-3 rounded bg-elevated animate-pulse ${className}`}
      style={{ width }}
    />
  );
}

function SkeletonBar({ width = '100%', height = 'h-5', className = '' }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`${height} rounded-sm bg-elevated animate-pulse ${className}`}
      style={{ width }}
    />
  );
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-md bg-elevated animate-pulse ${className}`} />
  );
}

// ── Composite Skeletons ──

/** Loading skeleton matching TunerDashboard layout. */
export function TunerSkeleton() {
  return (
    <div data-testid="tuner-skeleton" className="rounded-lg border border-border-default bg-surface p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <SkeletonLine width="100px" />
        <SkeletonLine width="60px" />
      </div>

      {/* Two-column: params + chart */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        {/* Params card */}
        <div className="rounded-md border border-border-default bg-deep p-3">
          <SkeletonLine width="80px" className="mb-3" />
          <div className="flex flex-col gap-3">
            <div className="flex justify-between">
              <SkeletonLine width="120px" />
              <SkeletonLine width="30px" />
            </div>
            <div className="flex justify-between">
              <SkeletonLine width="100px" />
              <SkeletonLine width="30px" />
            </div>
            <div className="flex justify-between">
              <SkeletonLine width="110px" />
              <SkeletonLine width="30px" />
            </div>
          </div>
        </div>

        {/* Chart area */}
        <div className="rounded-md border border-border-default bg-deep p-3">
          <SkeletonLine width="120px" className="mb-3" />
          <SkeletonBlock className="h-36 w-full" />
          {/* Legend dots */}
          <div className="flex gap-3 mt-2">
            <SkeletonLine width="40px" />
            <SkeletonLine width="40px" />
            <SkeletonLine width="40px" />
            <SkeletonLine width="40px" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Loading skeleton matching EvalReport layout. */
export function EvalSkeleton() {
  return (
    <div data-testid="eval-skeleton" className="rounded-lg border border-border-default bg-surface p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <SkeletonLine width="50px" className="h-5 rounded-md" />
          <SkeletonLine width="120px" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonLine width="50px" />
          <SkeletonLine width="60px" />
        </div>
      </div>

      {/* Metric bars */}
      <div className="flex flex-col gap-2.5">
        {[0.85, 0.65, 0.75, 0.55].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonLine width="144px" className="shrink-0" />
            <SkeletonBar width={`${w * 100}%`} className="flex-1" />
            <SkeletonLine width="40px" className="shrink-0" />
          </div>
        ))}
      </div>

      {/* Threshold legend */}
      <div className="mt-3 flex items-center gap-2">
        <SkeletonLine width="16px" className="h-px" />
        <SkeletonLine width="100px" />
      </div>
    </div>
  );
}
