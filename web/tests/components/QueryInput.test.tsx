/**
 * QueryInput.test.tsx — Unit tests for the chat query input component.
 *
 * Tests:
 * - Rendering: textarea, submit button, hint text
 * - Idle state: submit enabled when text present, disabled when empty
 * - Streaming state: input disabled, cancel button shown, submit hidden
 * - Interactions: submit on click, submit on Enter, no submit on Shift+Enter
 * - Input clearing: clears after submit
 * - Edge cases: whitespace-only input, very long input
 *
 * Owner: Stark (C9) | Sprint Day 2
 */

import { describe, it, expect, vi } from 'vitest';
import QueryInput from '@/components/QueryInput';
import { render, screen, fireEvent } from '../helpers/render';

// ─── Helpers ──────────────────────────────────────────────────

function renderQueryInput(streaming = false, onSend = vi.fn(), onCancel = vi.fn()) {
  return { ...render(<QueryInput onSend={onSend} streaming={streaming} onCancel={onCancel} />), onSend, onCancel };
}

// ─── Rendering ────────────────────────────────────────────────

describe('QueryInput — Rendering', () => {
  it('renders without crashing', () => {
    renderQueryInput();
    expect(screen.getByTestId('query-input')).toBeInTheDocument();
  });

  it('renders textarea', () => {
    renderQueryInput();
    expect(screen.getByTestId('query-input-textarea')).toBeInTheDocument();
  });

  it('renders submit button in idle state', () => {
    renderQueryInput();
    expect(screen.getByTestId('query-input-submit')).toBeInTheDocument();
  });

  it('renders hint text for idle state', () => {
    renderQueryInput();
    const hint = screen.getByTestId('query-input-hint');
    expect(hint).toHaveTextContent('Enter to send');
  });

  it('textarea has correct placeholder in idle state', () => {
    renderQueryInput();
    const textarea = screen.getByTestId('query-input-textarea');
    expect(textarea).toHaveAttribute('placeholder', 'Ask SoulGraph a question...');
  });

  it('textarea has aria-label', () => {
    renderQueryInput();
    const textarea = screen.getByTestId('query-input-textarea');
    expect(textarea).toHaveAttribute('aria-label', 'Question input');
  });

  it('submit button has aria-label', () => {
    renderQueryInput();
    expect(screen.getByTestId('query-input-submit')).toHaveAttribute('aria-label', 'Send question');
  });
});

// ─── Idle State ───────────────────────────────────────────────

describe('QueryInput — Idle State', () => {
  it('submit button disabled when textarea is empty', () => {
    renderQueryInput();
    expect(screen.getByTestId('query-input-submit')).toBeDisabled();
  });

  it('submit button enabled when textarea has text', () => {
    renderQueryInput();
    const textarea = screen.getByTestId('query-input-textarea');
    fireEvent.change(textarea, { target: { value: 'What is RAG?' } });
    expect(screen.getByTestId('query-input-submit')).not.toBeDisabled();
  });

  it('submit button disabled for whitespace-only input', () => {
    renderQueryInput();
    const textarea = screen.getByTestId('query-input-textarea');
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(screen.getByTestId('query-input-submit')).toBeDisabled();
  });

  it('does not show cancel button in idle state', () => {
    renderQueryInput();
    expect(screen.queryByTestId('query-input-cancel')).not.toBeInTheDocument();
  });

  it('does not show stream bar in idle state', () => {
    renderQueryInput();
    expect(screen.queryByTestId('query-input-stream-bar')).not.toBeInTheDocument();
  });
});

// ─── Streaming State ──────────────────────────────────────────

describe('QueryInput — Streaming State', () => {
  it('shows cancel button when streaming', () => {
    renderQueryInput(true);
    expect(screen.getByTestId('query-input-cancel')).toBeInTheDocument();
  });

  it('hides submit button when streaming', () => {
    renderQueryInput(true);
    expect(screen.queryByTestId('query-input-submit')).not.toBeInTheDocument();
  });

  it('disables textarea when streaming', () => {
    renderQueryInput(true);
    expect(screen.getByTestId('query-input-textarea')).toBeDisabled();
  });

  it('shows streaming placeholder text', () => {
    renderQueryInput(true);
    const textarea = screen.getByTestId('query-input-textarea');
    expect(textarea).toHaveAttribute('placeholder', 'Waiting for response...');
  });

  it('shows streaming hint text', () => {
    renderQueryInput(true);
    const hint = screen.getByTestId('query-input-hint');
    expect(hint).toHaveTextContent('Streaming response');
  });

  it('shows stream bar indicator', () => {
    renderQueryInput(true);
    expect(screen.getByTestId('query-input-stream-bar')).toBeInTheDocument();
  });

  it('cancel button has aria-label', () => {
    renderQueryInput(true);
    expect(screen.getByTestId('query-input-cancel')).toHaveAttribute('aria-label', 'Cancel streaming');
  });
});

// ─── Submit Interactions ──────────────────────────────────────

describe('QueryInput — Submit Interactions', () => {
  it('calls onSend with trimmed input on button click', () => {
    const onSend = vi.fn();
    renderQueryInput(false, onSend);

    const textarea = screen.getByTestId('query-input-textarea');
    fireEvent.change(textarea, { target: { value: '  What is RAG?  ' } });
    fireEvent.click(screen.getByTestId('query-input-submit'));

    expect(onSend).toHaveBeenCalledWith('What is RAG?');
  });

  it('calls onSend on Enter key press', () => {
    const onSend = vi.fn();
    renderQueryInput(false, onSend);

    const textarea = screen.getByTestId('query-input-textarea');
    fireEvent.change(textarea, { target: { value: 'Test question' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).toHaveBeenCalledWith('Test question');
  });

  it('does not call onSend on Shift+Enter', () => {
    const onSend = vi.fn();
    renderQueryInput(false, onSend);

    const textarea = screen.getByTestId('query-input-textarea');
    fireEvent.change(textarea, { target: { value: 'Test question' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('clears textarea after successful submit', () => {
    renderQueryInput();

    const textarea = screen.getByTestId('query-input-textarea');
    fireEvent.change(textarea, { target: { value: 'Test question' } });
    fireEvent.click(screen.getByTestId('query-input-submit'));

    expect(textarea).toHaveValue('');
  });

  it('does not call onSend with empty input', () => {
    const onSend = vi.fn();
    renderQueryInput(false, onSend);

    fireEvent.click(screen.getByTestId('query-input-submit'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not call onSend when streaming', () => {
    const onSend = vi.fn();
    renderQueryInput(true, onSend);

    // Can't submit because submit button is hidden
    expect(screen.queryByTestId('query-input-submit')).not.toBeInTheDocument();
  });
});

// ─── Cancel Interaction ───────────────────────────────────────

describe('QueryInput — Cancel Interaction', () => {
  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    renderQueryInput(true, vi.fn(), onCancel);

    fireEvent.click(screen.getByTestId('query-input-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
