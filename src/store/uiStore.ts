"use client";

import { create } from "zustand";

export interface ToastInfo {
  id: string;
  title: string;
  subtitle?: string;
  type?: "success" | "info" | "error";
}

interface UIStore {
  isSearchOpen: boolean;
  isLookbookOpen: boolean;
  isMobileMenuOpen: boolean;
  isAuthModalOpen: boolean;
  authModalRedirect: string | null;
  authModalAction: string | null;
  toasts: ToastInfo[];
  setSearchOpen: (open: boolean) => void;
  setLookbookOpen: (open: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
  openAuthModal: (options?: { action?: string; redirect?: string }) => void;
  closeAuthModal: () => void;
  showToast: (title: string, subtitle?: string, type?: "success" | "info" | "error") => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isSearchOpen: false,
  isLookbookOpen: false,
  isMobileMenuOpen: false,
  isAuthModalOpen: false,
  authModalRedirect: null,
  authModalAction: null,
  toasts: [],

  setSearchOpen: (open) => set({ isSearchOpen: open }),
  setLookbookOpen: (open) => set({ isLookbookOpen: open }),
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),

  openAuthModal: (options) =>
    set({
      isAuthModalOpen: true,
      authModalAction: options?.action || null,
      authModalRedirect: options?.redirect || null,
    }),

  closeAuthModal: () =>
    set({
      isAuthModalOpen: false,
      authModalAction: null,
      authModalRedirect: null,
    }),

  showToast: (title, subtitle, type = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, title, subtitle, type }],
    }));

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3500);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
