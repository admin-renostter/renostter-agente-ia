// src/lib/prompt-cache.ts
// Cache simples para system prompts (economia de tokens)

const systemPromptCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

export function getCachedSystemPrompt(prompt: string, agentId: string): string {
  const key = `${agentId}:${simpleHash(prompt)}`;
  const cached = systemPromptCache.get(key);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(JSON.stringify({ event: "cache.system.hit", agentId }));
    return cached.content;
  }
  
  systemPromptCache.set(key, { content: prompt, timestamp: Date.now() });
  console.log(JSON.stringify({ event: "cache.system.miss", agentId, cacheSize: systemPromptCache.size }));
  return prompt;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// Limpar cache periodicamente (opcional)
setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [key, value] of systemPromptCache.entries()) {
    if ((now - value.timestamp) > CACHE_TTL) {
      systemPromptCache.delete(key);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(JSON.stringify({ event: "cache.system.cleanup", removed, size: systemPromptCache.size }));
  }
}, 10 * 60 * 1000); // Limpa a cada 10 min
