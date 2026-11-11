"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Star,
  ShoppingBag,
  Plus,
  Minus,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Product } from "@/types";
import { formatINR } from "@/lib/utils";
import { fetchProductBySlug } from "@/lib/api";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useIsHydrated } from "@/lib/useHydrated";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductBenefits } from "@/components/product/ProductBenefits";

interface ProductDetailsClientProps {
  product: Product;
  relatedProducts: Product[];
}

export function ProductDetailsClient({ product, relatedProducts }: ProductDetailsClientProps) {
  const router = useRouter();
  const isHydrated = useIsHydrated();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(
    product.colors && product.colors.length > 0 ? product.colors[0].name : undefined
  );
  const [selectedSize, setSelectedSize] = useState(
    product.sizes && product.sizes.length > 0 ? product.sizes[0] : undefined
  );
  const initialStock = typeof product.stock === "number" ? product.stock : 0;
  const [currentStock, setCurrentStock] = useState<number>(initialStock);
  const [quantity, setQuantity] = useState(initialStock > 0 ? 1 : 0);
  const [isCheckingStock, setIsCheckingStock] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "care" | "delivery">("details");

  const { addItem } = useCartStore();
  const { isInWishlist, toggleWishlist } = useWishlistStore();
  const { showToast, openAuthModal } = useUIStore();
  const { isAuthenticated } = useAuthStore();

  const isFavorited = isHydrated ? isInWishlist(product.id) : false;
  const isOutOfStock = currentStock <= 0;

  // Re-fetch live stock authoritatively from FastAPI / Supabase PostgreSQL
  const recheckLiveStock = async (): Promise<number> => {
    try {
      const live = await fetchProductBySlug(product.slug);
      if (live) {
        const liveStock = typeof live.stock === "number" ? live.stock : 0;
        setCurrentStock(liveStock);
        return liveStock;
      }
    } catch (err) {
      console.warn("Could not recheck live product stock:", err);
    }
    return currentStock;
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      openAuthModal({ action: "add-to-cart", redirect: `/product/${product.slug}` });
      return;
    }

    setIsCheckingStock(true);
    const liveStock = await recheckLiveStock();
    setIsCheckingStock(false);

    if (liveStock <= 0) {
      showToast("Consignment Unavailable", `${product.name} is currently out of stock.`, "error");
      return;
    }

    if (quantity > liveStock) {
      setQuantity(liveStock);
      showToast(
        "Availability Notice",
        `Only ${liveStock} unit${liveStock > 1 ? "s" : ""} available in inventory. Quantity adjusted.`,
        "info"
      );
      return;
    }

    const success = addItem({ ...product, stock: liveStock }, quantity, selectedColor, selectedSize);
    if (!success) {
      showToast("Availability Notice", "Unable to allocate requested quantity.", "error");
      return;
    }

    showToast(
      "Allocated to your bespoke cart",
      `${product.name} (${quantity}) • ${formatINR(product.price * quantity)}`,
      "success"
    );
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      openAuthModal({ action: "buy-now", redirect: "/checkout" });
      return;
    }

    setIsCheckingStock(true);
    const liveStock = await recheckLiveStock();
    setIsCheckingStock(false);

    if (liveStock <= 0) {
      showToast("Consignment Unavailable", `${product.name} is currently out of stock.`, "error");
      return;
    }

    if (quantity > liveStock) {
      setQuantity(liveStock);
      showToast(
        "Availability Notice",
        `Only ${liveStock} unit${liveStock > 1 ? "s" : ""} available in inventory. Quantity adjusted.`,
        "info"
      );
      return;
    }

    addItem({ ...product, stock: liveStock }, quantity, selectedColor, selectedSize);
    router.push("/checkout");
  };

  const handleToggleWishlist = () => {
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
    <div className="w-[calc(100%-32px)] md:w-[calc(100%-48px)] lg:w-[calc(100%-80px)] max-w-[1320px] mx-auto py-5 sm:py-7 lg:py-9">
      {/* 1. ProductBreadcrumbs */}
      <nav
        aria-label="Breadcrumbs"
        className="flex items-center gap-1.5 sm:gap-2 text-xs text-[#71717A] mb-5 sm:mb-8 uppercase tracking-wider font-sans overflow-x-auto no-scrollbar whitespace-nowrap"
      >
        <Link href="/" className="hover:text-[#18181B] transition-colors shrink-0">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#C8C5CB]" />
        <Link href="/shop" className="hover:text-[#18181B] transition-colors shrink-0">
          Shop
        </Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#C8C5CB]" />
        <Link
          href={`/shop?category=${product.categorySlug}`}
          className="hover:text-[#18181B] transition-colors truncate max-w-[140px] sm:max-w-none shrink-0"
        >
          {product.category}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#C8C5CB]" />
        <span className="text-[#18181B] font-medium truncate max-w-[160px] sm:max-w-none shrink-0">
          {product.name}
        </span>
      </nav>

      {/* 2. ProductDetailGrid */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
        {/* Gallery Column: ~48% on desktop */}
        <div className="w-full md:w-[48%] shrink-0">
          <ProductGallery
            images={product.images}
            productName={product.name}
            badge={product.badge}
            selectedImageIndex={selectedImageIndex}
            onSelectImage={setSelectedImageIndex}
            isFavorited={isFavorited}
            onToggleWishlist={handleToggleWishlist}
          />
        </div>

        {/* ProductPurchaseInformation Column: ~52% on desktop */}
        <div className="w-full md:flex-1 min-w-0 flex flex-col">
          {/* Category & Rating */}
          <div className="flex items-center justify-between gap-2 text-xs font-sans">
            <span className="uppercase tracking-[0.1em] text-[#71717A] font-semibold truncate">
              {product.category}
            </span>
            <div className="flex items-center gap-1.5 text-[#C25E3E] shrink-0">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span className="font-semibold text-[#18181B]">{product.rating.toFixed(1)}</span>
              <span className="text-[#71717A] tracking-wider text-[11px] uppercase">
                ({product.reviewCount} Reviews)
              </span>
            </div>
          </div>

          {/* Product Title — 12px from category */}
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-[36px] xl:text-[40px] text-[#18181B] font-normal leading-[1.15] tracking-tight mt-3">
            {product.name}
          </h1>

          {/* Subtitle — 8px from title */}
          {product.subtitle && (
            <p className="text-sm sm:text-base text-[#71717A] mt-2 font-sans leading-relaxed">
              {product.subtitle}
            </p>
          )}

          {/* Price — 20px from description */}
          <div className="flex items-baseline gap-3 pb-4 border-b border-[#E7E5E4] mt-5">
            <span className="font-serif text-2xl sm:text-[32px] font-semibold text-[#18181B]">
              {formatINR(product.price)}
            </span>
            {product.compareAtPrice && (
              <span className="text-base sm:text-[17px] text-[#71717A] line-through font-mono">
                {formatINR(product.compareAtPrice)}
              </span>
            )}
            {product.compareAtPrice && (
              <span className="text-xs bg-[#FFDBD0] text-[#742508] font-semibold px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                Save {Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}%
              </span>
            )}
          </div>

          {/* Craftsmanship — 20px from price */}
          {product.provenance && (
            <div className="flex items-center gap-2.5 px-3.5 py-3 bg-[#F5F5F4] rounded-lg border border-[#E7E5E4] text-xs text-[#71717A] mt-5">
              <Sparkles className="w-4 h-4 text-[#C25E3E] shrink-0" />
              <span className="leading-snug">
                Crafted in <strong className="text-[#18181B] font-medium">{product.provenance}</strong>
                {product.artisan && ` • ${product.artisan}`}
              </span>
            </div>
          )}

          {/* Shade selector — 20px from craftsmanship */}
          {product.colors && product.colors.length > 0 && (
            <div className="mt-5 space-y-2.5">
              <div className="flex justify-between items-center text-xs font-sans">
                <span className="uppercase tracking-wider text-[#71717A] font-semibold">
                  Finish / Shade:
                </span>
                <span className="text-[#18181B] font-medium">{selectedColor}</span>
              </div>
              <div className="flex items-center gap-3">
                {product.colors.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setSelectedColor(color.name)}
                    className={`w-9 h-9 rounded-full border shadow-xs transition-all cursor-pointer ${
                      selectedColor === color.name
                        ? "ring-2 ring-[#18181B] ring-offset-2 scale-105 border-white"
                        : "border-black/15 hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                    aria-label={`Select ${color.name}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ProductVariants: Dimension / Scale Selector (if present) */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="mt-5 space-y-2.5">
              <div className="flex justify-between items-center text-xs font-sans">
                <span className="uppercase tracking-wider text-[#71717A] font-semibold">
                  Dimension / Scale:
                </span>
                <span className="text-[#18181B] font-medium">{selectedSize}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={`px-3.5 py-2 rounded text-xs uppercase tracking-wider font-mono border transition-all cursor-pointer ${
                      selectedSize === size
                        ? "bg-[#18181B] text-white border-[#18181B] shadow-xs"
                        : "bg-white text-[#18181B] border-[#E7E5E4] hover:border-[#18181B]"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity — 20px from shade */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
              <span className="text-xs uppercase tracking-wider text-[#71717A] font-semibold">
                Quantity:
              </span>
              <span
                className={`text-[11px] font-mono ${
                  isOutOfStock
                    ? "text-rose-600 font-semibold"
                    : currentStock <= 5
                    ? "text-amber-700 font-medium"
                    : "text-[#71717A]"
                }`}
              >
                {isOutOfStock
                  ? "(Out of Stock)"
                  : currentStock <= 10
                  ? `(Only ${currentStock} left)`
                  : `(${currentStock} available)`}
              </span>
            </div>

            <div className="w-28 sm:w-32 h-10 flex items-center justify-between border border-[#E7E5E4] rounded-lg bg-white px-1.5 sm:px-2 shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={isOutOfStock || quantity <= 1}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F5F5F4] active:bg-[#E7E5E4] text-[#18181B] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-7 sm:w-8 text-center text-sm font-semibold font-mono text-[#18181B] select-none">
                {isOutOfStock ? 0 : quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                disabled={isOutOfStock || quantity >= currentStock}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F5F5F4] active:bg-[#E7E5E4] text-[#18181B] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Purchase Buttons (12px from Quantity: mt-3 = 12px) */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-2.5">
            {/* AddToCartButton */}
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isOutOfStock || isCheckingStock}
              className={`w-full h-11 sm:h-12 text-white rounded-lg transition-all shadow-xs hover:shadow-sm flex items-center justify-center gap-1 sm:gap-1.5 lg:gap-2 px-1.5 sm:px-2 lg:px-3 font-medium text-[10px] min-[380px]:text-[11px] lg:text-xs uppercase tracking-wide cursor-pointer min-w-0 ${
                isOutOfStock
                  ? "bg-zinc-400 cursor-not-allowed opacity-60"
                  : "bg-[#18181B] hover:bg-[#27272A] active:bg-black"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" />
              <span className="whitespace-nowrap shrink-0">
                {isCheckingStock ? "Checking..." : isOutOfStock ? "Out of Stock" : "Add to Cart"}
              </span>
              {!isOutOfStock && (
                <>
                  <span className="text-white/60 text-[9px] sm:text-[10px] lg:text-xs shrink-0">•</span>
                  <span className="font-mono text-[10px] min-[380px]:text-[11px] lg:text-xs shrink-0 whitespace-nowrap">
                    {formatINR(product.price * (quantity || 1))}
                  </span>
                </>
              )}
            </button>

            {/* BuyNowButton */}
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={isOutOfStock || isCheckingStock}
              className={`w-full h-11 sm:h-12 text-white rounded-lg transition-all shadow-xs hover:shadow-sm flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 font-medium text-[11px] lg:text-xs uppercase tracking-wide cursor-pointer min-w-0 ${
                isOutOfStock
                  ? "bg-zinc-300 text-zinc-500 cursor-not-allowed opacity-60"
                  : "bg-[#C25E3E] hover:bg-[#A94E31] active:bg-[#933D22]"
              }`}
            >
              <span className="whitespace-nowrap shrink-0">
                {isOutOfStock ? "Unavailable" : "Buy Now"}
              </span>
              {!isOutOfStock && (
                <>
                  <span className="text-white/70 hidden xl:inline shrink-0">—</span>
                  <span className="text-white/90 normal-case tracking-normal hidden xl:inline truncate whitespace-nowrap">
                    Express Checkout
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Benefits — 20px from purchase buttons */}
          <div className="mt-5">
            <ProductBenefits />
          </div>

          {/* 3. ProductInformationTabs: Moved to Right Column Below Purchase & Benefits */}
          <section className="mt-8 pt-1 border-t border-[#E7E5E4] w-full">
            {/* Editorial Tab Navigation Bar */}
            <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto no-scrollbar border-b border-[#E7E5E4] h-14 sm:h-[58px]">
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`h-full flex items-center shrink-0 text-xs sm:text-[13px] uppercase tracking-[0.12em] font-semibold transition-colors border-b-2 -mb-[1px] cursor-pointer ${
                  activeTab === "details"
                    ? "text-[#18181B] border-[#18181B]"
                    : "text-[#71717A] border-transparent hover:text-[#18181B]"
                }`}
              >
                Specifications
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("care")}
                className={`h-full flex items-center shrink-0 text-xs sm:text-[13px] uppercase tracking-[0.12em] font-semibold transition-colors border-b-2 -mb-[1px] cursor-pointer ${
                  activeTab === "care"
                    ? "text-[#18181B] border-[#18181B]"
                    : "text-[#71717A] border-transparent hover:text-[#18181B]"
                }`}
              >
                Care &amp; Material
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("delivery")}
                className={`h-full flex items-center shrink-0 text-xs sm:text-[13px] uppercase tracking-[0.12em] font-semibold transition-colors border-b-2 -mb-[1px] cursor-pointer ${
                  activeTab === "delivery"
                    ? "text-[#18181B] border-[#18181B]"
                    : "text-[#71717A] border-transparent hover:text-[#18181B]"
                }`}
              >
                Shipping &amp; Concierge
              </button>
            </div>

            {/* Selected Tab Content Panel */}
            <div className="py-6 sm:py-7 text-sm leading-relaxed text-[#71717A]">
              {/* Specifications Tab Content */}
              {activeTab === "details" && (
                <div className="w-full space-y-6">
                  <div>
                    <h3 className="font-serif text-lg text-[#18181B] font-medium mb-2">
                      Architectural Narrative
                    </h3>
                    <p className="text-[#18181B] leading-relaxed">{product.description}</p>
                  </div>

                  {/* Technical Details & Specifications Table */}
                  <div className="pt-2">
                    <h4 className="text-xs uppercase tracking-wider text-[#71717A] font-semibold mb-3">
                      Technical Details &amp; Material Specifications
                    </h4>
                    <div className="divide-y divide-[#E7E5E4] border-y border-[#E7E5E4]">
                      {product.details.map((detail, index) => (
                        <div
                          key={index}
                          className="py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6"
                        >
                          <span className="text-xs uppercase tracking-wider text-[#71717A] sm:w-44 shrink-0 font-medium">
                            Detail {index + 1}
                          </span>
                          <span className="text-sm text-[#18181B]">{detail}</span>
                        </div>
                      ))}
                      {product.dimensions && (
                        <div className="py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6">
                          <span className="text-xs uppercase tracking-wider text-[#71717A] sm:w-44 shrink-0 font-medium">
                            Dimensions
                          </span>
                          <span className="text-sm text-[#18181B] font-mono">{product.dimensions}</span>
                        </div>
                      )}
                      {product.materials && (
                        <div className="py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6">
                          <span className="text-xs uppercase tracking-wider text-[#71717A] sm:w-44 shrink-0 font-medium">
                            Composition
                          </span>
                          <span className="text-sm text-[#18181B]">{product.materials}</span>
                        </div>
                      )}
                      {product.provenance && (
                        <div className="py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6">
                          <span className="text-xs uppercase tracking-wider text-[#71717A] sm:w-44 shrink-0 font-medium">
                            Provenance
                          </span>
                          <span className="text-sm text-[#18181B]">
                            {product.provenance}
                            {product.artisan && ` • ${product.artisan}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Care & Material Tab Content */}
              {activeTab === "care" && (
                <div className="w-full space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-[#F5F5F4] border border-[#E7E5E4] space-y-1.5">
                      <h4 className="text-xs uppercase tracking-wider text-[#18181B] font-semibold">
                        Primary Composition
                      </h4>
                      <p className="text-sm text-[#18181B]">{product.materials}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-[#F5F5F4] border border-[#E7E5E4] space-y-1.5">
                      <h4 className="text-xs uppercase tracking-wider text-[#18181B] font-semibold">
                        Provenance &amp; Lineage
                      </h4>
                      <p className="text-sm text-[#18181B]">
                        {product.provenance || "Artisanal Guild Network"}
                        {product.artisan && ` • ${product.artisan}`}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs uppercase tracking-wider text-[#71717A] font-semibold">
                      Preservation &amp; Cleaning Guidelines
                    </h4>
                    <p className="text-[#18181B]">
                      {product.care ||
                        "Clean gently with a soft dry cloth. Avoid harsh chemical cleaners and abrasive detergents."}
                    </p>
                    <ul className="list-disc list-inside space-y-1.5 text-xs text-[#71717A] pt-2">
                      <li>Keep shielded from prolonged exposure to harsh direct heat and excessive moisture.</li>
                      <li>Dust regularly using an unbleached organic microfiber cloth or soft horsehair brush.</li>
                      <li>For natural timbers and oiled finishes, condition once per year with solvent-free organic oil.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Shipping & Concierge Tab Content */}
              {activeTab === "delivery" && (
                <div className="w-full space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-[#F5F5F4] border border-[#E7E5E4] space-y-1.5">
                      <h4 className="text-xs uppercase tracking-wider text-[#18181B] font-semibold">
                        Complimentary Express Freight
                      </h4>
                      <p className="text-xs text-[#71717A] leading-relaxed">
                        Orders exceeding ₹2,999 qualify for complimentary express dispatch. Standard transit time is 4–7 business days via climate-neutral transport with end-to-end telemetry.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-[#F5F5F4] border border-[#E7E5E4] space-y-1.5">
                      <h4 className="text-xs uppercase tracking-wider text-[#18181B] font-semibold">
                        White-Glove Placement
                      </h4>
                      <p className="text-xs text-[#71717A] leading-relaxed">
                        Architectural furniture and large ceramic objects include designated room placement, unboxing, packaging recycling, and complimentary assembly by certified technicians.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E7E5E4] space-y-2">
                    <h4 className="text-xs uppercase tracking-wider text-[#71717A] font-semibold">
                      7-Day Home Trial &amp; Concierge Returns
                    </h4>
                    <p className="text-xs text-[#71717A] leading-relaxed">
                      We invite you to experience every artifact within the natural light and rhythm of your sanctuary. If a piece does not harmonize effortlessly, our concierge team coordinates discreet doorstep pickup with zero return fees.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* 4. RelatedProducts: You May Also Like */}
      {relatedProducts.length > 0 && (
        <section className="mt-12 sm:mt-16 pt-10 sm:pt-12 border-t border-[#E7E5E4]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
                Harmonious Pairings
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl text-[#18181B] font-normal mt-1">
                You May Also Like
              </h2>
            </div>
            <Link
              href={`/shop?category=${product.categorySlug}`}
              className="text-xs uppercase tracking-wider text-[#C25E3E] font-medium hover:underline inline-flex items-center gap-1"
            >
              <span>Explore {product.category}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
