import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { enqueueDebounce } from "@/lib/debounce";
import { getRedis } from "@/lib/redis";

// Rate limit: max 60 requests per minute per IP
const RL_MAX = 60;
const RL_WINDOW_SEC = 60;

async function isRateLimited(ip: string): Promise<boolean> {
  try {
    const redis = getRedis();
    const key = `rl:waha:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RL_WINDOW_SEC);
    return count > RL_MAX;
  } catch {
    // Redis unavailable — allow request to proceed
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Auth check
  const wahaKey = process.env.WAHA_API_KEY ?? process.env.WHATSAPP_API_KEY ?? "";
  if (wahaKey) {
    const incoming = request.headers.get("x-api-key") ?? "";
    if (incoming !== wahaKey) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  // Rate limiting — keyed by forwarded IP or socket address
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    console.log(JSON.stringify({ event: "webhook.waha.rate_limited", ip }));
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  console.log(JSON.stringify({ event: "webhook.waha.recv", type: body.event }));

  if (body.event === "session.status") {
    const sessionStatus: string = body.payload?.status ?? body.status ?? "UNKNOWN";
    console.log(JSON.stringify({ event: "webhook.waha.session_status", status: sessionStatus }));

    if (sessionStatus === "STOPPED" || sessionStatus === "FAILED") {
      try {
        const { startSession } = await import("@/lib/waha");
        await startSession();
      } catch { /* ignore — WAHA might not be ready yet */ }
    }

    return NextResponse.json({ ok: true });
  }

  if (body.event !== "message") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const payload = body.payload;
  if (!payload || payload.fromMe) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const providerMsgId: string | undefined = payload.id;
  const externalId: string = payload.from;
  const text: string = payload.body ?? "";
  const displayName: string = payload.notifyName ?? externalId;
  const hasMedia = payload.hasMedia === true;

  if (externalId.includes("@g.us") || externalId.includes("status@broadcast")) {
    console.log(JSON.stringify({ event: "webhook.waha.skipped", reason: "group_or_status", externalId }));
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (hasMedia) {
    console.log(JSON.stringify({ event: "webhook.waha.skipped", reason: "media_not_supported", externalId, mediaType: payload.type }));
    try {
      const { sendText } = await import("@/lib/waha");
      await sendText(externalId, "📸 Só aceitamos texto. Digite sua dúvida!");
    } catch { /* ignore send errors */ }
    return NextResponse.json({ ok: true, skipped: true, media: true });
  }

  if (!text.trim()) {
    console.log(JSON.stringify({ event: "webhook.waha.skipped", reason: "empty_message", externalId }));
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Dedup via Redis (fast), fallback to DB
  if (providerMsgId) {
    try {
      const redis = getRedis();
      const isNew = await redis.set(`seen:${providerMsgId}`, "1", "PX", 120_000, "NX");
      if (!isNew) {
        console.log(JSON.stringify({ event: "webhook.waha.duplicate", providerMsgId }));
        return NextResponse.json({ ok: true, duplicate: true });
      }
    } catch {
      const dup = await prisma.message.findUnique({ where: { providerMsgId } });
      if (dup) return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  const identity = await ensureContactIdentity("waha", externalId, displayName);
  if (!identity) return NextResponse.json({ ok: false }, { status: 500 });

  const conv = await prisma.conversation.upsert({
    where: { channel_contactId: { channel: "waha", contactId: identity.contactId } },
    update: {},
    create: { channel: "waha", contactId: identity.contactId },
  });

  const agent = await prisma.agentSession.findFirst({ where: { active: true } });
  const debounceMs = agent?.debounceMs ?? 5000;

  await enqueueDebounce(
    {
      providerMsgId,
      contactId: externalId,
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
