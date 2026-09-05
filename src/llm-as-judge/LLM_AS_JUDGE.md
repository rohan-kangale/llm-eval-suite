# Semantic Evaluation (LLM-as-a-Judge)

The Semantic Evaluation layer uses zero-temperature Judge LLMs to score qualitative aspects of a Retrieval-Augmented Generation (RAG) pipeline that deterministic algorithms cannot capture. It assesses output quality, context adherence (groundedness), and user intent alignment without requiring pre-authored ground-truth reference answers.

---

## Why LLM-as-a-Judge?

Algorithmic metrics (like ROUGE-L or Cosine Similarity) rely on exact reference comparisons. However, in real-world applications, an LLM might rephrase an answer perfectly while having zero lexical overlap with a ground-truth reference.

**LLM-as-a-Judge solves this by acting as a reference-free auditor:**

* **Reference-Free Evaluation:** Grades responses dynamically on live production traffic where no ground truth exists.
* **Hallucination Detection:** Deconstructs generated outputs into individual atomic factual claims and verifies each against source context documents.
* **Structured & Deterministic:** Uses Zod schemas for enforced JSON outputs, computing numerical scores programmatically in code rather than relying on stochastic LLM math.

---

## The RAG Triad Metrics Breakdown

The evaluation framework centers around three core semantic pillars:

```
                  ┌─────────────────┐
                  │   User Query    │
                  └────────┬────────┘
                           │
             ▲             │             ▲
             │             ▼             │
   Answer    │    ┌─────────────────┐    │  Context
 Relevance   │    │Retrieved Context│    │ Precision / Recall
             │    └────────┬────────┘    │
             │             │             │
             ▼             ▼             ▼
                  ┌─────────────────┐
                  │ Generated Answer│
                  └─────────────────┘
                           ▲
                           │ Faithfulness /
                           │ Groundedness

```

### 1. Faithfulness (Groundedness)

* **What it measures:** The proportion of factual claims in the generated answer that are explicitly supported by the retrieved context.
* **Implementation Mechanism:**
1. **Atomic Claim Extraction:** An LLM chain extracts single-fact assertions from `actualAnswer`.
2. **Natural Language Inference (NLI) Audit:** A separate LLM chain verifies each extracted claim against `retrievedContexts`, assigning a binary verdict (`SUPPORTED` or `UNSUPPORTED`).
3. **Programmatic Score:** Computed in TypeScript as $\frac{\text{Supported Claims}}{\text{Total Claims}}$.


* **Target Score:** `≥ 0.90` (90%+ of claims must be backed by retrieved context).

### 2. Answer Relevance

* **What it measures:** How directly the response addresses the user's prompt without introducing off-topic tangents or evasive answers.
* **Implementation Mechanism:** Evaluates `generatedAnswer` directly against `userQuery` using structured prompt constraints, outputting a normalized float from `0.0` (unrelated/evasive) to `1.0` (directly answers intent).
* **Target Score:** `≥ 0.85`.

### 3. Context Precision & Recall (Retriever Audit)

* **Context Precision:** Measures if the retrieved document chunks are relevant, ensuring noise isn't fed to the generator.
* **Context Recall:** Measures if all necessary facts required to answer the prompt were successfully retrieved.

---

## Execution Pipeline Architecture

To prevent false positives and maintain high evaluation speed, the evaluator separates claim decomposition from verification and delegates all mathematical computations to code:

```
[Input: User Query + Generated Answer + Contexts]
                       │
                       ▼
          ┌───────────────────────────┐
          │ Step 1: Claim Extraction  │  (CLAIMS_EXTRACTION_PROMPT)
          └─────────────┬─────────────┘
                        │ Atomic Claims
                        ▼
          ┌───────────────────────────┐
          │ Step 2: Claim NLI Audit   │  (FAITHFULNESS_VERIFICATION_PROMPT)
          └─────────────┬─────────────┘
                        │ Verdicts per Claim (SUPPORTED / UNSUPPORTED)
                        ▼
          ┌───────────────────────────┐
          │ Step 3: Answer Relevance  │  (ANSWER_RELEVANCE_PROMPT)
          └─────────────┬─────────────┘
                        │ Relevance Score & Justification
                        ▼
          ┌───────────────────────────┐
          │ Step 4: Programmatic Math │  (TypeScript Code Aggregation)
          └───────────────────────────┘

```

---

## Sample Output Structure

When running an evaluation via `evaluateSemantic()`, `RagRunner` attaches structured diagnostic results matching `SemanticEvalResult`:

```json
{
  "query": "What are the data backup policies for Bedrock?",
  "generatedAnswer": "Amazon Bedrock performs automated daily backups and allows manual snapshot creation stored across 3 availability zones.",
  "retrievedContexts": [
    "Amazon Bedrock supports automated daily backups. Users can manually trigger snapshots at any point."
  ],
  "evaluations": {
    "semantic": {
      "faithfulness": {
        "score": 0.67,
        "claimsExtracted": [
          {
            "claim": "Amazon Bedrock performs automated daily backups",
            "verdict": "SUPPORTED",
            "reason": "Explicitly stated in context snippet 1."
          },
          {
            "claim": "Bedrock allows manual snapshot creation",
            "verdict": "SUPPORTED",
            "reason": "Explicitly stated in context snippet 1."
          },
          {
            "claim": "Snapshots are stored across 3 availability zones",
            "verdict": "UNSUPPORTED",
            "reason": "No mention of availability zones in provided context."
          }
        ],
        "reason": "1 out of 3 claim(s) lack grounding in context."
      },
      "answerRelevance": {
        "score": 1.0,
        "reason": "The response directly answers the query regarding backup policies."
      }
    }
  }
}

```

---

## Diagnostic Matrix & Triage Guide

Use the combined metric signatures to isolate failure modes in your pipeline:

| Faithfulness Score | Answer Relevance Score | Primary Cause | Immediate Action |
| --- | --- | --- | --- |
| **High (≥ 0.90)** | **High (≥ 0.85)** | **Optimal Pipeline Execution** | Pass. No action required. |
| **Low (< 0.70)** | **High (≥ 0.85)** | **Hallucination / Parametric Leakage** | Model answered the query, but pulled facts from pre-trained memory rather than context. Tighten system prompt grounding instructions. |
| **High (≥ 0.90)** | **Low (< 0.70)** | **Evasive / Off-Topic Generation** | Model stayed strictly faithful to context, but failed to answer user intent. Refine answer-generation prompt instructions. |
| **Low (< 0.70)** | **Low (< 0.70)** | **System Retrieval & Generation Failure** | Inspect `retrievedContexts`. Context precision/recall failed or the retriever pulled irrelevant chunks. |

---

## Production Best Practices for Judge Models

1. **Enforce Zod / JSON Schema:** Always use `StructuredOutputParser` or LangChain's `.withStructuredOutput()` to force strict JSON parsing.
2. **Lock Temperature to 0.0:** Eliminates output variance across evaluation runs.
3. **Closed-Book Prompting:** Explicitly instruct the judge: *"Know NOTHING outside of the provided context. If a claim cannot be verified directly from the context, mark it as UNSUPPORTED (even if true in the real world)."*
4. **Binary Classification over Rated Scales:** Force binary decisions (`SUPPORTED` / `UNSUPPORTED`) on atomic claims. Never ask the LLM to calculate average floating-point scores directly.