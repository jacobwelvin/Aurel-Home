"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CartItem, Product } from "@/types";

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: Product, quantity?: number, selectedColor?: string, selectedSize?: string) => boolean;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  syncProductStock: (productIdOrSlug: string, newStock: number, newPrice?: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  getSubtotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (product, quantity = 1, selectedColor, selectedSize) => {
        // Enforce inventory stock availability
        const maxStock = typeof product.stock === "number" ? product.stock : 99;
        if (maxStock <= 0) {
          return false;
        }

        const items = get().items;
        // Key uniquely combines id, color, and size
        const itemKey = `${product.id}-${selectedColor || "default"}-${selectedSize || "default"}`;
        const existingIndex = items.findIndex((item) => item.id === itemKey);

        if (existingIndex > -1) {
          const updated = [...items];
          // Prevent customer from adding more units than available stock in database
          const newQty = Math.min(updated[existingIndex].quantity + quantity, maxStock);
          updated[existingIndex] = {
            ...updated[existingIndex],
            product,
            quantity: newQty,
          };
          set({ items: updated, isOpen: true });
        } else {
          const initialQty = Math.min(Math.max(1, quantity), maxStock);
          set({
            items: [
              ...items,
              {
                id: itemKey,
                product,
                quantity: initialQty,
                selectedColor: selectedColor || (product.colors && product.colors[0]?.name),
                selectedSize: selectedSize || (product.sizes && product.sizes[0]),
              },
            ],
            isOpen: true,
          });
        }
        return true;
      },

      removeItem: (id) => {
        set({ items: get().items.filter((item) => item.id !== id) });
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        set({
          items: get().items.map((item) => {
            if (item.id === id) {
              const maxStock = typeof item.product.stock === "number" ? item.product.stock : 99;
              const clamped = maxStock > 0 ? Math.min(quantity, maxStock) : quantity;
              return { ...item, quantity: clamped };
            }
            return item;
          }),
        });
      },

      syncProductStock: (productIdOrSlug, newStock, newPrice) => {
        set({
          items: get().items.map((item) => {
            if (item.product.id === productIdOrSlug || item.product.slug === productIdOrSlug) {
              const updatedProduct = {
                ...item.product,
                stock: newStock,
                ...(newPrice !== undefined ? { price: newPrice } : {}),
              };
              const clampedQty = newStock > 0 ? Math.min(item.quantity, newStock) : item.quantity;
              return {
                ...item,
                product: updatedProduct,
                quantity: clampedQty,
              };
            }
            return item;
          }),
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      getSubtotal: () => {
        return get().items.reduce((total, item) => total + item.product.price * item.quantity, 0);
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: "aurel-cart-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
