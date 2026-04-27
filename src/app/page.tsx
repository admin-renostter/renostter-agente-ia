import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { MessageCircle, Bot, Users, FileText, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalContacts, totalConvs, totalMsgs, totalDocs] = await Promise.all([
    prisma.contact.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.document.count(),
  ]);

  const handoffConvs = await prisma.conversation.count({
    where: { handoffRequested: true },
  });

  return (
    <main className="flex-1 p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Métricas gerais do agente</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="CONTATOS" value={totalContacts} icon={Users} />
        <MetricCard label="CONVERSAS" value={totalConvs} icon={MessageCircle} />
        <MetricCard label="MENSAGENS" value={totalMsgs} icon={MessageCircle} />
        <MetricCard label="DOCS RAG" value={totalDocs} icon={FileText} />
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard
          title="Configurar agente"
          description="Ajustar prompt do sistema, modelo, temperatura e debounce."
          href="/agents"
          icon={Bot}
        />
        <ActionCard
          title="Conversas em andamento"
          description="Monitorar threads, pausar IA, responder manualmente."
          href="/conversations"
          badge={handoffConvs > 0 ? `${handoffConvs} aguardando` : undefined}
          icon={MessageCircle}
        />
      </div>

      {/* Status row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          label="IA ativa"
          value={totalConvs}
          color="green"
          href="/conversations"
        />
        <StatusCard
          label="Handoff pendente"
          value={handoffConvs}
          color={handoffConvs > 0 ? "yellow" : "green"}
          href="/conversations"
        />
        <StatusCard
          label="Documentos RAG"
          value={totalDocs}
          color="blue"
          href="/tools-rag"
        />
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          {label}
        </p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-4xl font-bold">{value}</p>
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  icon: Icon,
  badge,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-6 hover:border-primary/40 hover:bg-accent/10 transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="size-5 text-primary" />
        </div>
        <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{title}</h3>
          {badge && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </Link>
  );
}

function StatusCard({
  label,
  value,
  color,
  href,
}: {
  label: string;
  value: number;
  color: "green" | "yellow" | "blue";
  href: string;
}) {
  const colors = {
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  return (
    <Link
      href={href}
      className={`flex items-center justify-between p-4 rounded-xl border ${colors[color]} hover:opacity-80 transition-opacity`}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xl font-bold">{value}</span>
    </Link>
  );
}
