"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ShieldCheck, Lock, CreditCard, RefreshCw, CheckCircle2 } from "lucide-react";

export function Footer() {
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail("");
    }
  };

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="w-full bg-[#FAFAF9] text-[#18181B] border-t border-[#E7E5E4] mt-20">
      {/* Newsletter Section */}
      <div className="bg-[#F5F5F4] py-14 px-4 sm:px-6 lg:px-8 border-b border-[#E7E5E4]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-6">
            <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
              Join the Aurel Atelier
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl text-[#18181B] mt-2 font-normal">
              Receive 10% off your premier acquisition.
            </h3>
            <p className="text-sm text-[#71717A] mt-2 max-w-lg leading-relaxed font-sans">
              Curated architectural dispatches, private salon invitations, and early allocations for rare artisan releases.
            </p>
          </div>

          <div className="md:col-span-6">
            {subscribed ? (
              <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-[#E7E5E4] text-[#18181B] max-w-md ml-auto">
                <CheckCircle2 className="w-5 h-5 text-[#C25E3E] shrink-0" />
                <div>
                  <p className="text-sm font-medium">Welcome to the Atelier.</p>
                  <p className="text-xs text-[#71717A]">Your privilege code has been recorded.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md ml-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="flex-1 bg-white px-4 py-3 text-sm text-[#18181B] placeholder-[#71717A] rounded border border-[#E7E5E4] focus:outline-none focus:border-[#18181B] transition-colors"
                />
                <button
                  type="submit"
                  className="bg-[#18181B] hover:bg-[#27272A] text-white text-xs uppercase tracking-widest font-medium px-6 py-3 rounded transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <span>Subscribe</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-10">
        {/* Brand Column */}
        <div className="md:col-span-4 flex flex-col gap-4">
          <Link href="/" className="inline-block">
            <span className="font-serif text-2xl tracking-[0.2em] uppercase font-medium text-[#18181B]">
              AUREL HOME
            </span>
          </Link>
          <p className="text-sm text-[#71717A] leading-relaxed max-w-sm font-sans">
            A sanctuary of tactile craftsmanship and quiet luxury. We curate timeless domestic relics, architectural furniture, and pure European linen crafted in collaboration with master global guilds.
          </p>
          <div className="pt-2 text-xs text-[#71717A]">
            <p className="font-medium text-[#18181B]">Atelier Kyoto & Mumbai</p>
            <p className="mt-0.5">Direct client concierge: concierge@aurelhome.com</p>
          </div>
        </div>

        {/* Shop Column */}
        <div className="md:col-span-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18181B] mb-4">
            Shop
          </h4>
          <ul className="flex flex-col gap-2.5 text-sm text-[#71717A]">
            <li>
              <Link href="/shop" className="hover:text-[#18181B] transition-colors">
                All Products
              </Link>
            </li>
            <li>
              <Link href="/shop?category=bedroom" className="hover:text-[#18181B] transition-colors">
                Bedroom & Sleep
              </Link>
            </li>
            <li>
              <Link href="/shop?category=living" className="hover:text-[#18181B] transition-colors">
                Living & Seating
              </Link>
            </li>
            <li>
              <Link href="/shop?category=textiles" className="hover:text-[#18181B] transition-colors">
                Curtains & Drapes
              </Link>
            </li>
            <li>
              <Link href="/shop?category=textiles" className="hover:text-[#18181B] transition-colors">
                Belgian Flax Throws
              </Link>
            </li>
            <li>
              <Link href="/shop?category=lighting" className="hover:text-[#18181B] transition-colors">
                Lighting & Décor
              </Link>
            </li>
          </ul>
        </div>

        {/* Customer Care Column */}
        <div className="md:col-span-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18181B] mb-4">
            Customer Care
          </h4>
          <ul className="flex flex-col gap-2.5 text-sm text-[#71717A]">
            <li>
              <Link href="/orders" className="hover:text-[#18181B] transition-colors">
                Track Order
              </Link>
            </li>
            <li>
              <Link href="/shop" className="hover:text-[#18181B] transition-colors">
                White Glove Delivery
              </Link>
            </li>
            <li>
              <Link href="/shop" className="hover:text-[#18181B] transition-colors">
                7-Day Returns Policy
              </Link>
            </li>
            <li>
              <Link href="/shop" className="hover:text-[#18181B] transition-colors">
                Care & Material Guides
              </Link>
            </li>
            <li>
              <Link href="/shop" className="hover:text-[#18181B] transition-colors">
                Frequently Asked
              </Link>
            </li>
          </ul>
        </div>

        {/* About Column */}
        <div className="md:col-span-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18181B] mb-4">
            About
          </h4>
          <ul className="flex flex-col gap-2.5 text-sm text-[#71717A]">
            <li>
              <Link href="/#story" className="hover:text-[#18181B] transition-colors">
                Our Story
              </Link>
            </li>
            <li>
              <Link href="/#story" className="hover:text-[#18181B] transition-colors">
                Sourcing & Forestry
              </Link>
            </li>
            <li>
              <Link href="/#gallery" className="hover:text-[#18181B] transition-colors">
                #LivingWithAurel
              </Link>
            </li>
            <li>
              <Link href="/account" className="hover:text-[#18181B] transition-colors">
                Patron Salon
              </Link>
            </li>
          </ul>
        </div>

        {/* Trust & Assurance Column */}
        <div className="md:col-span-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18181B] mb-4">
            Assurance
          </h4>
          <p className="text-xs text-[#71717A] leading-relaxed mb-4">
            Complimentary insured freight on domestic acquisitions above ₹2,999.
          </p>
          <div className="grid grid-cols-2 gap-2 text-[#71717A]">
            <div className="bg-[#F5F5F4] p-2 rounded flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#18181B]" />
              <span>Certified</span>
            </div>
            <div className="bg-[#F5F5F4] p-2 rounded flex items-center gap-1.5 text-[11px]">
              <Lock className="w-3.5 h-3.5 text-[#18181B]" />
              <span>256-bit</span>
            </div>
            <div className="bg-[#F5F5F4] p-2 rounded flex items-center gap-1.5 text-[11px]">
              <CreditCard className="w-3.5 h-3.5 text-[#18181B]" />
              <span>UPI / Cards</span>
            </div>
            <div className="bg-[#F5F5F4] p-2 rounded flex items-center gap-1.5 text-[11px]">
              <RefreshCw className="w-3.5 h-3.5 text-[#18181B]" />
              <span>Returns</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sub-footer */}
      <div className="bg-[#F5F5F4] py-6 px-4 sm:px-6 lg:px-8 border-t border-[#E7E5E4] text-[11px] text-[#71717A]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 AUREL HOME Inc. All bespoke rights reserved. Thoughtfully made for beautiful living.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-[#18181B] transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-[#18181B] transition-colors cursor-pointer">Terms of Service</span>
            <span className="hover:text-[#18181B] transition-colors cursor-pointer">Provenance Monograph</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
