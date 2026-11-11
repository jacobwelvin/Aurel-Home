"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X, RotateCcw, ChevronDown } from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";
import { CATEGORIES } from "@/data/categories";
import { fetchCategories, fetchProducts } from "@/lib/api";
import { Product, Category } from "@/types";
import { formatINR } from "@/lib/utils";

type SortOption = "featured" | "price-asc" | "price-desc" | "rating" | "newest";

function ShopContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category") || "all";
  const searchParam = searchParams.get("search") || "";

  const [categories, setCategories] = useState<Category[]>(CATEGORIES);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState(categoryParam);
  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [prevCategoryParam, setPrevCategoryParam] = useState(categoryParam);
  const [prevSearchParam, setPrevSearchParam] = useState(searchParam);

  if (categoryParam !== prevCategoryParam) {
    setPrevCategoryParam(categoryParam);
    setSelectedCategory(categoryParam);
  }
  if (searchParam !== prevSearchParam) {
    setPrevSearchParam(searchParam);
    setSearchQuery(searchParam);
  }

  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [fourStarsOnly, setFourStarsOnly] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    let isMounted = true;
    fetchCategories()
      .then((cats) => {
        if (isMounted && cats && cats.length > 0) {
          setCategories(cats);
        }
      })
      .catch((err) => {
        console.error("Failed to load categories:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchProducts({
          category: selectedCategory,
          search: searchQuery,
          sort: sortBy,
          maxPrice: maxPrice,
          inStockOnly: inStockOnly,
          minRating: fourStarsOnly ? 4.0 : undefined,
        });
        if (isMounted) {
          setProducts(data);
        }
      } catch (err) {
        console.error("Failed to load products:", err);
        if (isMounted) {
          setError("Failed to load objects. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedCategory, searchQuery, sortBy, maxPrice, inStockOnly, fourStarsOnly]);

  const resetFilters = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    setMaxPrice(100000);
    setInStockOnly(false);
    setFourStarsOnly(false);
    setSortBy("featured");
  };

  const hasActiveFilters =
    selectedCategory !== "all" || searchQuery !== "" || maxPrice < 100000 || inStockOnly || fourStarsOnly;

  const displayedProducts = products.slice(0, visibleCount);

  const currentCategory =
    selectedCategory !== "all"
      ? categories.find((c) => c.slug === selectedCategory)
      : null;

  const pageTitle = currentCategory ? currentCategory.name : "Shop All";
  const pageDescription = currentCategory
    ? currentCategory.description
    : "A considered collection of furniture, textiles and objects designed for everyday living.";

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-5 xl:px-8 2xl:px-10 pt-8 sm:pt-10 lg:pt-12 pb-16">
      {/* Editorial Page Header: Aligned within container, sits above divider and filter sidebar */}
      <div className="border-b border-[#E7E5E4] pb-6 sm:pb-8 mb-8 sm:mb-10">
        <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E] block mb-2">
          Complete Atelier Catalog
        </span>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
          <div className="max-w-2xl">
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] xl:text-5xl text-[#18181B] font-normal tracking-tight leading-[1.15]">
              {pageTitle}
            </h1>
            <p className="text-sm sm:text-base text-[#71717A] mt-2 sm:mt-2.5 font-sans leading-relaxed">
              {pageDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Mobile Filter Button (visible only below lg) */}
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-2 bg-white border border-[#E7E5E4] px-3.5 py-2 sm:px-4 sm:py-2.5 rounded text-xs uppercase tracking-wider font-medium text-[#18181B] shadow-xs cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#C25E3E]" />
              <span>Filters {hasActiveFilters && "• Active"}</span>
            </button>

            {/* Sort Dropdown */}
            <div className="relative inline-block">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none bg-white border border-[#E7E5E4] text-[#18181B] text-xs uppercase tracking-wider font-medium pl-3.5 pr-8 sm:pl-4 sm:pr-10 py-2 sm:py-2.5 rounded shadow-xs focus:outline-none focus:border-[#18181B] cursor-pointer"
              >
                <option value="featured">Sort: Curated Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
                <option value="newest">Newest Editions</option>
              </select>
              <ChevronDown className="w-4 h-4 text-[#71717A] absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout: Sidebar Filters + Products Grid (starts below page heading and divider) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-10 items-start w-full">
        {/* Desktop Sidebar Filters: only on lg (1024px and above) */}
        <aside className="hidden lg:block lg:col-span-3 bg-white p-5 xl:p-6 rounded-xl border border-[#E7E5E4] shadow-xs space-y-7 sticky top-28 shrink-0">
          <div className="flex items-center justify-between border-b border-[#E7E5E4] pb-4">
            <span className="font-serif text-base text-[#18181B] font-medium">Filter Objects</span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-[#C25E3E] hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Search Input */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-2">
              Keywords
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Linen, Oak, Ceramic..."
                className="w-full bg-[#F5F5F4] border border-[#E7E5E4] rounded pl-9 pr-3 py-2 text-xs text-[#18181B] focus:outline-none focus:border-[#18181B]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#18181B]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Categories Filter */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-2.5">
              Disciplines
            </label>
            <div className="flex flex-col gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`text-left py-1.5 px-2.5 rounded transition-colors flex items-center justify-between ${
                  selectedCategory === "all"
                    ? "bg-[#18181B] text-white font-medium"
                    : "text-[#71717A] hover:text-[#18181B] hover:bg-[#F5F5F4]"
                }`}
              >
                <span>All Disciplines</span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`text-left py-1.5 px-2.5 rounded transition-colors flex items-center justify-between ${
                    selectedCategory === cat.slug
                      ? "bg-[#18181B] text-white font-medium"
                      : "text-[#71717A] hover:text-[#18181B] hover:bg-[#F5F5F4]"
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className="text-[10px] opacity-60 font-mono">({cat.itemCount})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Price Range Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold">
                Max Price
              </label>
              <span className="text-xs font-serif font-medium text-[#18181B]">
                {formatINR(maxPrice)}
              </span>
            </div>
            <input
              type="range"
              min={2000}
              max={100000}
              step={2000}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-[#C25E3E] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#71717A] font-mono mt-1">
              <span>{formatINR(2000)}</span>
              <span>{formatINR(100000)}</span>
            </div>
          </div>

          {/* Availability & Rating Toggles */}
          <div className="pt-2 border-t border-[#E7E5E4] space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[#18181B]">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="rounded border-[#E7E5E4] text-[#18181B] focus:ring-0 cursor-pointer w-4 h-4"
              />
              <span>In-Stock Batches Only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[#18181B]">
              <input
                type="checkbox"
                checked={fourStarsOnly}
                onChange={(e) => setFourStarsOnly(e.target.checked)}
                className="rounded border-[#E7E5E4] text-[#18181B] focus:ring-0 cursor-pointer w-4 h-4"
              />
              <span>Rating: 4★ & above</span>
            </label>
          </div>
        </aside>

        {/* Products Grid Area */}
        <div className="lg:col-span-9 w-full min-w-0 flex flex-col space-y-6">
          {/* Active Filter Chips */}
          <div className="flex items-center justify-between text-xs text-[#71717A]">
            <span>
              Showing <strong className="text-[#18181B]">{products.length}</strong> objects
            </span>
            {hasActiveFilters && (
              <span className="text-[#C25E3E] font-medium">Filtered Selection</span>
            )}
          </div>

          {loading ? (
            <div className="py-20 text-center text-sm text-[#71717A]">
              Curating catalog artifacts...
            </div>
          ) : error ? (
            <div className="py-20 text-center bg-white rounded-xl border border-[#E7E5E4] p-8">
              <h3 className="font-serif text-2xl text-[#18181B]">{error}</h3>
              <p className="text-sm text-[#71717A] mt-2 max-w-sm mx-auto font-sans">
                Could not connect to the atelier server. Check your connection or try again.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-6 bg-[#18181B] text-white px-6 py-2.5 rounded text-xs uppercase tracking-wider font-medium hover:bg-[#27272A] transition-colors"
              >
                Reset & Try Again
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-xl border border-[#E7E5E4] p-8">
              <h3 className="font-serif text-2xl text-[#18181B]">No matching artifacts found.</h3>
              <p className="text-sm text-[#71717A] mt-2 max-w-sm mx-auto font-sans">
                Adjust your price threshold or search query to explore other tactile creations.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-6 bg-[#18181B] text-white px-6 py-2.5 rounded text-xs uppercase tracking-wider font-medium hover:bg-[#27272A] transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <>
              {/* Product Grid: 4 columns xl, 3 md, 2 mobile */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6 w-full">
                {displayedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Load More Pagination */}
              {visibleCount < products.length && (
                <div className="flex justify-center pt-8">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 8)}
                    className="bg-white hover:bg-[#18181B] hover:text-white text-[#18181B] border border-[#E7E5E4] px-8 py-3 rounded text-xs uppercase tracking-widest font-medium transition-all shadow-xs"
                  >
                    Load More Objects ({products.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#18181B]/60 backdrop-blur-xs"
            onClick={() => setIsMobileFilterOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col p-6 z-10 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#E7E5E4]">
              <span className="font-serif text-lg font-medium text-[#18181B]">Filter Catalog</span>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="p-1 text-[#71717A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-6 space-y-6">
              {/* Category */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-2">
                  Disciplines
                </label>
                <div className="flex flex-col gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory("all");
                      setIsMobileFilterOpen(false);
                    }}
                    className={`text-left py-2 px-3 rounded ${
                      selectedCategory === "all" ? "bg-[#18181B] text-white" : "bg-[#F5F5F4]"
                    }`}
                  >
                    All Disciplines
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(c.slug);
                        setIsMobileFilterOpen(false);
                      }}
                      className={`text-left py-2 px-3 rounded flex justify-between ${
                        selectedCategory === c.slug ? "bg-[#18181B] text-white" : "bg-[#F5F5F4]"
                      }`}
                    >
                      <span>{c.name}</span>
                      <span className="text-[10px] opacity-60">({c.itemCount})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold">
                    Max Price
                  </label>
                  <span className="text-xs font-serif font-medium">{formatINR(maxPrice)}</span>
                </div>
                <input
                  type="range"
                  min={2000}
                  max={100000}
                  step={2000}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-[#C25E3E]"
                />
              </div>

              {/* In Stock & Rating */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="rounded border-[#E7E5E4] text-[#18181B]"
                  />
                  <span>In-Stock Only</span>
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={fourStarsOnly}
                    onChange={(e) => setFourStarsOnly(e.target.checked)}
                    className="rounded border-[#E7E5E4] text-[#18181B]"
                  />
                  <span>Rating: 4★ & above</span>
                </label>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-[#E7E5E4] flex gap-2">
              <button
                type="button"
                onClick={() => {
                  resetFilters();
                  setIsMobileFilterOpen(false);
                }}
                className="flex-1 py-3 text-xs uppercase tracking-wider border border-[#E7E5E4] rounded"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="flex-1 py-3 text-xs uppercase tracking-wider bg-[#18181B] text-white rounded font-medium"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-[#71717A]">Loading catalog...</div>}>
      <ShopContent />
    </Suspense>
  );
}
