import { prisma } from "./prisma";
import { chat } from "./gemini";
import { sendText } from "./waha";
import type { ChannelMessage } from "./debounce";

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
      where: { providerMsgId: msg.providerMsgId ?? `noid-${Date.now()}` },
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

  // Build history (rolling window 10 + summary)
  const recentMsgs = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  recentMsgs.reverse();

  const history = recentMsgs.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const systemPrompt = conv.summary
    ? `${agent.systemPrompt}\n\n[Resumo da conversa anterior]: ${conv.summary}`
    : agent.systemPrompt;

  console.log(JSON.stringify({ event: "flush.decided", decision: "respond", conversationId }));

  let reply: string;
  try {
    reply = await chat(agent.model, systemPrompt, history, agent.temperature);
  } catch (err) {
    console.error(JSON.stringify({ event: "flush.llm_failed", conversationId, err: String(err) }));
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

  // Resolve externalId — NEVER use Contact.id (§0.9.27)
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
  const transcript = allMsgs.map((m) => `${m.role}: ${m.content}`).join("\n");
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

async function enqueueRetry(conversationId: string, msgs: ChannelMessage[]) {
  await prisma.retryQueue.create({
    data: {
      conversationId,
      payload: JSON.stringify(msgs),
      nextRetryAt: new Date(Date.now() + 5000),
    },
  });
}
