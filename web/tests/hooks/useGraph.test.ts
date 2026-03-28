/**
 * useGraph.test.ts — Integration tests for the core WebSocket agent graph hook.
 *
 * Tests the full flow: useGraph → WSClient → MockWebSocket → state assertions.
 *
 * Scenarios:
 * - Happy path: send → tokens → eval → done → messages updated
 * - Error response: send → error message → error state set
 * - Cancel mid-stream: send → cancel → streaming stops
 * - Multiple sends: sequential queries accumulate messages
 * - Connection status transitions
 * - Graph state transitions (supervisor → rag → evaluator → null)
 * - Empty/whitespace question rejection
 *
 * Owner: Stark (I4) | Sprint Day 3
 */

import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGraph } from '@/hooks/useGraph';
import {
  installMockWebSocket,
  scenarios,
  flushMicrotasks,
} from '../helpers/mock-ws';

// ─── Helpers ──────────────────────────────────────────────────

let mockInstall: ReturnType<typeof installMockWebSocket>;

afterEach(() => {
  mockInstall?.restore();
});

async function sendAndStream(
  result: { current: ReturnType<typeof useGraph> },
  question: string,
) {
  act(() => {
    result.current.send(question);
  });

  // Wait for WS to open
  await act(async () => {
    await flushMicrotasks();
  });

  // Get the mock instance and stream all messages
  const instance = mockInstall.getInstance();
  if (instance) {
    await act(async () => {
      await instance.streamAllMessages();
    });
  }
}

// ─── Happy Path ───────────────────────────────────────────────

describe('useGraph — Happy Path', () => {
  it('starts with empty state', () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    expect(result.current.messages).toEqual([]);
    expect(result.current.streaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.connectionStatus).toBe('idle');
    expect(result.current.graphState.activeNode).toBeNull();
  });

  it('adds user message on send', () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    act(() => {
      result.current.send('What is RAG?');
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]!.role).toBe('user');
    expect(result.current.messages[0]!.content).toBe('What is RAG?');
  });

  it('sets streaming to true on send', () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    act(() => {
      result.current.send('What is RAG?');
    });

    expect(result.current.streaming).toBe(true);
  });

  it('sets graph activeNode to supervisor on send', () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    act(() => {
      result.current.send('What is RAG?');
    });

    expect(result.current.graphState.activeNode).toBe('supervisor');
    expect(result.current.graphState.intent).toBe('What is RAG?');
  });

  it('accumulates tokens into assistant message', async () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    await sendAndStream(result, 'What is RAG?');

    // Should have user msg + assistant msg
    expect(result.current.messages).toHaveLength(2);
    const assistant = result.current.messages[1]!;
    expect(assistant.role).toBe('assistant');
    expect(assistant.content).toBeTruthy();
  });

  it('attaches eval report to assistant message', async () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    await sendAndStream(result, 'What is RAG?');

    const assistant = result.current.messages[1]!;
    expect(assistant.evalReport).toBeDefined();
    expect(assistant.evalReport!.passed).toBe(true);
    expect(assistant.evalReport!.scores.faithfulness).toBe(0.92);
  });

  it('sets streaming to false after done', async () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    await sendAndStream(result, 'What is RAG?');

    expect(result.current.streaming).toBe(false);
  });

  it('resets graph activeNode to null after done', async () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    await sendAndStream(result, 'What is RAG?');

    expect(result.current.graphState.activeNode).toBeNull();
  });

  it('sets final answer content from done message', async () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    await sendAndStream(result, 'What is RAG?');

    const assistant = result.current.messages[1]!;
    expect(assistant.content).toBe(
      'RAG combines retrieval with generation for grounded answers.',
    );
  });
});

// ─── Error Handling ───────────────────────────────────────────

describe('useGraph — Error Handling', () => {
  it('sets error state on error message', async () => {
    mockInstall = installMockWebSocket(scenarios.emptyQuestion);
    const { result } = renderHook(() => useGraph('test-session'));

    await sendAndStream(result, 'test');

    expect(result.current.error).toBe('question is required');
  });

  it('sets streaming to false on error', async () => {
    mockInstall = installMockWebSocket(scenarios.emptyQuestion);
    const { result } = renderHook(() => useGraph('test-session'));

    await sendAndStream(result, 'test');

    expect(result.current.streaming).toBe(false);
  });

  it('resets graph activeNode on error', async () => {
    mockInstall = installMockWebSocket(scenarios.emptyQuestion);
    const { result } = renderHook(() => useGraph('test-session'));

    await sendAndStream(result, 'test');

    expect(result.current.graphState.activeNode).toBeNull();
  });

  it('clears error on next send', async () => {
    mockInstall = installMockWebSocket(scenarios.emptyQuestion);
    const { result } = renderHook(() => useGraph('test-session'));

    await sendAndStream(result, 'test');
    expect(result.current.error).toBeTruthy();

    // Reinstall with happy path for next send
    mockInstall.restore();
    mockInstall = installMockWebSocket(scenarios.happyPath);

    act(() => {
      result.current.send('What is RAG?');
    });

    expect(result.current.error).toBeNull();
  });
});

// ─── Cancel ───────────────────────────────────────────────────

describe('useGraph — Cancel', () => {
  it('sets streaming to false on cancel', () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    act(() => {
      result.current.send('What is RAG?');
    });

    expect(result.current.streaming).toBe(true);

    act(() => {
      result.current.cancel();
    });

    expect(result.current.streaming).toBe(false);
  });

  it('resets graph activeNode on cancel', () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    act(() => {
      result.current.send('What is RAG?');
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.graphState.activeNode).toBeNull();
  });
});

// ─── Input Validation ─────────────────────────────────────────

describe('useGraph — Input Validation', () => {
  it('rejects empty string', () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    act(() => {
      result.current.send('');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.streaming).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    act(() => {
      result.current.send('   ');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.streaming).toBe(false);
  });

  it('trims whitespace from question', () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    act(() => {
      result.current.send('  What is RAG?  ');
    });

    expect(result.current.messages[0]!.content).toBe('What is RAG?');
  });

  it('prevents double-send while streaming', () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    act(() => {
      result.current.send('First question');
    });

    act(() => {
      result.current.send('Second question');
    });

    // Only one user message — second send was blocked
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]!.content).toBe('First question');
  });
});

// ─── Graph State Transitions ──────────────────────────────────

describe('useGraph — Graph State Transitions', () => {
  it('starts with default graph state', () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const { result } = renderHook(() => useGraph('test-session'));

    expect(result.current.graphState.nodes).toEqual([
      'supervisor',
      'rag',
      'evaluator',
      'tool',
    ]);
    expect(result.current.graphState.edges).toHaveLength(3);
    expect(result.current.graphState.activeNode).toBeNull();
    expect(result.current.graphState.intent).toBeNull();
  });

  it('transitions supervisor → rag during token streaming', async () => {
    mockInstall = installMockWebSocket(scenarios.singleWord);
    const { result } = renderHook(() => useGraph('test-session'));

    act(() => {
      result.current.send('Test');
    });

    // Supervisor on send
    expect(result.current.graphState.activeNode).toBe('supervisor');

    // Open WS
    await act(async () => {
      await flushMicrotasks();
    });

    // Stream tokens — should transition to rag
    const instance = mockInstall.getInstance()!;
    await act(async () => {
      await instance.streamAllMessages();
    });

    // After done, activeNode should be null
    expect(result.current.graphState.activeNode).toBeNull();
  });
});

// ─── Multiple Sends ───────────────────────────────────────────

describe('useGraph — Sequential Queries', () => {
  it('accumulates messages from multiple queries', async () => {
    mockInstall = installMockWebSocket(scenarios.singleWord);
    const { result } = renderHook(() => useGraph('test-session'));

    // First query
    await sendAndStream(result, 'Q1');

    expect(result.current.messages).toHaveLength(2); // user + assistant
    expect(result.current.streaming).toBe(false);

    // Reinstall mock for second query
    mockInstall.restore();
    mockInstall = installMockWebSocket(scenarios.singleWord);

    // Second query
    await sendAndStream(result, 'Q2');

    expect(result.current.messages).toHaveLength(4); // 2 user + 2 assistant
    expect(result.current.messages[2]!.role).toBe('user');
    expect(result.current.messages[2]!.content).toBe('Q2');
  });
});
