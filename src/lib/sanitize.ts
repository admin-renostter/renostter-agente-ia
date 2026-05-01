/**
 * Single-pass text sanitizer for text-only WhatsApp AI agent.
 * Removes image references, base64 blobs, URLs to media files, and non-printable chars.
 * Call once — never stack multiple sanitize calls on the same string.
 */
export function sanitizeText(text: string): string {
  if (!text) return "[EMPTY]";

  return (
    text
      // base64 data URIs
      .replace(/data:image\/[^;]+;base64[^"'\s]*/gi, "[IMG]")
      // HTTP URLs pointing to image files
      .replace(/https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|svg|bmp)([^\s]*)?/gi, "[IMG_URL]")
      // bare filenames like image.png / image.jpg
      .replace(/\bimage\.\w{3,4}\b/gi, "[IMG_REF]")
      // any remaining non-printable chars (keep newlines/CR)
      .replace(/[^\x20-\x7E\x0A\x0D]/g, "")
      .trim() || "[REMOVED]"
  );
}

/** Short, mobile-friendly UX messages for WhatsApp (keep under ~160 chars). */
export const UX_MESSAGES = {
  image: "📸 Só aceitamos texto. Digite sua dúvida!",
  quota: "⏳ Estou ocupado no momento. Tente em 1h ou digite 'falar com atendente'.",
  error: "⚠️ Algo deu errado. Digite 'atendente' para suporte humano.",
} as const;
