"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Boxes,
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Search,
  Package,
  Sparkles,
  ArrowUpDown,
  X,
  Plus,
  Minus,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import {
  fetchAdminProducts,
  adjustProductStock,
  AdminProductItem,
} from "@/lib/adminApi";
import { resolveMediaUrl } from "@/lib/utils";

export default function AdminInventoryPage() {
  const { token } = useAuthStore();
  const authToken = token || "";

  // Data states
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<string>("all"); // "all", "low_stock", "out_of_stock", "healthy"

  // Quick Adjustment Dialog
  const [adjustTarget, setAdjustTarget] = useState<AdminProductItem | null>(null);
  const [targetStock, setTargetStock] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Load Inventory Products
  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stockStatusParam =
        stockFilter === "low_stock"
          ? "low_stock"
          : stockFilter === "out_of_stock"
          ? "out_of_stock"
          : stockFilter === "healthy"
          ? "in_stock"
          : undefined;

      const res = await fetchAdminProducts(authToken, {
        limit: 100, // Load broad inventory set for stock review
        search: searchQuery.trim() || undefined,
        stock_status: stockStatusParam,
      });

      setProducts(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory.");
    } finally {
      setIsLoading(false);
    }
  }, [authToken, searchQuery, stockFilter]);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      try {
        const stockStatusParam =
          stockFilter === "low_stock"
            ? "low_stock"
            : stockFilter === "out_of_stock"
            ? "out_of_stock"
            : stockFilter === "healthy"
            ? "in_stock"
            : undefined;

        const res = await fetchAdminProducts(authToken, {
          limit: 100,
          search: searchQuery.trim() || undefined,
          stock_status: stockStatusParam,
        });

        if (isMounted) {
          setProducts(res.items);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load inventory.");
          setIsLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [authToken, searchQuery, stockFilter]);

  // Open adjustment modal
  const openAdjustModal = (product: AdminProductItem) => {
    setAdjustTarget(product);
    setTargetStock(product.stock);
    setAdjustReason("");
    setAdjustError(null);
  };

  // Submit stock adjustment
  const handleStockAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;

    if (targetStock < 0) {
      setAdjustError("Stock level cannot be negative.");
      return;
    }

    setIsAdjusting(true);
    setAdjustError(null);

    try {
      await adjustProductStock(authToken, adjustTarget.id, targetStock, adjustReason);
      setAdjustTarget(null);
      await loadInventory();
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : "Failed to adjust stock.");
    } finally {
      setIsAdjusting(false);
    }
  };

  // Metrics summary
  const totalStockCount = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-[#71717A]">
        <Link href="/admin" className="hover:text-[#18181B] flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </Link>
        <span>/</span>
        <span className="text-[#18181B] font-medium">Inventory & Stock</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E7E5E4] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#FAF7F2] border border-[#E7E5E4] text-[#C25E3E] text-[10px] font-semibold tracking-wider uppercase mb-2">
            <Sparkles className="w-3 h-3" />
            <span>Stock Operations</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#18181B] font-normal">
            Inventory & Stock Control
          </h2>
          <p className="text-sm text-[#71717A] mt-1 font-sans">
            Real-time stock auditing, replenishment workflows, and low-inventory early warnings (≤ 5 units).
          </p>
        </div>

        <button
          onClick={() => loadInventory()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 border border-[#E7E5E4] rounded-lg bg-white text-xs text-[#71717A] hover:text-[#18181B] hover:border-[#18181B] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Stock</span>
        </button>
      </div>

      {/* Quick KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-[#E7E5E4] rounded-lg shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#71717A] mb-2">
            <span>Total Units on Hand</span>
            <Boxes className="w-4 h-4 text-[#C25E3E]" />
          </div>
          <div className="font-serif text-2xl text-[#18181B] font-normal">
            {totalStockCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">Across all active catalog pieces</div>
        </div>

        <div className="p-5 bg-white border border-[#E7E5E4] rounded-lg shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#71717A] mb-2">
            <span>Low Stock Warnings</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-serif text-2xl text-amber-700 font-normal">
            {lowStockCount}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">Approaching atelier threshold (1 – 5 units)</div>
        </div>

        <div className="p-5 bg-white border border-[#E7E5E4] rounded-lg shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#71717A] mb-2">
            <span>Depleted / Out of Stock</span>
            <Package className="w-4 h-4 text-rose-600" />
          </div>
          <div className="font-serif text-2xl text-rose-700 font-normal">
            {outOfStockCount}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">Purchases currently halted on storefront</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
          <input
            type="text"
            placeholder="Search piece by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] bg-[#FAFAF9]"
          />
        </div>

        {/* Status Pill Filters */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStockFilter("all")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              stockFilter === "all"
                ? "bg-[#18181B] text-white"
                : "bg-[#FAFAF9] text-[#71717A] hover:bg-[#E7E5E4]"
            }`}
          >
            All Inventory
          </button>
          <button
            onClick={() => setStockFilter("low_stock")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              stockFilter === "low_stock"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            Low Stock (≤ 5)
          </button>
          <button
            onClick={() => setStockFilter("out_of_stock")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              stockFilter === "out_of_stock"
                ? "bg-rose-600 text-white"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100"
            }`}
          >
            Out of Stock (0)
          </button>
          <button
            onClick={() => setStockFilter("healthy")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              stockFilter === "healthy"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            Healthy (&gt; 5)
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#C25E3E] mb-2" />
            <p className="text-xs text-[#71717A]">Reading live inventory counts...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm text-[#18181B] font-medium">{error}</p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => loadInventory()}
                className="px-4 py-1.5 text-xs bg-[#18181B] text-white rounded hover:bg-[#27272A] transition-colors cursor-pointer"
              >
                Retry
              </button>
              {(error.toLowerCase().includes("session") ||
                error.toLowerCase().includes("unauthorized") ||
                error.toLowerCase().includes("credentials")) && (
                <Link
                  href="/login?redirect=/admin/inventory"
                  className="px-4 py-1.5 text-xs bg-[#C25E3E] text-white rounded hover:bg-[#A84F32] transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Boxes className="w-8 h-8 text-[#A1A1AA] mx-auto" />
            <h4 className="font-serif text-lg text-[#18181B]">No pieces match inventory filter</h4>
            <p className="text-xs text-[#71717A]">All stock levels are clear under this view.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7F2] text-[#71717A] uppercase text-[10px] tracking-wider border-b border-[#E7E5E4]">
                <tr>
                  <th className="py-3 px-4">Artisanal Creation</th>
                  <th className="py-3 px-4">Realm</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Current Stock</th>
                  <th className="py-3 px-4">Inventory Health</th>
                  <th className="py-3 px-4 text-right">Adjust Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E4]">
                {products.map((p) => {
                  const isLow = p.stock > 0 && p.stock <= 5;
                  const isOut = p.stock === 0;

                  return (
                    <tr key={p.id} className="hover:bg-[#FAFAF9] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded bg-[#F5F5F4] overflow-hidden flex-shrink-0 relative border border-[#E7E5E4]">
                            {p.images && p.images[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={resolveMediaUrl(p.images[0])}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "/images/placeholder.jpg";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#A1A1AA]">
                                <Package className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-[#18181B]">{p.name}</div>
                            <div className="text-[10px] text-[#A1A1AA] font-mono mt-0.5">
                              SKU / ID: {p.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-[#71717A]">
                        {p.category ? p.category.name : "Unassigned"}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[#18181B]">
                        ₹{Number(p.price).toLocaleString("en-IN")}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono text-sm font-semibold text-[#18181B]">
                          {p.stock}
                        </span>{" "}
                        <span className="text-[11px] text-[#71717A]">units</span>
                      </td>

                      <td className="py-3.5 px-4">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-medium border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Depleted (0 units)
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Low Stock (≤ 5 units)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Healthy Supply
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openAdjustModal(p)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-[#18181B] hover:bg-[#C25E3E] text-white rounded transition-colors font-medium shadow-xs"
                        >
                          <ArrowUpDown className="w-3 h-3" />
                          <span>Adjust</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QUICK STOCK ADJUSTMENT MODAL */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E7E5E4] w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7E5E4] pb-3">
              <div>
                <h4 className="font-serif text-lg text-[#18181B]">Adjust Stock Level</h4>
                <p className="text-xs text-[#71717A] mt-0.5">{adjustTarget.name}</p>
              </div>
              <button
                onClick={() => setAdjustTarget(null)}
                className="p-1 text-[#71717A] hover:text-[#18181B] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {adjustError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            <form onSubmit={handleStockAdjustmentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#18181B] mb-1">
                  New Absolute Stock Quantity
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetStock((s) => Math.max(0, s - 1))}
                    className="p-2 border border-[#E7E5E4] rounded hover:bg-[#F5F5F4]"
                  >
                    <Minus className="w-3.5 h-3.5 text-[#18181B]" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    required
                    value={targetStock}
                    onChange={(e) => setTargetStock(parseInt(e.target.value, 10) || 0)}
                    className="w-full text-center px-3 py-2 text-base font-mono font-semibold border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                  />
                  <button
                    type="button"
                    onClick={() => setTargetStock((s) => s + 1)}
                    className="p-2 border border-[#E7E5E4] rounded hover:bg-[#F5F5F4]"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#18181B]" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181B] mb-1">
                  Reason / Audit Log Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received workshop restock batch #4"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                />
              </div>

              <div className="p-3 bg-[#FAF7F2] border border-[#E7E5E4] rounded text-xs text-[#71717A] space-y-1">
                <div className="flex justify-between">
                  <span>Previous stock:</span>
                  <span className="font-mono text-[#18181B] font-semibold">{adjustTarget.stock} units</span>
                </div>
                <div className="flex justify-between">
                  <span>Adjustment delta:</span>
                  <span
                    className={`font-mono font-semibold ${
                      targetStock - adjustTarget.stock >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {targetStock - adjustTarget.stock >= 0 ? "+" : ""}
                    {targetStock - adjustTarget.stock} units
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E7E5E4]">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-4 py-2 border border-[#E7E5E4] rounded text-xs text-[#71717A] hover:bg-[#F5F5F4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdjusting}
                  className="px-5 py-2 bg-[#18181B] hover:bg-[#C25E3E] text-white rounded text-xs uppercase tracking-wider font-medium disabled:opacity-50 transition-colors"
                >
                  {isAdjusting ? "Updating..." : "Commit Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
