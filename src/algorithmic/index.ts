import path from "path";
import { RagRunner } from "./rag";
import { bedrockGoldenDataset } from "../../datasets/goldenDataset";

async function runFullBenchmark() {
  const pdfPath =path.join(process.cwd(), 'docs', 'AmazonBedrock_UserGuide.pdf');
  const ragRunner = new RagRunner();

  // 1. Ingest PDF Document
  await ragRunner.initializeVectorStore(pdfPath);

  const summaryResults = [];

  console.log(`Starting execution on ${bedrockGoldenDataset.length} Golden Test Cases...\n`);

  // 2. Iterate through Golden Dataset
  for (const testCase of bedrockGoldenDataset) {
    console.log(`[${testCase.id}] Query: "${testCase.query}"`);

    const result = await ragRunner.runAndEvaluate(
      testCase.query,
      testCase.groundTruthAnswer
    );

    summaryResults.push({
      ID: testCase.id,
      Category: testCase.category,
      CompositeScore: result.evaluations.algorithmic?.compositeScore ?? 0,
      Faithfulness: result.evaluations.semantic.faithfulness,
      Relevance: result.evaluations.semantic.answerRelevance,
    });
  }

  // 3. Print Output Summary Table
  console.log("\n=======================================================");
  console.log("          RAG PIPELINE BENCHMARK SUMMARY               ");
  console.log("=======================================================");
  console.table(summaryResults);

  // Calculate Averages
  const avgComposite =
    summaryResults.reduce((acc, curr) => acc + curr.CompositeScore, 0) /
    summaryResults.length;
  const avgFaithfulness =
    summaryResults.reduce((acc, curr) => acc + curr.Faithfulness, 0) /
    summaryResults.length;

  console.log(`\nAverage Algorithmic Composite Score: ${avgComposite.toFixed(4)}`);
  console.log(`Average Semantic Faithfulness Score:  ${avgFaithfulness.toFixed(4)}`);
}

runFullBenchmark().catch((err) => {
  console.error("Execution failed:", err);
});