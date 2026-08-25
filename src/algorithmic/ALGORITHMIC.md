# Fast Algorithmic & Heuristic Evaluation (Zero LLM Cost)

The Algorithmic Evaluation layer provides a fast, deterministic, zero-cost framework for evaluating Retrieval-Augmented Generation (RAG) outputs against reference ground-truth data. It combines string-level lexical matching algorithms with local vector embeddings to grade response quality without incurring external API costs or model latency.

---

## Why Algorithmic Evaluation?

While LLM-as-a-Judge evaluators offer high semantic nuance, they introduce execution latency, non-deterministic outputs, and ongoing API costs. Algorithmic evaluators serve as the **first line of defense** across local development, manual debugging, and continuous integration:

* **Zero API Cost:** Runs entirely on local compute without external LLM calls.
* **Ultra-Low Latency:** Completes in **~10ms–15ms** per evaluation pair.
* **100% Deterministic:** Produces identical, reproducible scores across test runs, making it ideal for regression detection.

---

## Core Metrics Breakdown

The evaluator combines three primary metrics into a single composite score:

### 1. Exact Match (Normalized)
* **Concept:** Evaluates binary equivalence between actual output and ground truth.
* **Mechanism:** Both strings undergo normalization (lowercasing, trimming whitespace, and stripping punctuation) prior to comparison.
* **Output:** `1.0` if identical after normalization, `0.0` otherwise.
* **Best Used For:** Strict entity extraction, key-value lookups, system IDs, and standardized outputs.

### 2. ROUGE-L (Longest Common Subsequence)
* **Concept:** Measures structural overlap and word-sequence preservation without requiring verbatim phrase matches.
* **Mechanism:** Identifies the longest sequence of words present in both texts in the exact relative order.
* **Outputs:**
  * **Precision:** Portion of generated tokens present in ground truth in sequence.
  * **Recall:** Portion of ground-truth tokens retrieved in generated output in sequence.
  * **F1-Score:** Harmonic mean of precision and recall.
* **Best Used For:** Ensuring key facts, phrase structures, and sequence order are preserved in synthesized summaries.

### 3. Semantic Cosine Similarity
* **Concept:** Evaluates deep semantic equivalence, accounting for synonyms, alternate phrasing, and sentence restructurings.
* **Mechanism:**
  1. Converts actual output and ground-truth text into dense vector representations using a local Transformer model (`xenova/all-MiniLM-L6-v2`).
  2. Computes the cosine of the angle between the two vectors in high-dimensional space.
* **Output:** Range between `0.0` (completely unrelated) and `1.0` (semantically identical).
* **Best Used For:** Assessing answer accuracy when the LLM rephrases context instead of copying it verbatim.

---

## Composite Score Formula

To produce a single actionable metric, individual results are combined using a weighted average schema:

$$\text{CompositeScore} = (0.60 \times \text{SemanticSimilarity}) + (0.30 \times \text{ROUGE-L}_{F1}) + (0.10 \times \text{ExactMatch})$$

* **60% Semantic Cosine Similarity:** Prioritizes overall meaning and factual alignment over exact word choice.
* **30% ROUGE-L F1-Score:** Ensures structural recall and proper sequence ordering of key facts.
* **10% Exact Match:** Gives a small boost when outputs match ground truth precisely.

---

## Sample Output Structure

When `RagRunner.runAndEvaluate()` executes against a query with a specified ground truth, the resulting `evaluations.algorithmic` object outputs structured scores as follows:

```json
{
  "query": "What are the encryption standards supported by Amazon Bedrock?",
  "generatedAnswer": "Amazon Bedrock encrypts data at rest and in transit using AWS KMS keys.",
  "retrievedContexts": [
    "Amazon Bedrock encrypts all data at rest using AWS KMS. Data in transit between Bedrock and other AWS services is encrypted using TLS 1.2."
  ],
  "evaluations": {
    "algorithmic": {
      "exactMatch": 0,
      "rougeL": {
        "precision": 0.7692,
        "recall": 0.7143,
        "f1": 0.7407
      },
      "semanticSimilarity": 0.9412,
      "compositeScore": 0.7869
    },
    "semantic": null
  }
}
```

---

## Interpreting & Acting on Results

Understanding metric signatures allows you to isolate pipeline issues without manually reviewing hundreds of responses.

### 1. Diagnostic Matrix (Interpreting Metric Combinations)

| Composite Score | Semantic Similarity | ROUGE-L F1 | Primary Diagnosis | Recommended Action |
| --- | --- | --- | --- | --- |
| **≥ 0.85** | High (≥ 0.90) | High (≥ 0.80) | **Optimal Answer:** Clear, accurate, and faithful to ground truth. | **Pass.** No action needed. |
| **0.65 – 0.84** | High (≥ 0.85) | Low (≤ 0.50) | **Paraphrased / Verbose:** Answer is semantically correct, but rephrased heavily or verbose. | **Review System Prompt:** Encourage concise, direct answer phrasing if strict brevity is required. |
| **0.50 – 0.65** | Moderate (0.60 – 0.75) | High (≥ 0.70) | **Keyword Hallucination:** Re-uses exact ground-truth keywords, but context/meaning is altered. | **Review Retrieval / Prompt:** Check if retrieved context lacks depth or if the model synthesized hallucinated links between terms. |
| **< 0.50** | Low (< 0.50) | Low (< 0.40) | **System Failure:** Severe hallucination, poor context retrieval, or model refusal. | **Check Retrieval:** Inspect `retrievedContexts` to verify if the retriever actually fetched the required ground-truth data. |

---

### 2. Multi-Tier Execution & Workflow Modes

Evaluation is not restricted to automated CI/CD pipelines. A complete quality lifecycle incorporates manual, scheduled, and continuous processes:

| Execution Mode | Workflow & Triggers | Primary Focus | Action Taken |
| --- | --- | --- | --- |
| **Local Engineering Runs** | Manual CLI runs (`npm run eval:local`) during prompt/chunk tuning. | Rapid local verification of single queries or micro-datasets. | Developer iterates on prompt templates or top-$k$ values immediately. |
| **Automated CI/CD Gates** | Continuous execution on Git Pull Requests. | Automated regression detection across fixed benchmark suites. | Automatically block PR merges if average `compositeScore` drops below **0.75**. |
| **Scheduled Nightly Benchmarks** | Automated cron execution over large test sets (500+ items). | System-wide benchmarking across diverse edge cases. | Triggers alerts for performance drift or systemic degradation. |
| **Human-in-the-Loop (HITL) Audits** | Periodic manual sampling of production logs and low-score runs. | Ground-truth dataset refinement and domain accuracy checks. | Domain experts update reference answers and add missing edge cases to ground-truth suites. |

---

### 3. Operational Failure Triaging Strategy

When evaluations flag failing or degraded cases, apply the following triage steps:

1. **Filter Defective Cases:** Isolate test items where `compositeScore < 0.60`.
2. **Inspect Context First (`retrievedContexts`):**
* **If retrieved context is missing ground-truth facts:** The issue lies in the **Retrieval Layer**. Adjust chunk size, overlap strategies, dense-sparse hybrid weights, or vector embeddings.
* **If retrieved context contains ground-truth facts:** The issue lies in the **Generation Layer**. Refine system instructions, reduce LLM temperature, or improve context injection formatting.

3. **Refine Ground Truth:** If low scores stem from valid alternative answers not captured in ground truth, update the reference dataset to preserve accurate benchmarking.
