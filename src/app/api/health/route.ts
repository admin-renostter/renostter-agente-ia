import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import { getSessionInfo } from "@/lib/waha";

type ServiceStatus = "ok" | "error";

interface CheckResult {
  status: ServiceStatus;
  latencyMs?: number;
  detail?: string;
}

async function checkPostgres(): Promise<CheckResult> {
  const t = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - t };
  } catch (err) {
    return { status: "error", detail: String(err), latencyMs: Date.now() - t };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const t = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    return { status: "ok", latencyMs: Date.now() - t };
  } catch (err) {
    return { status: "error", detail: String(err), latencyMs: Date.now() - t };
  }
}

const WAHA_HEALTHY = new Set(["WORKING", "SCAN_QR_CODE", "STARTING"]);

async function checkWaha(): Promise<CheckResult> {
  const t = Date.now();
  try {
    const { status, webhooks } = await getSessionInfo();
    const sessionOk = WAHA_HEALTHY.has(status);
    return {
      status: sessionOk ? "ok" : "error",
      latencyMs: Date.now() - t,
      detail: `session=${status} webhooks=${webhooks.length}`,
    };
  } catch (err) {
    return { status: "error", detail: String(err), latencyMs: Date.now() - t };
  }
}

export async function GET() {
  const [postgres, redis, waha] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkWaha(),
  ]);

  const infraOk =
    postgres.status === "ok" &&
    redis.status === "ok";

  // Always return 200 so Railway healthcheck never rolls back the deployment.
  // Waha connectivity is informational — app is alive even when WhatsApp is reconnecting.
  return NextResponse.json(
    { ok: infraOk, ts: Date.now(), services: { postgres, redis, waha } }
  );
}
