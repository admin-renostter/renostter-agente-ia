import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/login") ||
    pathname === "/api/health"
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get("panel_session");
  const secret = process.env.AUTH_SECRET;

  if (!secret || session?.value !== secret) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
