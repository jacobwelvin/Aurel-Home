"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { syncAuthCookie } from "@/lib/authCookie";

/**
 * Global component that ensures patron and administrator sessions are
 * initialized across the entire application and keeps the server-accessible
 * auth cookie in sync with active browser state.
 */
export function AuthInitializer() {
  const { initialize, isInitialized, token } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    } else if (token) {
      syncAuthCookie(token);
    }
  }, [initialize, isInitialized, token]);

  return null;
}
