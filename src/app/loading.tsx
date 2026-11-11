import React from "react";

export default function Loading() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse space-y-12">
      {/* Top Banner Skeleton */}
      <div className="h-8 bg-[#E7E5E4]/40 rounded w-1/4" />

      {/* Hero / Header Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="h-4 bg-[#E7E5E4]/40 rounded w-1/3" />
          <div className="h-14 bg-[#E7E5E4]/60 rounded w-4/5" />
          <div className="h-20 bg-[#E7E5E4]/30 rounded w-full" />
          <div className="flex gap-4">
            <div className="h-12 bg-[#E7E5E4]/60 rounded w-36" />
            <div className="h-12 bg-[#E7E5E4]/30 rounded w-36" />
          </div>
        </div>
        <div className="h-96 bg-[#E7E5E4]/40 rounded-xl" />
      </div>

      {/* Grid Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-64 bg-[#E7E5E4]/40 rounded-lg" />
            <div className="h-3 bg-[#E7E5E4]/40 rounded w-1/2" />
            <div className="h-4 bg-[#E7E5E4]/60 rounded w-3/4" />
            <div className="h-4 bg-[#E7E5E4]/40 rounded w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
