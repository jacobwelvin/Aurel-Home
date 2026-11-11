"use client";

import React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useUIStore } from "@/store/uiStore";

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-24 right-4 sm:right-8 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-[#18181B] text-[#FAFAF9] p-4 rounded-lg shadow-2xl border border-white/10 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300"
        >
          {toast.type === "error" ? (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          ) : toast.type === "info" ? (
            <Info className="w-5 h-5 text-[#FFDBD0] shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-[#FFDBD0] shrink-0 mt-0.5" />
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium font-sans leading-snug">{toast.title}</p>
            {toast.subtitle && (
              <p className="text-xs text-white/70 mt-0.5 leading-relaxed font-sans">
                {toast.subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="text-white/50 hover:text-white transition-colors"
            aria-label="Dismiss toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
