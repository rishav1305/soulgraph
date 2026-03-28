/**
 * QueryInput.tsx — Text input with submit/cancel for chat queries.
 * C1: Happy — Sprint Day 2
 *
 * Props: QueryInputProps from types.ts
 * States: idle (submit enabled), streaming (cancel shown, input disabled)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { QueryInputProps } from '@/lib/types';

export default function QueryInput({ onSend, streaming, onCancel }: QueryInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;
    onSend(trimmed);
    setInput('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [input, streaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div data-testid="query-input" className="px-4 py-3 border-t border-border-default bg-surface safe-bottom">
      {/* Stream bar */}
      {streaming && <div data-testid="query-input-stream-bar" className="stream-bar mb-3" />}

      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            data-testid="query-input-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={streaming ? 'Waiting for response...' : 'Ask SoulGraph a question...'}
            disabled={streaming}
            rows={1}
            aria-label="Question input"
            className="w-full resize-none bg-elevated border border-border-default rounded-xl px-4 py-3 text-sm text-fg placeholder:text-fg-muted outline-none transition-colors focus:border-soul focus:ring-1 focus:ring-soul-dim disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Submit or Cancel button */}
        {streaming ? (
          <button
            type="button"
            data-testid="query-input-cancel"
            onClick={onCancel}
            aria-label="Cancel streaming"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-fail/15 text-fail hover:bg-fail/25 transition-colors cursor-pointer shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            data-testid="query-input-submit"
            onClick={handleSubmit}
            disabled={!input.trim()}
            aria-label="Send question"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-soul text-deep hover:bg-soul/85 transition-colors cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 8l4-4v3h6v2H7v3L3 8z" />
            </svg>
          </button>
        )}
      </div>

      {/* Hint text */}
      <div className="max-w-3xl mx-auto mt-1.5">
        <span data-testid="query-input-hint" className="text-[10px] text-fg-muted">
          {streaming ? 'Streaming response... click cancel to stop' : 'Enter to send, Shift+Enter for new line'}
        </span>
      </div>
    </div>
  );
}
