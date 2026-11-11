"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Lock, Mail, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { API_BASE_URL } from "@/lib/api";
import { syncAuthCookie } from "@/lib/authCookie";
import { supabase } from "@/lib/supabase";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useUIStore();
  const { login, resetPassword, isLoading, isInitialized, initialize } = useAuthStore();
  const [authError, setAuthError] = useState<string | null>(null);
  // Post-hydration session verification state (must start as false to match server render)
  const [isCheckingSession, setIsCheckingSession] = useState(false);

  const redirectParam = searchParams.get("redirect");
  const confirmedParam = searchParams.get("confirmed");

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // 1. Check existing session on mount to resolve redirects immediately without forcing re-login
  useEffect(() => {
    let isMounted = true;

    async function evaluateActiveSession() {
      try {
        if (!isInitialized) {
          await initialize();
        }

        let activeToken = useAuthStore.getState().token;

        if (!activeToken) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            activeToken = session.access_token;
            useAuthStore.setState({
              user: { id: session.user.id, email: session.user.email || "" },
              token: session.access_token,
              isAuthenticated: true,
            });
          }
        }

        if (!activeToken) {
          return;
        }

        // Active session token discovered in client storage after hydration
        if (isMounted) {
          setIsCheckingSession(true);
        }

        // Authoritative server-side role confirmation via /api/v1/auth/me
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
          cache: "no-store",
        });

        if (res.ok) {
          const verifiedUser = await res.json();
          if (!isMounted) return;

          useAuthStore.getState().setProfile(verifiedUser);
          syncAuthCookie(activeToken);

          if (verifiedUser.role === "admin") {
            const dest = redirectParam && redirectParam.startsWith("/admin") ? redirectParam : (redirectParam || "/admin");
            router.replace(dest);
            return;
          } else {
            // Customer role
            if (redirectParam && redirectParam.startsWith("/admin")) {
              showToast("Access Restricted", "Administrator clearance required. Redirecting to your patron account.", "info");
              router.replace("/account");
              return;
            }
            router.replace(redirectParam || "/account");
            return;
          }
        } else {
          // Token is invalid/expired — clear invalid state
          await useAuthStore.getState().logout();
          syncAuthCookie(null);
          if (isMounted) setIsCheckingSession(false);
        }
      } catch (err) {
        console.warn("Session check error on login page:", err);
        if (isMounted) setIsCheckingSession(false);
      }
    }

    evaluateActiveSession();

    return () => {
      isMounted = false;
    };
  }, [isInitialized, initialize, redirectParam, router, showToast]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setAuthError(null);
    const result = await login(data.email, data.password);
    if (!result.success) {
      setAuthError(result.error || "Authentication failed. Please verify credentials.");
      showToast("Authentication Failed", result.error || "Please verify your email and password.", "error");
      return;
    }

    const token = useAuthStore.getState().token;
    if (!token) {
      setAuthError("Session token unavailable. Please try again.");
      return;
    }

    // Direct cryptographic confirmation with the backend
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (res.ok) {
        const verifiedProfile = await res.json();
        useAuthStore.getState().setProfile(verifiedProfile);
        syncAuthCookie(token);

        if (verifiedProfile.role === "admin") {
          showToast("Welcome Back", "Signed into Atelier Administration", "success");
          const dest = redirectParam && redirectParam.startsWith("/admin") ? redirectParam : (redirectParam || "/admin");
          router.push(dest);
        } else {
          // Customer role
          if (redirectParam && redirectParam.startsWith("/admin")) {
            showToast("Access Restricted", "Administrator privileges required. Redirecting to patron account.", "info");
            router.push("/account");
          } else {
            showToast("Welcome Back", "Signed into your Aurel Atelier Account", "success");
            router.push(redirectParam || "/account");
          }
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errorMsg = errJson.detail || "Authentication verification failed on Atelier security services.";
        setAuthError(errorMsg);
        showToast("Authentication Error", errorMsg, "error");
        await useAuthStore.getState().logout();
      }
    } catch {
      syncAuthCookie(token);
      router.push("/account");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.includes("@")) {
      showToast("Invalid Email", "Please enter a valid email address.", "error");
      return;
    }
    setForgotLoading(true);
    const result = await resetPassword(forgotEmail);
    setForgotLoading(false);
    if (result.success) {
      setForgotSubmitted(true);
      showToast("Reset Link Sent", "Instructions have been dispatched to your email address.", "success");
    } else {
      showToast("Error", result.error || "Failed to send reset link.", "error");
    }
  };

  // Display loading screen only after hydration while verifying an active session
  if (isCheckingSession) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#18181B] text-[#FAFAF9] mx-auto flex items-center justify-center shadow-sm">
          <Loader2 className="w-7 h-7 animate-spin text-[#C25E3E]" />
        </div>
        <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#C25E3E]">
          Atelier Clearance
        </span>
        <h2 className="font-serif text-xl text-[#18181B] font-normal">
          Resuming Session...
        </h2>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-16 sm:py-24">
      <div className="bg-white p-8 sm:p-10 rounded-xl border border-[#E7E5E4] shadow-xs space-y-6">
        <div className="text-center space-y-1">
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
            Atelier Portal
          </span>
          <h1 className="font-serif text-3xl text-[#18181B] font-normal">
            Sign In
          </h1>
          <p className="text-xs text-[#71717A] font-sans">
            Access your orders, saved sanctuaries, and private patron allocations.
          </p>
        </div>

        {confirmedParam && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>Email verified successfully! You may now sign in to your patron account.</span>
          </div>
        )}

        {authError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                {...register("email")}
                placeholder="patron@domain.com"
                className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded pl-10 pr-4 py-2.5 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
              />
            </div>
            {errors.email && (
              <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotSubmitted(false);
                }}
                className="text-[11px] text-[#C25E3E] hover:underline"
              >
                Forgot?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                {...register("password")}
                placeholder="••••••••"
                className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded pl-10 pr-4 py-2.5 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
              />
            </div>
            {errors.password && (
              <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#18181B] hover:bg-[#27272A] disabled:opacity-50 text-white py-3.5 rounded text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:-translate-y-0.5 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Enter Atelier</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-[#71717A] pt-2 border-t border-[#E7E5E4]">
          New to Aurel Home?{" "}
          <Link
            href={redirectParam ? `/register?redirect=${encodeURIComponent(redirectParam)}` : "/register"}
            className="text-[#C25E3E] font-medium hover:underline"
          >
            Create an Account
          </Link>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E7E5E4] max-w-sm w-full p-6 space-y-4">
            <h3 className="font-serif text-xl text-[#18181B]">Reset Password</h3>
            {forgotSubmitted ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 p-3 rounded">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>If an account exists for {forgotEmail}, password recovery instructions have been sent.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full bg-[#18181B] text-white py-2 rounded text-xs uppercase tracking-wider font-semibold"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-xs text-[#71717A]">
                  Enter your registered patron email to receive private reset instructions.
                </p>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="patron@domain.com"
                  className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3 py-2 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 bg-[#F5F5F4] hover:bg-[#EEEEED] text-[#18181B] py-2 rounded text-xs uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 bg-[#18181B] hover:bg-[#27272A] disabled:opacity-50 text-white py-2 rounded text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-1.5"
                  >
                    {forgotLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Send Link</span>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md mx-auto px-4 py-16 sm:py-24 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#C25E3E] mx-auto" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
