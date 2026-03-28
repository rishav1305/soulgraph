/**
 * MessageBubble.tsx — User/assistant chat message bubble.
 * C2: Happy — Sprint Day 2
 *
 * Props: MessageBubbleProps from types.ts
 * Features:
 *   - User bubble: right-aligned, elevated bg
 *   - Assistant bubble: left-aligned, surface bg, Soul diamond avatar
 *   - Markdown rendering via react-markdown
 *   - Streaming cursor on active assistant message
 *   - Eval report pass/fail badge (compact)
 */

import Markdown from 'react-markdown';
import type { MessageBubbleProps } from '@/lib/types';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      data-testid={`message-bubble-${message.id}`}
      className={`flex gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        data-testid={`message-avatar-${message.id}`}
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${
          isUser
            ? 'bg-elevated text-fg-secondary'
            : 'bg-soul/15 text-soul'
        }`}
      >
        {isUser ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="5" r="3" />
            <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          </svg>
        ) : (
          <span className={`text-lg leading-none ${isStreaming ? 'animate-pulse-soul' : ''}`}>&#9670;</span>
        )}
      </div>

      {/* Bubble content */}
      <div className={`flex flex-col max-w-[75%] min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Role label */}
        <span className="text-[10px] text-fg-muted font-display font-semibold uppercase tracking-wider mb-1">
          {isUser ? 'You' : 'SoulGraph'}
        </span>

        {/* Message body */}
        <div
          data-testid={`message-content-${message.id}`}
          className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-elevated text-fg rounded-br-sm'
              : 'bg-surface border border-border-default text-fg rounded-bl-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-soul">
              <Markdown>{message.content}</Markdown>
              {isStreaming && <span className="streaming-cursor" />}
            </div>
          )}
        </div>

        {/* Footer: timestamp + eval badge */}
        <div className="flex items-center gap-2 mt-1">
          <span data-testid={`message-time-${message.id}`} className="text-[10px] text-fg-muted">
            {formatTime(message.timestamp)}
          </span>

          {message.evalReport && (
            <span
              data-testid={`message-eval-badge-${message.id}`}
              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                message.evalReport.passed === true
                  ? 'bg-pass/15 text-pass'
                  : message.evalReport.passed === false
                    ? 'bg-fail/15 text-fail'
                    : 'bg-warn/15 text-warn'
              }`}
            >
              {message.evalReport.passed === true ? 'PASS' : message.evalReport.passed === false ? 'FAIL' : 'N/A'}
              {' '}
              {(() => {
                const scores = Object.values(message.evalReport!.scores).filter((s): s is number => s !== null);
                if (scores.length === 0) return '';
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                return `${(avg * 100).toFixed(0)}%`;
              })()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
