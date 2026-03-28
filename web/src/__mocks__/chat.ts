/**
 * Mock data for chat components (C1-C5).
 * Pure static data — no hooks, no WS.
 */

import type { ChatMessage, Session, EvalReport } from '@/lib/types';

// ── Mock eval report ──

export const mockEvalReport: EvalReport = {
  question: 'What is the capital of France?',
  answer_length: 142,
  num_documents: 4,
  scores: {
    faithfulness: 0.92,
    answer_relevancy: 0.88,
    context_precision: 0.85,
    context_recall: 0.78,
  },
  passed: true,
  threshold: 0.7,
};

export const mockFailedEvalReport: EvalReport = {
  question: 'Explain quantum entanglement in detail.',
  answer_length: 89,
  num_documents: 2,
  scores: {
    faithfulness: 0.45,
    answer_relevancy: 0.62,
    context_precision: 0.38,
    context_recall: 0.51,
  },
  passed: false,
  threshold: 0.7,
};

// ── Mock messages ──

export const mockMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'What is the capital of France?',
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content:
      'The capital of France is **Paris**. It is the largest city in France and serves as the country\'s political, economic, and cultural center. Paris is located in the north-central part of France along the Seine River.\n\nKey facts about Paris:\n- Population: ~2.1 million (city proper)\n- Known as the "City of Light" (*La Ville Lumière*)\n- Home to landmarks like the Eiffel Tower, Louvre Museum, and Notre-Dame Cathedral',
    timestamp: new Date(Date.now() - 115000).toISOString(),
    evalReport: mockEvalReport,
  },
  {
    id: 'msg-3',
    role: 'user',
    content: 'How does the RAG pipeline retrieve relevant documents?',
    timestamp: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: 'msg-4',
    role: 'assistant',
    content:
      'The RAG (Retrieval-Augmented Generation) pipeline in SoulGraph works through several steps:\n\n1. **Query embedding**: The user\'s question is converted into a vector using an embedding model\n2. **Similarity search**: ChromaDB performs approximate nearest-neighbor search against the document store\n3. **Context assembly**: Top-k documents (controlled by `rag_k` parameter) are retrieved and concatenated\n4. **Generation**: The LLM generates an answer using the retrieved context\n\n```python\n# Simplified retrieval flow\ndocs = chroma_client.query(\n    query_texts=[question],\n    n_results=tuner.get_params().rag_k\n)\n```\n\nThe evaluator agent then scores the response on faithfulness, relevancy, and context quality.',
    timestamp: new Date(Date.now() - 55000).toISOString(),
    evalReport: mockFailedEvalReport,
  },
];

export const mockStreamingMessage: ChatMessage = {
  id: 'msg-streaming',
  role: 'assistant',
  content: 'The RAG pipeline retrieves documents by first embedding the query into a vector space, then performing',
  timestamp: new Date().toISOString(),
};

export const mockEmptyMessages: ChatMessage[] = [];

// ── Mock sessions ──

export const mockSessions: Session[] = [
  {
    id: 'session-1',
    label: 'France capital question',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    last_message: 'How does the RAG pipeline retrieve relevant documents?',
  },
  {
    id: 'session-2',
    label: 'Quantum physics discussion',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    last_message: 'Explain quantum entanglement in detail.',
  },
  {
    id: 'session-3',
    label: 'SoulGraph architecture',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    last_message: 'How does the supervisor route queries?',
  },
];

export const mockEmptySessions: Session[] = [];
