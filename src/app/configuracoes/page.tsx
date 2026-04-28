export const dynamic = "force-dynamic";

function ConfigRow({ label, value, masked }: { label: string; value: string; masked?: boolean }) {
  const display = masked && value && value !== "—" ? value.slice(0, 6) + "••••••" : value;
  return (
    <div className="flex items-start justify-between py-3 border-b border-border last:border-0">
      <p className="text-sm text-muted-foreground w-48 shrink-0">{label}</p>
      <p className="text-sm font-mono text-right break-all">{display}</p>
    </div>
  );
}

export default async function ConfiguracoesPage() {
  const wahaUrl =
    process.env.WAHA_BASE_URL
      ?.replace("http://", "https://")
      .replace(".railway.internal:8080", "-production-fbb2.up.railway.app") ?? "—";

  return (
    <main className="flex-1 p-8 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Variáveis de ambiente e status da integração
        </p>
      </div>

      {/* Waha */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-1">
        <h2 className="font-semibold mb-3">WhatsApp / Waha</h2>
        <ConfigRow label="WAHA_BASE_URL" value={process.env.WAHA_BASE_URL ?? "—"} />
        <ConfigRow label="Painel público" value={wahaUrl} />
        <ConfigRow
          label="WAHA_API_KEY"
          value={process.env.WAHA_API_KEY ?? process.env.WHATSAPP_API_KEY ?? "—"}
          masked
        />
        <ConfigRow label="WAHA_SESSION" value={process.env.WAHA_SESSION ?? "default"} />
        <div className="pt-3">
          <a
            href={wahaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Abrir painel Waha →
          </a>
        </div>
      </section>

      {/* AI */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-1">
        <h2 className="font-semibold mb-3">Inteligência Artificial</h2>
        <ConfigRow label="GOOGLE_API_KEY" value={process.env.GOOGLE_API_KEY ?? "—"} masked />
        <ConfigRow label="Modelo padrão" value="gemini-2.5-flash" />
      </section>

      {/* Infra */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-1">
        <h2 className="font-semibold mb-3">Infraestrutura</h2>
        <ConfigRow
          label="DATABASE_URL"
          value={process.env.DATABASE_URL ? "Configurado ✓" : "Não configurado ✗"}
        />
        <ConfigRow
          label="REDIS_URL"
          value={process.env.REDIS_URL ? "Configurado ✓" : "Não configurado ✗"}
        />
        <ConfigRow label="NODE_ENV" value={process.env.NODE_ENV ?? "—"} />
      </section>

      {/* Auth */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-1">
        <h2 className="font-semibold mb-3">Autenticação</h2>
        <ConfigRow label="AUTH_SECRET" value={process.env.AUTH_SECRET ?? "—"} masked />
        <p className="text-xs text-muted-foreground pt-2">
          Para alterar a senha, atualize a variável <code className="font-mono">AUTH_SECRET</code> no Railway e reimplante.
        </p>
      </section>
    </main>
  );
}
