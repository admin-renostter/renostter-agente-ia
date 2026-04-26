import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const agents = await prisma.agentSession.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(agents);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const agent = await prisma.agentSession.create({ data });
  return NextResponse.json(agent, { status: 201 });
}
