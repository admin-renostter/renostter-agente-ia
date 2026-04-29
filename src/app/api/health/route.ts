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

  const allOk =
    postgres.status === "ok" &&
    redis.status === "ok" &&
    waha.status === "ok";

  const httpStatus = allOk ? 200 : 503;

  return NextResponse.json(
    { ok: allOk, ts: Date.now(), services: { postgres, redis, waha } },
    { status: httpStatus }
  );
}
