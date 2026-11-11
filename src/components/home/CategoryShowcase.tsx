"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORIES } from "@/data/categories";
import { fetchCategories } from "@/lib/api";
import { Category } from "@/types";
import { resolveMediaUrl } from "@/lib/utils";

export function CategoryShowcase() {
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);
  const [failedCategoryImages, setFailedCategoryImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    fetchCategories()
      .then((cats) => {
        if (isMounted && cats && cats.length > 0) {
          setCategories(cats);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch live categories for showcase:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Take first 4 primary categories for the bento layout
  const primaryCategories = categories.slice(0, 4);

  return (
    <section className="w-full bg-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-y border-[#E7E5E4]">
      <div className="max-w-7xl mx-auto flex flex-col space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E7E5E4] pb-6">
          <div>
            <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
              Disciplines & Spatial Domains
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#18181B] mt-1 font-normal">
              Curated for Every Corner
            </h2>
          </div>
          <p className="text-sm text-[#71717A] max-w-md leading-relaxed font-sans">
            Objects created not for transient consumption, but to anchor stillness, tactility, and quiet contemplation within modern residences.
          </p>
        </div>

        {/* 4-Column Category Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {primaryCategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/shop?category=${cat.slug}`}
              className="group relative rounded-xl overflow-hidden aspect-[3/4] bg-[#F5F5F4] flex flex-col justify-end p-6 shadow-xs hover:shadow-ambient transition-all duration-300 border border-[#E7E5E4]"
            >
              <Image
                src={
                  failedCategoryImages[cat.id]
                    ? "/images/placeholder.jpg"
                    : resolveMediaUrl(cat.image)
                }
                alt={cat.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                onError={() =>
                  setFailedCategoryImages((prev) => ({ ...prev, [cat.id]: true }))
                }
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

              <div className="relative z-10 flex flex-col text-white">
                <span className="text-[10px] uppercase tracking-widest text-white/80 font-mono">
                  {cat.realmNumber}
                </span>
                <h3 className="font-serif text-xl sm:text-2xl text-white mt-1 font-normal">
                  {cat.name}
                </h3>
                <p className="text-xs text-white/80 mt-1 line-clamp-2 font-sans leading-relaxed">
                  {cat.description}
                </p>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#FFDBD0] group-hover:translate-x-1 transition-transform">
                  <span>Explore {cat.itemCount} Pieces</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
