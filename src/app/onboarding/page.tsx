import Link from "next/link";
import { CheckCircle, Circle, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [agentCount, docCount, convCount] = await Promise.all([
    prisma.agentSession.count({ where: { active: true } }),
    prisma.document.count(),
    prisma.conversation.count(),
  ]);

  const wahaUrl = process.env.WAHA_BASE_URL?.replace("railway.internal", "production-fbb2.up.railway.app").replace("http://waha", "https://waha") ?? "#";

  const steps = [
    {
      title: "Agente configurado",
      description: "Configure o prompt do sistema, modelo e parâmetros do agente.",
      done: agentCount > 0,
      action: { label: "Configurar agente", href: "/agents" },
    },
    {
      title: "WhatsApp conectado",
      description: "Escaneie o QR code no painel do Waha para conectar o número.",
      done: convCount > 0,
      action: { label: "Abrir painel Waha", href: "https://waha-production-fbb2.up.railway.app", external: true },
    },
    {
      title: "Documentos RAG",
      description: "Adicione PDFs ou textos para que o agente use como base de conhecimento.",
      done: docCount > 0,
      action: { label: "Adicionar documentos", href: "/tools-rag" },
    },
    {
      title: "Primeira conversa",
      description: "Envie uma mensagem de teste para o número conectado e veja o agente responder.",
      done: convCount > 0,
      action: { label: "Ver conversas", href: "/conversations" },
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <main className="flex-1 p-8 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Onboarding</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure seu agente WhatsApp em 4 passos
        </p>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Progresso</p>
          <p className="text-sm text-muted-foreground">
            {completedCount}/{steps.length} concluídos
          </p>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex gap-4 p-5 rounded-xl border transition-colors ${
              step.done
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {step.done ? (
                <CheckCircle className="size-5 text-primary" />
              ) : (
                <Circle className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <p className={`font-medium ${step.done ? "text-primary" : ""}`}>
                  {i + 1}. {step.title}
                </p>
                {step.done && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    Concluído
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{step.description}</p>
              {"external" in step.action && step.action.external ? (
                <a
                  href={step.action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  {step.action.label}
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <Link
                  href={step.action.href}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  {step.action.label} →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
