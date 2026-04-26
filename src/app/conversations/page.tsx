import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import Link from "next/link";

export default async function ConversationsPage() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Conversas</h1>
      <div className="space-y-2">
        {conversations.map((conv) => (
          <Link
            key={conv.id}
            href={`/conversations/${conv.id}`}
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/10 transition-colors"
          >
            <div className="space-y-1">
              <p className="font-medium">{conv.contact.displayName}</p>
              <p className="text-sm text-muted-foreground">
                {conv.messages[0]?.content?.slice(0, 60) ?? "Sem mensagens"}
              </p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-xs text-muted-foreground">
                {conv.updatedAt.toLocaleDateString("pt-BR")}
              </p>
              {conv.handoffRequested && (
                <span className="block text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                  Handoff
                </span>
              )}
              {conv.aiEnabled && !conv.handoffRequested && (
                <span className="block text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                  IA ativa
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
