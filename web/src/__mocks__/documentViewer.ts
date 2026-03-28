/**
 * Mock data for DocumentViewer.tsx (P4)
 * Simulates ChromaDB retrieval results (plain text strings).
 */

import type { DocumentViewerProps } from '@/components/DocumentViewer';

// ── Sample documents (HotpotQA-style) ──

export const mockDocuments: string[] = [
  'The Battle of Gettysburg was fought July 1-3, 1863, in and around the town of Gettysburg, Pennsylvania, by Union and Confederate forces during the American Civil War. The battle involved the largest number of casualties of the entire war and is often described as the war\'s turning point. Union Major General George Meade\'s Army of the Potomac defeated attacks by Confederate General Robert E. Lee\'s Army of Northern Virginia, ending Lee\'s second invasion of the North.',

  'Quantum entanglement is a physical phenomenon that occurs when a group of particles are generated, interact, or share spatial proximity in a way such that the quantum state of each particle of the group cannot be described independently of the state of the others, including when the particles are separated by a large distance. Einstein famously referred to entanglement as "spooky action at a distance."',

  'ChromaDB is an open-source embedding database designed to make it easy to build LLM apps by making knowledge, facts, and skills pluggable for LLMs. It stores embeddings alongside metadata and documents, supports similarity search, and integrates with popular frameworks like LangChain and LlamaIndex.',

  'The HotpotQA dataset is a question answering dataset featuring natural, multi-hop questions, with strong supervision for supporting facts to enable more explainable question answering systems. It contains 113k Wikipedia-based question-answer pairs that require finding and reasoning over multiple supporting documents.',

  'RAGAS (Retrieval Augmented Generation Assessment) is a framework that helps evaluate Retrieval Augmented Generation (RAG) pipelines. It provides metrics such as faithfulness, answer relevancy, context precision, and context recall to assess the quality of generated answers against retrieved context.',
];

// ── Short documents (no expansion needed) ──
export const mockDocumentsShort: string[] = [
  'Paris is the capital of France.',
  'The Eiffel Tower was built in 1889.',
  'France is in Western Europe.',
];

// ── Single long document ──
export const mockDocumentsSingle: string[] = [
  'The Large Hadron Collider (LHC) is the world\'s largest and highest-energy particle collider. It was built by the European Organization for Nuclear Research (CERN) between 1998 and 2008 in collaboration with over 10,000 scientists and hundreds of universities and laboratories, as well as more than 100 countries. It lies in a tunnel 27 kilometres in circumference and as deep as 175 metres beneath the France-Switzerland border near Geneva. The collider has been instrumental in the discovery of the Higgs boson in 2012, confirming the existence of the Higgs field. The LHC first started up on 10 September 2008, and remains the latest addition to CERN\'s accelerator complex.',
];

// ── Empty (no documents) ──
export const mockDocumentsEmpty: string[] = [];

// ── Props combinations ──
export const mockDocViewerPropsDefault: DocumentViewerProps = {
  documents: mockDocuments,
};

export const mockDocViewerPropsShort: DocumentViewerProps = {
  documents: mockDocumentsShort,
};

export const mockDocViewerPropsEmpty: DocumentViewerProps = {
  documents: mockDocumentsEmpty,
};

export const mockDocViewerPropsSingle: DocumentViewerProps = {
  documents: mockDocumentsSingle,
  previewLength: 100,
};
