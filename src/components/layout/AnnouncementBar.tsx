"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Truck, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";

const ANNOUNCEMENTS = [
  {
    icon: Truck,
    text: "COMPLIMENTARY SHIPPING ON ORDERS ABOVE ₹2,999",
    highlight: "CODE: AURELHOME",
  },
  {
    icon: RotateCcw,
    text: "EASY 7-DAY IN-HOME TRIAL & EFFORTLESS RETURNS",
    highlight: "ZERO RETURN FEES",
  },
  {
    icon: ShieldCheck,
    text: "CAREFULLY PACKED IN MOLDED COTTON PULP & DELIVERED",
    highlight: "100% PLASTIC-FREE",
  },
];

export function AnnouncementBar() {
  const pathname = usePathname();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % ANNOUNCEMENTS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const current = ANNOUNCEMENTS[index];
  const Icon = current.icon;

  return (
    <div className="bg-[#18181B] text-[#FAFAF9] border-b border-white/10 text-[11px] tracking-widest uppercase font-medium">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-5 xl:px-8 2xl:px-10 py-2 flex items-center justify-between">
        {/* Left: Rotating ticker */}
        <div className="flex items-center gap-2 overflow-hidden transition-all duration-500">
          <Icon className="w-3.5 h-3.5 text-[#FFDBD0] shrink-0" />
          <span className="truncate">{current.text}</span>
          <span className="text-white/30 hidden sm:inline">|</span>
          <span className="text-[#FFDBD0] font-semibold hidden sm:inline">{current.highlight}</span>
        </div>

        {/* Right: Currency & Atelier Help */}
        <div className="hidden md:flex items-center gap-4 text-white/70 text-[10px]">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[#FFDBD0]" />
            <span>Monograph Edition 2026</span>
          </span>
          <span className="text-white/20">|</span>
          <span className="hover:text-white transition-colors cursor-default">INR (₹)</span>
          <span className="text-white/20">|</span>
          <a href="/shop" className="hover:text-white transition-colors">
            Atelier Directory
          </a>
        </div>
      </div>
    </div>
  );
}
