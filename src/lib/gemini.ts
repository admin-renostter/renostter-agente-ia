import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, embedMany } from "ai";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "",
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function chat(
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  temperature = 0.7
): Promise<string> {
  const { text } = await generateText({
    model: google(model),
    system: systemPrompt,
    messages,
    temperature,
  });
  return text;
}

export async function embed(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    values: texts,
  });
  return embeddings;
}
