import { prisma } from "@/lib/prisma";
import { RagClient } from "./rag-client";

export const dynamic = "force-dynamic";

export default async function ToolsRagPage() {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });

  const serialized = documents.map((d) => ({
    id: d.id,
    filename: d.filename,
    createdAt: d.createdAt.toISOString(),
    _count: d._count,
  }));

  return (
    <main className="flex-1 p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Tools / RAG</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Base de conhecimento do agente — {documents.length} documento
          {documents.length !== 1 ? "s" : ""}
        </p>
      </div>
      <RagClient initialDocs={serialized} />
    </main>
  );
}
