import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (boolean) required" }, { status: 400 });
  }
  const enabled: boolean = body.enabled;
  await prisma.conversation.update({
    where: { id },
    data: { aiEnabled: enabled, handoffRequested: enabled ? false : undefined },
  });
  return NextResponse.json({ ok: true });
}
