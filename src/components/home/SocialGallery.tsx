"use client";

import React from "react";
import Image from "next/image";
import { Camera } from "lucide-react";

const GALLERY_IMAGES = [
  {
    id: "gal-1",
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBk4zDK_0HNAsdRPgU1Nteievi3gO0nAMTIS_ig5yp5ZEgu8Ihg6NL_9UJpU2UW-Rv53BYp5ZCQ7ojtJ4VDHmg7WSCCV7YsHmkcIvLR26a6_CV5r7uLPaxKbc_DhvTgAaiLZAX25Nf2blmyU4xpyMXFSv6kcmwDDXdM4t7YKoSDS10sbJx_O4Z4W4CaclsOT4sp1tYDfAQSG8fOaeXTcGNrPNeJqH-RCvjzsQCgx8WHMKGLc57YyGFttw",
    alt: "Soren Chair styled beside tall indoor fig with afternoon light through linen curtains",
    caption: "@elena.vance in Zurich",
  },
  {
    id: "gal-2",
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBcGTE4dLphkREaMtrBzYlj9gcqS5z9WAwN0uGZqZGGku3RZvji7HBeSjnuyyy6V7vBUIoekZOWH3SyDvT9KuEadhyvtVjnjzk5dqTev49CWNEwioH0We4jrsqOdBv_O_2QTSMXdc1bX4o0EpzEbNmy-On3hXkf1sDJzkoMQ_wKz3I5ztP19cWRS61vpgqf7_6-s5QztAladVGGU_vbmoo_Eg6x_RJnHE2HyF0IHpTBewrCHwz5h5Eesg",
    alt: "Minimalist bedside table with Komorebi ceramic lamp glowing warm next to open hardcover book",
    caption: "@julian.studio in London",
  },
  {
    id: "gal-3",
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDuiTFP7YPXlBtL8FV1LGcyHeoE-JkOpU-6-EKkJg82m7EKjlrIjjkIAEI0lIAlYPaITES6ClyR-xZR3gpdRORrgq1YM7fdi-K10ArYWDxFvu95ST4VGxROSHCS2NzHHoAKnxEcGIIxjR9pXNzAomOON5tDGvi_Qd3pSfLIbAqMracbtlE1ZMkJWvZ1GqTrzZkbwRox1HgrOXhHUVF0rU4-D0IhFFaF0YS8HstpTId3wweo_qsKMSSgMw",
    alt: "Woven Belgian Flax throw draped over an organic curved modern sofa with sunlight shadows",
    caption: "@claire.interior in Paris",
  },
  {
    id: "gal-4",
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBztCHJVXxuBe2Lydh4hp_e1gtiHtB_pCX8Zfg3tu-YFAhNhYCp0nTV7LaC0Um_nJRh71emVygJYaOByiwL7et18IF4vMbnh2LaIVs7Nkm3fiWfH97hXgaDBRR0fu_4uVmSATQdeu6tpYVMGaIg75q3VaGWAumUZesxearfluILvf4tF3IHVSVaBMvyRgwgjxLFATzn4QG0rjoG13l_3vCUHFSgNYV2EF07LMfBhikBoS243S1si80w8Q",
    alt: "Artisanal ceramic vase holding dried wild grasses on a rustic timber mantelpiece",
    caption: "@aarav.home in Mumbai",
  },
];

export function SocialGallery() {
  return (
    <section id="gallery" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t border-[#E7E5E4]">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-baseline justify-between gap-2 mb-6">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#71717A] font-medium">
            Community Monograph
          </span>
          <h3 className="font-serif text-2xl sm:text-3xl text-[#18181B] font-normal">
            #LivingWithAurel
          </h3>
        </div>
        <span className="text-xs uppercase tracking-wider text-[#C25E3E] font-medium">
          Tag @aurel.domestic to be archived
        </span>
      </div>

      {/* 4 Square Images */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {GALLERY_IMAGES.map((img) => (
          <div
            key={img.id}
            className="aspect-square rounded-lg overflow-hidden bg-[#F5F5F4] relative group cursor-pointer border border-[#E7E5E4]"
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-3 text-center">
              <Camera className="w-6 h-6 mb-1 text-[#FFDBD0]" />
              <span className="text-xs font-mono">{img.caption}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
