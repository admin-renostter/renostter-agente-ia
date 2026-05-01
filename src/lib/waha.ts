const WAHA_BASE = process.env.WAHA_BASE_URL ?? "http://localhost:8080";
const WAHA_SESSION = process.env.WAHA_SESSION ?? "default";
const WAHA_API_KEY = process.env.WAHA_API_KEY ?? process.env.WHATSAPP_API_KEY ?? "";

function wahaHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = { "X-Api-Key": WAHA_API_KEY };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

function resolveAppUrl(): string | null {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN)
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return null;
}

export async function ensureSession(): Promise<void> {
  try {
    await fetch(`${WAHA_BASE}/api/sessions`, {
      method: "POST",
      headers: wahaHeaders(),
      body: JSON.stringify({ name: WAHA_SESSION }),
    });
    // Ignore errors — session may already exist (409 Conflict is normal)
  } catch { /* ignore */ }
}

export async function registerWebhook(): Promise<{ ok: boolean; detail: string }> {
  const appUrl = resolveAppUrl();
  if (!appUrl) {
    return { ok: false, detail: "NEXT_PUBLIC_APP_URL or RAILWAY_PUBLIC_DOMAIN not set" };
  }

  const hookUrl = `${appUrl}/api/webhooks/waha`;
  const events = (process.env.WAHA_HOOK_EVENTS ?? "message,session.status")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  type WebhookEntry = {
    url: string;
    events: string[];
    customHeaders?: { name: string; value: string }[];
  };

  const webhookEntry: WebhookEntry = { url: hookUrl, events };
  if (WAHA_API_KEY) {
    webhookEntry.customHeaders = [{ name: "X-Api-Key", value: WAHA_API_KEY }];
  }

  try {
    const res = await fetch(`${WAHA_BASE}/api/sessions/${WAHA_SESSION}`, {
      method: "PUT",
      headers: wahaHeaders(),
      body: JSON.stringify({
        config: { webhooks: [webhookEntry] },
      }),
    });
    if (res.ok) {
      return { ok: true, detail: `Webhook registrado: ${hookUrl}` };
    }
    const body = await res.text().catch(() => "");
    return { ok: false, detail: `Waha PUT ${res.status}: ${body}` };
  } catch (err) {
    return { ok: false, detail: String(err) };
  }
}

export async function getSessionInfo(): Promise<{ status: string; webhooks: string[] }> {
  try {
    const res = await fetch(`${WAHA_BASE}/api/sessions/${WAHA_SESSION}`, {
      headers: wahaHeaders(false),
    });
    if (!res.ok) return { status: "UNKNOWN", webhooks: [] };
    const data = await res.json();
    const status: string = data.status ?? "UNKNOWN";
    const webhooks: string[] = (data.config?.webhooks ?? []).map(
      (w: { url?: string }) => w.url ?? ""
    );
    return { status, webhooks };
  } catch {
    return { status: "ERROR", webhooks: [] };
  }
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

export async function startSession(): Promise<{ started: boolean; status: string }> {
  const res = await fetch(`${WAHA_BASE}/api/sessions/${WAHA_SESSION}/start`, {
    method: "POST",
    headers: wahaHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(JSON.stringify({ event: "waha.start_session_failed", status: res.status, body }));
    return { started: false, status: "ERROR" };
  }
  const data = await res.json().catch(() => ({}));
  const status: string = data.status ?? "STARTING";
  console.log(JSON.stringify({ event: "waha.session_started", status }));
  return { started: true, status };
}

export async function getSessionStatus(): Promise<string> {
  const { status } = await getSessionInfo();
  return status;
}
