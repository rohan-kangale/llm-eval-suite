import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import {
  FaithfulnessResult,
  AnswerRelevanceResult,
  SemanticEvalResult,
} from "./types";

const ClaimsExtractorSchema = z.object({
  claims: z.array(z.string()).describe("List of atomic factual claims extracted from the response."),
});

const ClaimVerdictSchema = z.object({
  claim: z.string().describe("The exact claim being evaluated."),
  verdict: z.enum(["SUPPORTED", "UNSUPPORTED"]).describe("SUPPORTED if backed by context, UNSUPPORTED otherwise."),
  reason: z.string().describe("Brief justification referencing context facts."),
});

const ClaimsVerificationSchema = z.object({
  evaluations: z.array(ClaimVerdictSchema),
});

const RelevanceSchema = z.object({
  score: z.number().min(0).max(1).describe("Score between 0.0 and 1.0 based on how well it answers the query."),
  reason: z.string().describe("Explanation of why the answer does or does not address the query."),
});


const CLAIMS_EXTRACTION_PROMPT = PromptTemplate.fromTemplate(`
You are a precise linguistic auditor. Break down the provided text into atomic factual statements.
An atomic claim is a simple sentence containing a single factual assertion.

Generated Answer:
{actualAnswer}

{format_instructions}
`);

const FAITHFULNESS_VERIFICATION_PROMPT = PromptTemplate.fromTemplate(`
You are an impartial auditor evaluating a RAG pipeline. Determine whether each extracted claim is supported ONLY by the provided context.

RULES:
1. Know NOTHING outside of the provided context.
2. If a claim cannot be verified directly from the context, mark it as UNSUPPORTED (even if true in the real world).

Context:
{context}

Claims:
{claims}

{format_instructions}
`);

const ANSWER_RELEVANCE_PROMPT = PromptTemplate.fromTemplate(`
You are evaluating the directness and relevance of an AI generated answer relative to a user question.

User Question: {question}
Generated Answer: {actualAnswer}

Assign a relevance score from 0.0 to 1.0:
- 1.0: Directly and completely addresses the question without unnecessary tangents.
- 0.5: Partially addresses the question or contains excessive irrelevant detail.
- 0.0: Evasive or completely fails to answer the question.

{format_instructions}
`);

export async function evaluateFaithfulness(
  actualAnswer: string,
  retrievedContexts: string[],
  judgeLlm: BaseChatModel
): Promise<FaithfulnessResult> {
  if (!actualAnswer.trim() || retrievedContexts.length === 0) {
    return {
      score: 0,
      claimsExtracted: [],
      reason: "Empty response or context provided.",
    };
  }

  const combinedContext = retrievedContexts.join("\n\n");

  try {
    // 1. Claim Extraction
    const extractorParser = StructuredOutputParser.fromZodSchema(ClaimsExtractorSchema);
    const extractionChain = CLAIMS_EXTRACTION_PROMPT.pipe(judgeLlm).pipe(extractorParser);
    const extractionResult = await extractionChain.invoke({
      actualAnswer,
      format_instructions: extractorParser.getFormatInstructions(),
    });

    if (!extractionResult.claims || extractionResult.claims.length === 0) {
      return {
        score: 1.0,
        claimsExtracted: [],
        reason: "No factual claims present in the answer to evaluate.",
      };
    }

    // 2. Claim Verification
    const verificationParser = StructuredOutputParser.fromZodSchema(ClaimsVerificationSchema);
    const verificationChain = FAITHFULNESS_VERIFICATION_PROMPT.pipe(judgeLlm).pipe(verificationParser);
    const verificationResult = await verificationChain.invoke({
      context: combinedContext,
      claims: JSON.stringify(extractionResult.claims),
      format_instructions: verificationParser.getFormatInstructions(),
    });

    // 3. Programmatic Score Calculation
    const total = verificationResult.evaluations.length;
    const supported = verificationResult.evaluations.filter((c) => c.verdict === "SUPPORTED").length;
    const score = total > 0 ? Number((supported / total).toFixed(2)) : 0;

    return {
      score,
      claimsExtracted: verificationResult.evaluations,
      reason:
        supported === total
          ? `All ${total} claim(s) fully supported by retrieved context.`
          : `${total - supported} out of ${total} claim(s) lack grounding in context.`,
    };
  } catch (err) {
    return {
      score: 0,
      claimsExtracted: [],
      reason: `Faithfulness evaluation failed to parse LLM response: ${(err as Error).message}`,
    };
  }
}

export async function evaluateAnswerRelevance(
  question: string,
  actualAnswer: string,
  judgeLlm: BaseChatModel
): Promise<AnswerRelevanceResult> {
  try {
    const relevanceParser = StructuredOutputParser.fromZodSchema(RelevanceSchema);
    const relevanceChain = ANSWER_RELEVANCE_PROMPT.pipe(judgeLlm).pipe(relevanceParser);

    const result = await relevanceChain.invoke({
      question,
      actualAnswer,
      format_instructions: relevanceParser.getFormatInstructions(),
    });

    return {
      score: Number(result.score.toFixed(2)),
      reason: result.reason,
    };
  } catch (err) {
    return {
      score: 0,
      reason: `Answer relevance evaluation failed: ${(err as Error).message}`,
    };
  }
}

export async function evaluateSemantic(
  question: string,
  actualAnswer: string,
  retrievedContexts: string[],
  judgeLlm: BaseChatModel
): Promise<SemanticEvalResult> {
  const [faithfulness, answerRelevance] = await Promise.all([
    evaluateFaithfulness(actualAnswer, retrievedContexts, judgeLlm),
    evaluateAnswerRelevance(question, actualAnswer, judgeLlm),
  ]);

  return {
    faithfulness,
    answerRelevance,
  };
}