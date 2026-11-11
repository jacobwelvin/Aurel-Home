"use client";

import React from "react";
import { Truck, ShieldCheck, RefreshCw } from "lucide-react";

export function ProductBenefits() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2 py-5 sm:py-6 border-y border-[#E7E5E4] text-xs text-[#71717A]">
      <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-1.5 p-1 sm:p-2">
        <div className="w-8 h-8 rounded-full bg-[#F5F5F4] flex items-center justify-center shrink-0 text-[#18181B]">
          <Truck className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-[#18181B] uppercase tracking-wider">Free Freight</h4>
          <p className="text-[11px] text-[#71717A] mt-0.5">Above ₹2,999</p>
        </div>
      </div>

      <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-1.5 p-1 sm:p-2 sm:border-x sm:border-[#E7E5E4]">
        <div className="w-8 h-8 rounded-full bg-[#F5F5F4] flex items-center justify-center shrink-0 text-[#18181B]">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-[#18181B] uppercase tracking-wider">Certified Sourcing</h4>
          <p className="text-[11px] text-[#71717A] mt-0.5">Thoughtfully selected materials</p>
        </div>
      </div>

      <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-1.5 p-1 sm:p-2">
        <div className="w-8 h-8 rounded-full bg-[#F5F5F4] flex items-center justify-center shrink-0 text-[#18181B]">
          <RefreshCw className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-[#18181B] uppercase tracking-wider">7-Day Home Trial</h4>
          <p className="text-[11px] text-[#71717A] mt-0.5">Take your time deciding</p>
        </div>
      </div>
    </div>
  );
}
