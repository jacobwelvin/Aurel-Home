"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Global listener that detects Supabase auth fragments in window.location.hash
 * (such as #error=access_denied&error_code=otp_expired or #access_token=...)
 * and seamlessly forwards the user to /auth/callback to be properly processed.
 */
export function AuthHashListener() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    function checkAuthHash() {
      const hash = window.location.hash;
      if (!hash) return;

      const isAuthError = hash.includes("error=") || hash.includes("error_code=");
      const isAuthSuccess = hash.includes("access_token=") || hash.includes("refresh_token=");

      if (isAuthError || isAuthSuccess) {
        // Do not redirect if we are already on the callback or confirm page
        if (!pathname?.startsWith("/auth/")) {
          const params = hash.startsWith("#") ? hash.substring(1) : hash;
          router.replace(`/auth/callback?${params}`);
        }
      }
    }

    checkAuthHash();
    window.addEventListener("hashchange", checkAuthHash);
    return () => window.removeEventListener("hashchange", checkAuthHash);
  }, [router, pathname]);

  return null;
}
