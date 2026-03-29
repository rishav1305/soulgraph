/**
 * DocumentViewer.test.tsx — Unit tests for the document viewer component.
 *
 * Tests:
 * - Empty state: "No documents retrieved"
 * - Document cards: rendering, index badges, character count
 * - Expand/collapse: individual toggle, expand-all button
 * - Short documents: non-collapsible, always show content
 * - Long documents: collapsible, preview with truncation
 * - Expand-all button: conditional render, toggle behavior
 * - Mobile responsive: useIsMobile hook (matchMedia mock)
 * - Accessibility: aria-expanded, aria-label, disabled state
 *
 * Owner: Happy (QA) | Coverage expansion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import DocumentViewer from '@/components/DocumentViewer';
import { render, screen, fireEvent } from '../helpers/render';

// ─── Constants ──────────────────────────────────────────────────

const SHORT_DOC = 'Short document text.'; // < 150 chars
const LONG_DOC =
  'This is a very long document that exceeds the default preview length of 150 characters. ' +
  'It contains enough text to trigger the truncation behavior and the expand/collapse toggle. ' +
  'The full content should only be visible when expanded.';

const MOCK_DOCUMENTS = [SHORT_DOC, LONG_DOC, 'Another short doc.'];

// ─── matchMedia mock ────────────────────────────────────────────

let mediaQueryListeners: ((e: { matches: boolean }) => void)[] = [];
let currentMatches = false;

function mockMatchMedia(matches: boolean) {
  currentMatches = matches;
  mediaQueryListeners = [];

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: currentMatches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(
        (_event: string, handler: (e: { matches: boolean }) => void) => {
          mediaQueryListeners.push(handler);
        },
      ),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ─── Helpers ────────────────────────────────────────────────────

function renderViewer(
  documents: string[] = MOCK_DOCUMENTS,
  previewLength?: number,
  className?: string,
) {
  return render(
    <DocumentViewer
      documents={documents}
      previewLength={previewLength}
      className={className}
    />,
  );
}

// ─── Tests ──────────────────────────────────────────────────────

describe('DocumentViewer', () => {
  beforeEach(() => {
    mockMatchMedia(false); // default: desktop
  });

  // ── Empty state ────────────────────────────────────────────

  describe('empty state', () => {
    it('renders "No documents retrieved" when documents array is empty', () => {
      renderViewer([]);
      expect(screen.getByTestId('document-viewer')).toHaveTextContent(
        'No documents retrieved.',
      );
    });

    it('applies className to empty state container', () => {
      renderViewer([], undefined, 'custom-class');
      expect(screen.getByTestId('document-viewer')).toHaveClass('custom-class');
    });
  });

  // ── Document cards ─────────────────────────────────────────

  describe('document cards', () => {
    it('renders one card per document', () => {
      renderViewer();
      expect(screen.getByTestId('document-card-0')).toBeInTheDocument();
      expect(screen.getByTestId('document-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('document-card-2')).toBeInTheDocument();
    });

    it('shows document count badge in header', () => {
      renderViewer();
      const viewer = screen.getByTestId('document-viewer');
      // The count badge is a span with the document count
      const badges = viewer.querySelectorAll('.font-mono');
      const countBadge = Array.from(badges).find((el) => el.textContent === '3');
      expect(countBadge).toBeTruthy();
    });

    it('shows "Retrieved Documents" header text', () => {
      renderViewer();
      expect(screen.getByText('Retrieved Documents')).toBeInTheDocument();
    });

    it('shows character count for each document', () => {
      renderViewer([SHORT_DOC]);
      expect(
        screen.getByText(`${SHORT_DOC.length} characters`),
      ).toBeInTheDocument();
    });

    it('shows staggered animation delay based on index', () => {
      renderViewer([SHORT_DOC, 'Second doc.']);
      const card0 = screen.getByTestId('document-card-0');
      const card1 = screen.getByTestId('document-card-1');
      expect(card0.style.animationDelay).toBe('0ms');
      expect(card1.style.animationDelay).toBe('60ms');
    });

    it('renders toggle button for each card', () => {
      renderViewer();
      expect(screen.getByTestId('document-toggle-0')).toBeInTheDocument();
      expect(screen.getByTestId('document-toggle-1')).toBeInTheDocument();
      expect(screen.getByTestId('document-toggle-2')).toBeInTheDocument();
    });

    it('applies className to container when documents exist', () => {
      renderViewer(MOCK_DOCUMENTS, undefined, 'my-class');
      expect(screen.getByTestId('document-viewer')).toHaveClass('my-class');
    });
  });

  // ── Short documents (non-collapsible) ──────────────────────

  describe('short documents', () => {
    it('toggle button is disabled for short documents on desktop', () => {
      renderViewer([SHORT_DOC]);
      const toggle = screen.getByTestId('document-toggle-0');
      expect(toggle).toBeDisabled();
    });

    it('shows full content without needing expand', () => {
      renderViewer([SHORT_DOC]);
      // Content div has whitespace-pre-wrap class
      const card = screen.getByTestId('document-card-0');
      const contentDiv = card.querySelector('.whitespace-pre-wrap');
      expect(contentDiv).not.toBeNull();
      expect(contentDiv!.textContent).toBe(SHORT_DOC);
    });

    it('aria-expanded is undefined for non-collapsible cards', () => {
      renderViewer([SHORT_DOC]);
      const toggle = screen.getByTestId('document-toggle-0');
      expect(toggle).not.toHaveAttribute('aria-expanded');
    });

    it('aria-label does not include "click to expand" for short docs', () => {
      renderViewer([SHORT_DOC]);
      const toggle = screen.getByTestId('document-toggle-0');
      expect(toggle).toHaveAttribute('aria-label', 'Document 1');
    });
  });

  // ── Long documents (collapsible) ───────────────────────────

  describe('long documents', () => {
    it('toggle button is enabled for long documents', () => {
      renderViewer([LONG_DOC]);
      const toggle = screen.getByTestId('document-toggle-0');
      expect(toggle).not.toBeDisabled();
    });

    it('starts collapsed — aria-expanded=false', () => {
      renderViewer([LONG_DOC]);
      const toggle = screen.getByTestId('document-toggle-0');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('expands on click — aria-expanded=true', () => {
      renderViewer([LONG_DOC]);
      fireEvent.click(screen.getByTestId('document-toggle-0'));
      expect(screen.getByTestId('document-toggle-0')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('collapses on second click', () => {
      renderViewer([LONG_DOC]);
      const toggle = screen.getByTestId('document-toggle-0');
      fireEvent.click(toggle); // expand
      fireEvent.click(toggle); // collapse
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('aria-label includes "click to expand" for collapsible docs', () => {
      renderViewer([LONG_DOC]);
      expect(screen.getByTestId('document-toggle-0')).toHaveAttribute(
        'aria-label',
        'Document 1, click to expand',
      );
    });

    it('shows chevron icon for collapsible documents', () => {
      renderViewer([LONG_DOC]);
      const toggle = screen.getByTestId('document-toggle-0');
      const svg = toggle.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('does not show chevron for non-collapsible documents', () => {
      renderViewer([SHORT_DOC]);
      const toggle = screen.getByTestId('document-toggle-0');
      const svg = toggle.querySelector('svg');
      expect(svg).not.toBeInTheDocument();
    });
  });

  // ── Custom preview length ──────────────────────────────────

  describe('custom preview length', () => {
    it('treats documents shorter than previewLength as non-collapsible', () => {
      // SHORT_DOC is ~20 chars, previewLength=10 makes it collapsible
      renderViewer([SHORT_DOC], 10);
      const toggle = screen.getByTestId('document-toggle-0');
      expect(toggle).not.toBeDisabled();
    });

    it('uses default 150 characters when previewLength not specified', () => {
      // A doc of exactly 150 chars should be non-collapsible
      const exact150 = 'x'.repeat(150);
      renderViewer([exact150]);
      const toggle = screen.getByTestId('document-toggle-0');
      expect(toggle).toBeDisabled();
    });

    it('documents at 151 chars are collapsible with default previewLength', () => {
      const over150 = 'x'.repeat(151);
      renderViewer([over150]);
      const toggle = screen.getByTestId('document-toggle-0');
      expect(toggle).not.toBeDisabled();
    });
  });

  // ── Expand all button ──────────────────────────────────────

  describe('expand-all button', () => {
    it('shows expand-all button when at least one doc exceeds preview length', () => {
      renderViewer([LONG_DOC]);
      expect(screen.getByTestId('document-expand-all')).toBeInTheDocument();
    });

    it('does not show expand-all when all docs are short', () => {
      renderViewer([SHORT_DOC, 'Another short.']);
      expect(
        screen.queryByTestId('document-expand-all'),
      ).not.toBeInTheDocument();
    });

    it('shows "Expand all" text initially', () => {
      renderViewer([LONG_DOC]);
      expect(screen.getByTestId('document-expand-all')).toHaveTextContent(
        'Expand all',
      );
    });

    it('toggles to "Collapse all" on click', () => {
      renderViewer([LONG_DOC]);
      fireEvent.click(screen.getByTestId('document-expand-all'));
      expect(screen.getByTestId('document-expand-all')).toHaveTextContent(
        'Collapse all',
      );
    });

    it('expand-all forces all cards to expanded state', () => {
      renderViewer([LONG_DOC, LONG_DOC.slice(0, 200)]);
      fireEvent.click(screen.getByTestId('document-expand-all'));
      // Both cards should be expanded
      expect(screen.getByTestId('document-toggle-0')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(screen.getByTestId('document-toggle-1')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('collapse-all returns cards to collapsed state', () => {
      renderViewer([LONG_DOC]);
      const expandAll = screen.getByTestId('document-expand-all');
      fireEvent.click(expandAll); // expand all
      fireEvent.click(expandAll); // collapse all
      expect(screen.getByTestId('document-toggle-0')).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    it('aria-label updates with expand/collapse state', () => {
      renderViewer([LONG_DOC]);
      const btn = screen.getByTestId('document-expand-all');
      expect(btn).toHaveAttribute('aria-label', 'Expand all documents');
      fireEvent.click(btn);
      expect(btn).toHaveAttribute('aria-label', 'Collapse all documents');
    });
  });

  // ── Mobile behavior ────────────────────────────────────────

  describe('mobile viewport', () => {
    it('makes all documents collapsible on mobile', () => {
      mockMatchMedia(true); // mobile
      renderViewer([SHORT_DOC]);
      const toggle = screen.getByTestId('document-toggle-0');
      // On mobile, even short docs are collapsible
      expect(toggle).not.toBeDisabled();
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('short docs are non-collapsible on desktop', () => {
      mockMatchMedia(false); // desktop
      renderViewer([SHORT_DOC]);
      const toggle = screen.getByTestId('document-toggle-0');
      expect(toggle).toBeDisabled();
    });
  });

  // ── Multiple documents ─────────────────────────────────────

  describe('multiple documents', () => {
    it('renders correct index badges (1-based)', () => {
      renderViewer();
      const card0 = screen.getByTestId('document-toggle-0');
      const card2 = screen.getByTestId('document-toggle-2');
      expect(card0).toHaveTextContent('1');
      expect(card2).toHaveTextContent('3');
    });

    it('individual card expansion is independent', () => {
      renderViewer([LONG_DOC, LONG_DOC.slice(0, 200)]);
      // Expand only card 0
      fireEvent.click(screen.getByTestId('document-toggle-0'));
      expect(screen.getByTestId('document-toggle-0')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(screen.getByTestId('document-toggle-1')).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    it('shows preview text truncated at 80 chars in header', () => {
      const longContent = 'a'.repeat(100);
      renderViewer([longContent], 50);
      const toggle = screen.getByTestId('document-toggle-0');
      // Header preview truncates at 80 chars with "..."
      expect(toggle).toHaveTextContent('a'.repeat(80) + '...');
    });
  });
});
