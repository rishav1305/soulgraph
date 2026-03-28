/**
 * mock-ws.ts — Combined HTTP + WebSocket mock server for SoulGraph.
 *
 * Serves all four endpoints the frontend needs:
 *   GET  /health        → { status: 'ok', version: '0.2.0' }
 *   POST /query         → synchronous JSON response
 *   GET  /tune/status   → tuner params + eval history
 *   POST /tune/reset    → reset tuner state
 *   WS   /ws/query      → streaming token → eval → done
 *
 * Run:   npx tsx scripts/mock-ws.ts
 * Or:    npm run mock-ws
 *
 * This eliminates the Docker dependency for local development.
 * All responses match soulgraph/api.py contracts exactly.
 */

import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = 8080;
const TOKEN_DELAY_MS = 50; // ms between streamed tokens

// ─────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────

const MOCK_ANSWERS: Record<string, string> = {
  default:
    'The Battle of Thermopylae was fought in 480 BC between an alliance of Greek city-states led by King Leonidas I of Sparta and the Achaemenid Empire of Xerxes I. It took place at the narrow coastal pass of Thermopylae. The Greek force of approximately 7,000 men held the pass for three days against a Persian army numbering in the tens of thousands.',
  hello:
    'Hello! I am SoulGraph, a multi-agent RAG system with evaluation. I can answer questions by retrieving relevant documents and evaluating the quality of my responses using RAGAS metrics.',
  soulgraph:
    'SoulGraph is a batteries-included LangGraph multi-agent service. It uses a supervisor pattern to route queries through specialized agents: a RAG agent for document retrieval and answer generation, an evaluator agent for RAGAS quality metrics, and a tool agent for calculations. State flows through Redis, documents live in ChromaDB, and tracing goes to LangFuse.',
};

function getAnswer(question: string): string {
  const lower = question.toLowerCase().trim();
  for (const [key, answer] of Object.entries(MOCK_ANSWERS)) {
    if (lower.includes(key)) return answer;
  }
  return MOCK_ANSWERS.default;
}

function makeEvalReport(question: string, answer: string) {
  return {
    question,
    answer_length: answer.length,
    num_documents: 4,
    scores: {
      faithfulness: +(0.7 + Math.random() * 0.3).toFixed(4),
      answer_relevancy: +(0.75 + Math.random() * 0.25).toFixed(4),
      context_precision: +(0.65 + Math.random() * 0.35).toFixed(4),
      context_recall: +(0.7 + Math.random() * 0.3).toFixed(4),
    },
    passed: true,
    threshold: 0.7,
  };
}

const MOCK_TUNER_STATUS = {
  params: {
    rag_k: 5,
    eval_threshold: 0.7,
    prefer_reasoning_model: false,
  },
  history: [
    {
      faithfulness: 0.85,
      answer_relevancy: 0.92,
      context_precision: 0.78,
      context_recall: 0.88,
      passed: true,
    },
    {
      faithfulness: 0.72,
      answer_relevancy: 0.81,
      context_precision: 0.69,
      context_recall: 0.75,
      passed: true,
    },
    {
      faithfulness: 0.91,
      answer_relevancy: 0.88,
      context_precision: 0.84,
      context_recall: 0.93,
      passed: true,
    },
  ],
  adjustments: [],
};

// ─────────────────────────────────────────────────────────────
// HTTP Server (REST endpoints)
// ─────────────────────────────────────────────────────────────

function sendJSON(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    sendJSON(res, 204, null);
    return;
  }

  // GET /health
  if (url === '/health' && method === 'GET') {
    sendJSON(res, 200, { status: 'ok', version: '0.2.0-mock' });
    return;
  }

  // POST /query
  if (url === '/query' && method === 'POST') {
    try {
      const raw = await readBody(req);
      const data = JSON.parse(raw) as { question?: string; session_id?: string };
      const question = data.question ?? '';
      const sessionId = data.session_id ?? 'default';

      if (!question) {
        sendJSON(res, 400, { error: 'question is required' });
        return;
      }

      if (question.toLowerCase() === 'error') {
        sendJSON(res, 503, {
          error: 'Service temporarily unavailable',
          detail: 'Simulated backend error for testing',
        });
        return;
      }

      const answer = getAnswer(question);
      sendJSON(res, 200, {
        answer,
        eval_report: makeEvalReport(question, answer),
        session_id: sessionId,
      });
    } catch {
      sendJSON(res, 400, { error: 'Invalid JSON body' });
    }
    return;
  }

  // GET /tune/status
  if (url === '/tune/status' && method === 'GET') {
    sendJSON(res, 200, MOCK_TUNER_STATUS);
    return;
  }

  // POST /tune/reset
  if (url === '/tune/reset' && method === 'POST') {
    sendJSON(res, 200, {
      status: 'reset',
      params: {
        rag_k: 5,
        eval_threshold: 0.7,
        prefer_reasoning_model: false,
      },
    });
    return;
  }

  // 404
  sendJSON(res, 404, { error: `Not found: ${method} ${url}` });
});

// ─────────────────────────────────────────────────────────────
// WebSocket Server (/ws/query)
// ─────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws/query' });

wss.on('connection', (ws: WebSocket) => {
  console.log('[mock] WS client connected');

  ws.on('message', async (raw: Buffer) => {
    try {
      const data = JSON.parse(raw.toString()) as {
        question?: string;
        session_id?: string;
      };
      const question = data.question ?? '';
      const sessionId = data.session_id ?? 'default';

      console.log(`[mock] Query: "${question}" (session: ${sessionId})`);

      if (!question) {
        ws.send(
          JSON.stringify({ type: 'error', message: 'question is required' }),
        );
        return;
      }

      // Error trigger for testing
      if (question.toLowerCase() === 'error') {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: 'Simulated backend error for testing',
          }),
        );
        return;
      }

      const answer = getAnswer(question);

      // Send retrieved documents (before tokens — RAG retrieval phase)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'documents',
            documents: [
              'Retrieval-Augmented Generation (RAG) combines information retrieval with text generation. A retriever fetches relevant passages from a knowledge base, which are then used as context for a language model to generate grounded answers.',
              'Multi-hop reasoning requires following chains of evidence across multiple documents. Systems like HotpotQA benchmark this capability by requiring answers that synthesize information from two or more Wikipedia articles.',
              'ChromaDB is an open-source embedding database designed for AI applications. It stores document embeddings and supports similarity search, making it ideal for RAG pipelines that need fast nearest-neighbor retrieval.',
              'RAGAS (Retrieval Augmented Generation Assessment) provides metrics for evaluating RAG systems: faithfulness measures hallucination, answer relevancy measures topicality, context precision measures retrieval quality, and context recall measures completeness.',
            ],
          }),
        );
        await sleep(100); // Small delay to simulate retrieval
      }

      // Stream tokens word-by-word
      const words = answer.split(' ');
      for (const word of words) {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'token', content: word + ' ' }));
        await sleep(TOKEN_DELAY_MS);
      }

      // Eval report
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'eval',
            report: makeEvalReport(question, answer),
          }),
        );
      }

      // Done
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'done', answer }));
      }

      console.log(`[mock] Streamed ${words.length} tokens + eval + done`);
    } catch {
      ws.send(
        JSON.stringify({ type: 'error', message: 'Invalid JSON payload' }),
      );
    }
  });

  ws.on('close', () => {
    console.log('[mock] WS client disconnected');
  });
});

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

server.listen(PORT, () => {
  console.log('');
  console.log(
    `  SoulGraph Mock Server running on http://localhost:${PORT}`,
  );
  console.log('');
  console.log('  Endpoints:');
  console.log(`    GET  /health       → service health`);
  console.log(`    POST /query        → synchronous query`);
  console.log(`    GET  /tune/status  → tuner parameters + history`);
  console.log(`    POST /tune/reset   → reset tuner`);
  console.log(`    WS   /ws/query     → streaming query`);
  console.log('');
  console.log('  Special queries:');
  console.log('    "error"  → triggers error response');
  console.log('    "hello"  → SoulGraph intro');
  console.log('    anything → Battle of Thermopylae');
  console.log('');
});
