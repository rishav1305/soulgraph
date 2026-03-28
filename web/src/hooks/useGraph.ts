/**
 * useGraph.ts — Core hook for WebSocket-based agent graph interaction.
 *
 * Manages:
 *   - WebSocket connection lifecycle (via WSClient)
 *   - Streaming token accumulation into ChatMessage[]
 *   - Graph state updates (active node tracking)
 *   - Eval report attachment to assistant messages
 *   - Connection status and error surfacing
 *
 * Used by App.tsx to wire ChatInterface + GraphViz.
 * Implements the UseGraphReturn contract from types.ts.
 */

import { useCallback, useRef, useState } from 'react';
import type {
  ChatMessage,
  EvalReport,
  GraphState,
  UseGraphReturn,
  WSMessage,
} from '@/lib/types';
import { DEFAULT_GRAPH_STATE } from '@/lib/types';
import { WSClient, type ConnectionStatus } from '@/lib/ws';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useGraph(sessionId: string): UseGraphReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [graphState, setGraphState] = useState<GraphState>(DEFAULT_GRAPH_STATE);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Refs to track the current streaming assistant message.
  const assistantIdRef = useRef<string | null>(null);
  const tokenBufferRef = useRef('');
  const clientRef = useRef<WSClient | null>(null);

  /**
   * Append or update the current assistant message with accumulated tokens.
   * Uses functional setState to avoid stale closure over messages.
   */
  const updateAssistantMessage = useCallback(
    (
      update: Partial<
        Pick<ChatMessage, 'content' | 'evalReport' | 'graphState' | 'documents'>
      >,
    ) => {
      const id = assistantIdRef.current;
      if (!id) return;

      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === id);
        if (idx === -1) {
          // First update — create the assistant message.
          return [
            ...prev,
            {
              id,
              role: 'assistant' as const,
              content: update.content ?? '',
              timestamp: nowISO(),
              evalReport: update.evalReport,
              graphState: update.graphState,
            },
          ];
        }
        // Subsequent updates — merge into existing message.
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx]!,
          ...update,
        };
        return updated;
      });
    },
    [],
  );

  /** Handle a single WSMessage from the server. */
  const handleMessage = useCallback(
    (msg: WSMessage) => {
      switch (msg.type) {
        case 'token': {
          tokenBufferRef.current += msg.content;
          updateAssistantMessage({ content: tokenBufferRef.current });

          // Infer active node from streaming state.
          // While tokens are flowing, the RAG agent is active.
          setGraphState((prev) => ({
            ...prev,
            activeNode: 'rag',
          }));
          break;
        }

        case 'documents': {
          updateAssistantMessage({ documents: msg.documents });
          break;
        }

        case 'eval': {
          const report = msg.report as EvalReport;
          updateAssistantMessage({ evalReport: report });

          // Evaluator is processing.
          setGraphState((prev) => ({
            ...prev,
            activeNode: 'evaluator',
          }));
          break;
        }

        case 'done': {
          // Finalize the assistant message with the complete answer.
          tokenBufferRef.current = msg.answer;
          updateAssistantMessage({ content: msg.answer });

          // Stream complete — reset graph state.
          setStreaming(false);
          setGraphState((prev) => ({
            ...prev,
            activeNode: null,
          }));
          break;
        }

        case 'error': {
          setError(msg.message);
          setStreaming(false);
          setGraphState((prev) => ({
            ...prev,
            activeNode: null,
          }));
          break;
        }
      }
    },
    [updateAssistantMessage],
  );

  /** Send a question to the agent graph via WebSocket. */
  const send = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || streaming) return;

      // Clear any previous error.
      setError(null);

      // Add user message to the conversation.
      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        timestamp: nowISO(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Prepare assistant message slot.
      assistantIdRef.current = generateId();
      tokenBufferRef.current = '';
      setStreaming(true);

      // Set graph to supervisor (routing phase).
      setGraphState((prev) => ({
        ...prev,
        activeNode: 'supervisor',
        intent: trimmed,
      }));

      // Create or reuse WSClient.
      if (!clientRef.current) {
        clientRef.current = new WSClient({
          onMessage: handleMessage,
          onStatusChange: setConnectionStatus,
          onError: (err) => {
            setError(err);
            setStreaming(false);
          },
          maxReconnects: 3,
        });
      }

      clientRef.current.send({
        question: trimmed,
        session_id: sessionId,
      });
    },
    [sessionId, streaming, handleMessage],
  );

  /** Cancel the current streaming query. */
  const cancel = useCallback(() => {
    clientRef.current?.close();
    setStreaming(false);
    setGraphState((prev) => ({
      ...prev,
      activeNode: null,
    }));
  }, []);

  return {
    messages,
    streaming,
    send,
    cancel,
    graphState,
    connectionStatus,
    error,
  };
}
