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

const PORT = Number(process.env.MOCK_WS_PORT ?? 8081);
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
  retrieval:
    'Retrieval-Augmented Generation (RAG) enhances language models by grounding responses in retrieved documents. Multi-hop reasoning extends this by following chains of evidence across multiple sources. Instead of answering from a single passage, the system retrieves document A, extracts a fact, uses that fact to query for document B, and synthesizes both into a coherent answer. This dramatically reduces hallucination and enables complex analytical questions that require connecting information scattered across a knowledge base.',
  rag:
    'Retrieval-Augmented Generation (RAG) enhances language models by grounding responses in retrieved documents. Multi-hop reasoning extends this by following chains of evidence across multiple sources. Instead of answering from a single passage, the system retrieves document A, extracts a fact, uses that fact to query for document B, and synthesizes both into a coherent answer. This dramatically reduces hallucination and enables complex analytical questions that require connecting information scattered across a knowledge base.',
  chromadb:
    'ChromaDB and Pinecone serve different segments of the RAG ecosystem. ChromaDB is open-source, self-hosted, and optimized for developer experience — you embed documents locally with zero external dependencies. Pinecone is a managed cloud service with higher throughput and built-in scaling, but requires sending your data to their infrastructure. For sovereign deployments where data cannot leave your network, ChromaDB is the clear choice. For high-volume SaaS applications with less data sensitivity, Pinecone offers operational simplicity. SoulGraph uses ChromaDB because our architecture requires zero external runtime dependencies.',
  pinecone:
    'ChromaDB and Pinecone serve different segments of the RAG ecosystem. ChromaDB is open-source, self-hosted, and optimized for developer experience — you embed documents locally with zero external dependencies. Pinecone is a managed cloud service with higher throughput and built-in scaling, but requires sending your data to their infrastructure. For sovereign deployments where data cannot leave your network, ChromaDB is the clear choice. For high-volume SaaS applications with less data sensitivity, Pinecone offers operational simplicity. SoulGraph uses ChromaDB because our architecture requires zero external runtime dependencies.',
  ragas:
    'RAGAS (Retrieval Augmented Generation Assessment) evaluates RAG pipelines on four core metrics. Faithfulness measures whether the answer is supported by the retrieved context — detecting hallucination. Answer Relevancy measures whether the response actually addresses the question asked. Context Precision measures whether the retrieved documents are relevant to the query. Context Recall measures whether all necessary information was retrieved. Each metric scores 0.0 to 1.0. SoulGraph evaluates every response automatically and surfaces these scores in the UI, making quality observable rather than assumed.',
  metrics:
    'RAGAS (Retrieval Augmented Generation Assessment) evaluates RAG pipelines on four core metrics. Faithfulness measures whether the answer is supported by the retrieved context — detecting hallucination. Answer Relevancy measures whether the response actually addresses the question asked. Context Precision measures whether the retrieved documents are relevant to the query. Context Recall measures whether all necessary information was retrieved. Each metric scores 0.0 to 1.0. SoulGraph evaluates every response automatically and surfaces these scores in the UI, making quality observable rather than assumed.',
  calculate:
    'The result of 15 × 23 + 47 = 392. Computed using the safe AST calculator agent: first 15 × 23 = 345, then 345 + 47 = 392. The tool agent parsed the arithmetic expression, evaluated it in a sandboxed environment, and returned the verified result.',
};

function getAnswer(question: string): string {
  const lower = question.toLowerCase().trim();
  for (const [key, answer] of Object.entries(MOCK_ANSWERS)) {
    if (key === 'default') continue;
    if (lower.includes(key)) return answer;
  }
  return MOCK_ANSWERS.default;
}

/** Detect if the query should route through the tool agent (not RAG). */
function isToolQuery(question: string): boolean {
  const lower = question.toLowerCase();
  return /calculate|compute|\d+\s*[+\-*/×÷]\s*\d+/.test(lower);
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
  adjustments: [
    'Increased rag_k from 4 to 5: faithfulness below threshold for 3 consecutive queries',
    'Enabled reasoning model: detected multi-hop question requiring chain-of-thought',
    'Decreased eval_threshold from 0.75 to 0.70: consistently failing on context_precision with narrow retrieval',
  ],
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
      const isTool = isToolQuery(question);

      // Send retrieved documents (before tokens — RAG retrieval phase)
      // Tool agent queries skip document retrieval entirely
      if (!isTool && ws.readyState === WebSocket.OPEN) {
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
  console.log('    "error"      → triggers error response');
  console.log('    "hello"      → SoulGraph intro');
  console.log('    "rag"        → RAG + multi-hop explanation');
  console.log('    "chromadb"   → ChromaDB vs Pinecone comparison');
  console.log('    "ragas"      → RAGAS metrics explanation');
  console.log('    "calculate"  → tool agent path (no documents)');
  console.log('    anything     → Battle of Thermopylae');
  console.log('');
});
