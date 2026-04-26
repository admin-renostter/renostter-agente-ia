import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { enabled } = await request.json();
  await prisma.conversation.update({
    where: { id },
    data: { aiEnabled: enabled, handoffRequested: enabled ? false : undefined },
  });
  return NextResponse.json({ ok: true });
}
