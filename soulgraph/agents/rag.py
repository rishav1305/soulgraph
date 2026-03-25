"""RAG Agent — ChromaDB retrieval + answer generation."""

from __future__ import annotations

import logging
from typing import Any

from soulgraph.state import AgentState
from soulgraph.tuner import get_tuner

logger = logging.getLogger(__name__)


class RAGAgent:
    """Retrieval-Augmented Generation agent.

    Phase 1 implementation:
    - ChromaDB vector store for document retrieval
    - HotpotQA seeded dataset (~100 docs)
    - Multi-hop retrieval for complex questions
    """

    def __init__(self, chroma_host: str = "localhost", chroma_port: int = 8001) -> None:
        self.chroma_host = chroma_host
        self.chroma_port = chroma_port
        self._collection: Any = None

    def _get_collection(self) -> Any:
        """Lazily initialise ChromaDB collection."""
        if self._collection is None:
            import chromadb

            client = chromadb.HttpClient(host=self.chroma_host, port=self.chroma_port)
            self._collection = client.get_or_create_collection("soulgraph_rag")
            logger.info("Connected to ChromaDB at %s:%d", self.chroma_host, self.chroma_port)
        return self._collection

    def retrieve(self, query: str, n_results: int = 5) -> list[str]:
        """Retrieve relevant documents for a query.

        Args:
            query: The user question to search for.
            n_results: Number of documents to retrieve.

        Returns:
            List of document strings ordered by relevance.
        """
        try:
            collection = self._get_collection()
            results = collection.query(
                query_texts=[query],
                n_results=n_results,
            )
            docs: list[str] = results.get("documents", [[]])[0]
            logger.debug("Retrieved %d documents for query: %s", len(docs), query[:80])
            return docs
        except Exception as exc:
            logger.warning("ChromaDB retrieval failed: %s — returning empty documents", exc)
            return []

    def __call__(self, state: AgentState) -> dict[str, Any]:
        """Process state: retrieve documents and update state.

        This is the LangGraph node function signature.
        """
        question = state.get("question", "")
        # Agent fine-tuning: use tuner-adjusted rag_k for retrieval count.
        rag_k = get_tuner().get_params().rag_k
        documents = self.retrieve(question, n_results=rag_k)
        return {"documents": documents, "next_agent": "evaluator"}
