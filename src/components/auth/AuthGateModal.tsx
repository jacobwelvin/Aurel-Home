"use client";

import React, { useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, LogIn, UserPlus } from "lucide-react";
import { useUIStore } from "@/store/uiStore";

export function AuthGateModal() {
  const router = useRouter();
  const { isAuthModalOpen, closeAuthModal, authModalRedirect, authModalAction } = useUIStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAuthModal();
      }
    },
    [closeAuthModal]
  );

  useEffect(() => {
    if (isAuthModalOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAuthModalOpen, handleKeyDown]);

  if (!isAuthModalOpen) return null;

  const redirectQuery = authModalRedirect
    ? `?redirect=${encodeURIComponent(authModalRedirect)}`
    : "";

  const handleSignIn = () => {
    closeAuthModal();
    router.push(`/login${redirectQuery}`);
  };

  const handleCreateAccount = () => {
    closeAuthModal();
    router.push(`/register${redirectQuery}`);
  };

  // Contextual copy based on user's intended action
  let badgeText = "Atelier Membership";
  let titleText = "Sign in to continue";
  let descText = "Create an account or sign in to save your preferences, manage your orders, and complete your purchase.";

  if (authModalAction === "add-to-cart" || authModalAction === "quick-add") {
    badgeText = "Atelier Shopping Bag";
    titleText = "Sign in to add to cart";
    descText = "Sign in or create an account to allocate this handcrafted artifact to your cart and reserve inventory.";
  } else if (authModalAction === "buy-now") {
    badgeText = "Direct Acquisition";
    titleText = "Sign in to buy now";
    descText = "Sign in or create an account to proceed directly to instant checkout with bespoke delivery.";
  } else if (authModalAction === "wishlist") {
    badgeText = "Personal Curation";
    titleText = "Sign in to save to wishlist";
    descText = "Sign in or create an account to preserve artifacts in your personal curation archive.";
  } else if (authModalAction === "checkout") {
    badgeText = "Bespoke Checkout";
    titleText = "Sign in to complete order";
    descText = "Sign in or create an account to verify delivery specifications and complete your purchase.";
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-title"
      aria-describedby="auth-gate-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={closeAuthModal}
    >
      <div
        className="relative w-full max-w-md bg-[#FAFAF9] rounded-2xl border border-[#E7E5E4] shadow-2xl p-6 sm:p-8 space-y-6 text-center transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-1.5 text-[#71717A] hover:text-[#18181B] transition-colors rounded-full hover:bg-[#F5F5F4] cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Monogram / Badge */}
        <div className="w-12 h-12 rounded-full bg-[#FFDBD0] text-[#742508] mx-auto flex items-center justify-center shadow-xs">
          <span className="font-serif text-xl font-bold tracking-tight text-[#C25E3E]">
            A
          </span>
        </div>

        {/* Title & Message */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E] block">
            {badgeText}
          </span>
          <h2
            id="auth-gate-title"
            className="font-serif text-2xl sm:text-3xl text-[#18181B] font-medium tracking-tight"
          >
            {titleText}
          </h2>
          <p
            id="auth-gate-description"
            className="text-xs sm:text-sm text-[#71717A] leading-relaxed max-w-sm mx-auto"
          >
            {descText}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={handleSignIn}
            className="w-full bg-[#18181B] hover:bg-[#27272A] text-white py-3.5 px-4 rounded-xl text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <LogIn className="w-4 h-4 text-[#FFDBD0]" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={handleCreateAccount}
            className="w-full bg-white hover:bg-[#F5F5F4] text-[#18181B] border border-[#E7E5E4] py-3.5 px-4 rounded-xl text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-all shadow-2xs hover:border-[#D4D4D8] cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-[#C25E3E]" />
            <span>Create Account</span>
          </button>

          <button
            type="button"
            onClick={closeAuthModal}
            className="w-full text-center text-xs text-[#71717A] hover:text-[#18181B] py-2 transition-colors font-medium tracking-wider cursor-pointer"
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </div>
  );
}
