"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  debounceMs: number;
  active: boolean;
}

export default function AgentEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";
  const [form, setForm] = useState<Partial<Agent>>({
    name: "Default",
    systemPrompt: "Você é um assistente de vendas da Renostter. Seja prestativo, objetivo e profissional.",
    model: "gemini-2.5-flash",
    temperature: 0.7,
    debounceMs: 5000,
    active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/agents/${id}`).then((r) => r.json()).then(setForm);
    }
  }, [id, isNew]);

  function set(key: keyof Agent, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    const method = isNew ? "POST" : "PUT";
    const url = isNew ? "/api/agents" : `/api/agents/${id}`;
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    router.push("/agents");
  }

  return (
    <main className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{isNew ? "Novo agente" : "Editar agente"}</h1>

      <div className="space-y-4">
        <Field label="Nome">
          <input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} className={inputCls} />
        </Field>

        <Field label="System Prompt">
          <textarea
            rows={6}
            value={form.systemPrompt ?? ""}
            onChange={(e) => set("systemPrompt", e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Modelo">
          <select value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} className={inputCls}>
            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            <option value="gemini-2.5-pro">gemini-2.5-pro</option>
            <option value="gemini-flash-latest">gemini-flash-latest</option>
          </select>
        </Field>

        <Field label={`Temperature (${form.temperature})`}>
          <input
            type="range" min={0} max={1} step={0.05}
            value={form.temperature ?? 0.7}
            onChange={(e) => set("temperature", parseFloat(e.target.value))}
            className="w-full"
          />
        </Field>

        <Field label={`Debounce (${form.debounceMs}ms)`}>
          <input
            type="range" min={1000} max={15000} step={500}
            value={form.debounceMs ?? 5000}
            onChange={(e) => set("debounceMs", parseInt(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Janela de coalescing de mensagens antes de responder
          </p>
        </Field>

        <Field label="Status">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active ?? true}
              onChange={(e) => set("active", e.target.checked)}
            />
            <span className="text-sm">Agente ativo</span>
          </label>
        </Field>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </main>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
