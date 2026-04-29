import { NextResponse } from "next/server";
import { registerWebhook, getSessionInfo } from "@/lib/waha";

export async function POST() {
  const result = await registerWebhook();
  const session = await getSessionInfo();
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
