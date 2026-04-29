import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendText, getSessionInfo } from "@/lib/waha";
import { chat } from "@/lib/gemini";

// GET /api/test — pipeline status check
export async function GET() {
  const [agent, sessionInfo, convCount] = await Promise.all([
    prisma.agentSession.findFirst({ where: { active: true } }),
    getSessionInfo(),
    prisma.conversation.count(),
  ]);

  const geminiOk = await chat(
    agent?.model ?? "gemini-2.5-flash",
    "Responda apenas: OK",
    [{ role: "user", content: "teste" }],
    0.1
  ).then(() => true).catch((e: unknown) => String(e));

  return NextResponse.json({
    agent: agent
      ? { name: agent.name, model: agent.model, active: agent.active, debounceMs: agent.debounceMs }
      : null,
    waha: { status: sessionInfo.status, webhooks: sessionInfo.webhooks },
    gemini: geminiOk === true ? "ok" : geminiOk,
    conversations: convCount,
  });
}

// POST /api/test — send a real WhatsApp message to verify the send path
// Body: { "chatId": "5511999999999@c.us", "text": "Mensagem de teste" }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { chatId, text } = body as { chatId?: string; text?: string };

  if (!chatId || !chatId.includes("@")) {
    return NextResponse.json(
      { error: "chatId obrigatório (formato: 5511999999999@c.us)" },
      { status: 400 }
    );
  }

  const message = text ?? "🤖 Teste do agente Renostter — enviando mensagem com sucesso!";

  try {
    await sendText(chatId, message);
    return NextResponse.json({ ok: true, sent: { chatId, message } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
