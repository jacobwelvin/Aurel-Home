"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, User, LogOut, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { API_BASE_URL } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { syncAuthCookie } from "@/lib/authCookie";

interface AdminGuardProps {
  children: React.ReactNode;
}

type VerificationState = "checking" | "authorized" | "unauthorized" | "unauthenticated" | "error";

export function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isInitialized, logout, initialize, setProfile } = useAuthStore();

  const [state, setState] = useState<VerificationState>("checking");
  const [denialEmail, setDenialEmail] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRechecking, setIsRechecking] = useState<boolean>(false);
  const [retryKey, setRetryKey] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    // Strict 8-second timeout for security verification
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 8000);

    async function executeVerification() {
      try {
        if (!isInitialized) {
          await initialize();
        }

        let tokenToUse = useAuthStore.getState().token;

        // Check active Supabase session and proactively refresh if expired
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          const now = Math.floor(Date.now() / 1000);
          if (session.expires_at && session.expires_at <= now + 60) {
            const { data: refreshData } = await supabase.auth.refreshSession();
            if (refreshData?.session) {
              tokenToUse = refreshData.session.access_token;
              useAuthStore.setState({
                token: tokenToUse,
              });
            }
          } else {
            tokenToUse = session.access_token;
          }
        }

        if (!tokenToUse) {
          clearTimeout(timeoutId);
          syncAuthCookie(null);
          if (isMounted) {
            setState("unauthenticated");
            router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
          }
          return;
        }

        // Keep cookie in sync for Next.js middleware
        syncAuthCookie(tokenToUse);

        // Mandatory server-side cryptographic verification directly against backend
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${tokenToUse}`,
          },
          cache: "no-store",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.status === 401) {
          await logout();
          syncAuthCookie(null);
          if (isMounted) {
            setState("unauthenticated");
            router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
          }
          return;
        }

        if (res.ok) {
          const userData = await res.json();
          if (isMounted) {
            setDenialEmail(userData.email || "");
            setProfile(userData);

            if (userData.role === "admin") {
              syncAuthCookie(tokenToUse);
              setState("authorized");
            } else {
              // Strictly reject non-admin roles without frontend bypass
              setState("unauthorized");
            }
          }
        } else {
          const errJson = await res.json().catch(() => ({}));
          if (isMounted) {
            setDenialEmail(useAuthStore.getState().profile?.email || "");
            if (res.status === 403) {
              setState("unauthorized");
            } else {
              setState("error");
              setErrorMessage(errJson.detail || `Server verification failed (HTTP ${res.status}).`);
            }
          }
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (isMounted) {
          if (err instanceof Error && err.name === "AbortError") {
            setState("error");
            setErrorMessage(
              "Verification timed out after 8 seconds. The backend or database did not respond in time."
            );
          } else {
            setState("error");
            setErrorMessage(
              err instanceof Error
                ? err.message
                : "Network error contacting Atelier security service."
            );
          }
        }
      } finally {
        if (isMounted) {
          setIsRechecking(false);
        }
      }
    }

    executeVerification();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isInitialized, initialize, pathname, retryKey, router, setProfile]);

  const handleManualRecheck = () => {
    setState("checking");
    setErrorMessage(null);
    setIsRechecking(true);
    setRetryKey((prev) => prev + 1);
  };

  // Loading state (bounded by 8s timeout)
  if (state === "checking" || state === "unauthenticated") {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#18181B] text-[#FAFAF9] flex items-center justify-center mb-6 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-[#C25E3E]" />
        </div>
        <span className="text-[11px] uppercase tracking-[0.25em] font-semibold text-[#C25E3E] mb-2">
          Aurel Security Protocol
        </span>
        <h2 className="font-serif text-2xl text-[#18181B] font-normal mb-2">
          Verifying Atelier Clearance
        </h2>
        <p className="text-sm text-[#71717A] max-w-sm font-sans leading-relaxed">
          Confirming cryptographic credentials and administrator privileges with PostgreSQL...
        </p>
      </div>
    );
  }

  // Verification Error / Timeout State (Never leaves endless spinner)
  if (state === "error") {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E7E5E4] rounded-lg p-8 shadow-sm text-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-700 mx-auto flex items-center justify-center mb-5 border border-amber-200">
            <AlertCircle className="w-7 h-7 text-amber-600" />
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-[10px] uppercase font-semibold tracking-wider mb-4 border border-amber-200">
            Security Verification Interrupted
          </div>

          <h1 className="font-serif text-2xl text-[#18181B] font-normal mb-3">
            Unable to Verify Credentials
          </h1>

          <p className="text-sm text-[#71717A] mb-4 font-sans leading-relaxed">
            {errorMessage || "The security service could not complete cryptographic role confirmation within the required window."}
          </p>

          <p className="text-xs text-[#A1A1AA] mb-6 font-sans">
            Please ensure the backend API and database connection are active and responsive.
          </p>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleManualRecheck}
              disabled={isRechecking}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#C25E3E] hover:bg-[#A1482B] disabled:opacity-50 text-white rounded text-xs uppercase tracking-widest font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRechecking ? "animate-spin" : ""}`} />
              <span>{isRechecking ? "Retrying..." : "Retry Verification"}</span>
            </button>

            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#18181B] text-[#FAFAF9] rounded text-xs uppercase tracking-widest font-medium hover:bg-black transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Storefront
            </Link>

            <button
              onClick={() => logout().then(() => router.push("/login"))}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 text-[#71717A] hover:text-[#18181B] text-xs font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out & Re-authenticate
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Access Denied (403 Forbidden)
  if (state === "unauthorized") {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E7E5E4] rounded-lg p-8 shadow-sm text-center">
          <div className="w-14 h-14 rounded-full bg-[#FFDBD0] text-[#742508] mx-auto flex items-center justify-center mb-5">
            <ShieldAlert className="w-7 h-7 text-[#C25E3E]" />
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-red-50 text-red-700 text-[10px] uppercase font-semibold tracking-wider mb-4 border border-red-200">
            403 Forbidden — Atelier Security
          </div>

          <h1 className="font-serif text-2xl text-[#18181B] font-normal mb-3">
            Administrator Privileges Required
          </h1>

          <p className="text-sm text-[#71717A] mb-6 font-sans leading-relaxed">
            The Atelier Dashboard is strictly restricted to verified Aurel Home administrators. Your account{" "}
            {denialEmail ? (
              <span className="font-medium text-[#18181B]">({denialEmail})</span>
            ) : null}{" "}
            holds patron clearance and cannot view or alter administrative resources.
          </p>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleManualRecheck}
              disabled={isRechecking}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#C25E3E] hover:bg-[#A1482B] disabled:opacity-50 text-white rounded text-xs uppercase tracking-widest font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRechecking ? "animate-spin" : ""}`} />
              <span>{isRechecking ? "Re-verifying..." : "Re-check Admin Clearance"}</span>
            </button>

            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#18181B] text-[#FAFAF9] rounded text-xs uppercase tracking-widest font-medium hover:bg-black transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Storefront
            </Link>

            <Link
              href="/account"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#F5F5F4] text-[#18181B] rounded text-xs uppercase tracking-widest font-medium hover:bg-[#E7E5E4] transition-colors"
            >
              <User className="w-4 h-4 text-[#71717A]" />
              View Customer Account
            </Link>

            <button
              onClick={() => logout().then(() => router.push("/login"))}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 text-[#71717A] hover:text-[#18181B] text-xs font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authorized Admin
  return <>{children}</>;
}
