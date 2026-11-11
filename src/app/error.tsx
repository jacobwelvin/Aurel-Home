"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, Home, AlertCircle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors
    console.error("Aurel Home Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-20">
      <div className="max-w-md mx-auto text-center space-y-6 bg-white p-8 sm:p-10 rounded-xl border border-[#E7E5E4] shadow-xs">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#FFF5F2] border border-[#FFDBD0] text-[#C25E3E] mx-auto">
          <AlertCircle className="w-7 h-7 stroke-1" />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
            Atelier Interruption
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#18181B] font-normal">
            Something interrupted the experience.
          </h1>
          <p className="text-xs sm:text-sm text-[#71717A] font-sans leading-relaxed">
            We encountered an unforeseen discrepancy while preparing this domestic curation.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#18181B] hover:bg-[#27272A] text-white px-6 py-3 rounded text-xs uppercase tracking-widest font-medium transition-all shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-[#F5F5F4] border border-[#E7E5E4] text-[#18181B] px-6 py-3 rounded text-xs uppercase tracking-widest font-medium transition-all"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
