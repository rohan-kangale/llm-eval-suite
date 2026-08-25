import { ChatOllama } from "@langchain/ollama";

export const llm = new ChatOllama({
    baseUrl: "http://localhost:11434", // Default Ollama server
    model: "llama3.2",                  // Substitute with your pulled model (e.g., mistral, llama3)
    temperature: 0.2,                   // Low temperature for strict factual grounding
});