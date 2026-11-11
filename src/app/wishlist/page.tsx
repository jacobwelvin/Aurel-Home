"use client";

import React from "react";
import Link from "next/link";
import { Heart, ShoppingBag, ArrowRight } from "lucide-react";
import { useWishlistStore } from "@/store/wishlistStore";
import { useCartStore } from "@/store/cartStore";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useIsHydrated } from "@/lib/useHydrated";
import { ProductCard } from "@/components/product/ProductCard";

export default function WishlistPage() {
  const { items } = useWishlistStore();
  const { addItem } = useCartStore();
  const { showToast, openAuthModal } = useUIStore();
  const { isAuthenticated } = useAuthStore();
  const isHydrated = useIsHydrated();

  if (!isHydrated) return null;

  const handleMoveAllToCart = () => {
    if (!isAuthenticated) {
      openAuthModal({ action: "move-to-cart", redirect: "/wishlist" });
      return;
    }
    items.forEach((item) => {
      addItem(item, 1);
    });
    showToast(
      "Allocated to Bespoke Cart",
      `Transferred ${items.length} artifacts to your active cart.`,
      "success"
    );
  };

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 rounded-full bg-[#F5F5F4] flex items-center justify-center text-[#71717A] mx-auto mb-6">
          <Heart className="w-10 h-10 stroke-1 text-[#71717A]" />
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
          Preserved Objects
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#18181B] font-normal mt-2">
          Nothing saved yet.
        </h1>
        <p className="text-sm text-[#71717A] mt-3 max-w-md mx-auto font-sans leading-relaxed">
          When something catches your eye, save it here for later consideration.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 mt-8 bg-[#18181B] hover:bg-[#27272A] text-white px-8 py-3.5 rounded text-xs uppercase tracking-widest font-medium transition-all shadow-md hover:-translate-y-0.5"
        >
          <span>Explore Collection</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* Page Header */}
      <div className="border-b border-[#E7E5E4] pb-6 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
            Curated Archive
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#18181B] font-normal mt-1">
            Saved for Your Space ({items.length} items)
          </h1>
        </div>

        <button
          type="button"
          onClick={handleMoveAllToCart}
          className="inline-flex items-center gap-2 bg-[#18181B] hover:bg-[#27272A] text-white px-6 py-2.5 rounded text-xs uppercase tracking-wider font-medium transition-all shadow-xs"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Move All to Cart</span>
        </button>
      </div>

      {/* Grid of Wishlist items */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
