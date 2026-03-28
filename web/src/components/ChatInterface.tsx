/**
 * ChatInterface.tsx — Composed chat view: MessageList + QueryInput.
 * C4: Happy — Sprint Day 2
 *
 * Props: ChatInterfaceProps from types.ts
 * Features:
 *   - Full-height flex column: message list fills space, input pinned to bottom
 *   - Passes streaming state to both children
 *   - Connection status bar (future: wired in Day 3 via useGraph)
 */

import type { ChatInterfaceProps } from '@/lib/types';
import MessageList from './MessageList';
import QueryInput from './QueryInput';

export default function ChatInterface({ messages, streaming, onSend, onCancel }: ChatInterfaceProps) {
  return (
    <div
      data-testid="chat-interface"
      className="flex flex-col h-full min-h-0"
    >
      {/* Message list — grows to fill available space */}
      <MessageList messages={messages} streaming={streaming} />

      {/* Input — pinned to bottom */}
      <QueryInput onSend={onSend} streaming={streaming} onCancel={onCancel} />
    </div>
  );
}
