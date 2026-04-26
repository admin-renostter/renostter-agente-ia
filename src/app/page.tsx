import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import Link from "next/link";

export default async function DashboardPage() {
  const [totalConvs, activeConvs, handoffConvs, totalMsgs] = await Promise.all([
    prisma.conversation.count(),
    prisma.conversation.count({ where: { aiEnabled: true } }),
    prisma.conversation.count({ where: { handoffRequested: true } }),
    prisma.message.count(),
  ]);

  const recent = await prisma.conversation.findMany({
    take: 10,
    orderBy: { updatedAt: "desc" },
    include: { contact: true },
  });

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Conversas totais" value={totalConvs} />
        <StatCard label="IA ativa" value={activeConvs} />
        <StatCard label="Aguardando humano" value={handoffConvs} />
        <StatCard label="Mensagens" value={totalMsgs} />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Conversas recentes</h2>
        <div className="space-y-2">
          {recent.map((conv) => (
            <Link
              key={conv.id}
              href={`/conversations/${conv.id}`}
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/10 transition-colors"
            >
              <div>
                <p className="font-medium">{conv.contact.displayName}</p>
                <p className="text-sm text-muted-foreground">{conv.channel}</p>
              </div>
              <div className="flex gap-2">
                {conv.handoffRequested && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                    Handoff
                  </span>
                )}
                {!conv.aiEnabled && !conv.handoffRequested && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                    IA pausada
                  </span>
                )}
                {conv.aiEnabled && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                    IA ativa
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-4 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
