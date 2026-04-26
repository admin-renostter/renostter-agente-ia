"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Message { id: string; role: string; content: string; createdAt: string }
interface Conv { id: string; aiEnabled: boolean; handoffRequested: boolean; contact: { displayName: string } }

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const [conv, setConv] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    const [cRes, mRes] = await Promise.all([
      fetch(`/api/conversations/${id}`),
      fetch(`/api/conversations/${id}/messages`),
    ]);
    if (cRes.ok) setConv(await cRes.json());
    if (mRes.ok) setMessages(await mRes.json());
  }

  useEffect(() => { load(); }, [id]);

  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    await fetch(`/api/conversations/${id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: reply }),
    });
    setReply("");
    setSending(false);
    load();
  }

  async function setAi(enabled: boolean) {
    await fetch(`/api/conversations/${id}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    load();
  }

  if (!conv) return <div className="p-6">Carregando...</div>;

  return (
    <main className="p-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{conv.contact.displayName}</h1>
        {/* Botão explícito de reativar IA (§0.9.17) */}
        {conv.handoffRequested ? (
          <button
            onClick={() => setAi(true)}
            className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded-lg hover:opacity-90"
          >
            Resolver handoff
          </button>
        ) : conv.aiEnabled ? (
          <button
            onClick={() => setAi(false)}
            className="text-sm bg-muted text-muted-foreground px-3 py-1 rounded-lg hover:bg-accent/20"
          >
            Pausar IA
          </button>
        ) : (
          <button
            onClick={() => setAi(true)}
            className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded-lg hover:opacity-90"
          >
            Reativar IA
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg text-sm ${
              msg.role === "user"
                ? "bg-muted text-foreground self-start"
                : "bg-primary/10 text-primary self-end ml-8"
            }`}
          >
            <p className="text-xs text-muted-foreground mb-1 capitalize">{msg.role}</p>
            {msg.content}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendReply()}
          placeholder="Resposta manual..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={sendReply}
          disabled={sending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </main>
  );
}
