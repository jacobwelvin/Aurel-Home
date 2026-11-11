"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Heart } from "lucide-react";
import { resolveMediaUrl } from "@/lib/utils";

interface ProductGalleryProps {
  images: string[];
  productName: string;
  badge?: string;
  selectedImageIndex: number;
  onSelectImage: (index: number) => void;
  isFavorited: boolean;
  onToggleWishlist: () => void;
}

export function ProductGallery({
  images,
  productName,
  badge,
  selectedImageIndex,
  onSelectImage,
  isFavorited,
  onToggleWishlist,
}: ProductGalleryProps) {
  const [unoptimizedImages, setUnoptimizedImages] = useState<Record<number, boolean>>({});
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  const rawImage = images[selectedImageIndex] || images[0];
  const currentImage = failedImages[selectedImageIndex]
    ? "/images/placeholder.jpg"
    : resolveMediaUrl(rawImage);

  const getThumbnailSrc = (img: string, index: number) => {
    if (failedImages[index]) return "/images/placeholder.jpg";
    return resolveMediaUrl(img);
  };

  const handleImageError = (index: number) => {
    if (!unoptimizedImages[index]) {
      // First attempt: direct unoptimized browser load
      setUnoptimizedImages((prev) => ({ ...prev, [index]: true }));
    } else {
      // Second attempt: show placeholder
      setFailedImages((prev) => ({ ...prev, [index]: true }));
    }
  };

  return (
    <div className="w-full flex flex-col md:flex-row gap-3 sm:gap-3.5 lg:gap-4 items-start">
      {/* ProductThumbnails: Desktop / Tablet Vertical Thumbnails (Hidden on mobile) */}
      {images.length > 1 && (
        <div className="hidden md:flex flex-col gap-2.5 lg:gap-3 shrink-0">
          {images.map((img, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onSelectImage(index)}
              className={`relative w-14 sm:w-16 lg:w-[72px] xl:w-20 aspect-[4/5] rounded-lg overflow-hidden border shrink-0 transition-all cursor-pointer ${
                selectedImageIndex === index
                  ? "border-[#18181B] ring-2 ring-[#18181B]/15"
                  : "border-[#E7E5E4] opacity-70 hover:opacity-100 hover:border-[#18181B]/40"
              }`}
              aria-label={`View image ${index + 1} of ${images.length}`}
            >
              <Image
                src={getThumbnailSrc(img, index)}
                alt={`${productName} thumbnail ${index + 1}`}
                fill
                unoptimized={Boolean(unoptimizedImages[index])}
                sizes="80px"
                className="object-cover"
                onError={() => handleImageError(index)}
              />
            </button>
          ))}
        </div>
      )}

      {/* MainProductImage: Hero Product View */}
      <div className="relative flex-1 min-w-0 w-full aspect-[4/3] md:aspect-[4/5] max-h-[360px] md:max-h-[480px] xl:max-h-[560px] rounded-xl overflow-hidden bg-[#F5F5F4] border border-[#E7E5E4] shadow-xs group">
        <Image
          src={currentImage}
          alt={productName}
          fill
          priority
          unoptimized={Boolean(unoptimizedImages[selectedImageIndex])}
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 560px"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          onError={() => handleImageError(selectedImageIndex)}
        />

        {/* Bestseller / Status Badge */}
        {badge && (
          <div className="absolute top-3.5 left-3.5 z-10">
            <span className="bg-white/95 backdrop-blur-xs text-[#18181B] text-xs uppercase font-semibold tracking-wider px-3 py-1 rounded shadow-xs border border-[#E7E5E4]">
              {badge}
            </span>
          </div>
        )}

        {/* Wishlist Button */}
        <div className="absolute top-3.5 right-3.5 z-10 flex gap-2">
          <button
            type="button"
            onClick={onToggleWishlist}
            className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-xs flex items-center justify-center text-[#18181B] hover:text-[#C25E3E] shadow-sm transition-transform active:scale-95 cursor-pointer"
            aria-label={isFavorited ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              className={`w-5 h-5 transition-colors ${
                isFavorited ? "fill-[#C25E3E] text-[#C25E3E]" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* ProductThumbnails: Mobile Horizontal Thumbnails Row (Hidden on tablet/desktop) */}
      {images.length > 1 && (
        <div className="flex md:hidden gap-2.5 overflow-x-auto pb-1 pt-0.5 w-full">
          {images.map((img, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onSelectImage(index)}
              className={`relative w-16 h-16 rounded-lg overflow-hidden border shrink-0 transition-all cursor-pointer ${
                selectedImageIndex === index
                  ? "border-[#18181B] ring-2 ring-[#18181B]/15"
                  : "border-[#E7E5E4] opacity-70 hover:opacity-100"
              }`}
              aria-label={`View thumbnail ${index + 1}`}
            >
              <Image
                src={getThumbnailSrc(img, index)}
                alt={`${productName} thumbnail ${index + 1}`}
                fill
                unoptimized={Boolean(unoptimizedImages[index])}
                sizes="64px"
                className="object-cover"
                onError={() => handleImageError(index)}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
