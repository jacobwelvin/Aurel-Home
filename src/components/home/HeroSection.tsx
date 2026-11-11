"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Play, Plus, Award } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { formatINR } from "@/lib/utils";

export function HeroSection() {
  const { setLookbookOpen } = useUIStore();
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 md:py-12 lg:py-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Typographic Narrative */}
        <div className="lg:col-span-5 flex flex-col justify-center space-y-6 md:space-y-5 lg:space-y-6 w-full lg:max-w-none">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E] bg-[#FFDBD0] px-3 py-1 rounded-full">
              Edition No. 04
            </span>
            <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-medium">
              NEW SEASON 2026
            </span>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl md:text-[50px] lg:text-[54px] text-[#18181B] leading-[1.08] md:leading-[1.12] tracking-tight font-normal">
            Thoughtfully Designed{" "}
            <br className="inline md:hidden lg:inline" />
            <em className="italic font-normal text-[#18181B]">For Beautiful</em> Living.
          </h1>

          <p className="text-base sm:text-lg text-[#71717A] leading-relaxed font-sans max-w-lg md:max-w-none lg:max-w-lg">
            Discover furniture, textiles, and objects designed to bring warmth, tactility, and architectural stillness into everyday spaces. Hand-loomed Belgian flax, charred Japanese ash, and hand-thrown stonewares.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/shop"
              className="bg-[#18181B] text-white hover:bg-[#27272A] transition-all px-7 py-3.5 rounded text-xs uppercase tracking-widest font-medium flex items-center gap-2 group shadow-md hover:-translate-y-0.5"
            >
              <span>Explore Collection</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <button
              type="button"
              onClick={() => setLookbookOpen(true)}
              className="bg-white text-[#18181B] hover:bg-[#F5F5F4] border border-[#E7E5E4] transition-all px-6 py-3.5 rounded text-xs uppercase tracking-widest font-medium flex items-center gap-2 shadow-xs"
            >
              <Play className="w-4 h-4 text-[#C25E3E] fill-current" />
              <span>Lookbook Film (2:40)</span>
            </button>
          </div>

          {/* Metric Badges */}
          <div className="pt-6 md:pt-6 lg:pt-8 grid grid-cols-3 gap-4 border-t border-[#E7E5E4]">
            <div>
              <div className="font-serif text-2xl sm:text-3xl text-[#18181B] font-medium">100%</div>
              <div className="text-[10px] uppercase tracking-wider text-[#71717A] mt-1 font-sans">
                Handcrafted Batches
              </div>
            </div>
            <div>
              <div className="font-serif text-2xl sm:text-3xl text-[#C25E3E] font-medium">42+</div>
              <div className="text-[10px] uppercase tracking-wider text-[#71717A] mt-1 font-sans">
                Master Guilds
              </div>
            </div>
            <div>
              <div className="font-serif text-2xl sm:text-3xl text-[#18181B] font-medium">0g</div>
              <div className="text-[10px] uppercase tracking-wider text-[#71717A] mt-1 font-sans">
                Plastic Packaging
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Editorial Composition with Micro-Tag Hotspots */}
        <div className="lg:col-span-7 relative">
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-xl overflow-hidden shadow-xl bg-[#F5F5F4] group">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB82fShdtSa3CbGfTrrT4V95JqQFSstREIj4l9i_qpoSkwav4PjGSr-tEuTrlbEtPdzpH8WODGcTshPHlBOIMg4n8GkTWTjUUvIENnOnBkSqpFBFR3JANJEUeRsqxtxlcu0CblavFGF1_djjfWXQHy-p-OVptJc_ZY99OCd6kjhAuqw6KULsl8tqQi04Uqg6MOZCcNrJoAnobzWlU6mmUBTvaIm-bdYhwhGJIzqxlW2aXtpboTmPJ_iPw"
              alt="Editorial sunlit living room with Soren Lounge Chair and Travertine table"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

            {/* Hotspot 1: Soren Lounge Chair */}
            <div className="absolute top-[52%] left-[34%] z-20">
              <div className="relative flex items-center justify-center">
                <span className="animate-ping absolute inline-flex h-7 w-7 rounded-full bg-white/70 opacity-75" />
                <button
                  type="button"
                  onClick={() => setActiveHotspot(activeHotspot === 1 ? null : 1)}
                  onMouseEnter={() => setActiveHotspot(1)}
                  className="relative w-7 h-7 rounded-full bg-white text-[#18181B] shadow-md flex items-center justify-center hover:scale-110 transition-transform"
                  aria-label="Inspect Soren Lounge Chair"
                >
                  <Plus className="w-4 h-4 font-bold text-[#18181B]" />
                </button>

                {/* Popover Card */}
                {activeHotspot === 1 && (
                  <div className="absolute bottom-9 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md p-3 rounded-lg shadow-xl w-56 flex flex-col gap-1 z-30 border border-[#E7E5E4] animate-in fade-in zoom-in-95 duration-200">
                    <span className="text-[10px] uppercase text-[#C25E3E] tracking-widest font-bold">
                      Featured Artifact
                    </span>
                    <span className="font-serif text-sm text-[#18181B] font-medium">
                      Soren Lounge Chair
                    </span>
                    <span className="text-xs text-[#71717A]">
                      Charred Japanese ash & Belgian flax
                    </span>
                    <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-[#E7E5E4]">
                      <span className="font-serif text-sm font-semibold text-[#18181B]">
                        {formatINR(48900)}
                      </span>
                      <Link
                        href="/product/soren-lounge-chair"
                        className="text-[11px] uppercase tracking-wider text-[#C25E3E] hover:underline font-medium"
                      >
                        Inspect →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Hotspot 2: Sabi Stoneware Vessel */}
            <div className="absolute bottom-[30%] right-[30%] z-20">
              <div className="relative flex items-center justify-center">
                <span className="animate-ping absolute inline-flex h-7 w-7 rounded-full bg-white/70 opacity-75" />
                <button
                  type="button"
                  onClick={() => setActiveHotspot(activeHotspot === 2 ? null : 2)}
                  onMouseEnter={() => setActiveHotspot(2)}
                  className="relative w-7 h-7 rounded-full bg-white text-[#18181B] shadow-md flex items-center justify-center hover:scale-110 transition-transform"
                  aria-label="Inspect Sabi Stoneware Vessel"
                >
                  <Plus className="w-4 h-4 font-bold text-[#18181B]" />
                </button>

                {/* Popover Card */}
                {activeHotspot === 2 && (
                  <div className="absolute bottom-9 right-0 bg-white/95 backdrop-blur-md p-3 rounded-lg shadow-xl w-52 flex flex-col gap-1 z-30 border border-[#E7E5E4] animate-in fade-in zoom-in-95 duration-200">
                    <span className="text-[10px] uppercase text-[#71717A] tracking-widest font-bold">
                      Tabletop Object
                    </span>
                    <span className="font-serif text-sm text-[#18181B] font-medium">
                      Sabi Stoneware Vessel
                    </span>
                    <span className="text-xs text-[#71717A]">
                      Four-day wood-fired Shigaraki clay
                    </span>
                    <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-[#E7E5E4]">
                      <span className="font-serif text-sm font-semibold text-[#18181B]">
                        {formatINR(7600)}
                      </span>
                      <Link
                        href="/product/sabi-stoneware-vessel"
                        className="text-[11px] uppercase tracking-wider text-[#C25E3E] hover:underline font-medium"
                      >
                        Inspect →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Caption Overlay */}
            <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md py-2 px-4 rounded-lg flex items-center justify-between text-xs border border-white/40">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span className="text-[11px] uppercase tracking-wider text-[#18181B] font-semibold">
                  Atelier Kyoto & Flanders • Monograph 2026
                </span>
              </div>
              <span className="text-[11px] text-[#71717A] hidden sm:inline">
                Hover markers to inspect provenance
              </span>
            </div>
          </div>

          {/* Overlapping Secondary Editorial Card */}
          <div className="hidden xl:flex absolute -bottom-8 -left-8 bg-white p-4 rounded-lg shadow-ambient w-64 flex-col gap-1 z-20 border border-[#E7E5E4]">
            <div className="flex items-center gap-1.5 text-[#C25E3E] text-[10px] uppercase tracking-widest font-bold">
              <Award className="w-3.5 h-3.5" />
              <span>Artisan Guild Choice</span>
            </div>
            <p className="font-serif text-sm text-[#18181B] italic mt-0.5">
              &ldquo;Architecture transposed to intimate daily touch.&rdquo;
            </p>
            <div className="flex items-center justify-between text-[#71717A] text-[10px] pt-2 border-t border-[#E7E5E4] font-sans">
              <span>The Architectural Review</span>
              <span>May 2026</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
