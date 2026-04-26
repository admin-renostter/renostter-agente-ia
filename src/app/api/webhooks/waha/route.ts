import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { enqueueDebounce } from "@/lib/debounce";

export async function POST(request: NextRequest) {
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

  // Dedup by providerMsgId (§0.9.5)
  if (providerMsgId) {
    const dup = await prisma.message.findUnique({ where: { providerMsgId } });
    if (dup) {
      console.log(JSON.stringify({ event: "webhook.waha.duplicate", providerMsgId }));
      return NextResponse.json({ ok: true, duplicate: true });
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
