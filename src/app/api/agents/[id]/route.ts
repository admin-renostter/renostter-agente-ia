import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = await prisma.agentSession.findUnique({ where: { id } });
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { name, systemPrompt, model, temperature, debounceMs, active } = body;

  const patch: Record<string, unknown> = {};
  if (typeof name === "string") patch.name = name;
  if (typeof systemPrompt === "string") patch.systemPrompt = systemPrompt;
  if (typeof model === "string") patch.model = model;
  if (typeof temperature === "number") patch.temperature = Math.min(Math.max(temperature, 0), 1);
  if (typeof debounceMs === "number") patch.debounceMs = Math.min(Math.max(debounceMs, 500), 30000);
  if (typeof active === "boolean") patch.active = active;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no valid fields to update" }, { status: 400 });
  }

  const agent = await prisma.agentSession.update({ where: { id }, data: patch });
  return NextResponse.json(agent);
}
