/**
 * Aurel Home — Client-side cookie synchronization for Next.js Middleware.
 *
 * Synchronizes the verified JWT token to a cookie so that Next.js Edge/Server
 * middleware can inspect session presence and expiration before rendering
 * protected administrative route bundles.
 */

export const AUTH_COOKIE_NAME = "aurel_auth_token";
export const SUPABASE_COOKIE_NAME = "sb-access-token";

export function syncAuthCookie(token: string | null) {
  if (typeof document === "undefined") return;

  const isSecure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const secureFlag = isSecure ? "Secure;" : "";

  if (token && token.trim().length > 10) {
    // 7 days expiration, SameSite=Lax, Path=/
    document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(
      token
    )}; path=/; max-age=604800; SameSite=Lax; ${secureFlag}`;
    document.cookie = `${SUPABASE_COOKIE_NAME}=${encodeURIComponent(
      token
    )}; path=/; max-age=604800; SameSite=Lax; ${secureFlag}`;
  } else {
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax;`;
    document.cookie = `${SUPABASE_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax;`;
  }
}
