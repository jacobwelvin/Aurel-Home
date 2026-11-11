"use client";

// import React, { useState } from "react";
// import { ShoppingBag, X } from "lucide-react";
// import { useCartStore } from "@/store/cartStore";
// import { useIsHydrated } from "@/lib/useHydrated";
// import { formatINR } from "@/lib/utils";

// const TOTE_THRESHOLD = 15000;

export function FloatingPromo() {
  // Disabled for now per requirements; implementation preserved below for future use
  return null;

  /*
  return (
    <aside
      className="hidden sm:flex fixed bottom-6 right-6 z-30 max-w-sm bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-ambient border border-[#E7E5E4] items-start gap-3 transition-all duration-300 animate-in slide-in-from-bottom-6"
      role="complementary"
      aria-label="Complimentary gift offer"
    >
      <div className="w-10 h-10 rounded-full bg-[#FFDBD0] text-[#742508] flex items-center justify-center shrink-0">
        <ShoppingBag className="w-5 h-5 text-[#C25E3E]" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-[#C25E3E] font-bold">
            Complimentary Offering
          </span>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-[#71717A] hover:text-[#18181B] p-0.5"
            aria-label="Dismiss gift notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="font-serif text-sm font-medium text-[#18181B] mt-0.5">
          Raw Linen Atelier Tote
        </p>
        <p className="text-xs text-[#71717A] mt-0.5 leading-snug">
          Credited with our compliments on orders exceeding {formatINR(TOTE_THRESHOLD)}.
        </p>

        <div className="mt-2.5 flex items-center gap-2">
          <div className="w-full bg-[#F5F5F4] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#C25E3E] h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-[#71717A] font-mono shrink-0">
            {formatINR(subtotal)} / {formatINR(TOTE_THRESHOLD)}
          </span>
        </div>
      </div>
    </aside>
  );
  */
}
