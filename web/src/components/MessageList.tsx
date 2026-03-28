/**
 * MessageList.tsx — Scrollable message list with auto-scroll.
 * C3: Happy — Sprint Day 2
 *
 * Props: MessageListProps from types.ts
 * Features:
 *   - Scrollable container with overflow-y-auto
 *   - Auto-scroll to bottom on new messages / streaming
 *   - Empty state with diamond icon + prompt
 *   - Renders MessageBubble for each message
 *   - Last assistant message gets isStreaming flag
 */

import { useRef, useEffect } from 'react';
import type { MessageListProps } from '@/lib/types';
import MessageBubble from './MessageBubble';

export default function MessageList({ messages, streaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // Empty state
  if (messages.length === 0) {
    return (
      <div
        data-testid="message-list-empty"
        className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center"
      >
        <div className="relative">
          <span className="absolute inset-0 -m-3 bg-soul/10 rounded-full blur-xl animate-soul-pulse pointer-events-none" />
          <span className="relative text-5xl text-soul drop-shadow-[0_0_12px_var(--color-soul)]">&#9670;</span>
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-fg mb-1">SoulGraph</h2>
          <p className="text-sm text-fg-secondary max-w-sm">
            Ask a question to get started. SoulGraph will retrieve relevant documents,
            generate an answer, and evaluate its quality.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="message-list"
      className="flex-1 overflow-y-auto px-4 py-4"
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        {messages.map((msg, idx) => {
          // Last assistant message during streaming gets the streaming flag
          const isLastAssistant =
            streaming &&
            msg.role === 'assistant' &&
            idx === messages.length - 1;

          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={isLastAssistant}
            />
          );
        })}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </div>
  );
}
