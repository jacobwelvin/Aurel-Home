"use client";

import React, { useEffect, useRef } from "react";
import { LogOut, X, Loader2 } from "lucide-react";

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  isProcessing?: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function LogoutConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isProcessing = false,
  title = "Sign out of Aurel Home?",
  message = "Are you sure you want to sign out of your account?",
  confirmLabel = "Sign Out",
  cancelLabel = "Cancel",
}: LogoutConfirmationModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation: Escape key closes modal & focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isProcessing) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isProcessing, onClose]);

  // Lock body scroll while open and manage initial/restore focus
  useEffect(() => {
    if (isOpen) {
      const previouslyFocused = document.activeElement as HTMLElement | null;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // Auto-focus cancel button for safe keyboard navigation
      const timer = setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);

      return () => {
        document.body.style.overflow = originalOverflow;
        clearTimeout(timer);
        previouslyFocused?.focus?.();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={() => {
        if (!isProcessing) onClose();
      }}
    >
      {/* Modal Dialog Container */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        className="relative w-full max-w-[480px] sm:max-w-[500px] bg-white rounded-[22px] sm:rounded-[24px] border border-[#E7E5E4] p-6 sm:p-8 shadow-[0_20px_50px_rgba(24,24,27,0.14)] transition-all transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          aria-label="Close dialog"
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 text-[#71717A] hover:text-[#18181B] hover:bg-[#F5F5F4] rounded-full transition-colors disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181B]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content Layout */}
        <div className="flex flex-col items-center text-center">
          {/* Sign Out Icon Badge */}
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#FFDBD0]/70 text-[#C25E3E] border border-[#FFDBD0] flex items-center justify-center mb-4 shadow-2xs">
            <LogOut className="w-5 h-5 stroke-[1.8] translate-x-0.5" />
          </div>

          {/* Heading */}
          <h2
            id="logout-dialog-title"
            className="font-serif text-2xl sm:text-[26px] text-[#18181B] font-normal leading-snug tracking-tight"
          >
            {title}
          </h2>

          {/* Description */}
          <p
            id="logout-dialog-description"
            className="text-xs sm:text-sm text-[#71717A] mt-2 font-sans leading-relaxed max-w-sm"
          >
            {message}
          </p>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-7 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 w-full">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full h-11 sm:h-12 px-4 rounded-xl border border-[#E7E5E4] hover:border-[#D4D4D8] bg-white text-[#18181B] hover:bg-[#F5F5F4] active:bg-[#E7E5E4] text-xs uppercase tracking-widest font-semibold flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181B] focus-visible:ring-offset-1"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="w-full h-11 sm:h-12 px-4 rounded-xl bg-[#C25E3E] hover:bg-[#A84E33] active:bg-[#93432B] text-white text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-all shadow-xs hover:shadow-sm disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C25E3E] focus-visible:ring-offset-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Signing Out...</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
