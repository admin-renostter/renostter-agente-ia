import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import Link from "next/link";

export default async function AgentsPage() {
  const agents = await prisma.agentSession.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agentes</h1>
        <Link
          href="/agents/new"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90"
        >
          + Novo agente
        </Link>
      </div>
      <div className="space-y-2">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={`/agents/${agent.id}`}
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/10 transition-colors"
          >
            <div>
              <p className="font-medium">{agent.name}</p>
              <p className="text-sm text-muted-foreground">
                {agent.model} · debounce {agent.debounceMs}ms · temp {agent.temperature}
              </p>
            </div>
            {agent.active && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                Ativo
              </span>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
