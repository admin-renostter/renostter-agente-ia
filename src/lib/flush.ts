import { prisma } from "./prisma";
import { chat } from "./gemini";
import { sendText } from "./waha";
import type { ChannelMessage } from "./debounce";
import { randomUUID } from "crypto";

const HANDOFF_KEYWORDS = [
  "falar com atendente",
  "humano",
  "atendente",
  "suporte humano",
];

export async function flushConversation(
  conversationId: string,
  msgs: ChannelMessage[]
): Promise<void> {
  console.log(JSON.stringify({ event: "flush.start", conversationId, msgCount: msgs.length }));

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true },
  });

  if (!conv) {
    console.error(JSON.stringify({ event: "flush.conv_not_found", conversationId }));
    return;
  }

  if (!conv.aiEnabled) {
    console.log(JSON.stringify({ event: "flush.decided", decision: "ai_disabled", conversationId }));
    return;
  }

  const combinedText = msgs.map((m) => m.text).join("\n");

  // Handoff check
  const isHandoff = HANDOFF_KEYWORDS.some((kw) =>
    combinedText.toLowerCase().includes(kw)
  );
  if (isHandoff) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { handoffRequested: true, aiEnabled: false },
    });
    console.log(JSON.stringify({ event: "flush.decided", decision: "handoff", conversationId }));
    return;
  }

  // Persist inbound messages
  for (const msg of msgs) {
    await prisma.message.upsert({
      where: { providerMsgId: msg.providerMsgId ?? randomUUID() },
      update: {},
      create: {
        conversationId,
        role: "user",
        content: msg.text,
        providerMsgId: msg.providerMsgId,
      },
    });
  }

  // Get agent config
  const agent = await prisma.agentSession.findFirst({ where: { active: true } });
  if (!agent) {
    console.error(JSON.stringify({ event: "flush.no_agent", conversationId }));
    return;
  }

  // Build history (rolling window 10 + summary) — text-only agent, skip any media
  const recentMsgs = await prisma.message.findMany({
    where: {
      conversationId,
    },
    orderBy: { createdAt: "desc" },
    take: 20, // fetch more to filter out bad ones
  });
  
  console.log(JSON.stringify({
    event: "flush.history.raw",
    conversationId,
    totalFetched: recentMsgs.length,
    messages: recentMsgs.map(m => ({
      id: m.id,
      role: m.role,
      contentPreview: m.content ? m.content.substring(0, 100) : null,
      contentLength: m.content ? m.content.length : 0
    }))
  }));

  // Filter out messages that might have image references
  const textOnlyMsgs = recentMsgs.filter((m) => {
    if (!m.content) {
      console.log(JSON.stringify({ event: "flush.history.skip", reason: "empty_content", msgId: m.id }));
      return false;
    }
    const c = m.content.toLowerCase();
    // Skip messages that look like image references
    const skip = c.includes('.png') || 
                c.includes('.jpg') || 
                c.includes('.jpeg') || 
                c.includes('.gif') ||
                c.includes('image') ||
                c.includes('data:image') ||
                c.includes('.webp');
    
    if (skip) {
      console.log(JSON.stringify({ event: "flush.history.skip", reason: "image_reference", msgId: m.id, preview: m.content.substring(0, 50) }));
    }
    return !skip;
  }).slice(0, 10); // take only 10 after filtering
  
  console.log(JSON.stringify({
    event: "flush.history.filtered",
    conversationId,
    originalCount: recentMsgs.length,
    filteredCount: textOnlyMsgs.length,
    willSendToLLM: textOnlyMsgs.map(m => ({ role: m.role, preview: m.content.substring(0, 50) }))
  }));

  textOnlyMsgs.reverse();

  // DEEP SANITIZATION: Ensure ONLY clean text reaches the LLM
  const history = textOnlyMsgs.map((m) => {
    let cleanContent = m.content || "";
    
    // Aggressive cleanup: remove any potential image references
    cleanContent = cleanContent
      .replace(/data:image\/[^;]+;base64[^"'\s]*/gi, '[IMAGE_REMOVED]')
      .replace(/https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|svg|bmp)([^\s]*)?/gi, '[IMAGE_URL_REMOVED]')
      .replace(/[^\x20-\x7E\x0A\x0D\xC0-\xFF]/g, '') // Remove non-printable chars except newlines
      .replace(/image\.png|image\.jpg|image\.jpeg/gi, '[IMAGE_REF]')
      .trim();
    
    // If content became empty or suspicious after cleanup, provide fallback
    if (!cleanContent || cleanContent.length < 2) {
      cleanContent = m.role === 'user' ? '[Mensagem não legível]' : '[Conteúdo removido]';
    }
    
    return {
      role: m.role as "user" | "assistant",
      content: cleanContent,
    };
  });

  // FINAL SAFETY CHECK: Log exactly what will be sent to LLM
  console.log(JSON.stringify({
    event: "flush.llm_payload",
    conversationId,
    messageCount: history.length,
    messages: history.map(m => ({
      role: m.role,
      contentLength: m.content.length,
      contentPreview: m.content.substring(0, 100)
    }))
  }));

  // Sanitize summary and system prompt to remove any image references
  let cleanSummary = conv.summary || "";
  if (cleanSummary) {
    cleanSummary = cleanSummary
      .replace(/data:image\/[^;]+;base64[^"'\s]*/gi, '[IMAGE_REMOVED]')
      .replace(/https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp)([^\s]*)?/gi, '[IMAGE_URL_REMOVED]')
      .replace(/image\.png|image\.jpg|image\.jpeg/gi, '[IMAGE_REF]');
  }

  let cleanSystemPrompt = agent.systemPrompt || "";
  cleanSystemPrompt = cleanSystemPrompt
    .replace(/data:image\/[^;]+;base64[^"'\s]*/gi, '[IMAGE_REMOVED]')
    .replace(/https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp)([^\s]*)?/gi, '[IMAGE_URL_REMOVED]')
    .replace(/image\.png|image\.jpg|image\.jpeg/gi, '[IMAGE_REF]');

  const systemPrompt = cleanSummary
    ? `${cleanSystemPrompt}\n\n[Resumo da conversa anterior]: ${cleanSummary}`
    : cleanSystemPrompt;

  console.log(JSON.stringify({ event: "flush.decided", decision: "respond", conversationId }));

  // Resolve externalId BEFORE LLM call — needed if all API keys exhausted (§0.9.27)
  const externalId =
    msgs[0]?.contactId ??
    (await (async () => {
      const ident = await prisma.contactIdentity.findFirst({
        where: { contactId: conv.contactId, channel: conv.channel },
      });
      return ident?.externalId;
    })());

  if (!externalId) {
    console.error(JSON.stringify({ event: "flush.no_external_id", conversationId }));
    return;
  }

  let reply: string;
  try {
    reply = await chat(agent.model, systemPrompt, history, agent.temperature);
  } catch (err) {
    const errMsg = String(err);
    const cause = err instanceof Error && (err as Error & { cause?: unknown }).cause;
    const causeMsg = cause ? String(cause) : undefined;
    console.error(JSON.stringify({ event: "flush.llm_failed", conversationId, model: agent.model, err: errMsg, cause: causeMsg }));

    // Check if ALL API keys are exhausted (quota exceeded for all)
    const isAllKeysExhausted = errMsg.toLowerCase().includes("all api keys exhausted") ||
                              (errMsg.includes("429") && errMsg.toLowerCase().includes("quota"));

    if (isAllKeysExhausted) {
      console.error(JSON.stringify({ event: "flush.all_keys_exhausted", conversationId, action: "send_unavailable_message" }));
      await sendUnavailableMessage(externalId, conv);
      return;
    }

    await enqueueRetry(conversationId, msgs);
    return;
  }

  // Persist assistant reply
  await prisma.message.create({
    data: { conversationId, role: "assistant", content: reply },
  });

  // Summarize if too many messages
  const totalMsgs = await prisma.message.count({ where: { conversationId } });
  if (totalMsgs > 30) {
    await summarizeConversation(conversationId, agent.model);
  }

  console.log(JSON.stringify({ event: "flush.sending", conversationId, externalId }));

  try {
    await sendText(externalId, reply);
    console.log(JSON.stringify({ event: "flush.sent_ok", conversationId }));
  } catch (err) {
    console.error(JSON.stringify({ event: "flush.send_failed", conversationId, err: String(err) }));
    await enqueueRetry(conversationId, msgs);
  }
}

async function summarizeConversation(conversationId: string, model: string) {
  const allMsgs = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
  
  // Sanitize transcript to remove any image references
  const transcript = allMsgs.map((m) => {
    let content = m.content || "";
    // Aggressive cleanup for text-only agent
    content = content
      .replace(/data:image\/[^;]+;base64[^"'\s]*/gi, '[IMAGE_REMOVED]')
      .replace(/https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|svg|bmp)([^\s]*)?/gi, '[IMAGE_URL_REMOVED]')
      .replace(/[^\x20-\x7E\x0A\x0D\xC0-\xFF]/g, '') // Remove non-printable except newlines
      .replace(/image\.png|image\.jpg|image\.jpeg/gi, '[IMAGE_REF]')
      .replace(/\.png|\.jpg|\.jpeg|\.gif|\.webp/gi, '[IMAGE]')
      .trim();
    return `${m.role}: ${content}`;
  }).join("\n");
  
  console.log(JSON.stringify({
    event: "flush.summarize",
    conversationId,
    transcriptLength: transcript.length,
    transcriptPreview: transcript.substring(0, 200)
  }));

  const summary = await chat(
    model,
    "Resuma esta conversa em 3–5 frases, preservando detalhes importantes do lead.",
    [{ role: "user", content: transcript }]
  );
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { summary },
  });
  // Keep only last 10 messages
  const toDelete = allMsgs.slice(0, allMsgs.length - 10).map((m) => m.id);
  if (toDelete.length > 0) {
    await prisma.message.deleteMany({ where: { id: { in: toDelete } } });
  }
}

const RETRY_BACKOFF_MS = [1_000, 3_000, 9_000]; // 1s / 3s / 9s

async function enqueueRetry(conversationId: string, msgs: ChannelMessage[]) {
  const existing = await prisma.retryQueue.findFirst({
    where: { conversationId },
    orderBy: { attempts: "desc" },
  });
  const attempts = (existing?.attempts ?? 0) + 1;
  const backoffMs = RETRY_BACKOFF_MS[Math.min(attempts - 1, RETRY_BACKOFF_MS.length - 1)];

  await prisma.retryQueue.create({
    data: {
      conversationId,
      payload: JSON.stringify(msgs),
      attempts,
      nextRetryAt: new Date(Date.now() + backoffMs),
    },
  });
}

// Message sent when ALL API keys are exhausted (quota exceeded for all keys)
const UNAVAILABLE_MESSAGE = "⚠️ Estou temporariamente indisponível devido a limites técnicos de processamento. " +
  "Tente novamente em algumas horas ou, se preferir, digite 'falar com atendente' para ser direcionado ao suporte humano.";

async function sendUnavailableMessage(externalId: string, conv: Awaited<ReturnType<typeof prisma.conversation.findUnique>>) {
  if (!externalId || !conv) return;

  try {
    await sendText(externalId, UNAVAILABLE_MESSAGE);
    console.log(JSON.stringify({ event: "flush.unavailable_msg_sent", conversationId: conv.id, externalId }));

    // Persist the message in DB
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        role: "assistant",
        content: UNAVAILABLE_MESSAGE,
      },
    });
  } catch (err) {
    console.error(JSON.stringify({ event: "flush.unavailable_msg_failed", conversationId: conv.id, err: String(err) }));
  }
}
