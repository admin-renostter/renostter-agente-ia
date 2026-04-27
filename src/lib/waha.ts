const WAHA_BASE = process.env.WAHA_BASE_URL ?? "http://localhost:8080";
const WAHA_SESSION = process.env.WAHA_SESSION ?? "default";
const WAHA_API_KEY = process.env.WAHA_API_KEY ?? process.env.WHATSAPP_API_KEY ?? "";

function wahaHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = { "X-Api-Key": WAHA_API_KEY };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export async function sendText(chatId: string, text: string): Promise<void> {
  // chatId must be ContactIdentity.externalId (e.g. "5511...@c.us" or "...@lid")
  if (!chatId.includes("@")) {
    throw new Error(`sendText: invalid chatId "${chatId}" — must contain @`);
  }
  const res = await fetch(`${WAHA_BASE}/api/sendText`, {
    method: "POST",
    headers: wahaHeaders(),
    body: JSON.stringify({ session: WAHA_SESSION, chatId, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Waha sendText failed ${res.status}: ${body}`);
  }
}

export async function startSession(): Promise<void> {
  await fetch(`${WAHA_BASE}/api/sessions/start`, {
    method: "POST",
    headers: wahaHeaders(),
    body: JSON.stringify({ name: WAHA_SESSION }),
  });
}

export async function getSessionStatus(): Promise<string> {
  const res = await fetch(`${WAHA_BASE}/api/sessions/${WAHA_SESSION}`, {
    headers: wahaHeaders(false),
  });
  if (!res.ok) return "UNKNOWN";
  const data = await res.json();
  return data.status ?? "UNKNOWN";
}
