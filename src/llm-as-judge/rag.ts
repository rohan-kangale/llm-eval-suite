import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createStuffDocumentsChain } from '@langchain/classic/chains/combine_documents';
import { createRetrievalChain } from '@langchain/classic/chains/retrieval';

import { LocalHuggingFaceEmbeddings } from '../core/embeddings';
import { ingestAndChunk } from '../core/ingestAndChunking';
import { llm as ollamaLLM } from '../core/ollama.js';
import { evaluateAlgorithmic } from './evaluator';
import { RagEvaluationOutput, SemanticEvalResult } from './types';

export class RagRunner {
  private vectorStore: MemoryVectorStore | null = null;
  private embeddings: LocalHuggingFaceEmbeddings;
  private prompt: ChatPromptTemplate;

  constructor() {
    this.embeddings = new LocalHuggingFaceEmbeddings();
    
    this.prompt = ChatPromptTemplate.fromTemplate(`
    Answer the user's question using ONLY the provided context:

    Context:
    {context}

    Question: {input}
    `);
  }

  /**
   * Ingests, chunks, embeds, and indexes the specified PDF into the Memory Vector Store
   */
  async initializeVectorStore(pdfPath: string): Promise<void> {
    console.log(`Ingesting and chunking PDF from: ${pdfPath}...`);
    const chunks = await ingestAndChunk(pdfPath);

    const docs = chunks.map((c) => ({
      pageContent: c.text,
      metadata: { pageNumber: c.pageNumber, id: c.id },
    }));

    console.log(`Indexing ${docs.length} document chunks into vector store...`);
    this.vectorStore = new MemoryVectorStore(this.embeddings);
    await this.vectorStore.addDocuments(docs);
    console.log("Vector store successfully initialized.\n");
  }

  /**
   * Queries the RAG retrieval chain using Ollama and LCEL
   */
  async query(userQuery: string, topK = 3) {
    if (!this.vectorStore) {
      throw new Error("VectorStore is not initialized. Call initializeVectorStore() first.");
    }

    const vectorRetriever = this.vectorStore.asRetriever({ k: topK });

    const combineDocsChain = await createStuffDocumentsChain({
      llm: ollamaLLM,
      prompt: this.prompt,
    });

    const retrievalChain = await createRetrievalChain({
      retriever: vectorRetriever,
      combineDocsChain,
    });

    const response = await retrievalChain.invoke({ input: userQuery });

    return {
      answer: response.answer as string,
      sourceDocuments: response.context as Record<string, any>[],
    };
  }

  /**
   * Executes RAG query and runs dual-layer evaluation (Algorithmic & Semantic)
   */
  async runAndEvaluate(
    userQuery: string,
    groundTruthAnswer?: string,
    topK = 3
  ): Promise<RagEvaluationOutput> {
    // 1. Run RAG Pipeline
    const ragResult = await this.query(userQuery, topK);
    const actualAnswer = ragResult.answer;
    const retrievedContexts = ragResult.sourceDocuments.map((doc) => doc.pageContent);

    // 2A. Deterministic Algorithmic Evaluation (against Ground Truth)
    const algorithmic = groundTruthAnswer
      ? await evaluateAlgorithmic(actualAnswer, groundTruthAnswer, this.embeddings)
      : null;

    // 2B. LLM-as-a-Judge Evaluation using Ollama
    const evalPrompt = `
    You are an expert evaluator assessing a RAG pipeline response based on retrieved PDF context.

    USER QUERY: "${userQuery}"
    RETRIEVED CONTEXT: ${JSON.stringify(retrievedContexts)}
    GENERATED ANSWER: "${actualAnswer}"

    Respond STRICTLY in JSON format with numeric scores between 0.0 and 1.0:
    {
      "faithfulness": <number>,
      "answerRelevance": <number>,
      "reasoning": "<explanation_string>"
    }
    `;

    const evalResponse = await ollamaLLM.invoke(evalPrompt);
    
    let semantic: SemanticEvalResult;
    try {
      const responseText = typeof evalResponse === "string" ? evalResponse : evalResponse.content;
      semantic = JSON.parse(responseText as string);
    } catch (err) {
      console.warn("Failed to parse LLM evaluation JSON output. Fallback applied.");
      semantic = {
        faithfulness: 0,
        answerRelevance: 0,
        reasoning: "Failed to parse structured JSON score from LLM response.",
      };
    }

    return {
      query: userQuery,
      generatedAnswer: actualAnswer,
      retrievedContexts,
      evaluations: {
        algorithmic,
        semantic,
      },
    };
  }
}

// ===================================================================
// EXECUTION SCRIPT
// ===================================================================
// export async function run() {
//   const runner = new OllamaPdfRagRunner();
//   const pdfPath = path.join(process.cwd(), 'docs', 'AmazonBedrock_UserGuide.pdf');

//   await runner.initializeVectorStore(pdfPath);

//   const query = "What are the security and encryption practices for model data in Bedrock?";
//   const groundTruth = "Amazon Bedrock encrypts model data in transit and at rest using AWS Key Management Service (KMS).";

//   const result = await runner.runAndEvaluate(query, groundTruth);

//   console.log("--- RAG ANSWER ---");
//   console.log(result.generatedAnswer);

//   console.log("\n--- EVALUATION RESULTS ---");
//   console.log("Algorithmic Metrics:", result.evaluations.algorithmic);
//   console.log("Semantic Metrics:", result.evaluations.semantic);
// }

// run().catch((err) => console.error("Execution failed:", err));