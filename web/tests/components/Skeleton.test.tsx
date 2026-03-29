/**
 * Skeleton.test.tsx — Unit tests for loading skeleton components.
 *
 * Tests:
 * - TunerSkeleton: renders with data-testid, has pulse animation, matches layout
 * - EvalSkeleton: renders with data-testid, has pulse animation, matches layout
 * - Primitive elements: SkeletonLine, SkeletonBar, SkeletonBlock render with animate-pulse
 *
 * Owner: Happy (I5.2 proactive test coverage) | Sprint Day 5
 */

import { describe, it, expect } from 'vitest';
import { TunerSkeleton, EvalSkeleton } from '@/components/Skeleton';
import { render, screen } from '../helpers/render';

// ─── TunerSkeleton ──────────────────────────────────────────

describe('TunerSkeleton', () => {
  it('renders with correct data-testid', () => {
    render(<TunerSkeleton />);
    expect(screen.getByTestId('tuner-skeleton')).toBeInTheDocument();
  });

  it('has pulse animation elements', () => {
    render(<TunerSkeleton />);
    const skeleton = screen.getByTestId('tuner-skeleton');
    const pulseElements = skeleton.querySelectorAll('.animate-pulse');
    // Should have multiple shimmer elements (header, params, chart, legend)
    expect(pulseElements.length).toBeGreaterThan(5);
  });

  it('has border and surface styling', () => {
    render(<TunerSkeleton />);
    const skeleton = screen.getByTestId('tuner-skeleton');
    expect(skeleton.className).toContain('border');
    expect(skeleton.className).toContain('bg-surface');
    expect(skeleton.className).toContain('rounded-lg');
  });

  it('renders two-column grid for params + chart', () => {
    render(<TunerSkeleton />);
    const skeleton = screen.getByTestId('tuner-skeleton');
    const grid = skeleton.querySelector('.grid');
    expect(grid).not.toBeNull();
    expect(grid!.className).toContain('grid-cols-1');
    expect(grid!.className).toContain('md:grid-cols-');
  });

  it('renders params section with 3 rows', () => {
    render(<TunerSkeleton />);
    const skeleton = screen.getByTestId('tuner-skeleton');
    // Params card has bg-deep class — find the first one
    const deepCards = skeleton.querySelectorAll('.bg-deep');
    expect(deepCards.length).toBeGreaterThanOrEqual(1);
    // First deep card is params — should have justify-between rows for param entries
    const paramRows = deepCards[0]!.querySelectorAll('.justify-between');
    expect(paramRows.length).toBe(3);
  });

  it('renders chart area with legend dots', () => {
    render(<TunerSkeleton />);
    const skeleton = screen.getByTestId('tuner-skeleton');
    // Chart area has a tall block (h-36)
    const chartBlock = skeleton.querySelector('.h-36');
    expect(chartBlock).not.toBeNull();
    // Legend row with gap-3
    const deepCards = skeleton.querySelectorAll('.bg-deep');
    expect(deepCards.length).toBe(2); // params + chart
  });
});

// ─── EvalSkeleton ───────────────────────────────────────────

describe('EvalSkeleton', () => {
  it('renders with correct data-testid', () => {
    render(<EvalSkeleton />);
    expect(screen.getByTestId('eval-skeleton')).toBeInTheDocument();
  });

  it('has pulse animation elements', () => {
    render(<EvalSkeleton />);
    const skeleton = screen.getByTestId('eval-skeleton');
    const pulseElements = skeleton.querySelectorAll('.animate-pulse');
    // Header + 4 metric rows + threshold legend
    expect(pulseElements.length).toBeGreaterThan(8);
  });

  it('has border and surface styling', () => {
    render(<EvalSkeleton />);
    const skeleton = screen.getByTestId('eval-skeleton');
    expect(skeleton.className).toContain('border');
    expect(skeleton.className).toContain('bg-surface');
    expect(skeleton.className).toContain('rounded-lg');
  });

  it('renders 4 metric bar rows', () => {
    render(<EvalSkeleton />);
    const skeleton = screen.getByTestId('eval-skeleton');
    // Each metric row has "items-center gap-3" pattern
    const metricContainer = skeleton.querySelector('.flex.flex-col.gap-2\\.5');
    expect(metricContainer).not.toBeNull();
    const rows = metricContainer!.querySelectorAll(':scope > div');
    expect(rows.length).toBe(4);
  });

  it('renders header with badge and label placeholders', () => {
    render(<EvalSkeleton />);
    const skeleton = screen.getByTestId('eval-skeleton');
    // Header section with mb-4
    const header = skeleton.querySelector('.mb-4');
    expect(header).not.toBeNull();
  });

  it('renders threshold legend at bottom', () => {
    render(<EvalSkeleton />);
    const skeleton = screen.getByTestId('eval-skeleton');
    // mt-3 is the threshold legend section
    const legend = skeleton.querySelector('.mt-3');
    expect(legend).not.toBeNull();
  });
});

// ─── Skeleton Primitives (via composite rendering) ──────────

describe('Skeleton Primitives', () => {
  it('SkeletonLine renders with custom width via TunerSkeleton', () => {
    render(<TunerSkeleton />);
    const skeleton = screen.getByTestId('tuner-skeleton');
    // SkeletonLine renders as div with h-3 rounded bg-elevated animate-pulse
    const lines = skeleton.querySelectorAll('.h-3.rounded.bg-elevated');
    expect(lines.length).toBeGreaterThan(0);
    // Check at least one has explicit width style
    const withWidth = Array.from(lines).filter((el) => {
      const style = (el as HTMLElement).style.width;
      return style && style !== '100%';
    });
    expect(withWidth.length).toBeGreaterThan(0);
  });

  it('SkeletonBar renders with custom height via EvalSkeleton', () => {
    render(<EvalSkeleton />);
    const skeleton = screen.getByTestId('eval-skeleton');
    // SkeletonBar renders as div with rounded-sm bg-elevated animate-pulse + custom height class
    const bars = skeleton.querySelectorAll('.rounded-sm.bg-elevated');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('SkeletonBlock renders via TunerSkeleton chart area', () => {
    render(<TunerSkeleton />);
    const skeleton = screen.getByTestId('tuner-skeleton');
    // SkeletonBlock renders as div with rounded-md bg-elevated animate-pulse
    const blocks = skeleton.querySelectorAll('.rounded-md.bg-elevated');
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('all shimmer elements use animate-pulse class', () => {
    const { container } = render(
      <>
        <TunerSkeleton />
        <EvalSkeleton />
      </>,
    );
    const pulseElements = container.querySelectorAll('.animate-pulse');
    // Every animated element should have bg-elevated
    const allElevated = Array.from(pulseElements).every((el) =>
      el.className.includes('bg-elevated'),
    );
    expect(allElevated).toBe(true);
  });
});
