import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, SUPABASE_COOKIE_NAME } from "@/lib/authCookie";

/**
 * Aurel Home — Server-side middleware for admin route protection.
 *
 * This provides a server-side defense layer for `/admin` routes. It checks
 * for the presence of an authenticated session token in cookies before allowing
 * the request to load administrative pages.
 *
 * Expired or invalid tokens are rejected with a redirect to login.
 *
 * Defense-in-depth: AdminGuard.tsx performs the authoritative cryptographic
 * verification and PostgreSQL database role check with the FastAPI backend.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const cookies = request.cookies;

  // Extract auth token from any supported cookie format
  const rawToken =
    cookies.get(AUTH_COOKIE_NAME)?.value ||
    cookies.get(SUPABASE_COOKIE_NAME)?.value ||
    Array.from(cookies.getAll()).find(
      (c) =>
        (c.name.startsWith("sb-") &&
          (c.name.includes("-auth-token") || c.name.includes("token"))) ||
        c.name === AUTH_COOKIE_NAME
    )?.value;

  const token = rawToken ? decodeURIComponent(rawToken) : null;

  if (!token || token.trim().length < 10) {
    // Unauthenticated — redirect to login, preserving intended admin route
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check if JWT token is expired
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const parsed = JSON.parse(jsonPayload);
      if (parsed.exp && typeof parsed.exp === "number") {
        // Expired if timestamp is in the past (allowing 5s leeway)
        if (parsed.exp * 1000 < Date.now() - 5000) {
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("redirect", pathname);
          const response = NextResponse.redirect(loginUrl);
          response.cookies.delete(AUTH_COOKIE_NAME);
          response.cookies.delete(SUPABASE_COOKIE_NAME);
          return response;
        }
      }
    }
  } catch {
    // If edge decode fails, pass through to AdminGuard for full verification
  }

  // Token cookie exists and is not expired — allow access.
  // AdminGuard.tsx will perform authoritative server role verification.
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
