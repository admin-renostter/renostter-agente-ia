import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, embedMany } from "ai";
import { getRedis } from "./redis";

// Parse multiple API keys from GOOGLE_API_KEYS (comma-separated) or fallback to single GOOGLE_API_KEY
const GOOGLE_API_KEYS = (process.env.GOOGLE_API_KEYS ?? process.env.GOOGLE_API_KEY ?? "")
  .split(",")
  .map(k => k.trim())
  .filter(Boolean);

const EXHAUSTED_KEY_PREFIX = "gemini:exhausted:";
const EXHAUSTED_TTL = 24 * 60 * 60; // 24 hours (quota resets daily)

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

function resolveModel(modelId: string, apiKey?: string) {
  // Models with "/" are OpenRouter (e.g. "meta-llama/llama-3.3-70b-instruct:free")
  if (modelId.includes("/")) {
    return getOpenRouter()(modelId);
  }
  const google = createGoogleGenerativeAI({ apiKey });
  return google(modelId);
}

async function isKeyExhausted(key: string): Promise<boolean> {
  try {
    const redis = getRedis();
    const result = await redis.get(`${EXHAUSTED_KEY_PREFIX}${key}`);
    return result !== null;
  } catch {
    return false; // If Redis fails, assume key is available
  }
}

async function markKeyExhausted(key: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(`${EXHAUSTED_KEY_PREFIX}${key}`, "1", "EX", EXHAUSTED_TTL);
    console.log(JSON.stringify({ event: "gemini.key_marked_exhausted", key: key.slice(0, 15) + "..." }));
  } catch {
    // Ignore Redis errors
  }
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

  // QA VALIDATION: Ensure ALL messages are TEXT-ONLY before sending to LLM
  const sanitizedMessages = messages.map((msg, idx) => {
    let content = msg.content || "";
    
    // Aggressive sanitization for text-only models
    content = content
      .replace(/data:image\/[^;]+;base64[^"'\s]*/gi, '[IMAGE_REMOVED]')
      .replace(/https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|svg|bmp)([^\s]*)?/gi, '[IMAGE_URL_REMOVED]')
      .replace(/image\.png|image\.jpg|image\.jpeg/gi, '[IMAGE_REF]')
      .replace(/[^\x20-\x7E\x0A\x0D\xC0-\xFF]/g, '') // Remove non-printable except newlines
      .trim();
    
    if (!content || content.length < 1) {
      content = msg.role === 'user' ? '[Mensagem não legível]' : '[Conteúdo removido]';
    }
    
    // Log if content was modified
    if (content !== msg.content) {
      console.log(JSON.stringify({
        event: "gemini.sanitize",
        index: idx,
        role: msg.role,
        originalLength: msg.content?.length || 0,
        sanitizedLength: content.length,
        preview: content.substring(0, 50)
      }));
    }
    
    return {
      role: msg.role,
      content: content
    };
  });

  // FINAL CHECK: Log exactly what will be sent to LLM
  console.log(JSON.stringify({
    event: "gemini.llm_call",
    model,
    messageCount: sanitizedMessages.length,
    messages: sanitizedMessages.map(m => ({
      role: m.role,
      contentLength: m.content.length,
      contentPreview: m.content.substring(0, 80)
    }))
  }));

  const availableKeys = GOOGLE_API_KEYS.length > 0 ? GOOGLE_API_KEYS : [undefined];
  let lastError: Error | null = null;

  for (const key of availableKeys) {
    // Skip exhausted keys (only for Google keys)
    if (key && await isKeyExhausted(key)) {
      console.log(JSON.stringify({ event: "gemini.key_skip_exhausted", key: key.slice(0, 15) + "..." }));
      continue;
    }

    try {
      const { text } = await generateText({
        model: resolveModel(model, key),
        system: systemPrompt,
        messages: sanitizedMessages,
        temperature,
      });
      console.log(JSON.stringify({ event: "gemini.chat_success", key: key ? key.slice(0, 15) + "..." : "openrouter", model }));
      return text;
    } catch (err) {
      const errMsg = String(err);
      const isQuotaError = errMsg.includes("429") ||
                          errMsg.toLowerCase().includes("quota") ||
                          errMsg.toLowerCase().includes("exceeded") ||
                          errMsg.toLowerCase().includes("rate limit");

      // Handle image not supported error (model doesn't support multimodal input)
      const isImageNotSupported = errMsg.toLowerCase().includes("image") &&
                                  (errMsg.toLowerCase().includes("not support") || errMsg.toLowerCase().includes("cannot read"));

      if (isImageNotSupported) {
        console.error(JSON.stringify({ event: "gemini.image_not_supported", model, err: errMsg }));
        // Return a safe message instead of throwing - this prevents the error from breaking the flow
        return "📝 Atendimento apenas por texto no momento. Por favor, envie sua dúvida digitada (sem imagens).";
      }

      if (isQuotaError && key) {
        console.error(JSON.stringify({ event: "gemini.quota_exceeded", key: key.slice(0, 15) + "...", err: errMsg }));
        await markKeyExhausted(key);
        continue; // Try next key
      }

      if (key) {
        console.error(JSON.stringify({ event: "gemini.chat_error", key: key.slice(0, 15) + "...", err: errMsg }));
      }
      lastError = err instanceof Error ? err : new Error(errMsg);
      break; // Non-quota errors: don't try other keys
    }
  }

  throw lastError ?? new Error("All API keys exhausted or failed");
}

export async function embed(texts: string[]): Promise<number[][]> {
  // For embeddings, use the first non-exhausted key
  const availableKeys = GOOGLE_API_KEYS.length > 0 ? GOOGLE_API_KEYS : [undefined];

  for (const key of availableKeys) {
    if (key && await isKeyExhausted(key)) continue;

    try {
      const google = createGoogleGenerativeAI({ apiKey: key });
      const { embeddings } = await embedMany({
        model: google.textEmbeddingModel("gemini-embedding-2"),
        values: texts,
      });
      return embeddings;
    } catch (err) {
      const errMsg = String(err);
      const isQuotaError = errMsg.includes("429") || errMsg.toLowerCase().includes("quota");
      if (isQuotaError && key) {
        await markKeyExhausted(key);
        continue;
      }
      throw err;
    }
  }

  throw new Error("All API keys exhausted for embeddings");
}
