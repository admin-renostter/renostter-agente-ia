"use client";

import { useState } from "react";
import { Trash2, Plus, FileText, Loader2 } from "lucide-react";

type Doc = {
  id: string;
  filename: string;
  createdAt: string;
  _count: { chunks: number };
};

export function RagClient({ initialDocs }: { initialDocs: Doc[] }) {
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
  const [filename, setFilename] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!filename.trim() || !content.trim()) {
      setError("Preencha o nome e o conteúdo.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: filename.trim(), content: content.trim() }),
      });
      if (!res.ok) throw new Error("Erro ao adicionar documento");
      const doc = await res.json();
      setDocs((prev) => [doc, ...prev]);
      setFilename("");
      setContent("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Add Document */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Adicionar documento</h2>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Nome do documento (ex: manual-produto.txt)"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <textarea
            placeholder="Cole o conteúdo do documento aqui..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-y"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={handleAdd}
            disabled={loading}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Adicionar à base RAG
          </button>
        </div>
      </div>

      {/* Document list */}
      <div className="space-y-2">
        {docs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum documento na base. Adicione um acima.
          </p>
        )}
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-4 rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-3">
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">{doc.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {doc._count.chunks} chunks ·{" "}
                  {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDelete(doc.id)}
              disabled={deleting === doc.id}
              className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
            >
              {deleting === doc.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
