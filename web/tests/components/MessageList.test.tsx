/**
 * MessageList.test.tsx — Unit tests for the scrollable message list component.
 *
 * Tests:
 * - Rendering: message list container, message bubbles
 * - Empty state: diamond icon + prompt text
 * - Message rendering: each message rendered as MessageBubble
 * - Streaming flag: last assistant message gets isStreaming
 * - Edge cases: single message, mixed roles, many messages
 *
 * Owner: Stark (C9) | Sprint Day 2
 */

import { describe, it, expect } from 'vitest';
import MessageList from '@/components/MessageList';
import { render, screen } from '../helpers/render';
import {
  createUserMessage,
  createAssistantMessage,
  resetFactoryCounters,
} from '../helpers/factories';
import type { ChatMessage } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────

function renderMessageList(messages: ChatMessage[], streaming = false) {
  return render(<MessageList messages={messages} streaming={streaming} />);
}

// ─── Empty State ──────────────────────────────────────────────

describe('MessageList — Empty State', () => {
  it('renders empty state when no messages', () => {
    renderMessageList([]);
    expect(screen.getByTestId('message-list-empty')).toBeInTheDocument();
  });

  it('shows SoulGraph title in empty state', () => {
    renderMessageList([]);
    expect(screen.getByText('SoulGraph')).toBeInTheDocument();
  });

  it('shows instruction text in empty state', () => {
    renderMessageList([]);
    expect(screen.getByText(/ask a question to get started/i)).toBeInTheDocument();
  });

  it('does not show message-list container when empty', () => {
    renderMessageList([]);
    expect(screen.queryByTestId('message-list')).not.toBeInTheDocument();
  });
});

// ─── Message Rendering ───────────────────────────────────────

describe('MessageList — Message Rendering', () => {
  it('renders message list container when messages exist', () => {
    const messages = [createUserMessage('Hello')];
    renderMessageList(messages);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
  });

  it('renders each message as a MessageBubble', () => {
    resetFactoryCounters();
    const messages = [
      createUserMessage('Hello'),
      createAssistantMessage('Hi there!'),
    ];
    renderMessageList(messages);
    expect(screen.getByTestId(`message-bubble-${messages[0]!.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`message-bubble-${messages[1]!.id}`)).toBeInTheDocument();
  });

  it('renders correct number of message bubbles', () => {
    resetFactoryCounters();
    const messages = [
      createUserMessage('Q1'),
      createAssistantMessage('A1'),
      createUserMessage('Q2'),
      createAssistantMessage('A2'),
    ];
    renderMessageList(messages);
    messages.forEach((msg) => {
      expect(screen.getByTestId(`message-bubble-${msg.id}`)).toBeInTheDocument();
    });
  });

  it('does not show empty state when messages exist', () => {
    renderMessageList([createUserMessage('Hello')]);
    expect(screen.queryByTestId('message-list-empty')).not.toBeInTheDocument();
  });
});

// ─── Streaming Flag ───────────────────────────────────────────

describe('MessageList — Streaming Flag', () => {
  it('passes isStreaming to last assistant message when streaming', () => {
    resetFactoryCounters();
    const messages = [
      createUserMessage('Question'),
      createAssistantMessage('Streaming answer...'),
    ];
    renderMessageList(messages, true);

    // Last assistant message should have streaming cursor
    const lastBubble = screen.getByTestId(`message-content-${messages[1]!.id}`);
    const cursor = lastBubble.querySelector('.streaming-cursor');
    expect(cursor).not.toBeNull();
  });

  it('does not show streaming cursor when not streaming', () => {
    resetFactoryCounters();
    const messages = [
      createUserMessage('Question'),
      createAssistantMessage('Complete answer'),
    ];
    renderMessageList(messages, false);

    const lastBubble = screen.getByTestId(`message-content-${messages[1]!.id}`);
    const cursor = lastBubble.querySelector('.streaming-cursor');
    expect(cursor).toBeNull();
  });

  it('only last assistant message gets streaming cursor', () => {
    resetFactoryCounters();
    const messages = [
      createUserMessage('Q1'),
      createAssistantMessage('A1 complete'),
      createUserMessage('Q2'),
      createAssistantMessage('A2 streaming...'),
    ];
    renderMessageList(messages, true);

    // First assistant message should NOT have cursor
    const firstAssistant = screen.getByTestId(`message-content-${messages[1]!.id}`);
    expect(firstAssistant.querySelector('.streaming-cursor')).toBeNull();

    // Last assistant message SHOULD have cursor
    const lastAssistant = screen.getByTestId(`message-content-${messages[3]!.id}`);
    expect(lastAssistant.querySelector('.streaming-cursor')).not.toBeNull();
  });

  it('does not give streaming flag to user message even if last', () => {
    resetFactoryCounters();
    const messages = [
      createAssistantMessage('Hello'),
      createUserMessage('Question'),
    ];
    renderMessageList(messages, true);

    // User message should NOT have streaming cursor
    const userContent = screen.getByTestId(`message-content-${messages[1]!.id}`);
    expect(userContent.querySelector('.streaming-cursor')).toBeNull();
  });
});

// ─── Edge Cases ───────────────────────────────────────────────

describe('MessageList — Edge Cases', () => {
  it('renders single message', () => {
    const messages = [createUserMessage('Solo message')];
    renderMessageList(messages);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId(`message-bubble-${messages[0]!.id}`)).toBeInTheDocument();
  });

  it('renders many messages', () => {
    resetFactoryCounters();
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 20; i++) {
      messages.push(
        i % 2 === 0
          ? createUserMessage(`Question ${i}`)
          : createAssistantMessage(`Answer ${i}`),
      );
    }
    renderMessageList(messages);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    // Spot check first and last
    expect(screen.getByTestId(`message-bubble-${messages[0]!.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`message-bubble-${messages[19]!.id}`)).toBeInTheDocument();
  });
});
