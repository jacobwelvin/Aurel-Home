"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, Heart, ArrowRight, ShoppingBag, ShieldCheck, Tag, ArrowLeft } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { formatINR } from "@/lib/utils";
import { useIsHydrated } from "@/lib/useHydrated";
import { fetchProductBySlug, fetchProductById } from "@/lib/api";
import { CartItem } from "@/types";

const FREE_SHIPPING_THRESHOLD = 2999;

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, getSubtotal, clearCart, syncProductStock } = useCartStore();
  const { addToWishlist } = useWishlistStore();
  const { showToast, openAuthModal } = useUIStore();
  const { isAuthenticated } = useAuthStore();

  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const isHydrated = useIsHydrated();

  // Revalidate cart items with live database quantities on mount
  useEffect(() => {
    let isMounted = true;
    async function revalidateCartStock() {
      if (items.length === 0) return;
      for (const item of items) {
        try {
          const live = item.product.slug
            ? await fetchProductBySlug(item.product.slug)
            : item.product.id && !item.product.id.startsWith("local-")
            ? await fetchProductById(item.product.id)
            : null;
          if (live && isMounted) {
            syncProductStock(item.product.id, live.stock, live.price);
          }
        } catch (err) {
          console.warn("Cart stock sync failed:", err);
        }
      }
    }
    revalidateCartStock();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isHydrated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-sm text-[#71717A]">
        Loading cart details...
      </div>
    );
  }

  const subtotal = getSubtotal();
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const shippingCost = isFreeShipping || items.length === 0 ? 0 : 450;
  const discount = promoApplied ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal - discount + shippingCost;
  const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progressPercent = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoCode.trim().toUpperCase() === "AURELHOME" || promoCode.trim().toUpperCase() === "WELCOME10") {
      setPromoApplied(true);
      showToast("Privilege code applied", "10% privilege discount credited", "success");
    } else {
      showToast("Invalid promo code", "Try entering code: AURELHOME", "error");
    }
  };

  const handleMoveToWishlist = (item: CartItem) => {
    if (!isAuthenticated) {
      openAuthModal({ action: "wishlist", redirect: "/cart" });
      return;
    }
    addToWishlist(item.product);
    removeItem(item.id);
    showToast("Moved to Wishlist", item.product.name, "info");
  };

  const handleProceedToCheckout = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal({ action: "checkout", redirect: "/checkout" });
      return;
    }

    // Check for out of stock items
    const outOfStockItems = items.filter((it) => (it.product.stock ?? 0) <= 0);
    if (outOfStockItems.length > 0) {
      showToast(
        "Cart Inventory Issue",
        `'${outOfStockItems[0].product.name}' is currently out of stock. Please remove it to proceed.`,
        "error"
      );
      return;
    }

    const overQtyItems = items.filter((it) => it.quantity > (it.product.stock ?? 0));
    if (overQtyItems.length > 0) {
      showToast(
        "Quantity Exceeds Stock",
        `Only ${overQtyItems[0].product.stock} units of '${overQtyItems[0].product.name}' are available. Please adjust your quantity.`,
        "error"
      );
      return;
    }

    router.push("/checkout");
  };

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 rounded-full bg-[#F5F5F4] flex items-center justify-center text-[#71717A] mx-auto mb-6">
          <ShoppingBag className="w-10 h-10 stroke-1" />
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#18181B] font-normal">
          Your cart is waiting for something beautiful.
        </h1>
        <p className="text-base text-[#71717A] mt-3 max-w-md mx-auto font-sans leading-relaxed">
          Discover furniture, Belgian textiles, and objects designed to bring warmth and architectural character into everyday spaces.
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
      {/* Page Title */}
      <div className="border-b border-[#E7E5E4] pb-6 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
            Client Acquisition
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#18181B] font-normal mt-1">
            Shopping Cart ({items.reduce((s, i) => s + i.quantity, 0)} items)
          </h1>
        </div>

        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[#71717A] hover:text-[#18181B] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Continue Browsing</span>
        </Link>
      </div>

      {/* Free Shipping Notification Bar */}
      <div className="mb-8 p-4 bg-white rounded-xl border border-[#E7E5E4] shadow-xs">
        {isFreeShipping ? (
          <div className="flex items-center gap-2 text-xs font-medium text-[#C25E3E]">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Complimentary insured shipping unlocked on this consignment!</span>
          </div>
        ) : (
          <div>
            <div className="flex justify-between text-xs text-[#71717A] mb-1.5">
              <span>
                Add <strong className="text-[#18181B]">{formatINR(amountToFreeShipping)}</strong> more to unlock complimentary delivery
              </span>
              <span className="font-mono text-[#18181B]">{progressPercent}%</span>
            </div>
            <div className="w-full bg-[#F5F5F4] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#C25E3E] h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2-Column Cart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Cart Items Table */}
        <div className="lg:col-span-8 space-y-4">
          <div className="hidden sm:grid grid-cols-12 text-[10px] uppercase tracking-widest text-[#71717A] font-bold px-4 pb-2 border-b border-[#E7E5E4]">
            <span className="col-span-6">Object Details</span>
            <span className="col-span-3 text-center">Quantity</span>
            <span className="col-span-3 text-right">Subtotal</span>
          </div>

          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 bg-white rounded-xl border border-[#E7E5E4] shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-4 items-center"
            >
              {/* Product Info */}
              <div className="sm:col-span-6 flex gap-4">
                <div className="relative w-20 sm:w-24 aspect-[4/5] rounded overflow-hidden bg-[#F5F5F4] shrink-0">
                  <Image
                    src={item.product.images[0]}
                    alt={item.product.name}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col justify-between py-0.5">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#71717A]">
                      {item.product.category}
                    </span>
                    <Link
                      href={`/product/${item.product.slug}`}
                      className="font-serif text-base text-[#18181B] hover:text-[#C25E3E] transition-colors font-medium block"
                    >
                      {item.product.name}
                    </Link>
                    <div className="text-xs text-[#71717A] mt-1 space-x-2">
                      {item.selectedColor && <span>{item.selectedColor}</span>}
                      {item.selectedSize && <span>• {item.selectedSize}</span>}
                    </div>
                    {typeof item.product.stock === "number" && item.product.stock <= 0 ? (
                      <p className="text-xs font-medium text-red-600 mt-1">
                        Out of stock — remove to proceed
                      </p>
                    ) : typeof item.product.stock === "number" && item.product.stock <= 5 ? (
                      <p className="text-xs font-medium text-amber-700 mt-1">
                        Only {item.product.stock} left in stock
                      </p>
                    ) : null}
                  </div>

                  <span className="font-serif text-sm text-[#18181B] font-medium sm:hidden mt-2">
                    {formatINR(item.product.price)}
                  </span>

                  <div className="flex items-center gap-4 text-xs pt-2">
                    <button
                      type="button"
                      onClick={() => handleMoveToWishlist(item)}
                      className="inline-flex items-center gap-1 text-[#71717A] hover:text-[#18181B] transition-colors"
                    >
                      <Heart className="w-3.5 h-3.5" />
                      <span>Move to Wishlist</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="inline-flex items-center gap-1 text-[#71717A] hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quantity Controls */}
              <div className="sm:col-span-3 flex justify-start sm:justify-center">
                <div className="flex items-center border border-[#E7E5E4] rounded bg-[#FAFAF9]">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="p-1.5 hover:bg-[#EEEEED] text-[#18181B] transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-xs font-medium font-mono text-[#18181B]">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    disabled={
                      typeof item.product.stock === "number" &&
                      (item.quantity >= item.product.stock || item.product.stock <= 0)
                    }
                    className="p-1.5 hover:bg-[#EEEEED] text-[#18181B] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Total Price */}
              <div className="sm:col-span-3 text-left sm:text-right">
                <span className="font-serif text-base font-semibold text-[#18181B]">
                  {formatINR(item.product.price * item.quantity)}
                </span>
                <p className="text-[10px] text-[#71717A] font-mono mt-0.5 hidden sm:block">
                  {formatINR(item.product.price)} each
                </p>
              </div>
            </div>
          ))}

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-[#71717A] hover:text-red-600 transition-colors uppercase tracking-wider"
            >
              Clear Entire Cart
            </button>
          </div>
        </div>

        {/* Right: Order Summary Card */}
        <div className="lg:col-span-4 bg-white p-6 sm:p-7 rounded-xl border border-[#E7E5E4] shadow-xs space-y-6 sticky top-28">
          <h2 className="font-serif text-lg text-[#18181B] font-medium border-b border-[#E7E5E4] pb-4">
            Order Summary
          </h2>

          {/* Promo code form */}
          {!promoApplied ? (
            <form onSubmit={handleApplyPromo} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Code (AURELHOME)"
                  className="w-full bg-[#F5F5F4] border border-[#E7E5E4] rounded pl-8 pr-3 py-2 text-xs text-[#18181B] uppercase font-mono focus:outline-none focus:border-[#18181B]"
                />
              </div>
              <button
                type="submit"
                className="bg-[#18181B] text-white px-4 py-2 rounded text-xs uppercase tracking-wider font-medium hover:bg-[#27272A] transition-colors"
              >
                Apply
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between text-xs bg-[#FFDBD0]/40 text-[#742508] p-3 rounded border border-[#FFDBD0]">
              <div>
                <span className="font-medium">Privilege Code Active</span>
                <p className="text-[10px] opacity-80">10% off your premier acquisition</p>
              </div>
              <span className="font-semibold font-serif">-{formatINR(discount)}</span>
            </div>
          )}

          {/* Price rows */}
          <div className="space-y-2.5 text-xs text-[#71717A] border-b border-[#E7E5E4] pb-5">
            <div className="flex justify-between">
              <span>Cart Subtotal</span>
              <span className="font-serif font-medium text-[#18181B] text-sm">{formatINR(subtotal)}</span>
            </div>
            {promoApplied && (
              <div className="flex justify-between text-[#C25E3E]">
                <span>Atelier Privilege (10%)</span>
                <span>-{formatINR(discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Insured Carbon-Neutral Freight</span>
              <span className="text-[#18181B]">
                {isFreeShipping ? "Complimentary" : formatINR(shippingCost)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Estimated Taxes & Packaging</span>
              <span className="text-[#18181B]">Included</span>
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-sm font-semibold uppercase tracking-wider text-[#18181B]">
              Total
            </span>
            <div className="text-right">
              <span className="font-serif text-2xl font-bold text-[#18181B]">
                {formatINR(total)}
              </span>
              <p className="text-[10px] text-[#71717A]">Including all applicable duties</p>
            </div>
          </div>

          {/* Checkout CTA */}
          <button
            type="button"
            onClick={handleProceedToCheckout}
            className="w-full bg-[#18181B] hover:bg-[#27272A] text-white py-4 rounded text-xs uppercase tracking-widest font-medium flex items-center justify-center gap-2 transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Security Notice */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-[#71717A] pt-2">
            <ShieldCheck className="w-4 h-4 text-[#C25E3E]" />
            <span>256-bit Encrypted Transaction Protocol</span>
          </div>
        </div>
      </div>
    </div>
  );
}
