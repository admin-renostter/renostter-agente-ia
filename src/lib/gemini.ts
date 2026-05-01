import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getRedis } from "./redis";

const GOOGLE_API_KEYS = (process.env.GOOGLE_API_KEYS ?? process.env.GOOGLE_API_KEY ?? "")
  .split(",")
  .map(k => k.trim())
  .filter(Boolean);

const EXHAUSTED_KEY_PREFIX = "gemini:exhausted:";
const EXHAUSTED_TTL = 24 * 60 * 60;

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

// Simple function to remove image references
function cleanText(text: string): string {
  if (!text) return "[EMPTY]";
  
  let cleaned = text;
  
  // Remove any occurrence of image.png (case insensitive)
  cleaned = cleaned.replace(/image\.png/gi, " ");
  cleaned = cleaned.replace(/image\.jpg/gi, " ");
  cleaned = cleaned.replace(/image\.jpeg/gi, " ");
  
  // Remove quoted filenames
  cleaned = cleaned.replace(/"image\.\w+"/gi, " ");
  cleaned = cleaned.replace(/'image\.\w+'/gi, " ");
  
  // Remove any "image" word followed by dot and extension
  cleaned = cleaned.replace(/\bimage\s*[.":]\s*\w+\.\w{3,4}/gi, " ");
  
  // Keep only printable ASCII
  cleaned = cleaned.split('').filter(c => {
    const code = c.charCodeAt(0);
    return (code >= 0x20 && code <= 0x7E) || code === 0x0A || code === 0x0D;
  }).join('');
  
  return cleaned.trim() || "[CONTENT_REMOVED]";
}

function resolveModel(modelId: string, apiKey?: string) {
  if (modelId.includes("/")) {
    return getOpenRouter()(modelId);
  }
  return createGoogleGenerativeAI({ apiKey })(modelId);
}

async function isKeyExhausted(key: string): Promise<boolean> {
  try {
    const redis = getRedis();
    return (await redis.get(`${EXHAUSTED_KEY_PREFIX}${key}`)) !== null;
  } catch {
    return false;
  }
}

async function markKeyExhausted(key: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(`${EXHAUSTED_KEY_PREFIX}${key}`, "1", "EX", EXHAUSTED_TTL);
  } catch {}
}

export async function chat(
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  temperature = 0.7
): Promise<string> {
  if (GOOGLE_API_KEYS.length === 0 && !model.includes("/")) {
    throw new Error("No Google API keys configured");
  }

  // Clean ALL input
  const cleanSystem = cleanText(systemPrompt);
  
  const cleanMessages = messages.map(msg => ({
    role: msg.role === "user" ? "user" as const : "assistant" as const,
    content: cleanText(msg.content || "")
  }));

  // Log what we're sending
  console.log(JSON.stringify({
    event: "gemini.call",
    model,
    systemPreview: cleanSystem.substring(0, 100),
    messageCount: cleanMessages.length
  }));

  const availableKeys = GOOGLE_API_KEYS.length > 0 ? GOOGLE_API_KEYS : [undefined];
  let lastError: Error | null = null;

  for (const key of availableKeys) {
    if (key && await isKeyExhausted(key)) {
      console.log(JSON.stringify({ event: "gemini.skip_key", key: key.slice(0, 15) }));
      continue;
    }

    try {
      const { text } = await generateText({
        model: resolveModel(model, key),
        system: cleanSystem,
        messages: cleanMessages,
        temperature,
      });
      console.log(JSON.stringify({ event: "gemini.success", model }));
      return text;
    } catch (err) {
      const errMsg = String(err);
      
      // Handle image errors - simple check
      const isImageError = errMsg.toLowerCase().includes("image") && 
                             (errMsg.toLowerCase().includes("cannot read") || 
                              errMsg.toLowerCase().includes("not support"));
      
      if (isImageError) {
        console.error(JSON.stringify({ event: "gemini.image_error", err: errMsg }));
        return "📝 Atendimento apenas por texto no momento. Por favor, envie sua dúvida digitada (sem imagens).";
      }
      
      // Handle quota errors
      if (errMsg.includes("429") || errMsg.toLowerCase().includes("quota")) {
        console.error(JSON.stringify({ event: "gemini.quota", key: key?.slice(0, 15) }));
        if (key) await markKeyExhausted(key);
        continue;
      }
      
      lastError = err instanceof Error ? err : new Error(errMsg);
      break;
    }
  }

  throw lastError ?? new Error("All API keys exhausted or failed");
}

export async function embed(texts: string[]): Promise<number[][]> {
  const availableKeys = GOOGLE_API_KEYS.length > 0 ? GOOGLE_API_KEYS : [undefined];
  
  for (const key of availableKeys) {
    if (key && await isKeyExhausted(key)) continue;
    
    try {
      const google = createGoogleGenerativeAI({ apiKey: key });
      const { embeddings } = await import("ai").then(m => m.embedMany({
        model: google.textEmbeddingModel("gemini-embedding-2"),
        values: texts,
      }));
      return embeddings;
    } catch (err) {
      const errMsg = String(err);
      if (errMsg.includes("429") || errMsg.toLowerCase().includes("quota")) {
        if (key) await markKeyExhausted(key);
        continue;
      }
      throw err;
    }
  }
  
  throw new Error("All API keys exhausted for embeddings");
}
