/**
 * Smoke test — verifies the test infrastructure works end-to-end.
 *
 * If this test passes, the scaffold is ready:
 * - vitest runs
 * - jsdom environment works
 * - @testing-library/jest-dom matchers are available
 * - Type imports from @/lib/types resolve
 * - Mock factories produce valid typed objects
 * - MockWebSocket installs and delivers messages
 */

import { describe, it, expect, afterEach } from 'vitest';
import type { ChatMessage, WSMessage } from '@/lib/types';
import {
  createChatMessage,
  createEvalReport,
  createGraphState,
  createSession,
  createTunerStatus,
  resetFactoryCounters,
} from './factories';
import {
  installMockWebSocket,
  scenarios,
  flushMicrotasks,
} from './mock-ws';

afterEach(() => {
  resetFactoryCounters();
});

describe('Test Infrastructure Smoke Test', () => {
  it('vitest runs with jsdom environment', () => {
    expect(document).toBeDefined();
    expect(window).toBeDefined();
  });

  it('jest-dom matchers are available', () => {
    const div = document.createElement('div');
    div.textContent = 'Hello';
    document.body.appendChild(div);
    expect(div).toBeInTheDocument();
    expect(div).toHaveTextContent('Hello');
    document.body.removeChild(div);
  });

  it('type imports resolve from @/lib/types', () => {
    const msg: ChatMessage = {
      id: '1',
      role: 'user',
      content: 'test',
      timestamp: new Date().toISOString(),
    };
    expect(msg.role).toBe('user');
  });

  it('WSMessage discriminated union types check', () => {
    const token: WSMessage = { type: 'token', content: 'hello ' };
    const done: WSMessage = { type: 'done', answer: 'hello world' };
    const error: WSMessage = { type: 'error', message: 'oops' };
    const evalMsg: WSMessage = {
      type: 'eval',
      report: createEvalReport(),
    };

    expect(token.type).toBe('token');
    expect(done.type).toBe('done');
    expect(error.type).toBe('error');
    expect(evalMsg.type).toBe('eval');
  });
});

describe('Mock Data Factories', () => {
  it('createChatMessage returns valid ChatMessage', () => {
    const msg = createChatMessage();
    expect(msg.id).toBeTruthy();
    expect(msg.role).toBe('assistant');
    expect(msg.content).toBeTruthy();
    expect(msg.timestamp).toBeTruthy();
  });

  it('createChatMessage accepts overrides', () => {
    const msg = createChatMessage({ role: 'user', content: 'Hello' });
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
  });

  it('createChatMessage generates unique IDs', () => {
    const msg1 = createChatMessage();
    const msg2 = createChatMessage();
    expect(msg1.id).not.toBe(msg2.id);
  });

  it('createEvalReport returns valid EvalReport', () => {
    const report = createEvalReport();
    expect(report.question).toBeTruthy();
    expect(report.scores).toBeDefined();
    expect(report.passed).toBe(true);
    expect(report.threshold).toBe(0.7);
  });

  it('createEvalReport accepts score overrides', () => {
    const report = createEvalReport({
      passed: false,
      scores: { faithfulness: 0.3 },
    });
    expect(report.passed).toBe(false);
    expect(report.scores.faithfulness).toBe(0.3);
  });

  it('createGraphState returns valid default graph', () => {
    const state = createGraphState();
    expect(state.nodes).toHaveLength(4);
    expect(state.nodes).toContain('supervisor');
    expect(state.nodes).toContain('rag');
    expect(state.edges.length).toBeGreaterThan(0);
    expect(state.activeNode).toBeNull();
  });

  it('createSession generates unique IDs', () => {
    const s1 = createSession();
    const s2 = createSession();
    expect(s1.id).not.toBe(s2.id);
  });

  it('createTunerStatus returns valid defaults', () => {
    const status = createTunerStatus();
    expect(status.params.rag_k).toBe(5);
    expect(status.params.eval_threshold).toBe(0.7);
    expect(status.history).toEqual([]);
  });
});

describe('MockWebSocket', () => {
  let mockInstall: ReturnType<typeof installMockWebSocket>;

  afterEach(() => {
    mockInstall?.restore();
  });

  it('installs and replaces global WebSocket', () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const ws = new WebSocket('ws://localhost:8080/ws/query');
    expect(mockInstall.instances).toHaveLength(1);
    expect(ws).toBe(mockInstall.getInstance());
  });

  it('connects and opens asynchronously', async () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    const ws = new WebSocket('ws://localhost:8080/ws/query');

    // Before flush: still connecting
    expect((ws as any).readyState).toBe(0); // CONNECTING

    await flushMicrotasks();

    // After flush: open
    expect((ws as any).readyState).toBe(1); // OPEN
  });

  it('records sent messages', async () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    // Create instance via constructor (or use existing)
    if (!mockInstall.getInstance()) {
      new WebSocket('ws://localhost:8080/ws/query');
    }

    await flushMicrotasks(); // wait for open

    const instance = mockInstall.getInstance()!;
    instance.send(JSON.stringify({ question: 'What is RAG?', session_id: 'test' }));

    expect(instance.sentMessages).toHaveLength(1);
    expect(instance.receivedMessages).toHaveLength(1);
    expect(instance.receivedMessages[0]).toEqual({
      question: 'What is RAG?',
      session_id: 'test',
    });
  });

  it('streams happy path: tokens + eval + done', async () => {
    mockInstall = installMockWebSocket(scenarios.happyPath);
    new WebSocket('ws://localhost:8080/ws/query');
    const instance = mockInstall.getInstance()!;

    await flushMicrotasks();

    // Collect messages via onmessage
    const received: WSMessage[] = [];
    instance.onmessage = (event: MessageEvent) => {
      received.push(JSON.parse(event.data as string));
    };

    instance.send(JSON.stringify({ question: 'test', session_id: 's1' }));
    await instance.streamAllMessages();

    // Verify message types in order
    const types = received.map((m) => m.type);
    const tokenCount = types.filter((t) => t === 'token').length;
    const evalIndex = types.indexOf('eval');
    const doneIndex = types.indexOf('done');

    expect(tokenCount).toBeGreaterThan(0);
    expect(types).toContain('eval');
    expect(types).toContain('done');
    // eval comes after all tokens
    expect(evalIndex).toBeGreaterThan(tokenCount - 1);
    // done comes last
    expect(doneIndex).toBe(types.length - 1);
  });

  it('streams error scenario', async () => {
    mockInstall = installMockWebSocket(scenarios.emptyQuestion);
    new WebSocket('ws://localhost:8080/ws/query');
    const instance = mockInstall.getInstance()!;

    await flushMicrotasks();

    const received: WSMessage[] = [];
    instance.onmessage = (event: MessageEvent) => {
      received.push(JSON.parse(event.data as string));
    };

    const messages = await instance.streamAllMessages();

    expect(messages).toHaveLength(1);
    expect(messages[0]!.type).toBe('error');
    expect(received).toHaveLength(1);
    expect(received[0]!.type).toBe('error');
  });

  it('mid-stream disconnect closes after N tokens', async () => {
    mockInstall = installMockWebSocket(scenarios.midStreamDisconnect);
    new WebSocket('ws://localhost:8080/ws/query');
    const instance = mockInstall.getInstance()!;

    await flushMicrotasks();

    const received: WSMessage[] = [];
    instance.onmessage = (event: MessageEvent) => {
      received.push(JSON.parse(event.data as string));
    };

    const messages = await instance.streamAllMessages();

    // Should have exactly 5 tokens (disconnectAfterTokens: 5)
    expect(messages.filter((m) => m.type === 'token')).toHaveLength(5);
    // No done message — disconnected before completion
    expect(messages.some((m) => m.type === 'done')).toBe(false);
  });

  it('restore() puts back the original WebSocket', () => {
    const original = globalThis.WebSocket;
    mockInstall = installMockWebSocket(scenarios.happyPath);
    expect(globalThis.WebSocket).not.toBe(original);
    mockInstall.restore();
    expect(globalThis.WebSocket).toBe(original);
  });
});
