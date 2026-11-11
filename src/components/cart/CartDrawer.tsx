"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Plus, Minus, Trash2, ArrowRight, ShoppingBag, ShieldCheck, Tag } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useIsHydrated } from "@/lib/useHydrated";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";

const FREE_SHIPPING_THRESHOLD = 2999;

export function CartDrawer() {
  const router = useRouter();
  const isHydrated = useIsHydrated();
  const { items, isOpen, closeCart, removeItem, updateQuantity, getSubtotal } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const { openAuthModal } = useUIStore();
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  if (!isHydrated || !isOpen) return null;

  const subtotal = getSubtotal();
  const discount = promoApplied ? Math.round(subtotal * 0.1) : 0;
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progressPercent = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoCode.trim().toUpperCase() === "AURELHOME" || promoCode.trim().toUpperCase() === "WELCOME10") {
      setPromoApplied(true);
    }
  };

  const handleProceedToCheckout = (e: React.MouseEvent) => {
    e.preventDefault();
    const problematicItems = items.filter(
      (item) =>
        typeof item.product.stock === "number" &&
        (item.product.stock <= 0 || item.quantity > item.product.stock)
    );
    if (problematicItems.length > 0) {
      setStockError(
        `"${problematicItems[0].product.name}" has insufficient stock. Please adjust quantity before proceeding.`
      );
      return;
    }
    setStockError(null);
    closeCart();
    if (!isAuthenticated) {
      openAuthModal({ action: "checkout", redirect: "/checkout" });
      return;
    }
    router.push("/checkout");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#18181B]/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-300"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-[#FAFAF9] h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300 border-l border-[#E7E5E4]">
        {/* Header */}
        <div className="p-6 border-b border-[#E7E5E4] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#18181B]" />
            <h2 className="font-serif text-lg uppercase tracking-wider text-[#18181B] font-medium">
              Bespoke Cart ({items.reduce((s, i) => s + i.quantity, 0)})
            </h2>
          </div>
          <button
            type="button"
            onClick={closeCart}
            className="p-1.5 text-[#71717A] hover:text-[#18181B] rounded-full hover:bg-[#F5F5F4] transition-colors"
            aria-label="Close cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Progress Meter */}
        <div className="px-6 py-3 bg-[#F5F5F4] border-b border-[#E7E5E4] text-xs">
          {isFreeShipping ? (
            <div className="flex items-center gap-1.5 text-[#C25E3E] font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Complimentary insured shipping unlocked!</span>
            </div>
          ) : (
            <div>
              <p className="text-[#71717A]">
                Add <strong className="text-[#18181B]">{formatINR(amountToFreeShipping)}</strong> more to unlock complimentary delivery.
              </p>
              <div className="w-full bg-[#E7E5E4] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[#C25E3E] h-full transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-[#F5F5F4] flex items-center justify-center text-[#71717A] mb-4">
                <ShoppingBag className="w-8 h-8 stroke-1" />
              </div>
              <h3 className="font-serif text-xl text-[#18181B]">
                Your cart is waiting for something beautiful.
              </h3>
              <p className="text-sm text-[#71717A] mt-2 max-w-xs font-sans">
                Explore our curated collection of furniture, Belgian textiles, and handmade ceramics.
              </p>
              <button
                type="button"
                onClick={closeCart}
                className="mt-6 bg-[#18181B] text-white hover:bg-[#27272A] px-6 py-3 rounded text-xs uppercase tracking-widest font-medium transition-colors"
              >
                Explore Collection
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 p-3 bg-white rounded-lg border border-[#E7E5E4] shadow-xs group"
              >
                <div className="relative w-20 h-24 rounded overflow-hidden bg-[#F5F5F4] shrink-0">
                  <Image
                    src={item.product.images[0]}
                    alt={item.product.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>

                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/product/${item.product.slug}`}
                        onClick={closeCart}
                        className="font-serif text-sm text-[#18181B] hover:text-[#C25E3E] transition-colors truncate font-medium"
                      >
                        {item.product.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-[#71717A] hover:text-red-600 transition-colors p-1"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-[11px] text-[#71717A] mt-0.5 space-x-2">
                      {item.selectedColor && <span>{item.selectedColor}</span>}
                      {item.selectedSize && <span>• {item.selectedSize}</span>}
                    </div>
                    {typeof item.product.stock === "number" && item.product.stock <= 0 ? (
                      <p className="text-[11px] font-medium text-red-600 mt-1">
                        Out of stock — please remove
                      </p>
                    ) : typeof item.product.stock === "number" && item.product.stock <= 5 ? (
                      <p className="text-[11px] font-medium text-amber-700 mt-1">
                        Only {item.product.stock} left in stock
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center border border-[#E7E5E4] rounded">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1 hover:bg-[#F5F5F4] text-[#18181B] transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-medium font-mono text-[#18181B]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={
                          typeof item.product.stock === "number" &&
                          (item.quantity >= item.product.stock || item.product.stock <= 0)
                        }
                        className="p-1 hover:bg-[#F5F5F4] text-[#18181B] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="text-sm font-serif font-medium text-[#18181B]">
                      {formatINR(item.product.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Summary */}
        {items.length > 0 && (
          <div className="p-6 bg-white border-t border-[#E7E5E4] space-y-4">
            {/* Promo code toggle */}
            {!promoApplied ? (
              <form onSubmit={handleApplyPromo} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Promo code (try: AURELHOME)"
                    className="w-full bg-[#F5F5F4] border border-[#E7E5E4] rounded pl-8 pr-3 py-1.5 text-xs text-[#18181B] placeholder-[#71717A] uppercase font-mono focus:outline-none focus:border-[#18181B]"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-[#18181B] text-white px-3 py-1.5 rounded text-xs uppercase tracking-wider font-medium hover:bg-[#27272A] transition-colors"
                >
                  Apply
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between text-xs bg-[#FFDBD0]/40 text-[#742508] p-2 rounded border border-[#FFDBD0]">
                <span>Privilege Discount (10% off)</span>
                <span className="font-semibold">-{formatINR(discount)}</span>
              </div>
            )}

            <div className="space-y-1.5 text-xs text-[#71717A]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-serif font-medium text-[#18181B] text-sm">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Freight</span>
                <span className="text-[#18181B]">
                  {isFreeShipping ? "Complimentary" : formatINR(450)}
                </span>
              </div>
              {promoApplied && (
                <div className="flex justify-between text-[#C25E3E]">
                  <span>Atelier Privilege</span>
                  <span>-{formatINR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold text-[#18181B] pt-2 border-t border-[#E7E5E4]">
                <span>Total</span>
                <span className="font-serif text-base">
                  {formatINR(subtotal - discount + (isFreeShipping ? 0 : 450))}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {stockError && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-700">
                  {stockError}
                </div>
              )}
              <button
                type="button"
                onClick={handleProceedToCheckout}
                className="w-full bg-[#18181B] hover:bg-[#27272A] text-white py-3.5 rounded text-xs uppercase tracking-widest font-medium flex items-center justify-center gap-2 transition-all shadow-md hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                href="/cart"
                onClick={closeCart}
                className="w-full text-center text-xs text-[#71717A] hover:text-[#18181B] py-1.5 uppercase tracking-wider transition-colors"
              >
                View Full Cart Details
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
