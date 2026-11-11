"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  User,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  MailCheck,
  RefreshCw,
  LogIn,
} from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";

const registerSchema = z
  .object({
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    email: z.string().email("Please provide a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
    terms: z.boolean().refine((val) => val === true, "You must accept the terms of craftsmanship"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const { showToast } = useUIStore();
  const { register: registerUser, resendConfirmation, isLoading } = useAuthStore();
  const [authError, setAuthError] = useState<string | null>(null);

  // Email confirmation dispatched state
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      terms: true,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setAuthError(null);
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
    const result = await registerUser(data.email, data.password, fullName);

    if (!result.success) {
      setAuthError(result.error || "Registration failed. Please try again.");
      showToast("Registration Failed", result.error || "Could not complete account creation.", "error");
      return;
    }

    if (result.needsEmailConfirmation) {
      setSubmittedEmail(data.email.trim());
      setConfirmationPending(true);
      showToast("Verification Email Dispatched", "Please check your inbox to confirm your email.", "info");
      return;
    }

    showToast("Welcome to Aurel", "Your atelier account has been created", "success");
    router.push(redirectParam || "/account");
  };

  const handleResend = async () => {
    if (!submittedEmail || resending) return;
    setResending(true);
    setResendSuccess(false);

    const result = await resendConfirmation(submittedEmail);
    setResending(false);

    if (result.success) {
      setResendSuccess(true);
      showToast("Email Resent", "A new confirmation email has been dispatched.", "success");
    } else {
      showToast("Resend Failed", result.error || "Could not resend confirmation email.", "error");
    }
  };

  // View: Email Confirmation Required Notice
  if (confirmationPending) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-16 sm:py-24">
        <div className="bg-white p-8 sm:p-10 rounded-xl border border-[#E7E5E4] shadow-xs space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#FFDBD0] text-[#742508] mx-auto flex items-center justify-center">
            <MailCheck className="w-8 h-8 text-[#C25E3E]" />
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
              Atelier Verification
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#18181B] font-normal mt-1">
              Check Your Inbox
            </h1>
            <p className="text-xs text-[#71717A] font-sans mt-2 leading-relaxed">
              We have dispatched a confirmation email to:
            </p>
            <p className="text-sm font-semibold text-[#18181B] mt-1 font-mono">
              {submittedEmail}
            </p>
          </div>

          <p className="text-xs text-[#71717A] font-sans leading-relaxed text-left p-3 bg-[#FAFAF9] rounded border border-[#E7E5E4]">
            Please click the confirmation link inside the email to activate your Aurel Home patron account.
            Once confirmed, your account will be activated and you can sign in.
          </p>

          {/* Localhost limitation note for development */}
          <div className="p-3 bg-[#FFF8F6] border border-[#FFDBD0] rounded text-left text-[11px] text-[#742508] space-y-1">
            <strong className="block font-semibold">Important Local Development Notice:</strong>
            <p className="leading-relaxed">
              If opening email on a <strong>phone or secondary device</strong>, links pointing to{" "}
              <code className="bg-white/80 px-1 py-0.2 rounded">localhost:3000</code> will not resolve on your phone.
              Open the email on the computer running this development server, or copy the link into this browser.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleResend}
              disabled={resending || resendSuccess}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#18181B] rounded text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
              <span>{resendSuccess ? "Confirmation Link Resent" : "Resend Confirmation Email"}</span>
            </button>

            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#18181B] text-[#FAFAF9] rounded text-xs uppercase tracking-widest font-medium hover:bg-black transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Proceed to Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // View: Registration Form
  return (
    <div className="w-full max-w-md mx-auto px-4 py-16 sm:py-24">
      <div className="bg-white p-8 sm:p-10 rounded-xl border border-[#E7E5E4] shadow-xs space-y-6">
        <div className="text-center space-y-1">
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
            Atelier Membership
          </span>
          <h1 className="font-serif text-3xl text-[#18181B] font-normal">
            Create an Account
          </h1>
          <p className="text-xs text-[#71717A] font-sans">
            Gain premier access to archive monographs, custom textile swatches, and private allocations.
          </p>
        </div>

        {authError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
                First Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  {...register("firstName")}
                  placeholder="Aarav"
                  className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded pl-9 pr-3 py-2 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
                />
              </div>
              {errors.firstName && (
                <p className="text-red-600 text-[11px] mt-1">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
                Last Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  {...register("lastName")}
                  placeholder="Deshmukh"
                  className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3 py-2 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
                />
              </div>
              {errors.lastName && (
                <p className="text-red-600 text-[11px] mt-1">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
              Email Address *
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
            <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
              Password *
            </label>
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

          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
              Confirm Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                {...register("confirmPassword")}
                placeholder="••••••••"
                className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded pl-10 pr-4 py-2.5 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-red-600 text-xs mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="pt-1">
            <label className="flex items-start gap-2.5 text-xs text-[#71717A] cursor-pointer">
              <input
                type="checkbox"
                {...register("terms")}
                className="mt-0.5 rounded border-[#E7E5E4] text-[#18181B] focus:ring-0"
              />
              <span>
                I agree to the terms of craftsmanship and consent to receive curated dispatches from the Aurel Atelier.
              </span>
            </label>
            {errors.terms && (
              <p className="text-red-600 text-xs mt-1">{errors.terms.message}</p>
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
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-[#71717A] pt-2 border-t border-[#E7E5E4]">
          Already have an account?{" "}
          <Link
            href={redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : "/login"}
            className="text-[#C25E3E] font-medium hover:underline"
          >
            Sign In Here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#C25E3E]" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
