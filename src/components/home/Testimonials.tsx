"use client";

import React from "react";
import { Star, CheckCircle } from "lucide-react";
import { TESTIMONIALS } from "@/data/testimonials";

export function Testimonials() {
  const displayTestimonials = TESTIMONIALS.slice(0, 3);

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
            Realized Living Spaces
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#18181B] mt-1 font-normal">
            Reflections From Our Patrons
          </h2>
        </div>

        {/* Rating summary */}
        <div className="flex items-center gap-2">
          <div className="flex text-[#C25E3E]">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-current" />
            ))}
          </div>
          <span className="font-serif text-base font-semibold text-[#18181B]">4.92 / 5.0</span>
          <span className="text-xs text-[#71717A]">• 840+ Verified Reviews</span>
        </div>
      </div>

      {/* 3 Review Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {displayTestimonials.map((t) => (
          <div
            key={t.id}
            className="flex flex-col justify-between p-6 sm:p-7 rounded-xl bg-white shadow-xs hover:shadow-ambient transition-all duration-300 border border-[#E7E5E4]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex text-[#C25E3E]">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
                <span className="text-[10px] text-[#71717A] font-mono">{t.date}</span>
              </div>

              <h4 className="font-serif text-base sm:text-lg text-[#18181B] font-medium leading-snug">
                &ldquo;{t.headline}&rdquo;
              </h4>

              <p className="text-xs sm:text-sm text-[#71717A] leading-relaxed font-sans">
                {t.comment}
              </p>
            </div>

            <div className="pt-4 mt-6 border-t border-[#E7E5E4] flex items-center justify-between">
              <div>
                <p className="font-serif text-sm font-medium text-[#18181B]">{t.author}</p>
                <div className="flex items-center gap-1 text-[10px] text-[#C25E3E] font-medium mt-0.5">
                  <CheckCircle className="w-3 h-3" />
                  <span>Verified Patron • {t.location}</span>
                </div>
              </div>
              <span className="text-[10px] bg-[#F5F5F4] px-2 py-1 rounded text-[#71717A] font-mono max-w-[140px] truncate">
                {t.productPurchased}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
