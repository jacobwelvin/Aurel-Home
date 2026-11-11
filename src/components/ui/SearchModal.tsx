"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X, ArrowRight, CornerDownLeft } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { PRODUCTS } from "@/data/products";
import { fetchProducts } from "@/lib/api";
import { Product } from "@/types";
import { formatINR } from "@/lib/utils";

export function SearchModal() {
  const { isSearchOpen, setSearchOpen } = useUIStore();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [apiResults, setApiResults] = useState<Product[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Load latest catalog items when modal opens
  useEffect(() => {
    if (!isSearchOpen) return;
    let isMounted = true;
    fetchProducts().then((items) => {
      if (isMounted && items && items.length > 0) {
        setProducts(items);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [isSearchOpen]);

  // Derived immediate fallback matches from loaded catalogue
  const localResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.materials.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [query, products]);

  const results = apiResults ?? localResults;

  // Live search debounced query against PostgreSQL API
  useEffect(() => {
    if (!query.trim()) return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const liveMatches = await fetchProducts({ search: query.trim() });
        if (isMounted) {
          setApiResults(liveMatches.slice(0, 6));
        }
      } catch {
        // Keep local matches on error
      } finally {
        if (isMounted) {
          setIsSearching(false);
        }
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Keyboard shortcut Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape" && isSearchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, setSearchOpen]);

  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div
        className="fixed inset-0 bg-[#18181B]/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => setSearchOpen(false)}
      />

      <div className="relative w-full max-w-2xl bg-[#FAFAF9] rounded-xl shadow-2xl border border-[#E7E5E4] overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Search Input Bar */}
        <div className="p-4 bg-white border-b border-[#E7E5E4] flex items-center gap-3">
          <Search className="w-5 h-5 text-[#71717A] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setApiResults(null);
            }}
            placeholder="Search bespoke furniture, Belgian flax, ceramic lamps..."
            className="w-full bg-transparent text-sm sm:text-base text-[#18181B] placeholder-[#71717A] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setApiResults(null);
              }}
              className="text-[#71717A] hover:text-[#18181B] text-xs p-1"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            className="p-1.5 text-[#71717A] hover:text-[#18181B] rounded hover:bg-[#F5F5F4]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {query.trim() === "" ? (
            <div className="py-8 px-4 text-center">
              <span className="text-xs uppercase tracking-widest text-[#71717A] font-semibold">
                Trending Inquiries
              </span>
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {["Belgian Linen", "Lounge Chair", "Ceramic Lamp", "Travertine", "Blackout Curtains", "Platform Bed"].map(
                  (term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setQuery(term)}
                      className="text-xs bg-[#F5F5F4] hover:bg-[#EEEEED] text-[#18181B] px-3 py-1.5 rounded-full border border-[#E7E5E4] transition-colors"
                    >
                      {term}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-[#71717A] text-sm space-y-3">
              <p className="font-serif text-lg text-[#18181B]">No pieces found for &ldquo;{query}&rdquo;.</p>
              <p className="text-xs max-w-xs mx-auto">Try another search or explore our collections.</p>
              <Link
                href="/shop"
                onClick={() => setSearchOpen(false)}
                className="inline-block mt-2 bg-[#18181B] hover:bg-[#27272A] text-white px-5 py-2 rounded text-xs uppercase tracking-wider font-medium transition-colors"
              >
                View All Products
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-[11px] uppercase tracking-widest text-[#71717A] font-semibold block px-2 mb-2">
                Curated Artifacts ({results.length}) {isSearching && <span className="opacity-60 text-[10px] ml-2 lowercase font-normal">searching...</span>}
              </span>
              {results.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.slug}`}
                  onClick={() => setSearchOpen(false)}
                  className="flex items-center gap-4 p-2.5 rounded-lg hover:bg-white hover:shadow-xs border border-transparent hover:border-[#E7E5E4] transition-all group"
                >
                  <div className="relative w-14 h-14 rounded overflow-hidden bg-[#F5F5F4] shrink-0">
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      sizes="56px"
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-sm text-[#18181B] group-hover:text-[#C25E3E] transition-colors truncate font-medium">
                      {product.name}
                    </p>
                    <p className="text-xs text-[#71717A] truncate mt-0.5">{product.materials}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-serif text-sm font-medium text-[#18181B]">
                      {formatINR(product.price)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#71717A] group-hover:text-[#C25E3E] group-hover:translate-x-1 transition-all ml-auto mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-[#F5F5F4] border-t border-[#E7E5E4] flex items-center justify-between text-[11px] text-[#71717A]">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" /> press <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-[#E7E5E4]">ESC</kbd> to exit
          </span>
          <Link
            href={`/shop?search=${encodeURIComponent(query)}`}
            onClick={() => setSearchOpen(false)}
            className="hover:text-[#18181B] font-medium transition-colors"
          >
            View all results in Shop →
          </Link>
        </div>
      </div>
    </div>
  );
}
