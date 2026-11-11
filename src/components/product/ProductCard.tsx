"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Star, ShoppingBag, Eye } from "lucide-react";
import { Product } from "@/types";
import { formatINR, resolveMediaUrl } from "@/lib/utils";
import { useWishlistStore } from "@/store/wishlistStore";
import { useCartStore } from "@/store/cartStore";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useIsHydrated } from "@/lib/useHydrated";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [primaryUnoptimized, setPrimaryUnoptimized] = useState(false);
  const [hoverUnoptimized, setHoverUnoptimized] = useState(false);
  const [hasPrimaryError, setHasPrimaryError] = useState(false);
  const [hasHoverError, setHasHoverError] = useState(false);
  const isHydrated = useIsHydrated();
  const { isInWishlist, toggleWishlist } = useWishlistStore();
  const { addItem } = useCartStore();
  const { showToast, openAuthModal } = useUIStore();
  const { isAuthenticated } = useAuthStore();

  const isFavorited = isHydrated ? isInWishlist(product.id) : false;
  const isOutOfStock = typeof product.stock === "number" && product.stock <= 0;
  const primaryImage = hasPrimaryError
    ? "/images/placeholder.jpg"
    : resolveMediaUrl(product.images?.[0]);
  const hoverImage = hasHoverError
    ? primaryImage
    : product.images?.[1]
    ? resolveMediaUrl(product.images[1])
    : primaryImage;

  const currentSrc = isHovered ? hoverImage : primaryImage;
  const isCurrentUnoptimized = isHovered ? hoverUnoptimized : primaryUnoptimized;

  const handleImageError = () => {
    if (isHovered) {
      if (!hoverUnoptimized) {
        setHoverUnoptimized(true);
      } else {
        setHasHoverError(true);
      }
    } else {
      if (!primaryUnoptimized) {
        setPrimaryUnoptimized(true);
      } else {
        setHasPrimaryError(true);
      }
    }
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal({ action: "quick-add", redirect: `/product/${product.slug}` });
      return;
    }
    if (isOutOfStock) {
      showToast("Consignment Unavailable", `${product.name} is currently out of stock.`, "error");
      return;
    }
    const success = addItem(product, 1);
    if (!success) {
      showToast("Availability Notice", `${product.name} is currently out of stock.`, "error");
      return;
    }
    showToast(
      "Allocated to your bespoke cart",
      `${product.name} • ${formatINR(product.price)}`,
      "success"
    );
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal({ action: "wishlist", redirect: `/product/${product.slug}` });
      return;
    }
    toggleWishlist(product);
    showToast(
      isFavorited ? "Removed from Wishlist" : "Preserved in Wishlist",
      product.name,
      "info"
    );
  };

  return (
    <div
      className="group relative flex flex-col bg-white rounded-lg p-2.5 sm:p-3 border border-[#E7E5E4] shadow-xs hover:shadow-ambient transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container with 4:5 aspect ratio */}
      <div className="relative w-full aspect-[4/5] rounded overflow-hidden bg-[#F5F5F4]">
        <Link href={`/product/${product.slug}`} className="relative block w-full h-full">
          {/* Main image */}
          <Image
            src={currentSrc}
            alt={product.name}
            fill
            unoptimized={isCurrentUnoptimized}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            onError={handleImageError}
          />
        </Link>

        {/* Badges */}
        {isOutOfStock ? (
          <div className="absolute top-2.5 left-2.5 right-12 z-10 flex items-start pointer-events-none">
            <span
              className="inline-block max-w-full min-w-0 truncate bg-[#18181B]/90 backdrop-blur-xs text-white text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded shadow-xs border border-white/20 pointer-events-auto"
            >
              Out of Stock
            </span>
          </div>
        ) : product.badge ? (
          <div className="absolute top-2.5 left-2.5 right-12 z-10 flex items-start pointer-events-none">
            <span
              title={product.badge}
              className="inline-block max-w-full min-w-0 truncate bg-white/95 backdrop-blur-xs text-[#18181B] text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded shadow-xs border border-[#E7E5E4]/50 pointer-events-auto"
            >
              {product.badge}
            </span>
          </div>
        ) : null}

        {/* Wishlist Heart Button */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/95 backdrop-blur-xs flex items-center justify-center transition-all shadow-xs ${
            isFavorited
              ? "text-[#C25E3E] scale-110"
              : "text-[#71717A] hover:text-[#18181B] hover:scale-105"
          }`}
          aria-label={isFavorited ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart
            className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`}
          />
        </button>

        {/* Quick Add Overlay on Hover */}
        <div className="absolute inset-x-2.5 bottom-2.5 z-10 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 [@media(hover:none)]:opacity-100 [@media(hover:none)]:translate-y-0 transition-all duration-200 ease-out pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto [@media(hover:none)]:pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={isOutOfStock}
              className={`flex-1 h-8 px-2.5 rounded text-[10px] sm:text-[11px] uppercase tracking-wider font-medium flex items-center justify-center gap-1.5 shadow-sm transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181B] focus-visible:ring-offset-1 ${
                isOutOfStock
                  ? "bg-zinc-200 text-zinc-500 cursor-not-allowed opacity-80"
                  : "bg-[#C25E3E] text-white hover:bg-[#A84E33] active:bg-[#93432B]"
              }`}
              aria-label={isOutOfStock ? `${product.name} is out of stock` : `Quick add ${product.name} to cart`}
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span>{isOutOfStock ? "OUT OF STOCK" : "QUICK ADD"}</span>
            </button>
            <div className="relative group/tooltip flex items-center justify-center shrink-0">
              <Link
                href={`/product/${product.slug}`}
                className="w-8 h-8 rounded-full bg-white text-[#18181B] hover:text-[#C25E3E] hover:bg-[#F5F5F4] border border-[#E7E5E4]/80 shadow-xs flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C25E3E] focus-visible:ring-offset-1 shrink-0"
                aria-label={`Quick view ${product.name} details`}
                title="Quick View"
              >
                <Eye className="w-3.5 h-3.5" />
              </Link>
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 bg-[#18181B] text-white text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap z-20"
              >
                Quick View
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Meta Content */}
      <div className="flex flex-col pt-3 flex-1">
        {/* Category & Rating */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="uppercase tracking-widest text-[#71717A] truncate max-w-[60%]">
            {product.category}
          </span>
          <div className="flex items-center gap-1 text-[#C25E3E]">
            <Star className="w-3 h-3 fill-current" />
            <span className="font-semibold text-[#18181B]">{product.rating.toFixed(1)}</span>
            <span className="text-[#71717A]">({product.reviewCount})</span>
          </div>
        </div>

        {/* Product Name */}
        <h3 className="font-serif text-sm sm:text-base text-[#18181B] group-hover:text-[#C25E3E] transition-colors mt-1 line-clamp-1 font-medium">
          <Link href={`/product/${product.slug}`}>
            {product.name}
          </Link>
        </h3>

        {/* Subtitle / Material */}
        <p className="text-xs text-[#71717A] line-clamp-1 mt-0.5 font-sans">
          {product.subtitle || product.materials}
        </p>

        {/* Bottom: Swatches & Price */}
        <div className="mt-auto pt-3 flex items-center justify-between border-t border-[#E7E5E4]/60">
          {/* Color swatches */}
          <div className="flex items-center gap-1">
            {product.colors && product.colors.length > 0 ? (
              product.colors.slice(0, 3).map((col) => (
                <span
                  key={col.name}
                  className="w-3 h-3 rounded-full border border-black/20 shadow-xs"
                  style={{ backgroundColor: col.hex }}
                  title={col.name}
                />
              ))
            ) : (
              <span className="text-[10px] text-[#71717A] uppercase tracking-wider font-mono">
                {product.provenance ? product.provenance.split(",")[0] : "Artisan"}
              </span>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-1.5">
            {product.compareAtPrice && (
              <span className="text-[11px] text-[#71717A] line-through font-mono">
                {formatINR(product.compareAtPrice)}
              </span>
            )}
            <span className="font-serif text-sm sm:text-base font-semibold text-[#18181B]">
              {formatINR(product.price)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
