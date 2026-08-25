import { pipeline } from '@xenova/transformers';
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";

// Custom LangChain Embeddings Class wrapping HuggingFace Transformers.js
export class LocalHuggingFaceEmbeddings extends Embeddings {
  private extractor: any;

  constructor(params?: EmbeddingsParams) {
    super(params ?? {});
  }

  private async getExtractor() {
    if (!this.extractor) {
      this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return this.extractor;
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const pipe = await this.getExtractor();
    const embeddings: number[][] = [];

    for (const text of documents) {
      const output = await pipe(text, { pooling: 'mean', normalize: true });
      embeddings.push(Array.from(output.data));
    }
    return embeddings;
  }

  async embedQuery(document: string): Promise<number[]> {
    const [embedding] = await this.embedDocuments([document]);
    return embedding;
  }
}