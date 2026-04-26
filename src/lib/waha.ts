const WAHA_BASE = process.env.WAHA_BASE_URL ?? "http://localhost:8080";

export async function sendText(chatId: string, text: string): Promise<void> {
  // chatId must be ContactIdentity.externalId (e.g. "5511...@c.us" or "...@lid")
  if (!chatId.includes("@")) {
    throw new Error(`sendText: invalid chatId "${chatId}" — must contain @`);
  }
  const res = await fetch(`${WAHA_BASE}/api/sendText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session: "default", chatId, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Waha sendText failed ${res.status}: ${body}`);
  }
}

export async function startSession(): Promise<void> {
  await fetch(`${WAHA_BASE}/api/sessions/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "default" }),
  });
}

export async function getSessionStatus(): Promise<string> {
  const res = await fetch(`${WAHA_BASE}/api/sessions/default`);
  if (!res.ok) return "UNKNOWN";
  const data = await res.json();
  return data.status ?? "UNKNOWN";
}
