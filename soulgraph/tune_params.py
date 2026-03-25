"""TuningParams — mutable agent parameters adjusted by the AgentTuner."""

from __future__ import annotations

from dataclasses import asdict, dataclass

# Default number of documents the RAG agent retrieves per query.
DEFAULT_RAG_K: int = 4


@dataclass
class TuningParams:
    """Agent parameters that the AgentTuner adjusts based on eval feedback.

    Attributes:
        rag_k: Number of documents retrieved per RAG query.
                Increased when faithfulness is consistently low.
        eval_threshold: RAGAS pass/fail threshold (0-1).
        prefer_reasoning_model: When True, the ModelRouter uses the reasoning
                                 model (slower but more deliberate generation).
                                 Set when answer_relevancy is consistently low.
    """

    rag_k: int = DEFAULT_RAG_K
    eval_threshold: float = 0.7
    prefer_reasoning_model: bool = False

    def to_dict(self) -> dict:
        """Serialise to a plain dict (JSON-safe)."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "TuningParams":
        """Deserialise from a plain dict."""
        return cls(
            rag_k=int(data.get("rag_k", DEFAULT_RAG_K)),
            eval_threshold=float(data.get("eval_threshold", 0.7)),
            prefer_reasoning_model=bool(data.get("prefer_reasoning_model", False)),
        )
