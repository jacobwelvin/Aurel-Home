"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  LogIn,
  Mail,
  RefreshCw,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { syncAuthCookie } from "@/lib/authCookie";

type VerificationStatus = "verifying" | "success" | "error";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { syncBackendProfile, resendConfirmation, verifyEmailOtp } = useAuthStore();
  const { showToast } = useUIStore();

  const [status, setStatus] = useState<VerificationStatus>("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOtpExpired, setIsOtpExpired] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(3);
  const [targetDestination, setTargetDestination] = useState<string>("/account");

  // Recovery / Resend Form States
  const [emailInput, setEmailInput] = useState<string>("");
  const [otpCodeInput, setOtpCodeInput] = useState<string>("");
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendSuccess, setResendSuccess] = useState<boolean>(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function processAuthConfirmation() {
      // 1. Extract params from BOTH query string and URL hash fragment
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const hashParams = new URLSearchParams(
        hash.startsWith("#") ? hash.substring(1) : hash
      );

      const errorParam = searchParams.get("error") || hashParams.get("error");
      const errorCode = searchParams.get("error_code") || hashParams.get("error_code");
      const errorDescription =
        searchParams.get("error_description") || hashParams.get("error_description");

      // Check for Supabase Auth error (e.g. otp_expired, access_denied)
      if (errorParam || errorCode) {
        if (isMounted) {
          setStatus("error");
          if (errorCode === "otp_expired" || errorParam === "access_denied") {
            setIsOtpExpired(true);
            setErrorMessage(
              errorDescription
                ? errorDescription.replace(/\+/g, " ")
                : "The email confirmation link has expired or has already been used."
            );
          } else {
            setErrorMessage(
              errorDescription ? errorDescription.replace(/\+/g, " ") : `Authentication error: ${errorParam}`
            );
          }
        }
        return;
      }

      const code = searchParams.get("code") || hashParams.get("code");
      const tokenHash = searchParams.get("token_hash") || hashParams.get("token_hash");
      const type = searchParams.get("type") || hashParams.get("type");

      try {
        // 2. PKCE Authorization Code Flow
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (isMounted) {
              setStatus("error");
              if (error.message.toLowerCase().includes("expired") || error.message.toLowerCase().includes("invalid")) {
                setIsOtpExpired(true);
              }
              setErrorMessage(error.message);
            }
            return;
          }

          if (data.session && isMounted) {
            await handleSuccess(data.session.access_token, data.session.user);
            return;
          }
        }

        // 3. Token Hash (OTP / Email Signup) Flow
        if (tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type as "signup" | "email" | "recovery") || "signup",
          });

          if (error) {
            if (isMounted) {
              setStatus("error");
              if (error.message.toLowerCase().includes("expired") || error.message.toLowerCase().includes("invalid")) {
                setIsOtpExpired(true);
              }
              setErrorMessage(error.message);
            }
            return;
          }

          if (data.session && isMounted) {
            await handleSuccess(data.session.access_token, data.session.user);
            return;
          }
        }

        // 4. Fallback: Check active session (e.g. Implicit Hash fragment processed by supabase client)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          if (isMounted) {
            setStatus("error");
            setErrorMessage(sessionError.message);
          }
          return;
        }

        if (session && isMounted) {
          await handleSuccess(session.access_token, session.user);
          return;
        }

        // No tokens or session detected in URL
        if (isMounted) {
          setStatus("error");
          setErrorMessage(
            "No active confirmation token detected. Please open the confirmation link from your email."
          );
        }
      } catch (err: unknown) {
        if (isMounted) {
          setStatus("error");
          const msg = err instanceof Error ? err.message : "Authentication confirmation failed.";
          setErrorMessage(msg);
        }
      }
    }

    async function handleSuccess(token: string, user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
      const name =
        (user.user_metadata?.name as string) ||
        (user.user_metadata?.full_name as string) ||
        undefined;

      // Synchronize patron profile with backend PostgreSQL
      const profile = await syncBackendProfile(token, name);

      if (!profile) {
        syncAuthCookie(null);
        setStatus("error");
        setErrorMessage("Email confirmed, but patron profile could not be synchronized with Atelier services. Please try signing in.");
        return;
      }

      syncAuthCookie(token);

      useAuthStore.setState({
        user: { id: user.id, email: user.email || "" },
        profile,
        token,
        isAuthenticated: true,
        isAdmin: profile.role === "admin",
        isInitialized: true,
      });

      const dest = profile.role === "admin" ? "/admin" : "/account";
      setTargetDestination(dest);
      setStatus("success");
    }

    processAuthConfirmation();

    return () => {
      isMounted = false;
    };
  }, [searchParams, syncBackendProfile]);

  // Auto-redirect timer when successful
  useEffect(() => {
    if (status !== "success") return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(targetDestination);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, router, targetDestination]);

  // Handler: Resend a fresh confirmation link
  const handleResendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes("@")) {
      showToast("Invalid Email", "Please enter a valid email address.", "error");
      return;
    }

    setIsResending(true);
    setResendSuccess(false);

    const result = await resendConfirmation(emailInput);
    setIsResending(false);

    if (result.success) {
      setResendSuccess(true);
      showToast("Confirmation Resent", "A new confirmation email has been dispatched.", "success");
    } else {
      showToast("Resend Failed", result.error || "Could not dispatch confirmation email.", "error");
    }
  };

  // Handler: Direct 6-digit OTP verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes("@")) {
      showToast("Email Required", "Please enter your registered email address.", "error");
      return;
    }
    if (!otpCodeInput || otpCodeInput.trim().length < 6) {
      showToast("Code Required", "Please enter the 6-digit confirmation code from your email.", "error");
      return;
    }

    setIsVerifyingCode(true);
    const result = await verifyEmailOtp(emailInput, otpCodeInput);
    setIsVerifyingCode(false);

    if (result.success) {
      showToast("Verified Successfully", "Your email has been confirmed.", "success");
      setStatus("success");
      const role = useAuthStore.getState().profile?.role;
      setTargetDestination(role === "admin" ? "/admin" : "/account");
    } else {
      showToast("Code Verification Failed", result.error || "Invalid or expired 6-digit code.", "error");
      setErrorMessage(result.error || "The code entered is invalid or has expired.");
    }
  };

  // View: Verifying
  if (status === "verifying") {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-8 sm:p-10 shadow-xs text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#18181B] text-[#FAFAF9] mx-auto flex items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-[#C25E3E]" />
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
            Atelier Authentication
          </span>
          <h2 className="font-serif text-2xl text-[#18181B] font-normal mt-1">
            Confirming Your Email
          </h2>
          <p className="text-xs text-[#71717A] max-w-sm mx-auto mt-2 font-sans leading-relaxed">
            Exchanging verification credentials with Supabase Auth and synchronizing your patron profile...
          </p>
        </div>
      </div>
    );
  }

  // View: Success
  if (status === "success") {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-8 sm:p-10 shadow-xs text-center space-y-6">
        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-emerald-700">
            Account Activated
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#18181B] font-normal mt-1">
            Email Confirmed Successfully
          </h2>
          <p className="text-sm text-[#71717A] max-w-sm mx-auto mt-2 font-sans leading-relaxed">
            Your Aurel Home patron credentials have been verified. Welcome to our sanctuary of quiet luxury and architectural living.
          </p>
        </div>

        <div className="p-3 bg-[#FAFAF9] border border-[#E7E5E4] rounded text-xs text-[#71717A]">
          Redirecting to {targetDestination === "/admin" ? "Admin Dashboard" : "your account"} in{" "}
          <strong className="text-[#18181B] font-semibold">{countdown}</strong> seconds...
        </div>

        <div className="pt-2">
          <Link
            href={targetDestination}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#18181B] text-[#FAFAF9] rounded text-xs uppercase tracking-widest font-medium hover:bg-black transition-colors"
          >
            <span>Proceed to Atelier</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // View: Error (Expired OTP or Invalid Link)
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl p-8 sm:p-10 shadow-xs space-y-6">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-[#FFDBD0] text-[#742508] mx-auto flex items-center justify-center">
          {isOtpExpired ? (
            <ShieldAlert className="w-8 h-8 text-[#C25E3E]" />
          ) : (
            <AlertCircle className="w-8 h-8 text-[#C25E3E]" />
          )}
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
            {isOtpExpired ? "Single-Use Token Expired" : "Verification Incomplete"}
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#18181B] font-normal mt-1">
            {isOtpExpired ? "Confirmation Link Expired or Used" : "Confirmation Link Failed"}
          </h2>
          <p className="text-xs text-[#71717A] max-w-md mx-auto mt-2 font-sans leading-relaxed">
            {errorMessage || "The confirmation link is invalid or has expired."}
          </p>
        </div>
      </div>

      {/* Root Cause Technical Explanation Callout */}
      {isOtpExpired && (
        <div className="p-4 bg-[#FAFAF9] border border-[#E7E5E4] rounded-lg text-xs text-[#71717A] space-y-2">
          <div className="font-semibold text-[#18181B] flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[#C25E3E]" />
            <span>Why did this link expire?</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
            <li>
              <strong>Email Antivirus / Scanner:</strong> Many email providers (Outlook, Gmail, Defender) automatically pre-scan incoming email links, which consumes single-use confirmation tokens before you click.
            </li>
            <li>
              <strong>Mobile Device Localhost:</strong> Clicking a link on a mobile phone will route to the phone&apos;s loopback instead of this computer.
            </li>
            <li>
              <strong>Token Timeout:</strong> The token exceeded the configured expiration window.
            </li>
          </ul>
        </div>
      )}

      {/* Interactive Recovery Options */}
      <div className="pt-2 border-t border-[#E7E5E4] space-y-4">
        <h3 className="font-serif text-base text-[#18181B] font-medium text-center">
          Resolve & Activate Account
        </h3>

        {/* Option 1: Resend fresh confirmation link */}
        <form onSubmit={handleResendLink} className="space-y-2 p-4 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4]">
          <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block">
            Option 1: Dispatch a Fresh Confirmation Email
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="your_email@example.com"
              className="flex-1 bg-white border border-[#E7E5E4] rounded px-3 py-2 text-xs text-[#18181B] focus:outline-none focus:border-[#18181B]"
            />
            <button
              type="submit"
              disabled={isResending || resendSuccess}
              className="bg-[#18181B] hover:bg-black disabled:opacity-50 text-white px-3.5 py-2 rounded text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
              <span>{resendSuccess ? "Sent" : "Resend Link"}</span>
            </button>
          </div>
          {resendSuccess && (
            <p className="text-emerald-700 text-[11px] font-medium">
              ✓ Fresh verification link dispatched to {emailInput}.
            </p>
          )}
        </form>

        {/* Option 2: Enter 6-digit code directly (immune to link scanners) */}
        <form onSubmit={handleVerifyOtp} className="space-y-2 p-4 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4]">
          <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block">
            Option 2: Enter 6-Digit Email Code (Scanner-Proof)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="your_email@example.com"
              className="bg-white border border-[#E7E5E4] rounded px-3 py-2 text-xs text-[#18181B] focus:outline-none focus:border-[#18181B]"
            />
            <input
              type="text"
              required
              maxLength={8}
              value={otpCodeInput}
              onChange={(e) => setOtpCodeInput(e.target.value.trim())}
              placeholder="6-digit code"
              className="bg-white border border-[#E7E5E4] rounded px-3 py-2 text-xs text-[#18181B] font-mono tracking-widest text-center focus:outline-none focus:border-[#18181B]"
            />
          </div>
          <button
            type="submit"
            disabled={isVerifyingCode}
            className="w-full bg-[#C25E3E] hover:bg-[#A1482B] disabled:opacity-50 text-white py-2 rounded text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {isVerifyingCode ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <KeyRound className="w-3.5 h-3.5" />
            )}
            <span>Verify 6-Digit Code</span>
          </button>
        </form>
      </div>

      <div className="pt-2 flex items-center justify-between text-xs text-[#71717A]">
        <Link href="/login" className="text-[#C25E3E] font-medium hover:underline flex items-center gap-1">
          <LogIn className="w-3.5 h-3.5" />
          <span>Already confirmed? Sign in</span>
        </Link>
        <Link href="/register" className="hover:text-[#18181B] hover:underline">
          Create new account
        </Link>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="w-full max-w-lg mx-auto px-4 py-16 sm:py-24">
      <Suspense
        fallback={
          <div className="bg-white border border-[#E7E5E4] rounded-xl p-8 sm:p-10 shadow-xs text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#18181B] text-[#FAFAF9] mx-auto flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#C25E3E]" />
            </div>
            <p className="text-xs text-[#71717A]">Processing authentication token...</p>
          </div>
        }
      >
        <AuthCallbackContent />
      </Suspense>
    </div>
  );
}
