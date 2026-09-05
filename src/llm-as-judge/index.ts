import path from "path";
import { RagRunner } from "./rag";

async function run() {
  const runner = new RagRunner();
  const pdfPath = path.join(process.cwd(), "docs", "AmazonBedrock_UserGuide.pdf");

  console.log("Initializing Vector Store...");
  await runner.initializeVectorStore(pdfPath);

  const query = "What are the security and encryption practices for model data in Bedrock?";
  const groundTruth = "Amazon Bedrock encrypts model data in transit and at rest using AWS Key Management Service (KMS).";

  console.log("Running Query & Dual-Layer Evaluation...\n");
  const result = await runner.runAndEvaluate(query, groundTruth);

  console.log("=== RAG RESPONSE ===");
  console.log(result.generatedAnswer);

  console.log("\n=== ALGORITHMIC METRICS (0ms - 15ms) ===");
  console.dir(result.evaluations.algorithmic, { depth: null });

  console.log("\n=== SEMANTIC LLM-AS-A-JUDGE METRICS ===");
  console.dir(result.evaluations.semantic, { depth: null });
}

run().catch((err) => console.error("Execution failed:", err));