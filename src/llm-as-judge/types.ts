import { AlgorithmicEvalResult } from "../algorithmic/types";

export type ClaimVerdictType = "SUPPORTED" | "UNSUPPORTED";

export interface ClaimVerdict {
  claim: string;
  verdict: ClaimVerdictType;
  reason: string;
}

export interface FaithfulnessResult {
  score: number;
  claimsExtracted: ClaimVerdict[];
  reason: string;
}

export interface AnswerRelevanceResult {
  score: number;
  reason: string;
}

export interface SemanticEvalResult {
  faithfulness: FaithfulnessResult;
  answerRelevance: AnswerRelevanceResult;
}

export interface RagEvaluationOutput {
  query: string;
  generatedAnswer: string;
  retrievedContexts: string[];
  evaluations: {
    algorithmic: AlgorithmicEvalResult | null;
    semantic: SemanticEvalResult | null;
  };
}