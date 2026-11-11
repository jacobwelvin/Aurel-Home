"use client";

import React from "react";
import { Truck, ShieldCheck, Home, RefreshCw } from "lucide-react";

const BENEFITS = [
  {
    icon: Truck,
    title: "Complimentary Delivery",
    description: "Priority carbon-offset freight on all domestic orders surpassing ₹2,999. Carefully packed & delivered.",
    color: "text-[#18181B]",
  },
  {
    icon: ShieldCheck,
    title: "Certified Sourcing",
    description: "Thoughtfully selected materials: FSC-certified forestry, Master of Linen® flax, and non-toxic finishes.",
    color: "text-[#C25E3E]",
  },
  {
    icon: Home,
    title: "30-Day Home Trial",
    description: "Take your time deciding what belongs in your domestic light. Experience the tactile weight in your space.",
    color: "text-[#18181B]",
  },
  {
    icon: RefreshCw,
    title: "Easy Returns",
    description: "Simple, transparent return process with complimentary white-glove pickup on architectural furniture.",
    color: "text-[#C25E3E]",
  },
];

export function BenefitsSection() {
  return (
    <section className="w-full bg-white py-16 px-4 sm:px-6 lg:px-8 border-b border-[#E7E5E4]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {BENEFITS.map((b) => {
          const Icon = b.icon;
          return (
            <div
              key={b.title}
              className="flex flex-col p-6 rounded-xl bg-[#F5F5F4] hover:bg-[#EEEEED] transition-all duration-300 border border-[#E7E5E4]/80 group"
            >
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xs mb-4 group-hover:scale-105 transition-transform">
                <Icon className={`w-5 h-5 ${b.color}`} />
              </div>
              <h3 className="font-serif text-lg text-[#18181B] font-medium">
                {b.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#71717A] mt-2 leading-relaxed font-sans">
                {b.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
