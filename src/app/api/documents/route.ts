import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });
  return NextResponse.json(documents);
}

export async function POST(request: NextRequest) {
  const { filename, content } = await request.json().catch(() => ({}));
  if (!filename || !content) {
    return NextResponse.json({ error: "filename and content required" }, { status: 400 });
  }

  const chunkSize = 500;
  const words = content.split(/\s+/);
  const chunkTexts: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunkTexts.push(words.slice(i, i + chunkSize).join(" "));
  }

  const doc = await prisma.document.create({
    data: {
      filename,
      content,
      chunks: {
        create: chunkTexts.map((c) => ({ content: c })),
      },
    },
    include: { _count: { select: { chunks: true } } },
  });

  return NextResponse.json(doc, { status: 201 });
}
