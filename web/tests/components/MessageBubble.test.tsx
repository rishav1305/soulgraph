/**
 * MessageBubble.test.tsx — Unit tests for the chat message bubble component.
 *
 * Tests:
 * - Rendering: avatar, content, timestamp, role label
 * - User messages: right alignment cue, "You" label
 * - Assistant messages: left alignment cue, "SoulGraph" label, Soul diamond avatar
 * - Streaming: cursor indicator on active assistant message
 * - Eval badge: pass/fail/null compact badge in footer
 * - Markdown: content rendered via react-markdown
 *
 * Owner: Stark (C9) | Sprint Day 2
 */

import { describe, it, expect } from 'vitest';
import MessageBubble from '@/components/MessageBubble';
import { render, screen } from '../helpers/render';
import {
  createChatMessage,
  createUserMessage,
  createAssistantMessage,
  createEvalReport,
  createFailedEvalReport,
} from '../helpers/factories';

// ─── Rendering Basics ─────────────────────────────────────────

describe('MessageBubble — Rendering', () => {
  it('renders without crashing', () => {
    const msg = createChatMessage();
    render(<MessageBubble message={msg} />);
    expect(screen.getByTestId(`message-bubble-${msg.id}`)).toBeInTheDocument();
  });

  it('renders message content', () => {
    const msg = createChatMessage({ content: 'Hello world' });
    render(<MessageBubble message={msg} />);
    const content = screen.getByTestId(`message-content-${msg.id}`);
    expect(content).toHaveTextContent('Hello world');
  });

  it('renders timestamp', () => {
    const msg = createChatMessage();
    render(<MessageBubble message={msg} />);
    expect(screen.getByTestId(`message-time-${msg.id}`)).toBeInTheDocument();
  });

  it('renders avatar', () => {
    const msg = createChatMessage();
    render(<MessageBubble message={msg} />);
    expect(screen.getByTestId(`message-avatar-${msg.id}`)).toBeInTheDocument();
  });
});

// ─── User Messages ────────────────────────────────────────────

describe('MessageBubble — User Messages', () => {
  it('shows "You" label for user messages', () => {
    const msg = createUserMessage('Hello');
    render(<MessageBubble message={msg} />);
    const bubble = screen.getByTestId(`message-bubble-${msg.id}`);
    expect(bubble).toHaveTextContent('You');
  });

  it('renders user content as plain text', () => {
    const msg = createUserMessage('What is RAG?');
    render(<MessageBubble message={msg} />);
    expect(screen.getByTestId(`message-content-${msg.id}`)).toHaveTextContent('What is RAG?');
  });

  it('has flex-row-reverse class for right alignment', () => {
    const msg = createUserMessage('Test');
    render(<MessageBubble message={msg} />);
    const bubble = screen.getByTestId(`message-bubble-${msg.id}`);
    expect(bubble.className).toContain('flex-row-reverse');
  });
});

// ─── Assistant Messages ───────────────────────────────────────

describe('MessageBubble — Assistant Messages', () => {
  it('shows "SoulGraph" label for assistant messages', () => {
    const msg = createAssistantMessage('RAG combines retrieval with generation.');
    render(<MessageBubble message={msg} />);
    const bubble = screen.getByTestId(`message-bubble-${msg.id}`);
    expect(bubble).toHaveTextContent('SoulGraph');
  });

  it('has flex-row class for left alignment', () => {
    const msg = createAssistantMessage('Test');
    render(<MessageBubble message={msg} />);
    const bubble = screen.getByTestId(`message-bubble-${msg.id}`);
    expect(bubble.className).toContain('flex-row');
    expect(bubble.className).not.toContain('flex-row-reverse');
  });

  it('renders Soul diamond avatar for assistant', () => {
    const msg = createAssistantMessage('Test');
    render(<MessageBubble message={msg} />);
    const avatar = screen.getByTestId(`message-avatar-${msg.id}`);
    // Diamond character ◆
    expect(avatar.textContent).toContain('\u25C6');
  });
});

// ─── Streaming State ──────────────────────────────────────────

describe('MessageBubble — Streaming', () => {
  it('shows streaming cursor on active assistant message', () => {
    const msg = createAssistantMessage('Partial answer...');
    render(<MessageBubble message={msg} isStreaming />);
    const content = screen.getByTestId(`message-content-${msg.id}`);
    const cursor = content.querySelector('.streaming-cursor');
    expect(cursor).not.toBeNull();
  });

  it('does not show streaming cursor when not streaming', () => {
    const msg = createAssistantMessage('Complete answer.');
    render(<MessageBubble message={msg} isStreaming={false} />);
    const content = screen.getByTestId(`message-content-${msg.id}`);
    const cursor = content.querySelector('.streaming-cursor');
    expect(cursor).toBeNull();
  });

  it('shows pulse animation on avatar when streaming', () => {
    const msg = createAssistantMessage('Streaming...');
    render(<MessageBubble message={msg} isStreaming />);
    const avatar = screen.getByTestId(`message-avatar-${msg.id}`);
    const diamond = avatar.querySelector('.animate-pulse-soul');
    expect(diamond).not.toBeNull();
  });

  it('does not show pulse animation on user message avatar', () => {
    const msg = createUserMessage('Hello');
    render(<MessageBubble message={msg} isStreaming />);
    const avatar = screen.getByTestId(`message-avatar-${msg.id}`);
    const diamond = avatar.querySelector('.animate-pulse-soul');
    expect(diamond).toBeNull();
  });
});

// ─── Eval Badge ───────────────────────────────────────────────

describe('MessageBubble — Eval Badge', () => {
  it('shows PASS badge when evalReport passed', () => {
    const msg = createAssistantMessage('Answer');
    msg.evalReport = createEvalReport({ passed: true });
    render(<MessageBubble message={msg} />);
    const badge = screen.getByTestId(`message-eval-badge-${msg.id}`);
    expect(badge).toHaveTextContent('PASS');
  });

  it('shows FAIL badge when evalReport failed', () => {
    const msg = createAssistantMessage('Bad answer');
    msg.evalReport = createFailedEvalReport();
    render(<MessageBubble message={msg} />);
    const badge = screen.getByTestId(`message-eval-badge-${msg.id}`);
    expect(badge).toHaveTextContent('FAIL');
  });

  it('shows N/A badge when evalReport.passed is null', () => {
    const msg = createAssistantMessage('Ambiguous');
    msg.evalReport = createEvalReport({ passed: null });
    render(<MessageBubble message={msg} />);
    const badge = screen.getByTestId(`message-eval-badge-${msg.id}`);
    expect(badge).toHaveTextContent('N/A');
  });

  it('does not show eval badge when no evalReport', () => {
    const msg = createAssistantMessage('No eval');
    render(<MessageBubble message={msg} />);
    expect(screen.queryByTestId(`message-eval-badge-${msg.id}`)).not.toBeInTheDocument();
  });

  it('shows average percentage in eval badge', () => {
    const msg = createAssistantMessage('Answer');
    msg.evalReport = createEvalReport({
      scores: {
        faithfulness: 0.92,
        answer_relevancy: 0.88,
        context_precision: 0.85,
        context_recall: 0.9,
      },
      passed: true,
    });
    render(<MessageBubble message={msg} />);
    const badge = screen.getByTestId(`message-eval-badge-${msg.id}`);
    // Average: (0.92 + 0.88 + 0.85 + 0.9) / 4 = 0.8875 → 89%
    expect(badge).toHaveTextContent('89%');
  });
});

// ─── Edge Cases ───────────────────────────────────────────────

describe('MessageBubble — Edge Cases', () => {
  it('renders empty content gracefully', () => {
    const msg = createChatMessage({ content: '' });
    render(<MessageBubble message={msg} />);
    expect(screen.getByTestId(`message-bubble-${msg.id}`)).toBeInTheDocument();
  });

  it('renders long content without overflow', () => {
    const longContent = 'A'.repeat(1000);
    const msg = createAssistantMessage(longContent);
    render(<MessageBubble message={msg} />);
    expect(screen.getByTestId(`message-content-${msg.id}`)).toHaveTextContent(longContent);
  });

  it('defaults isStreaming to false', () => {
    const msg = createAssistantMessage('Test');
    render(<MessageBubble message={msg} />);
    const content = screen.getByTestId(`message-content-${msg.id}`);
    const cursor = content.querySelector('.streaming-cursor');
    expect(cursor).toBeNull();
  });
});
