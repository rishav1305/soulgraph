/**
 * DocumentViewer.tsx — Expandable list of retrieved ChromaDB documents.
 *
 * Displays documents retrieved by the RAG agent for each query.
 * Each document is collapsible with a preview snippet and full content expansion.
 *
 * Backend: AgentState.documents is list[str] — plain text from ChromaDB.
 * The component wraps each string with index-based display.
 *
 * Owner: Banner (P4) | Sprint Day 3 (pulled forward)
 */

import { useState, useCallback, useEffect } from 'react';

// ── Hooks ──

/** Detect mobile viewport (<768px) for responsive behavior. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    setIsMobile(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

// ── Types ──

export interface DocumentViewerProps {
  /** Raw document strings from ChromaDB retrieval. */
  documents: string[];
  /** Number of characters to show in preview. Default: 150 */
  previewLength?: number;
  /** Optional class name for container. */
  className?: string;
}

// ── Constants ──

const DEFAULT_PREVIEW_LENGTH = 150;

/** Chevron SVG path. */
const CHEVRON_PATH = 'M6 9l6 6 6-6';

// ── Sub-components ──

function DocumentCard({
  content,
  index,
  previewLength,
  forceExpanded,
  isMobile,
}: {
  content: string;
  index: number;
  previewLength: number;
  forceExpanded: boolean;
  isMobile: boolean;
}) {
  const [localExpanded, setLocalExpanded] = useState(false);
  // On mobile, all cards are collapsible (even short content)
  const isCollapsible = isMobile || content.length > previewLength;
  const expanded = forceExpanded || localExpanded;
  const preview = content.length > previewLength
    ? content.slice(0, previewLength) + '...'
    : content;

  const toggle = useCallback(() => {
    if (isCollapsible) setLocalExpanded((e) => !e);
  }, [isCollapsible]);

  return (
    <div
      data-testid={`document-card-${index}`}
      className="rounded-md border border-border-default bg-deep p-3 animate-fade-in"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Header */}
      <button
        data-testid={`document-toggle-${index}`}
        onClick={toggle}
        disabled={!isCollapsible}
        className={`flex items-center gap-2 w-full text-left ${
          isCollapsible ? 'cursor-pointer' : 'cursor-default'
        }`}
        aria-expanded={isCollapsible ? expanded : undefined}
        aria-label={`Document ${index + 1}${isCollapsible ? ', click to expand' : ''}`}
      >
        {/* Chevron */}
        {isCollapsible && (
          <svg
            className={`w-3.5 h-3.5 shrink-0 text-fg-muted transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={CHEVRON_PATH} />
          </svg>
        )}

        {/* Document number badge */}
        <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded bg-elevated text-[10px] font-mono text-fg-muted">
          {index + 1}
        </span>

        {/* Preview text */}
        <span className="text-xs text-fg-secondary leading-relaxed truncate">
          {content.slice(0, 80)}{content.length > 80 ? '...' : ''}
        </span>
      </button>

      {/* Content */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          expanded ? 'max-h-96 mt-2' : isCollapsible ? 'max-h-0' : 'mt-2 max-h-96'
        }`}
      >
        <div className="text-xs text-fg-secondary/80 leading-relaxed font-mono whitespace-pre-wrap break-words pl-7">
          {expanded ? content : (!isCollapsible ? content : preview)}
        </div>

        {/* Character count */}
        <div className="mt-1.5 pl-7 text-[10px] text-fg-muted">
          {content.length} characters
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──

export default function DocumentViewer({
  documents,
  previewLength = DEFAULT_PREVIEW_LENGTH,
  className = '',
}: DocumentViewerProps) {
  const [allExpanded, setAllExpanded] = useState(false);
  const isMobile = useIsMobile();

  if (documents.length === 0) {
    return (
      <div
        data-testid="document-viewer"
        className={`text-xs text-fg-muted italic ${className}`}
      >
        No documents retrieved.
      </div>
    );
  }

  return (
    <div data-testid="document-viewer" className={className}>
      {/* Header with expand-all toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            Retrieved Documents
          </span>
          <span className="text-[10px] font-mono text-fg-muted bg-elevated px-1.5 py-0.5 rounded">
            {documents.length}
          </span>
        </div>

        {documents.some((d) => d.length > previewLength) && (
          <button
            data-testid="document-expand-all"
            onClick={() => setAllExpanded((e) => !e)}
            className="text-[10px] text-fg-muted hover:text-fg-secondary transition-colors"
            aria-label={allExpanded ? 'Collapse all documents' : 'Expand all documents'}
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {/* Document list */}
      <div className="space-y-1.5">
        {documents.map((doc, i) => (
          <DocumentCard
            key={i}
            content={doc}
            index={i}
            previewLength={previewLength}
            forceExpanded={allExpanded}
            isMobile={isMobile}
          />
        ))}
      </div>
    </div>
  );
}
