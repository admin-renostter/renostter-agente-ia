import type { NextRequest } from "next/server";

export function isAuthenticated(request: NextRequest): boolean {
  const session = request.cookies.get("panel_session");
  return session?.value === process.env.AUTH_SECRET;
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.PANEL_PASSWORD;
  if (!expected) return false;
  return input === expected;
}
