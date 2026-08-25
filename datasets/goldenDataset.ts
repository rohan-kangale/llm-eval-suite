// goldenDataset.ts

export interface GoldenTestCase {
  id: string;
  query: string;
  groundTruthAnswer: string;
  category: "Factoid" | "Technical Schema" | "Feature Overview" | "Regional Support";
}

export const bedrockGoldenDataset: GoldenTestCase[] = [
  {
    id: "TC-001",
    query: "What is Amazon Bedrock?",
    groundTruthAnswer: "Amazon Bedrock is a fully managed service that makes base models from Amazon and third-party model providers accessible through an API.",
    category: "Factoid"
  },
  {
    id: "TC-002",
    query: "What must you do before you can use a model in Amazon Bedrock?",
    groundTruthAnswer: "You must request access to a model before you can use it. If you try to use the model before requesting access, you will receive an error message.",
    category: "Factoid"
  },
  {
    id: "TC-003",
    query: "What is Provisioned Throughput in Amazon Bedrock?",
    groundTruthAnswer: "Provisioned Throughput allows you to purchase throughput capacity to run inference on models at discounted rates.",
    category: "Feature Overview"
  },
  {
    id: "TC-004",
    query: "Which AWS regions support Amazon Bedrock?",
    groundTruthAnswer: "Amazon Bedrock is available in US East (N. Virginia), US West (Oregon), Asia Pacific (Singapore), Asia Pacific (Tokyo), and Europe (Frankfurt).",
    category: "Regional Support"
  },
  {
    id: "TC-005",
    query: "What prompt format is required for Anthropic Claude models?",
    groundTruthAnswer: "Anthropic Claude prompts require the structure starting with \\n\\nHuman: <prompt> and ending with \\n\\nAssistant:.",
    category: "Technical Schema"
  },
  {
    id: "TC-006",
    query: "What is the provisioned throughput Model ID for Titan Text G1 - Express 8K?",
    groundTruthAnswer: "The Model ID for Titan Text G1 - Express 8K provisioned throughput is amazon.titan-text-express-v1:0:8k.",
    category: "Technical Schema"
  },
  {
    id: "TC-007",
    query: "What are Agents for Amazon Bedrock used for?",
    groundTruthAnswer: "Agents for Amazon Bedrock are used to perform orchestration and carry out tasks for customers.",
    category: "Feature Overview"
  },
  {
    id: "TC-008",
    query: "What are Knowledge bases for Amazon Bedrock used for?",
    groundTruthAnswer: "Knowledge bases for Amazon Bedrock draw from data sources to help your agent find information for your customers.",
    category: "Feature Overview"
  },
  {
    id: "TC-009",
    query: "What parameter fields are used in the Titan model request body?",
    groundTruthAnswer: "The Titan model request body includes inputText and textGenerationConfig with parameters for temperature, topP, maxTokenCount, and stopSequences.",
    category: "Technical Schema"
  },
  {
    id: "TC-010",
    query: "What feature logs model invocations in Amazon Bedrock?",
    groundTruthAnswer: "Model invocation logging collects invocation logs, model input data, and model output data for all invocations in your AWS account used in Amazon Bedrock.",
    category: "Feature Overview"
  }
];