import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const agents = await prisma.agentSession.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(agents);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { name, systemPrompt, model, temperature, debounceMs, active } = body;
  if (!systemPrompt) {
    return NextResponse.json({ error: "systemPrompt required" }, { status: 400 });
  }
  const agent = await prisma.agentSession.create({
    data: {
      name: typeof name === "string" ? name : "Default",
      systemPrompt: String(systemPrompt),
      model: typeof model === "string" ? model : "gemini-2.5-flash",
      temperature: typeof temperature === "number" ? Math.min(Math.max(temperature, 0), 1) : 0.7,
      debounceMs: typeof debounceMs === "number" ? Math.min(Math.max(debounceMs, 500), 30000) : 5000,
      active: typeof active === "boolean" ? active : true,
    },
  });
  return NextResponse.json(agent, { status: 201 });
}
