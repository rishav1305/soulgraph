/**
 * ChatInterface.test.tsx — Unit tests for the composed chat view.
 *
 * Tests:
 * - Rendering: contains MessageList + QueryInput
 * - Prop forwarding: messages, streaming, onSend, onCancel flow to children
 * - Empty state: shows SoulGraph prompt when no messages
 * - Streaming state: input shows cancel, message list shows cursor
 *
 * Owner: Stark (C9) | Sprint Day 2
 */

import { describe, it, expect, vi } from 'vitest';
import ChatInterface from '@/components/ChatInterface';
import { render, screen, fireEvent } from '../helpers/render';
import {
  createUserMessage,
  createAssistantMessage,
  resetFactoryCounters,
} from '../helpers/factories';
import type { ChatMessage } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────

function renderChatInterface(
  messages: ChatMessage[] = [],
  streaming = false,
  onSend = vi.fn(),
  onCancel = vi.fn(),
) {
  return {
    ...render(
      <ChatInterface
        messages={messages}
        streaming={streaming}
        onSend={onSend}
        onCancel={onCancel}
      />,
    ),
    onSend,
    onCancel,
  };
}

// ─── Rendering ────────────────────────────────────────────────

describe('ChatInterface — Rendering', () => {
  it('renders without crashing', () => {
    renderChatInterface();
    expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
  });

  it('renders QueryInput child', () => {
    renderChatInterface();
    expect(screen.getByTestId('query-input')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    renderChatInterface([]);
    expect(screen.getByTestId('message-list-empty')).toBeInTheDocument();
  });

  it('shows message list when messages exist', () => {
    const messages = [createUserMessage('Hello')];
    renderChatInterface(messages);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
  });
});

// ─── Prop Forwarding ──────────────────────────────────────────

describe('ChatInterface — Prop Forwarding', () => {
  it('forwards messages to MessageList', () => {
    resetFactoryCounters();
    const messages = [
      createUserMessage('Q1'),
      createAssistantMessage('A1'),
    ];
    renderChatInterface(messages);
    expect(screen.getByTestId(`message-bubble-${messages[0]!.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`message-bubble-${messages[1]!.id}`)).toBeInTheDocument();
  });

  it('forwards onSend to QueryInput', () => {
    const onSend = vi.fn();
    renderChatInterface([], false, onSend);

    const textarea = screen.getByTestId('query-input-textarea');
    fireEvent.change(textarea, { target: { value: 'Test question' } });
    fireEvent.click(screen.getByTestId('query-input-submit'));

    expect(onSend).toHaveBeenCalledWith('Test question');
  });

  it('forwards onCancel to QueryInput', () => {
    const onCancel = vi.fn();
    renderChatInterface([], true, vi.fn(), onCancel);

    fireEvent.click(screen.getByTestId('query-input-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('forwards streaming to QueryInput', () => {
    renderChatInterface([], true);
    // Streaming = textarea disabled + cancel button visible
    expect(screen.getByTestId('query-input-textarea')).toBeDisabled();
    expect(screen.getByTestId('query-input-cancel')).toBeInTheDocument();
  });

  it('forwards streaming to MessageList for cursor', () => {
    resetFactoryCounters();
    const messages = [
      createUserMessage('Q'),
      createAssistantMessage('Partial...'),
    ];
    renderChatInterface(messages, true);

    const lastContent = screen.getByTestId(`message-content-${messages[1]!.id}`);
    expect(lastContent.querySelector('.streaming-cursor')).not.toBeNull();
  });
});

// ─── Integrated Behavior ──────────────────────────────────────

describe('ChatInterface — Integrated Behavior', () => {
  it('idle state: submit button + enabled textarea + no cursor', () => {
    resetFactoryCounters();
    const messages = [createAssistantMessage('Done')];
    renderChatInterface(messages, false);

    expect(screen.getByTestId('query-input-submit')).toBeInTheDocument();
    expect(screen.getByTestId('query-input-textarea')).not.toBeDisabled();

    const content = screen.getByTestId(`message-content-${messages[0]!.id}`);
    expect(content.querySelector('.streaming-cursor')).toBeNull();
  });

  it('streaming state: cancel button + disabled textarea + cursor on last assistant', () => {
    resetFactoryCounters();
    const messages = [
      createUserMessage('Q'),
      createAssistantMessage('Streaming...'),
    ];
    renderChatInterface(messages, true);

    expect(screen.getByTestId('query-input-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('query-input-textarea')).toBeDisabled();

    const lastContent = screen.getByTestId(`message-content-${messages[1]!.id}`);
    expect(lastContent.querySelector('.streaming-cursor')).not.toBeNull();
  });
});
