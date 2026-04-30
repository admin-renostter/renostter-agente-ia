import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, embedMany } from "ai";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "",
});

// OpenRouter provider — used when model contains "/" (e.g. "meta-llama/llama-3.3-70b-instruct:free")
function getOpenRouter() {
  return createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
  });
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function resolveModel(modelId: string) {
  // Models with "/" are OpenRouter (e.g. "meta-llama/llama-3.3-70b-instruct:free")
  if (modelId.includes("/")) {
    return getOpenRouter()(modelId);
  }
  return google(modelId);
}

export async function chat(
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  temperature = 0.7
): Promise<string> {
  const { text } = await generateText({
    model: resolveModel(model),
    system: systemPrompt,
    messages,
    temperature,
  });
  return text;
}

export async function embed(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-2"),
    values: texts,
  });
  return embeddings;
}
