"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, Heart, ShoppingBag, User, Menu, X, ArrowRight } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useUIStore } from "@/store/uiStore";
import { formatINR } from "@/lib/utils";
import { useIsHydrated } from "@/lib/useHydrated";

interface NavLinkItem {
  label: string;
  href: string;
  category?: string;
}

const NAV_LINKS: NavLinkItem[] = [
  { label: "SHOP", href: "/shop" },
  { label: "BEDROOM", href: "/shop?category=bedroom", category: "bedroom" },
  { label: "LIVING", href: "/shop?category=living", category: "living" },
  { label: "CURTAINS & TEXTILES", href: "/shop?category=textiles", category: "textiles" },
  { label: "DÉCOR & LIGHTING", href: "/shop?category=lighting", category: "lighting" },
  { label: "ORDERS", href: "/orders" },
];

const MOBILE_NAV_LINKS: NavLinkItem[] = [
  { label: "SHOP", href: "/shop" },
  { label: "BEDROOM", href: "/shop?category=bedroom", category: "bedroom" },
  { label: "LIVING", href: "/shop?category=living", category: "living" },
  { label: "BATH & ESSENTIALS", href: "/shop?category=bath", category: "bath" },
  { label: "CURTAINS & TEXTILES", href: "/shop?category=textiles", category: "textiles" },
  { label: "DÉCOR & LIGHTING", href: "/shop?category=lighting", category: "lighting" },
  { label: "ORDERS", href: "/orders" },
];

function checkIsActive(
  link: NavLinkItem,
  pathname: string,
  categoryParam: string | null
): boolean {
  if (link.href === "/orders") {
    return pathname === "/orders" || pathname.startsWith("/orders/");
  }

  if (link.category) {
    return pathname === "/shop" && categoryParam === link.category;
  }

  if (link.href === "/shop") {
    return pathname === "/shop" && (!categoryParam || categoryParam === "all");
  }

  return false;
}

function DesktopNavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");

  return (
    <nav className="hidden lg:flex items-center gap-5 xl:gap-[22px] 2xl:gap-6 shrink-0">
      {NAV_LINKS.map((link) => {
        const isActive = checkIsActive(link, pathname, categoryParam);
        return (
          <Link
            key={link.label}
            href={link.href}
            className={`text-[11px] 2xl:text-[12px] uppercase tracking-[0.06em] xl:tracking-[0.08em] 2xl:tracking-[0.12em] font-medium transition-colors relative py-1 hover:text-[#C25E3E] shrink-0 whitespace-nowrap ${
              isActive ? "text-[#18181B] font-semibold" : "text-[#18181B]/80"
            }`}
          >
            {link.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#C25E3E]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function DesktopNavFallback() {
  const pathname = usePathname();
  return (
    <nav className="hidden lg:flex items-center gap-5 xl:gap-[22px] 2xl:gap-6 shrink-0">
      {NAV_LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.label}
            href={link.href}
            className={`text-[11px] 2xl:text-[12px] uppercase tracking-[0.06em] xl:tracking-[0.08em] 2xl:tracking-[0.12em] font-medium transition-colors relative py-1 hover:text-[#C25E3E] shrink-0 whitespace-nowrap ${
              isActive ? "text-[#18181B] font-semibold" : "text-[#18181B]/80"
            }`}
          >
            {link.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#C25E3E]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNavLinks({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");

  return (
    <div className="py-6 flex flex-col gap-4">
      {MOBILE_NAV_LINKS.map((link) => {
        const isActive = checkIsActive(link, pathname, categoryParam);
        return (
          <Link
            key={link.label}
            href={link.href}
            onClick={onClose}
            className={`flex items-center justify-between text-sm tracking-[0.14em] uppercase font-medium py-2 border-b border-[#E7E5E4]/40 transition-colors ${
              isActive ? "text-[#C25E3E] font-semibold" : "text-[#18181B] hover:text-[#C25E3E]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{link.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#C25E3E]" />
              )}
            </div>
            <ArrowRight className={`w-4 h-4 ${isActive ? "text-[#C25E3E]" : "text-[#71717A]"}`} />
          </Link>
        );
      })}
    </div>
  );
}

function MobileNavFallback({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  return (
    <div className="py-6 flex flex-col gap-4">
      {MOBILE_NAV_LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.label}
            href={link.href}
            onClick={onClose}
            className={`flex items-center justify-between text-sm tracking-[0.14em] uppercase font-medium py-2 border-b border-[#E7E5E4]/40 transition-colors ${
              isActive ? "text-[#C25E3E] font-semibold" : "text-[#18181B] hover:text-[#C25E3E]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{link.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#C25E3E]" />
              )}
            </div>
            <ArrowRight className={`w-4 h-4 ${isActive ? "text-[#C25E3E]" : "text-[#71717A]"}`} />
          </Link>
        );
      })}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const isHydrated = useIsHydrated();
  const openCart = useCartStore((s) => s.openCart);
  const cartItems = useCartStore((s) => s.items);
  const wishlistItems = useWishlistStore((s) => s.items);
  const { setSearchOpen, isMobileMenuOpen, setMobileMenuOpen } = useUIStore();

  const cartCount = isHydrated ? cartItems.reduce((c, i) => c + i.quantity, 0) : 0;
  const subtotal = isHydrated ? cartItems.reduce((t, i) => t + i.product.price * i.quantity, 0) : 0;
  const wishlistCount = isHydrated ? wishlistItems.length : 0;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          isScrolled
            ? "bg-[#FAFAF9]/95 backdrop-blur-md shadow-[0_2px_12px_rgba(24,24,27,0.04)] border-b border-[#E7E5E4]"
            : "bg-[#FAFAF9] border-b border-[#E7E5E4]/80"
        }`}
      >
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-4 xl:px-8 2xl:px-10">
          <div className="flex items-center justify-between h-20 gap-3 lg:gap-4 xl:gap-6">
            {/* Left Section: Mobile trigger + Brand Logo + Desktop Navigation Links */}
            <div className="flex items-center gap-3 sm:gap-3.5 lg:gap-6 xl:gap-9 2xl:gap-11 min-w-0">
              {/* Mobile menu trigger */}
              <div className="flex items-center lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 text-[#18181B] hover:text-[#C25E3E] transition-colors cursor-pointer"
                  aria-label="Toggle navigation menu"
                >
                  {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>

              {/* Brand Logo */}
              <div className="flex items-center shrink-0">
                <Link href="/" className="flex flex-col group">
                  <span className="font-serif text-xl sm:text-[22px] 2xl:text-[26px] tracking-[0.14em] 2xl:tracking-[0.18em] uppercase text-[#18181B] group-hover:text-[#C25E3E] transition-colors leading-none font-medium whitespace-nowrap">
                    AUREL HOME
                  </span>
                  <span className="text-[7px] sm:text-[7.5px] xl:text-[8px] 2xl:text-[8.5px] tracking-[0.05em] xl:tracking-[0.14em] 2xl:tracking-[0.2em] uppercase text-[#71717A] mt-1 font-sans hidden sm:block whitespace-nowrap">
                    Thoughtfully made for beautiful living
                  </span>
                </Link>
              </div>

              {/* Desktop Navigation Links: Comfortable, consistent horizontal spacing; all on one single line */}
              <Suspense fallback={<DesktopNavFallback />}>
                <DesktopNavLinks />
              </Suspense>
            </div>

            {/* Right Action Icons & Search */}
            <div className="flex items-center gap-1.5 lg:gap-2 xl:gap-2.5 2xl:gap-3 shrink-0 ml-auto">
              {/* Desktop Quick Search Pill (xl and above) */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="hidden xl:flex items-center gap-2 bg-[#F5F5F4] hover:bg-[#EEEEED] border border-[#E7E5E4] rounded-full px-3 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] transition-colors shadow-xs cursor-pointer xl:w-36 2xl:w-48 justify-between shrink-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Search className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-sans text-xs truncate whitespace-nowrap">
                    Search...
                  </span>
                </div>
                <kbd className="text-[10px] bg-white border border-[#E7E5E4] px-1.5 py-0.5 rounded text-[#71717A] font-mono ml-1 hidden 2xl:inline-block shrink-0">
                  ⌘K
                </kbd>
              </button>

              {/* Search Icon (< xl: mobile and tablet) */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="xl:hidden p-2 text-[#18181B] hover:text-[#C25E3E] transition-colors cursor-pointer shrink-0"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Wishlist */}
              <Link
                href="/wishlist"
                className="relative p-2 text-[#18181B] hover:text-[#C25E3E] transition-colors shrink-0"
                aria-label="Wishlist"
              >
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute top-1 right-1 bg-[#C25E3E] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* Cart Drawer Trigger */}
              <button
                type="button"
                onClick={openCart}
                className="flex items-center gap-2 bg-[#F5F5F4] hover:bg-[#EEEEED] border border-[#E7E5E4] text-[#18181B] hover:border-[#18181B] px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full transition-all shadow-xs cursor-pointer shrink-0"
                aria-label="Shopping Cart"
              >
                <div className="relative shrink-0">
                  <ShoppingBag className="w-4 h-4 text-[#18181B]" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#C25E3E] text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline text-[11px] font-semibold tracking-wider uppercase font-sans whitespace-nowrap truncate">
                  {cartCount > 0 ? (
                    <>
                      <span>{cartCount}</span>
                      <span className="hidden 2xl:inline"> • {formatINR(subtotal)}</span>
                    </>
                  ) : (
                    "Cart"
                  )}
                </span>
              </button>

              {/* Account Link */}
              <Link
                href="/account"
                className="p-2 text-[#18181B] hover:text-[#C25E3E] transition-colors hidden sm:flex items-center gap-1.5 shrink-0"
                aria-label="My Account"
              >
                <User className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#18181B]/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-full max-w-sm bg-[#FAFAF9] h-full shadow-2xl flex flex-col p-6 z-10 overflow-y-auto">
            <div className="flex items-center justify-between pb-6 border-b border-[#E7E5E4]">
              <span className="font-serif text-xl tracking-[0.18em] uppercase text-[#18181B]">
                AUREL HOME
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-[#18181B] hover:text-[#C25E3E]"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <Suspense fallback={<MobileNavFallback onClose={() => setMobileMenuOpen(false)} />}>
              <MobileNavLinks onClose={() => setMobileMenuOpen(false)} />
            </Suspense>

            <div className="mt-auto pt-6 border-t border-[#E7E5E4] flex flex-col gap-3">
              <Link
                href="/account"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 text-sm font-medium text-[#18181B] hover:text-[#C25E3E]"
              >
                <User className="w-4 h-4 text-[#71717A]" />
                <span>My Account & Orders</span>
              </Link>
              <Link
                href="/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 text-sm font-medium text-[#18181B] hover:text-[#C25E3E]"
              >
                <Heart className="w-4 h-4 text-[#71717A]" />
                <span>Saved Wishlist ({wishlistCount})</span>
              </Link>
              <div className="text-[11px] text-[#71717A] mt-4 pt-4 border-t border-[#E7E5E4]">
                Complimentary delivery on all orders over ₹2,999.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
