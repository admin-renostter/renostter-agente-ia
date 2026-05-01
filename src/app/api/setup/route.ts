import { NextResponse } from "next/server";
import { registerWebhook, getSessionInfo, startSession } from "@/lib/waha";

const STOPPED_STATES = new Set(["STOPPED", "FAILED", "UNKNOWN"]);

export async function POST() {
  // 1. Register webhook
  const result = await registerWebhook();

  // 2. Check session and auto-start if stopped
  let session = await getSessionInfo();

  if (STOPPED_STATES.has(session.status)) {
    try {
      await startSession();
      // Wait briefly for the session to transition out of STOPPED
      await new Promise((r) => setTimeout(r, 1500));
      session = await getSessionInfo();
    } catch (err) {
      console.error(JSON.stringify({ event: "setup.start_session_failed", err: String(err) }));
    }
  }

  return NextResponse.json({ ...result, session }, { status: result.ok ? 200 : 502 });
}

export async function GET() {
  const session = await getSessionInfo();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : null);
  const expectedHook = appUrl ? `${appUrl}/api/webhooks/waha` : null;
  const webhookRegistered = expectedHook
    ? session.webhooks.includes(expectedHook)
    : null;

  return NextResponse.json({
    session: session.status,
    webhooks: session.webhooks,
    expectedHook,
    webhookRegistered,
  });
}
