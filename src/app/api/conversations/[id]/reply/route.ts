import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendText } from "@/lib/waha";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { text } = await request.json();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Always use ContactIdentity.externalId — never Contact.id (§0.9.27)
  const identity = await prisma.contactIdentity.findFirst({
    where: { contactId: conv.contactId, channel: conv.channel },
  });
  if (!identity?.externalId) {
    return NextResponse.json({ error: "no externalId" }, { status: 500 });
  }

  await sendText(identity.externalId, text);

  await prisma.message.create({
    data: { conversationId: id, role: "assistant", content: text },
  });

  return NextResponse.json({ ok: true });
}
