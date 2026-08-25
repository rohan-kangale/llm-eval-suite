export interface AlgorithmicEvalResult {
  exactMatch: number;
  rougeL: {
    precision: number;
    recall: number;
    f1: number;
  };
  semanticSimilarity: number;
  compositeScore: number;
}

export interface SemanticEvalResult {
  faithfulness: number;
  answerRelevance: number;
  reasoning: string;
}

export interface GoldenTestCase {
  id: string;
  query: string;
  groundTruthAnswer: string;
  category: "Factoid" | "Technical Schema" | "Feature Overview" | "Regional Support";
}

export interface RagEvaluationOutput {
  query: string;
  generatedAnswer: string;
  retrievedContexts: string[];
  evaluations: {
    algorithmic: AlgorithmicEvalResult | null;
    semantic: SemanticEvalResult;
  };
}