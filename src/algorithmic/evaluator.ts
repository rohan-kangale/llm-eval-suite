import { AlgorithmicEvalResult } from "./types";
import { LocalHuggingFaceEmbeddings } from "../core/embeddings";

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 1. EXACT MATCH
 * Pure deterministic identity check.
 */
export function calculateExactMatch(actual: string, expected: string): number {
  return normalizeText(actual) === normalizeText(expected) ? 1.0 : 0.0;
}

/**
 * 2. ROUGE-L (Longest Common Subsequence)
 * Measures sentence structure order & structural fact recall without LLMs.
 */
export function calculateRougeL(actual: string, expected: string): { precision: number; recall: number; f1: number } {
  const actualTokens = normalizeText(actual).split(" ").filter(Boolean);
  const refTokens = normalizeText(expected).split(" ").filter(Boolean);

  if (actualTokens.length === 0 || refTokens.length === 0) {
    return { precision: 0, recall: 0, f1: 0 };
  }

  // Dynamic Programming table for Longest Common Subsequence (LCS)
  const dp: number[][] = Array(refTokens.length + 1)
    .fill(0)
    .map(() => Array(actualTokens.length + 1).fill(0));

  for (let i = 1; i <= refTokens.length; i++) {
    for (let j = 1; j <= actualTokens.length; j++) {
      if (refTokens[i - 1] === actualTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcsLength = dp[refTokens.length][actualTokens.length];
  const recall = lcsLength / refTokens.length;
  const precision = lcsLength / actualTokens.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return {
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
  };
}

/**
 * 3. COSINE SIMILARITY
 * Vector space similarity between embedding arrays.
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0.0;

  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0.0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * PRODUCTION COMPOSITE EVALUATOR (0ms - 15ms compute, $0 LLM Cost)
 */
export async function evaluateAlgorithmic(
  actual: string,
  expected: string,
  embeddings: LocalHuggingFaceEmbeddings
): Promise<AlgorithmicEvalResult> {
  // 1. Fast deterministic check
  const exactMatch = calculateExactMatch(actual, expected);

  // 2. Structural/Fact Recall check (ROUGE-L)
  const rougeL = calculateRougeL(actual, expected);

  // 3. Semantic similarity via local HuggingFace embedding vector space
  const [actualVector, expectedVector] = await Promise.all([
    embeddings.embedQuery(actual),
    embeddings.embedQuery(expected),
  ]);
  const semanticSimilarity = calculateCosineSimilarity(actualVector, expectedVector);

  // Production Composite Weighting:
  // 60% Semantic Embedding Similarity + 30% ROUGE-L F1 + 10% Exact Match
  const compositeScore =
    exactMatch * 0.10 +
    rougeL.f1 * 0.30 +
    semanticSimilarity * 0.60;

  return {
    exactMatch,
    rougeL,
    semanticSimilarity: Number(semanticSimilarity.toFixed(4)),
    compositeScore: Number(compositeScore.toFixed(4)),
  };
}