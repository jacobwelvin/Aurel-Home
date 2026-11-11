"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  IndianRupee,
  Package,
  AlertTriangle,
  RefreshCw,
  FolderTree,
  Users,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Inbox,
  TrendingUp,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import {
  fetchAdminStats,
  fetchAdminRecentOrders,
  fetchAdminSalesSummary,
  DashboardStats,
  RecentOrderSummary,
  SalesSummary,
} from "@/lib/adminApi";
import { formatINR, getOrderStatusBadgeClasses } from "@/lib/utils";

export default function AdminDashboardPage() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<RecentOrderSummary[]>([]);
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [statsData, ordersData, salesData] = await Promise.all([
        fetchAdminStats(token || undefined),
        fetchAdminRecentOrders(token || undefined, 8),
        fetchAdminSalesSummary(token || undefined),
      ]);

      setStats(statsData);
      setOrders(ordersData);
      setSales(salesData);
      setLastRefreshed(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load admin overview.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let isMounted = true;

    async function initializeData() {
      try {
        const [statsData, ordersData, salesData] = await Promise.all([
          fetchAdminStats(token || undefined),
          fetchAdminRecentOrders(token || undefined, 8),
          fetchAdminSalesSummary(token || undefined),
        ]);

        if (isMounted) {
          setStats(statsData);
          setOrders(ordersData);
          setSales(salesData);
          setLastRefreshed(new Date());
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Failed to load admin overview.";
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeData();

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (isLoading && !stats) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-8 w-64 bg-gray-200 rounded" />
          </div>
          <div className="h-9 w-28 bg-gray-200 rounded" />
        </div>

        {/* Skeleton Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-lg border border-[#E7E5E4] p-5 space-y-3" />
          ))}
        </div>

        {/* Skeleton Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-white rounded-lg border border-[#E7E5E4]" />
          <div className="h-72 bg-white rounded-lg border border-[#E7E5E4]" />
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-8 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
        <h3 className="font-serif text-xl text-[#18181B] mb-2 font-normal">
          Dashboard Synchronization Error
        </h3>
        <p className="text-sm text-[#71717A] mb-5 font-sans leading-relaxed">{error}</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={refreshData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#18181B] text-[#FAFAF9] rounded text-xs uppercase tracking-wider font-medium hover:bg-black transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Connection
          </button>
          {(error.toLowerCase().includes("session") ||
            error.toLowerCase().includes("unauthorized") ||
            error.toLowerCase().includes("credentials")) && (
            <Link
              href="/login?redirect=/admin"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#C25E3E] text-white rounded text-xs uppercase tracking-wider font-semibold hover:bg-[#A84F32] transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E7E5E4] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
              Atelier Intelligence
            </span>
            <span className="text-white/20">•</span>
            <span className="text-[11px] text-[#71717A] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Synced {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#18181B] font-normal">
            Atelier Executive Overview
          </h2>
          <p className="text-sm text-[#71717A] mt-1 font-sans">
            Real-time catalog metrics, inventory alerts, and customer transactions across Supabase PostgreSQL.
          </p>
        </div>

        <button
          onClick={refreshData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#E7E5E4] hover:border-[#18181B] rounded text-xs uppercase tracking-wider font-medium text-[#18181B] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#C25E3E]" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Orders */}
        <div className="bg-white border border-[#E7E5E4] rounded-lg p-5 shadow-sm hover:border-[#C25E3E]/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#71717A]">
              Total Orders
            </span>
            <div className="w-9 h-9 rounded-full bg-[#F5F5F4] flex items-center justify-center text-[#18181B]">
              <ShoppingBag className="w-4 h-4 text-[#C25E3E]" />
            </div>
          </div>
          <div className="font-serif text-3xl text-[#18181B] font-medium tracking-tight">
            {stats?.total_orders ?? 0}
          </div>
          <div className="text-[12px] text-[#71717A] mt-2 flex items-center gap-1 font-sans">
            <span>Customer acquisitions</span>
          </div>
        </div>

        {/* Card 2: Total Revenue */}
        <div className="bg-white border border-[#E7E5E4] rounded-lg p-5 shadow-sm hover:border-[#C25E3E]/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#71717A]">
              Total Revenue
            </span>
            <div className="w-9 h-9 rounded-full bg-[#F5F5F4] flex items-center justify-center text-[#18181B]">
              <IndianRupee className="w-4 h-4 text-[#C25E3E]" />
            </div>
          </div>
          <div className="font-serif text-3xl text-[#18181B] font-medium tracking-tight">
            {formatINR(stats?.total_revenue ?? 0)}
          </div>
          <div className="text-[12px] text-[#71717A] mt-2 flex items-center gap-1 font-sans">
            <span>Gross order volume (INR)</span>
          </div>
        </div>

        {/* Card 3: Active Products */}
        <div className="bg-white border border-[#E7E5E4] rounded-lg p-5 shadow-sm hover:border-[#C25E3E]/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#71717A]">
              Active Products
            </span>
            <div className="w-9 h-9 rounded-full bg-[#F5F5F4] flex items-center justify-center text-[#18181B]">
              <Package className="w-4 h-4 text-[#18181B]" />
            </div>
          </div>
          <div className="font-serif text-3xl text-[#18181B] font-medium tracking-tight">
            {stats?.total_active_products ?? 0}
          </div>
          <div className="text-[12px] text-emerald-700 mt-2 flex items-center gap-1 font-sans font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Live across 6 realms</span>
          </div>
        </div>

        {/* Card 4: Low-Stock Products */}
        <div className="bg-white border border-[#E7E5E4] rounded-lg p-5 shadow-sm hover:border-[#C25E3E]/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#71717A]">
              Low-Stock Warnings
            </span>
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center ${
                (stats?.low_stock_products ?? 0) > 0
                  ? "bg-[#FFDBD0] text-[#742508]"
                  : "bg-[#F5F5F4] text-[#18181B]"
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 ${
                  (stats?.low_stock_products ?? 0) > 0 ? "text-[#C25E3E]" : "text-[#71717A]"
                }`}
              />
            </div>
          </div>
          <div className="font-serif text-3xl text-[#18181B] font-medium tracking-tight">
            {stats?.low_stock_products ?? 0}
          </div>
          <div className="text-[12px] text-[#71717A] mt-2 flex items-center gap-1 font-sans">
            <span>Stock ≤ {stats?.low_stock_threshold ?? 5} units</span>
          </div>
        </div>
      </div>

      {/* Catalogue & Customer Quick Context */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderTree className="w-5 h-5 text-[#C25E3E]" />
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-[#18181B]">
                Curated Realms
              </div>
              <div className="text-xs text-[#71717A]">
                {stats?.total_categories ?? 0} active architectural categories in PostgreSQL
              </div>
            </div>
          </div>
          <Link
            href="/admin/categories"
            className="text-xs font-medium text-[#C25E3E] hover:underline flex items-center gap-1"
          >
            <span>Realms</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-[#C25E3E]" />
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-[#18181B]">
                Registered Patrons
              </div>
              <div className="text-xs text-[#71717A]">
                {stats?.total_customers ?? 0} verified customer profiles synchronized
              </div>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-white text-[#18181B] font-medium border border-[#E7E5E4]">
            Role: customer
          </span>
        </div>
      </div>

      {/* Sales Overview & Status Breakdown */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
              Financial Intelligence
            </span>
            <h3 className="font-serif text-xl text-[#18181B] font-normal">
              Sales Overview & Metrics
            </h3>
          </div>
          <div className="text-right">
            <span className="text-xs text-[#71717A]">Average Order Value</span>
            <div className="font-serif text-lg text-[#18181B]">
              {formatINR(sales?.average_order_value ?? 0)}
            </div>
          </div>
        </div>

        {sales?.has_data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 p-4 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4] text-center">
              <div>
                <div className="text-xs text-[#71717A]">Orders Recorded</div>
                <div className="font-serif text-xl text-[#18181B] mt-1">
                  {sales.orders_count}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#71717A]">Cumulative Sales</div>
                <div className="font-serif text-xl text-[#18181B] mt-1">
                  {formatINR(sales.total_revenue)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#71717A]">Average Ticket</div>
                <div className="font-serif text-xl text-[#18181B] mt-1">
                  {formatINR(sales.average_order_value)}
                </div>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="space-y-2 pt-2">
              <span className="text-xs uppercase tracking-wider font-medium text-[#71717A]">
                Order Lifecycle Breakdown
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(sales.status_breakdown).map(([statusName, count]) => (
                  <div
                    key={statusName}
                    className="p-3 bg-white rounded border border-[#E7E5E4] text-center"
                  >
                    <div className="text-[11px] text-[#71717A] uppercase">{statusName}</div>
                    <div className="text-lg font-serif font-medium text-[#18181B] mt-0.5">
                      {count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 px-6 rounded-lg bg-[#FAFAF9] border border-dashed border-[#E7E5E4] text-center">
            <TrendingUp className="w-8 h-8 text-[#71717A]/60 mx-auto mb-3" />
            <h4 className="font-serif text-base text-[#18181B] font-medium mb-1">
              No Sales Transactions Recorded Yet
            </h4>
            <p className="text-xs text-[#71717A] max-w-md mx-auto font-sans leading-relaxed">
              Aggregated sales curves, transaction volumes, and revenue metrics will dynamically calculate
              here once patrons complete checkout orders in Phase 5.3.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E7E5E4] text-[11px] text-[#71717A]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Waiting for Phase 5.3 Checkout transactions</span>
            </div>
          </div>
        )}
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
              Order Stream
            </span>
            <h3 className="font-serif text-xl text-[#18181B] font-normal">
              Recent Patron Acquisitions
            </h3>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs uppercase tracking-wider font-medium text-[#C25E3E] hover:underline flex items-center gap-1"
          >
            <span>All Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F5F4] text-[#71717A] uppercase tracking-wider text-[10px] border-b border-[#E7E5E4]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Order Number</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Items</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E4]">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-[#FAFAF9] transition-colors">
                    <td className="py-3.5 px-4 font-medium text-[#18181B]">{o.order_number}</td>
                    <td className="py-3.5 px-4 text-[#71717A]">
                      <div className="font-medium text-[#18181B]">{o.recipient_name || o.customer_name || "Recipient details unavailable"}</div>
                      <div className="text-[11px] text-[#71717A]/70">{o.customer_email || "—"}</div>
                    </td>
                    <td className="py-3.5 px-4 text-[#71717A]">
                      {new Date(o.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-semibold tracking-wider border ${getOrderStatusBadgeClasses(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#71717A]">{o.items_count} items</td>
                    <td className="py-3.5 px-4 text-right font-medium text-[#18181B]">
                      {formatINR(o.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 px-6 rounded-lg bg-[#FAFAF9] border border-dashed border-[#E7E5E4] text-center">
            <Inbox className="w-10 h-10 text-[#71717A]/50 mx-auto mb-3" />
            <h4 className="font-serif text-lg text-[#18181B] font-normal mb-1">
              No Orders Placed Yet
            </h4>
            <p className="text-xs text-[#71717A] max-w-md mx-auto font-sans leading-relaxed">
              When patrons complete acquisition checkout in Phase 5.3, real orders with financial snapshots,
              customer shipping addresses, and tracking codes will stream into this table in real time.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E7E5E4] text-[11px] text-[#71717A]">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Real PostgreSQL Table: orders (0 records)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
