import React from "react";
import Link from "next/link";
import { ArrowRight, Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-20">
      <div className="max-w-xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F5F5F4] border border-[#E7E5E4] text-[#C25E3E] mx-auto">
          <Compass className="w-8 h-8 stroke-1" />
        </div>

        <div className="space-y-3">
          <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#C25E3E]">
            Error 404 • Spatial Disconnect
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl text-[#18181B] font-normal tracking-tight">
            This space hasn’t been furnished yet.
          </h1>
          <p className="text-sm sm:text-base text-[#71717A] max-w-md mx-auto font-sans leading-relaxed">
            The page or architectural object you are seeking cannot be located, or may have been transitioned to an archival collection.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#18181B] hover:bg-[#27272A] text-white px-8 py-3.5 rounded text-xs uppercase tracking-widest font-medium transition-all shadow-md hover:-translate-y-0.5"
          >
            <Home className="w-4 h-4" />
            <span>Return Home</span>
          </Link>
          <Link
            href="/shop"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-[#F5F5F4] border border-[#E7E5E4] text-[#18181B] px-8 py-3.5 rounded text-xs uppercase tracking-widest font-medium transition-all hover:border-[#18181B]"
          >
            <span>Explore Catalogue</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="pt-8 border-t border-[#E7E5E4] mt-10">
          <p className="text-xs uppercase tracking-widest text-[#71717A] font-medium mb-4">
            Curated Destinations
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#18181B]">
            <Link href="/shop?category=living" className="hover:text-[#C25E3E] transition-colors">
              Living & Furniture
            </Link>
            <span className="text-[#E7E5E4]">•</span>
            <Link href="/shop?category=bedroom" className="hover:text-[#C25E3E] transition-colors">
              Bedroom & Sleep
            </Link>
            <span className="text-[#E7E5E4]">•</span>
            <Link href="/shop?category=textiles" className="hover:text-[#C25E3E] transition-colors">
              Belgian Textiles
            </Link>
            <span className="text-[#E7E5E4]">•</span>
            <Link href="/shop?category=lighting" className="hover:text-[#C25E3E] transition-colors">
              Ceramic Lighting
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
