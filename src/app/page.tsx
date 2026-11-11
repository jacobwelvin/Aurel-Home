import React from "react";
import { HeroSection } from "@/components/home/HeroSection";
import { CategoryShowcase } from "@/components/home/CategoryShowcase";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { StorySection } from "@/components/home/StorySection";
import { BenefitsSection } from "@/components/home/BenefitsSection";
import { Testimonials } from "@/components/home/Testimonials";
import { SocialGallery } from "@/components/home/SocialGallery";
import { Leaf, Handshake, Shield } from "lucide-react";

export default function HomePage() {
  return (
    <div className="w-full flex flex-col">
      {/* Editorial Announcement Sub-strip */}
      <section className="w-full bg-[#F5F5F4] py-2.5 px-4 sm:px-6 lg:px-8 border-b border-[#E7E5E4]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-[11px] text-[#71717A] uppercase tracking-widest font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C25E3E] inline-block" />
            <span className="text-[#18181B] font-semibold tracking-normal">Spring/Summer Capsule</span>
            <span className="text-[#E7E5E4]">/</span>
            <span>Limited Domestic Allocation</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <Leaf className="w-3.5 h-3.5 text-[#C25E3E]" />
              <span>100% Traceable Materials</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5">
              <Handshake className="w-3.5 h-3.5 text-[#18181B]" />
              <span>B-Corp Certified Atelier</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#18181B]" />
              <span>Carbon-Neutral Freight</span>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Section */}
      <HeroSection />

      {/* Shop by Category Showcase */}
      <CategoryShowcase />

      {/* Featured Products / Curated Home Essentials */}
      <FeaturedProducts />

      {/* Brand Craftsmanship / Meet the Makers */}
      <StorySection />

      {/* Trust & Benefits Pillars */}
      <BenefitsSection />

      {/* Testimonials / Reflections From Our Patrons */}
      <Testimonials />

      {/* Social Gallery / #LivingWithAurel */}
      <SocialGallery />
    </div>
  );
}
