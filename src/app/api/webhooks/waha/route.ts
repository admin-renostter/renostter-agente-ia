import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { enqueueDebounce } from "@/lib/debounce";
import { getRedis } from "@/lib/redis";

export async function POST(request: NextRequest) {
  const wahaKey = process.env.WAHA_API_KEY ?? process.env.WHATSAPP_API_KEY ?? "";
  if (wahaKey) {
    const incoming = request.headers.get("x-api-key") ?? "";
    if (incoming !== wahaKey) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  console.log(JSON.stringify({ event: "webhook.waha.recv", type: body.event }));

  // Only handle "message" events (§0.9.4)
  if (body.event !== "message") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const payload = body.payload;
  if (!payload || payload.fromMe) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const providerMsgId: string | undefined = payload.id;
  const externalId: string = payload.from; // always @c.us or @lid (§0.9.21)
  const text: string = payload.body ?? "";
  const displayName: string = payload.notifyName ?? externalId;
  const hasMedia = payload.hasMedia === true;

  // Skip group messages, status broadcasts, and empty messages — each costs a Gemini call
  if (externalId.includes("@g.us") || externalId.includes("status@broadcast")) {
    console.log(JSON.stringify({ event: "webhook.waha.skipped", reason: "group_or_status", externalId }));
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Waha Core is TEXT-ONLY (§0.9 Waha Core spec). Ignore media messages.
  if (hasMedia) {
    console.log(JSON.stringify({ event: "webhook.waha.skipped", reason: "media_not_supported", externalId, mediaType: payload.type }));
    // Send polite message to user about text-only limitation
    try {
      const { sendText } = await import("@/lib/waha");
      await sendText(externalId, "📝 Atendimento apenas por texto no momento. Por favor, envie sua dúvida digitada.");
    } catch { /* ignore send errors */ }
    return NextResponse.json({ ok: true, skipped: true, media: true });
  }

  if (!text.trim()) {
    console.log(JSON.stringify({ event: "webhook.waha.skipped", reason: "empty_message", externalId }));
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Dedup by providerMsgId via Redis (fast, prevents race conditions)
  if (providerMsgId) {
    try {
      const redis = getRedis();
      const isNew = await redis.set(`seen:${providerMsgId}`, "1", "PX", 120_000, "NX");
      if (!isNew) {
        console.log(JSON.stringify({ event: "webhook.waha.duplicate", providerMsgId }));
        return NextResponse.json({ ok: true, duplicate: true });
      }
    } catch {
      // Redis unavailable — fall back to DB check
      const dup = await prisma.message.findUnique({ where: { providerMsgId } });
      if (dup) return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  // Ensure contact identity — create-then-catch P2002 (§0.9.5)
  const identity = await ensureContactIdentity("waha", externalId, displayName);
  if (!identity) return NextResponse.json({ ok: false }, { status: 500 });

  // Ensure conversation
  const conv = await prisma.conversation.upsert({
    where: { channel_contactId: { channel: "waha", contactId: identity.contactId } },
    update: {},
    create: {
      channel: "waha",
      contactId: identity.contactId,
    },
  });

  // Get agent debounce config
  const agent = await prisma.agentSession.findFirst({ where: { active: true } });
  const debounceMs = agent?.debounceMs ?? 5000;

  await enqueueDebounce(
    {
      providerMsgId,
      contactId: externalId, // externalId, NOT Contact.id (§0.9.27)
      text,
      channel: "waha",
      conversationId: conv.id,
    },
    debounceMs
  );

  return NextResponse.json({ ok: true });
}

async function ensureContactIdentity(
  channel: string,
  externalId: string,
  displayName: string
) {
  try {
    return await prisma.contactIdentity.create({
      data: {
        channel,
        externalId,
        contact: { create: { displayName: displayName ?? externalId } },
      },
      include: { contact: true },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return prisma.contactIdentity.findUnique({
        where: { channel_externalId: { channel, externalId } },
        include: { contact: true },
      });
    }
    throw err;
  }
}
