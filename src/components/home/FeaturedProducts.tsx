"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { PRODUCTS } from "@/data/products";
import { fetchProducts } from "@/lib/api";
import { Product } from "@/types";
import { ProductCard } from "@/components/product/ProductCard";

const TABS = [
  { id: "bestsellers", label: "BEST SELLERS" },
  { id: "new", label: "NEW ARRIVALS" },
  { id: "living", label: "LIVING" },
  { id: "bedroom", label: "BEDROOM" },
  { id: "textiles", label: "TEXTILES" },
];

export function FeaturedProducts() {
  const [activeTab, setActiveTab] = useState("bestsellers");
  const [products, setProducts] = useState<Product[]>(PRODUCTS);

  useEffect(() => {
    let isMounted = true;
    fetchProducts()
      .then((data) => {
        if (isMounted && data && data.length > 0) {
          setProducts(data);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch live products for featured:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    switch (activeTab) {
      case "new":
        return products.filter((p) => p.isNew || p.badge?.includes("New")).slice(0, 4);
      case "living":
        return products.filter((p) => p.categorySlug === "living").slice(0, 4);
      case "bedroom":
        return products.filter((p) => p.categorySlug === "bedroom").slice(0, 4);
      case "textiles":
        return products.filter((p) => p.categorySlug === "textiles").slice(0, 4);
      case "bestsellers":
      default:
        return products.filter((p) => p.bestseller || p.featured).slice(0, 4);
    }
  }, [activeTab, products]);

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      {/* Header and Filter Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6 mb-10">
        <div className="shrink-0">
          <div className="flex items-center gap-1.5 text-[#C25E3E] text-[11px] uppercase tracking-[0.2em] font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Archival Selections</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-[28px] lg:text-4xl text-[#18181B] mt-1 font-normal tracking-tight leading-tight">
            Curated Home <br className="hidden md:inline lg:hidden" />Essentials
          </h2>
        </div>

        {/* Tab Pills Floating Bar */}
        <div className="flex items-center gap-1 sm:gap-1 lg:gap-1.5 bg-[#F5F5F4] p-1 sm:p-1.5 rounded-full border border-[#E7E5E4] shadow-xs shrink-0 max-w-full overflow-x-auto no-scrollbar">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 sm:px-2.5 md:px-3 lg:px-4 py-1.5 rounded-full text-[10px] md:text-[10.5px] lg:text-[11px] uppercase tracking-wider font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-[#18181B] text-white shadow-xs"
                    : "text-[#71717A] hover:text-[#18181B] hover:bg-black/5"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4-Card Archetypal Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Bottom Action */}
      <div className="flex justify-center mt-12">
        <Link
          href="/shop"
          className="bg-white hover:bg-[#18181B] hover:text-white text-[#18181B] border border-[#E7E5E4] hover:border-[#18181B] transition-all px-8 py-3.5 rounded text-xs uppercase tracking-widest font-medium flex items-center gap-2 shadow-xs"
        >
          <span>View Complete 2026 Archive ({products.length} Artifacts)</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
