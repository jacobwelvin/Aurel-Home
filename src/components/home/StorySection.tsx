"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function StorySection() {
  return (
    <section id="story" className="w-full bg-[#F5F5F4] py-16 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden border-y border-[#E7E5E4]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
        {/* Left: Artisan Visual Canvas */}
        <div className="lg:col-span-6 relative">
          <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden shadow-xl bg-[#EEEEED]">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCyynI_0Z6w6KWuNx0-T2ENKIFOolTuFsrwcJ0MUvlzEmEMeSVY2TOb2AtPa2YASEJCYvYxPqgOOfoiIcFh3yWn1uvvtp_rgPmevXZjxbDf2Jj4Q0jDwYvhHdN9ZVry8M_txHwAj_PTDybdCD_Sv93O4OJcAa_DOXyIhB0OkP7edhT5AloaXsNJvNKB8TfmX35u516hWJmL2EL15O0l9mJsbK-K7iqdp44sDn8C0OGhuzJP2VM2_xhqAA"
              alt="Master Kenji Takahashi shaping a curved natural wood joint in Kyoto atelier"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

            <div className="absolute bottom-6 left-6 right-6 p-4 bg-white/90 backdrop-blur-md rounded-lg flex items-center justify-between border border-white/40">
              <div>
                <p className="font-serif text-sm sm:text-base font-medium text-[#18181B]">
                  Master Kenji Takahashi
                </p>
                <p className="text-[10px] uppercase tracking-wider text-[#71717A] font-sans">
                  Fourth-Generation Sashimono Joiner • Kyoto
                </p>
              </div>
              <span className="font-serif text-xl sm:text-2xl text-[#C25E3E] font-medium">
                48 Yrs
              </span>
            </div>
          </div>

          {/* Floater Badge */}
          <div className="hidden sm:block absolute -top-6 -right-6 bg-white p-4 rounded-lg shadow-ambient border border-[#E7E5E4] max-w-xs z-10">
            <div className="flex items-center gap-1.5 text-[#C25E3E] text-[10px] uppercase tracking-wider font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero Metallic Fasteners</span>
            </div>
            <p className="text-xs text-[#71717A] mt-1 leading-snug">
              Interlocking ash dowels and mortise joints engineered to expand and breathe with seasonal domestic moisture.
            </p>
          </div>
        </div>

        {/* Right: Narrative Editorial */}
        <div className="lg:col-span-6 flex flex-col space-y-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C25E3E] inline-block" />
            <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#C25E3E]">
              CRAFTED WITH INTENTION
            </span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-[42px] text-[#18181B] leading-tight font-normal">
            Where Thoughtful Design <br />
            <span className="italic font-normal text-[#18181B]">Meets Everyday Living.</span>
          </h2>

          <div className="py-2 pl-4 border-l-2 border-[#C25E3E]">
            <p className="font-serif text-base sm:text-lg italic text-[#18181B] leading-relaxed">
              &ldquo;When wood is cut with humility and shaped with patience, it continues breathing in the room for a hundred years after the artisan departs.&rdquo;
            </p>
            <span className="block mt-2 text-[10px] uppercase tracking-widest text-[#71717A]">
              — Kenji Takahashi, Lead Artisan Partner
            </span>
          </div>

          <p className="text-sm sm:text-base text-[#71717A] leading-relaxed font-sans">
            Every piece at AUREL HOME is selected for its material, function, and innate ability to age beautifully within your home. We reject seasonal churn in favor of sustainably cured timber, certified European flax, and natural non-toxic botanical oils.
          </p>

          {/* Monograph Specifications List */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="border-t border-[#E7E5E4] pt-3">
              <span className="text-[10px] uppercase tracking-wider text-[#71717A]">
                Material Ethics
              </span>
              <p className="font-serif text-sm font-medium text-[#18181B] mt-1">
                PEFC & FSC Certified Timber
              </p>
            </div>
            <div className="border-t border-[#E7E5E4] pt-3">
              <span className="text-[10px] uppercase tracking-wider text-[#71717A]">
                Surface Chemistry
              </span>
              <p className="font-serif text-sm font-medium text-[#18181B] mt-1">
                Solvent-Free Cold Walnut Oils
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-[#18181B] hover:text-[#C25E3E] group transition-colors"
            >
              <span>Explore The Craftsmanship Archive</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
