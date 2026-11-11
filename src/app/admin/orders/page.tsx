"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  ArrowLeft,
  Search,
  RefreshCw,
  AlertTriangle,
  Eye,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CreditCard,
  MapPin,
  User,
  History,
  X,
  AlertCircle,
  FileText,
  Download,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { syncAuthCookie } from "@/lib/authCookie";
import { downloadOrderInvoicePdf } from "@/lib/api";
import {
  fetchAdminOrders,
  fetchAdminOrderDetail,
  updateAdminOrderStatus,
  AdminOrderDetailItem,
  AdminOrderListResult,
  AdminTimeoutError,
  AdminAuthError,
  AdminNetworkError,
} from "@/lib/adminApi";
import { formatINR, getOrderStatusBadgeClasses } from "@/lib/utils";

interface NewOrderToast {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  orderId: string;
}

export default function AdminOrdersPage() {
  const { token } = useAuthStore();
  const authToken = token || "";

  // Data states
  const [orders, setOrders] = useState<AdminOrderDetailItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDataStale, setIsDataStale] = useState(false);

  // Real-time & Connection states
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "reconnecting" | "offline">("connected");
  const [newOrderToasts, setNewOrderToasts] = useState<NewOrderToast[]>([]);

  // Prevent duplicate toast notifications & track disconnection
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const wasDisconnectedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  // Request race-condition prevention & cancellation refs
  const inFlightAbortRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [sortOption, setSortOption] = useState("newest");

  // Search input debouncer (300ms) to avoid request storms while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Detail Modal state
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetailItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Status Update Dialog state
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState("");
  const [carrierInput, setCarrierInput] = useState("");
  const [trackingInput, setTrackingInput] = useState("");
  const [auditNote, setAuditNote] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Admin Invoice PDF Download state
  const [downloadingAdminInvoiceId, setDownloadingAdminInvoiceId] = useState<string | null>(null);
  const [adminInvoiceError, setAdminInvoiceError] = useState<string | null>(null);

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (inFlightAbortRef.current) {
        inFlightAbortRef.current.abort();
      }
    };
  }, []);

  // Helper to ensure an active valid admin access token
  const getActiveToken = useCallback(async (): Promise<string> => {
    let currentToken = token;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const now = Math.floor(Date.now() / 1000);
        if (session.expires_at && session.expires_at <= now + 60) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData?.session?.access_token) {
            currentToken = refreshData.session.access_token;
            useAuthStore.setState({ token: currentToken });
            syncAuthCookie(currentToken);
          }
        } else if (session.access_token) {
          currentToken = session.access_token;
        }
      }
    } catch {
      // Keep memory token if session probe fails
    }
    return currentToken || "";
  }, [token]);

  const handleAdminDownloadInvoice = async (orderId: string) => {
    setDownloadingAdminInvoiceId(orderId);
    setAdminInvoiceError(null);
    try {
      const activeToken = await getActiveToken();
      const { blob, filename } = await downloadOrderInvoicePdf(orderId, activeToken);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setAdminInvoiceError(err instanceof Error ? err.message : "Failed to download invoice PDF.");
    } finally {
      setDownloadingAdminInvoiceId(null);
    }
  };

  // Unified robust order fetcher with cancellation and race-condition prevention
  const executeFetchOrders = useCallback(
    async (options: { silent?: boolean; isManual?: boolean } = {}) => {
      const { silent = false, isManual = false } = options;

      // Abort previous in-flight request so newer queries never compete
      if (inFlightAbortRef.current) {
        inFlightAbortRef.current.abort();
      }
      const controller = new AbortController();
      inFlightAbortRef.current = controller;
      const requestId = ++latestRequestIdRef.current;

      if (!silent) {
        setIsLoading(true);
      }
      if (isManual) {
        setIsRefreshing(true);
      }

      try {
        let activeToken = await getActiveToken();

        let data: AdminOrderListResult;
        try {
          data = await fetchAdminOrders(activeToken, {
            page,
            limit,
            search: debouncedSearch.trim() || undefined,
            status: statusFilter || undefined,
            payment_status: paymentFilter || undefined,
            sort: sortOption,
            signal: controller.signal,
          });
        } catch (fetchErr) {
          // If 401 unauthorized, attempt secure session refresh once before giving up
          if (fetchErr instanceof AdminAuthError && fetchErr.statusCode === 401) {
            const { data: refreshData } = await supabase.auth.refreshSession();
            if (refreshData?.session?.access_token) {
              activeToken = refreshData.session.access_token;
              useAuthStore.setState({ token: activeToken });
              syncAuthCookie(activeToken);

              // Retry once with refreshed credentials
              data = await fetchAdminOrders(activeToken, {
                page,
                limit,
                search: debouncedSearch.trim() || undefined,
                status: statusFilter || undefined,
                payment_status: paymentFilter || undefined,
                sort: sortOption,
                signal: controller.signal,
              });
            } else {
              throw fetchErr;
            }
          } else {
            throw fetchErr;
          }
        }

        // Commit only if this response matches the most recent request
        if (requestId === latestRequestIdRef.current && isMountedRef.current) {
          setOrders(data.items);
          setTotal(data.total);
          setTotalPages(data.pages || 1);
          setError(null);
          setIsDataStale(false);
        }
      } catch (err: unknown) {
        // Clean cancellation from caller's AbortController — do not overwrite state or set errors
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        if (requestId !== latestRequestIdRef.current || !isMountedRef.current) {
          return;
        }

        let userMessage = "Failed to load orders from database.";
        if (err instanceof AdminTimeoutError) {
          userMessage = "Order synchronization timed out. The server or database may be experiencing latency.";
        } else if (err instanceof AdminNetworkError) {
          userMessage = "Network connection unavailable. Please check your connectivity.";
        } else if (err instanceof AdminAuthError) {
          userMessage = "Administrator session expired or unauthorized. Please sign in again.";
        } else if (err instanceof Error) {
          userMessage = err.message;
        }

        setError(userMessage);
        // Mark displayed orders as stale while preserving them in view
        setIsDataStale(true);
      } finally {
        if (requestId === latestRequestIdRef.current && isMountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [getActiveToken, page, limit, debouncedSearch, statusFilter, paymentFilter, sortOption]
  );

  // Manual refresh that keeps UI steady and spins only the button
  const handleManualRefresh = async () => {
    await executeFetchOrders({ silent: true, isManual: true });
  };

  // Initial and query-driven fetch
  useEffect(() => {
    executeFetchOrders();
  }, [executeFetchOrders]);

  // Real-time synchronization via Supabase Channel with auto-reconnection and miss recovery
  useEffect(() => {
    const setupRealtimeChannel = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = supabase
        .channel("admin-orders-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          (payload: any) => {
            const newOrder = payload.new;
            if (!newOrder || !newOrder.id) return;

            // Prevent duplicate notifications
            if (seenOrderIdsRef.current.has(newOrder.id)) return;
            seenOrderIdsRef.current.add(newOrder.id);

            const customerName =
              newOrder.shipping_address?.fullName ||
              newOrder.shipping_address?.name ||
              "Valued Patron";
            const totalAmount = Number(newOrder.total_amount || 0);

            const toastId = `${newOrder.id}-${Date.now()}`;
            setNewOrderToasts((prev) => [
              ...prev,
              {
                id: toastId,
                orderNumber: newOrder.order_number,
                customerName,
                totalAmount,
                orderId: newOrder.id,
              },
            ]);

            // Auto-dismiss after 9 seconds
            setTimeout(() => {
              setNewOrderToasts((prev) => prev.filter((t) => t.id !== toastId));
            }, 9000);

            // Smoothly update metrics and fetch latest orders silently without page reload
            setTotal((prev) => prev + 1);
            executeFetchOrders({ silent: true });
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders" },
          (payload: any) => {
            const updated = payload.new;
            if (!updated || !updated.id) return;

            // Check if order payment transitioned to Paid
            const isNowPaid = (updated.payment_status || "").toLowerCase() === "paid";
            const toastKey = `paid-notif-${updated.id}`;
            if (isNowPaid && !seenOrderIdsRef.current.has(toastKey)) {
              seenOrderIdsRef.current.add(toastKey);
              const isCodConverted =
                (updated.original_payment_method || "").toLowerCase() === "cod" ||
                (updated.payment_method || "").toLowerCase() === "upi";

              const customerName =
                updated.shipping_address?.fullName ||
                updated.shipping_address?.name ||
                "Valued Patron";

              const toastId = `${updated.id}-${Date.now()}`;
              setNewOrderToasts((prev) => [
                ...prev,
                {
                  id: toastId,
                  orderNumber: `${updated.order_number} (Payment Confirmed)`,
                  customerName: isCodConverted ? `${customerName} (COD Paid Online)` : `${customerName} (Online Settlement)`,
                  totalAmount: Number(updated.total_amount || 0),
                  orderId: updated.id,
                },
              ]);

              setTimeout(() => {
                setNewOrderToasts((prev) => prev.filter((t) => t.id !== toastId));
              }, 9000);
            }

            // Update item in-place in current view
            setOrders((prev) =>
              prev.map((o) =>
                o.id === updated.id
                  ? {
                      ...o,
                      status: updated.status || o.status,
                      payment_status: updated.payment_status || o.payment_status,
                      payment_method: updated.payment_method || o.payment_method,
                      original_payment_method: updated.original_payment_method ?? o.original_payment_method,
                      payment_reference: updated.payment_reference ?? o.payment_reference,
                      paid_at: updated.paid_at ?? o.paid_at,
                      invoice_number: updated.invoice_number ?? o.invoice_number,
                      total_amount: updated.total_amount || o.total_amount,
                      tracking_number: updated.tracking_number ?? o.tracking_number,
                      carrier: updated.carrier ?? o.carrier,
                    }
                  : o
              )
            );

            // Also update detailed modal if currently viewing this order
            setSelectedOrder((prev) =>
              prev && prev.id === updated.id
                ? {
                    ...prev,
                    status: updated.status || prev.status,
                    payment_status: updated.payment_status || prev.payment_status,
                    payment_method: updated.payment_method || prev.payment_method,
                    original_payment_method: updated.original_payment_method ?? prev.original_payment_method,
                    payment_reference: updated.payment_reference ?? prev.payment_reference,
                    paid_at: updated.paid_at ?? prev.paid_at,
                    invoice_number: updated.invoice_number ?? prev.invoice_number,
                    tracking_number: updated.tracking_number ?? prev.tracking_number,
                    carrier: updated.carrier ?? prev.carrier,
                  }
                : prev
            );
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setConnectionStatus("connected");
            reconnectAttemptsRef.current = 0;
            // Catch up on any orders placed during a disconnection window
            if (wasDisconnectedRef.current) {
              wasDisconnectedRef.current = false;
              executeFetchOrders({ silent: true });
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            wasDisconnectedRef.current = true;
            setConnectionStatus("reconnecting");
            const backoff = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            reconnectAttemptsRef.current += 1;
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
              setupRealtimeChannel();
            }, backoff);
          } else if (status === "CLOSED") {
            wasDisconnectedRef.current = true;
            setConnectionStatus("offline");
          }
        });

      channelRef.current = channel;
    };

    setupRealtimeChannel();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [executeFetchOrders]);

  // Open Order Details directly by ID (used by toast action)
  const handleViewOrderById = async (orderId: string) => {
    const existing = orders.find((o) => o.id === orderId);
    if (existing) {
      setSelectedOrder(existing);
    } else {
      setSelectedOrder(null);
    }
    setIsDetailModalOpen(true);

    try {
      const activeToken = await getActiveToken();
      const detailed = await fetchAdminOrderDetail(activeToken, orderId);
      setSelectedOrder(detailed);
    } catch (err) {
      console.error("Failed to fetch fresh order details:", err);
    }
  };

  // Open Order Details
  const handleViewOrder = async (order: AdminOrderDetailItem) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);

    try {
      const activeToken = await getActiveToken();
      const detailed = await fetchAdminOrderDetail(activeToken, order.id);
      setSelectedOrder(detailed);
    } catch (err) {
      console.error("Failed to fetch fresh order details:", err);
    }
  };

  // Open Status Transition Dialog
  const handleOpenStatusDialog = (order: AdminOrderDetailItem) => {
    setSelectedOrder(order);
    setTargetStatus("");
    setCarrierInput(order.carrier || "White-Glove Courier");
    setTrackingInput(order.tracking_number || "");
    setAuditNote("");
    setUpdateError(null);
    setIsUpdateModalOpen(true);
  };

  // Submit Status Update
  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !targetStatus) return;

    setIsUpdatingStatus(true);
    setUpdateError(null);

    try {
      const activeToken = await getActiveToken();
      const updated = await updateAdminOrderStatus(activeToken, selectedOrder.id, {
        new_status: targetStatus,
        carrier: carrierInput.trim() || undefined,
        tracking_number: trackingInput.trim() || undefined,
        note: auditNote.trim() || undefined,
      });

      setSelectedOrder(updated);
      setIsUpdateModalOpen(false);
      await executeFetchOrders({ silent: true });
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Failed to update order status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Status Badge Styling Helper
  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase().trim();
    const colorClasses = getOrderStatusBadgeClasses(s);

    if (s === "delivered" || s === "completed") {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${colorClasses}`}>
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Delivered</span>
        </span>
      );
    }

    if (s === "shipped" || s === "dispatched" || s === "dispatched / shipped" || s === "in_transit" || s === "out_for_delivery") {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${colorClasses}`}>
          <Truck className="w-3 h-3 text-blue-600" />
          <span>Dispatched / Shipped</span>
        </span>
      );
    }

    if (s === "processing" || s === "workshop processing" || s === "in_processing") {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${colorClasses}`}>
          <Clock className="w-3 h-3 text-amber-600" />
          <span>Workshop Processing</span>
        </span>
      );
    }

    if (s === "confirmed" || s === "payment confirmed" || s === "payment_confirmed" || s === "payment-confirmed") {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${colorClasses}`}>
          <CheckCircle2 className="w-3 h-3 text-purple-600" />
          <span>Payment Confirmed</span>
        </span>
      );
    }

    if (s === "cancelled" || s === "canceled" || s === "restocked" || s.includes("cancelled") || s.includes("restocked")) {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${colorClasses}`}>
          <XCircle className="w-3 h-3 text-rose-600" />
          <span>Cancelled (Restocked)</span>
        </span>
      );
    }

    if (s === "failed" || s === "payment failed" || s === "payment_failed") {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${colorClasses}`}>
          <AlertCircle className="w-3 h-3 text-red-600" />
          <span>Payment Failed</span>
        </span>
      );
    }

    if (s === "pending" || s === "awaiting payment" || s === "awaiting_payment") {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${colorClasses}`}>
          <Clock className="w-3 h-3 text-[#71717A]" />
          <span>Awaiting Payment</span>
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${colorClasses}`}>
        <Package className="w-3 h-3 text-[#71717A]" />
        <span>{status || "Placed / Awaiting Review"}</span>
      </span>
    );
  };

  const getPaymentBadge = (status: string, originalMethod?: string | null) => {
    const s = (status || "").toLowerCase();
    const isExCod = (originalMethod || "").toLowerCase() === "cod";
    switch (s) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {isExCod ? "Paid Online (ex-COD)" : "Paid"}
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            {isExCod ? "COD Pending" : "Pending"}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-[#71717A]">
        <Link href="/admin" className="hover:text-[#18181B] flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </Link>
        <span>/</span>
        <span className="text-[#18181B] font-medium">Order Management</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E7E5E4] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#FAF7F2] border border-[#E7E5E4] text-[#C25E3E] text-[10px] font-semibold tracking-wider uppercase mb-2">
            <Sparkles className="w-3 h-3" />
            <span>Fulfillment & Dispatch</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#18181B] font-normal">
            Order Management & Logistics
          </h2>
          <p className="text-sm text-[#71717A] mt-1 font-sans">
            Review patron acquisitions, manage fulfillment transitions, waybills, and stock recovery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Real-time Telemetry Status Pill */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
              connectionStatus === "connected"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : connectionStatus === "reconnecting"
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : "bg-zinc-100 text-zinc-600 border-zinc-200"
            }`}
            title={`Real-time WebSocket streaming: ${connectionStatus}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-emerald-500 animate-pulse"
                  : connectionStatus === "reconnecting"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-zinc-400"
              }`}
            />
            <span className="capitalize font-mono text-[10px] tracking-wider uppercase">
              {connectionStatus === "connected" ? "Live" : connectionStatus === "reconnecting" ? "Reconnecting" : "Offline"}
            </span>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-2 border border-[#E7E5E4] rounded-lg bg-white text-xs text-[#71717A] hover:text-[#18181B] hover:border-[#18181B] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh Consignments</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
            <input
              type="text"
              placeholder="Search order #, customer, tracking..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] bg-[#FAFAF9]"
            />
          </div>

          {/* Fulfillment Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] bg-[#FAFAF9] text-[#18181B]"
            >
              <option value="">All Fulfillment States</option>
              <option value="Placed">Placed</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Processing">Processing</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] bg-[#FAFAF9] text-[#18181B]"
            >
              <option value="">All Payment States</option>
              <option value="Pending">Payment Pending</option>
              <option value="Paid">Paid / Settled</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>

          {/* Sorting */}
          <div>
            <select
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] bg-[#FAFAF9] text-[#18181B]"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="total-desc">Sort: Highest Total</option>
              <option value="total-asc">Sort: Lowest Total</option>
            </select>
          </div>
        </div>

        {/* Filter stats bar */}
        <div className="flex items-center justify-between text-xs text-[#71717A] pt-2 border-t border-[#F5F5F4]">
          <div>
            Found <span className="font-semibold text-[#18181B]">{total}</span> recorded acquisitions
          </div>
          {(searchQuery || statusFilter || paymentFilter || sortOption !== "newest") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("");
                setPaymentFilter("");
                setSortOption("newest");
                setPage(1);
              }}
              className="text-[#C25E3E] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg shadow-sm overflow-hidden">
        {error && orders.length > 0 && (
          <div className="p-3.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{error} (Existing orders remain displayed, but live data may be stale).</span>
            </div>
            <button
              onClick={() => executeFetchOrders({ silent: true, isManual: true })}
              disabled={isRefreshing}
              className="font-medium underline text-amber-900 hover:text-amber-950 flex items-center gap-1.5 ml-3 whitespace-nowrap"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Retry Sync</span>
            </button>
          </div>
        )}

        {isLoading && orders.length === 0 ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#C25E3E] mb-2" />
            <p className="text-xs text-[#71717A]">Reading live orders from database...</p>
          </div>
        ) : error && orders.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm text-[#18181B] font-medium">{error}</p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => executeFetchOrders()}
                className="px-4 py-1.5 text-xs bg-[#18181B] text-white rounded hover:bg-[#27272A] transition-colors"
              >
                Retry
              </button>
              {error.toLowerCase().includes("session") && (
                <Link
                  href="/login?redirect=/admin/orders"
                  className="px-4 py-1.5 text-xs bg-[#C25E3E] text-white rounded hover:bg-[#A84F32] transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <ShoppingBag className="w-8 h-8 text-[#A1A1AA] mx-auto" />
            <h4 className="font-serif text-lg text-[#18181B]">No acquisitions found</h4>
            <p className="text-xs text-[#71717A] max-w-sm mx-auto">
              No orders matched your selected filters. Note: Simulated dummy orders are never injected into the live database.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7F2] text-[#71717A] uppercase text-[10px] tracking-wider border-b border-[#E7E5E4]">
                <tr>
                  <th className="py-3 px-4">Order Code</th>
                  <th className="py-3 px-4">Recipient / Patron</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total (INR)</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Fulfillment Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E4]">
                {orders.map((o) => {
                  const itemCount = o.items ? o.items.reduce((sum, it) => sum + it.quantity, 0) : 0;
                  const dateStr = new Date(o.created_at).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <tr key={o.id} className="hover:bg-[#FAFAF9] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#18181B]">
                        {o.order_number}
                        {o.tracking_number && (
                          <div className="text-[10px] text-[#71717A] font-normal flex items-center gap-1 mt-0.5">
                            <Truck className="w-3 h-3 text-[#A1A1AA]" />
                            <span>{o.tracking_number}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#18181B]">
                          {o.recipient_name || o.shipping_address?.fullName || o.customer_name || "Recipient details unavailable"}
                        </div>
                        <div className="text-[11px] text-[#71717A]">
                          {o.recipient_email || o.shipping_address?.email || o.customer_email || "No email on record"}
                        </div>
                        {o.account_name && o.account_name !== (o.recipient_name || o.shipping_address?.fullName || o.customer_name) && (
                          <div className="text-[10px] text-[#A1A1AA] flex items-center gap-1 mt-0.5">
                            <span className="text-[#A1A1AA]">Account:</span>
                            <span className="font-medium text-[#71717A]">{o.account_name}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-[#71717A]">{dateStr}</td>

                      <td className="py-3.5 px-4 text-[#71717A]">
                        {itemCount} {itemCount === 1 ? "unit" : "units"}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium text-[#18181B]">
                        {formatINR(Number(o.total_amount))}
                      </td>

                      <td className="py-3.5 px-4">
                        {getPaymentBadge(o.payment_status, o.original_payment_method)}
                      </td>

                      <td className="py-3.5 px-4">
                        {getStatusBadge(o.status)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleViewOrder(o)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-[#E7E5E4] rounded hover:bg-[#F5F5F4] text-[#18181B] transition-colors font-medium"
                            title="View Full Dossier"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#71717A]" />
                            <span>Details</span>
                          </button>

                          <button
                            onClick={() => handleOpenStatusDialog(o)}
                            disabled={o.status === "Delivered" || o.status === "Cancelled"}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-[#18181B] hover:bg-[#C25E3E] disabled:bg-[#E7E5E4] disabled:text-[#A1A1AA] text-white rounded transition-colors font-medium"
                            title="Update Fulfillment"
                          >
                            <span>Update</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E7E5E4] bg-[#FAFAF9] text-xs">
            <span className="text-[#71717A]">
              Page <span className="font-medium text-[#18181B]">{page}</span> of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 border border-[#E7E5E4] rounded bg-white disabled:opacity-40 hover:bg-[#F5F5F4]"
              >
                <ChevronLeft className="w-4 h-4 text-[#18181B]" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 border border-[#E7E5E4] rounded bg-white disabled:opacity-40 hover:bg-[#F5F5F4]"
              >
                <ChevronRight className="w-4 h-4 text-[#18181B]" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ORDER DETAILS DOSSIER MODAL */}
      {isDetailModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E7E5E4] w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-[#E7E5E4] px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FAF7F2] border border-[#E7E5E4] flex items-center justify-center text-[#C25E3E]">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-[#18181B]">
                    Consignment {selectedOrder.order_number}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-[#71717A]">
                    <span>Allocated on {new Date(selectedOrder.created_at).toLocaleDateString("en-IN", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</span>
                    <span>•</span>
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 text-[#71717A] hover:text-[#18181B] rounded hover:bg-[#F5F5F4]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Top metadata grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Patron & Shipping */}
                <div className="p-4 bg-[#FAFAF9] border border-[#E7E5E4] rounded-lg space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#18181B]">
                    <User className="w-3.5 h-3.5 text-[#C25E3E]" />
                    <span>Recipient & Patron Details</span>
                  </div>

                  {/* Recipient Details from Checkout */}
                  <div className="text-xs space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71717A] block">
                      Order Recipient
                    </span>
                    <p className="font-medium text-[#18181B] text-sm">
                      {selectedOrder.recipient_name || selectedOrder.shipping_address?.fullName || selectedOrder.customer_name || "Recipient details unavailable"}
                    </p>
                    <p className="text-[#71717A]">
                      {selectedOrder.recipient_email || selectedOrder.shipping_address?.email || selectedOrder.customer_email || "No email on record"}
                    </p>
                    {selectedOrder.shipping_address?.phone && (
                      <p className="text-[#71717A]">Phone: {selectedOrder.shipping_address.phone}</p>
                    )}
                  </div>

                  {/* Account Information if placed by a registered user */}
                  {(selectedOrder.account_name || selectedOrder.user_id) && (
                    <div className="pt-2.5 border-t border-[#E7E5E4] text-xs space-y-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71717A] block">
                        Account Holder
                      </span>
                      <p className="font-medium text-[#18181B]">
                        {selectedOrder.account_name || "Registered Account"}
                      </p>
                      {selectedOrder.account_email && (
                        <p className="text-[#71717A] text-[11px]">{selectedOrder.account_email}</p>
                      )}
                      {selectedOrder.user_id && (
                        <p className="text-[10px] font-mono text-[#A1A1AA]">ID: {selectedOrder.user_id}</p>
                      )}
                    </div>
                  )}

                  {/* Delivery Address */}
                  <div className="pt-2.5 border-t border-[#E7E5E4] text-xs space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-[#18181B]">
                      <MapPin className="w-3 h-3 text-[#C25E3E]" />
                      <span>Delivery Address</span>
                    </div>
                    {selectedOrder.shipping_address ? (
                      <div className="text-[#71717A] leading-relaxed space-y-0.5">
                        <p className="font-medium text-[#18181B]">
                          {selectedOrder.shipping_address.fullName || selectedOrder.recipient_name}
                        </p>
                        <p>{selectedOrder.shipping_address.address}</p>
                        {selectedOrder.shipping_address.apartment && (
                          <p>{selectedOrder.shipping_address.apartment}</p>
                        )}
                        <p>
                          {[selectedOrder.shipping_address.city, selectedOrder.shipping_address.state].filter(Boolean).join(", ")}
                          {selectedOrder.shipping_address.postalCode ? ` - ${selectedOrder.shipping_address.postalCode}` : ""}
                        </p>
                        <p>{selectedOrder.shipping_address.country || "India"}</p>
                      </div>
                    ) : (
                      <p className="text-[#A1A1AA] italic">Recipient details unavailable</p>
                    )}
                  </div>
                </div>

                {/* Settlement & Carrier */}
                <div className="p-4 bg-[#FAFAF9] border border-[#E7E5E4] rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#18181B]">
                    <CreditCard className="w-3.5 h-3.5 text-[#C25E3E]" />
                    <span>Settlement & Logistics</span>
                  </div>
                  <div className="text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#71717A]">Payment Protocol:</span>
                      <span className="font-medium text-[#18181B] capitalize">
                        {selectedOrder.original_payment_method === "cod" && selectedOrder.payment_method !== "cod"
                          ? `${selectedOrder.payment_method} (Converted from COD)`
                          : selectedOrder.payment_method || "Online"}
                      </span>
                    </div>
                    {selectedOrder.original_payment_method && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#71717A]">Original Method:</span>
                        <span className="uppercase font-medium text-[#71717A]">{selectedOrder.original_payment_method}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-[#71717A]">Payment State:</span>
                      {getPaymentBadge(selectedOrder.payment_status, selectedOrder.original_payment_method)}
                    </div>
                    {selectedOrder.payment_reference && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#71717A]">Transaction Ref:</span>
                        <span className="font-mono text-[#18181B]">{selectedOrder.payment_reference}</span>
                      </div>
                    )}
                    {selectedOrder.paid_at && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#71717A]">Verified Paid At:</span>
                        <span className="text-[#18181B]">{new Date(selectedOrder.paid_at).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {selectedOrder.razorpay_payment_id && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#71717A]">Razorpay Payment ID:</span>
                        <span className="font-mono text-emerald-800">{selectedOrder.razorpay_payment_id}</span>
                      </div>
                    )}
                    {selectedOrder.razorpay_order_id && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#71717A]">Razorpay Order ID:</span>
                        <span className="font-mono text-[#18181B]">{selectedOrder.razorpay_order_id}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#E7E5E4] text-xs space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-[#18181B]">
                      <Truck className="w-3 h-3 text-[#C25E3E]" />
                      <span>Courier Logistics</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#71717A]">Carrier:</span>
                      <span className="font-medium text-[#18181B]">{selectedOrder.carrier || "White-Glove Priority"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#71717A]">Waybill Tracking:</span>
                      <span className="font-mono text-[#18181B]">{selectedOrder.tracking_number || "Pending Dispatch"}</span>
                    </div>
                  </div>

                  {/* Certified Consignment Invoice (Delivered orders only) */}
                  {selectedOrder.status === "Delivered" && (
                    <div className="pt-2.5 border-t border-[#E7E5E4] text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-[#18181B]">
                          <FileText className="w-3 h-3 text-[#C25E3E]" />
                          <span>Official Invoice</span>
                        </div>
                        {selectedOrder.invoice_number && (
                          <span className="font-mono text-[10px] text-[#71717A] bg-white px-2 py-0.5 rounded border border-[#E7E5E4]">
                            {selectedOrder.invoice_number}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAdminDownloadInvoice(selectedOrder.id)}
                        disabled={downloadingAdminInvoiceId === selectedOrder.id}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-[#18181B] text-xs font-medium transition-colors cursor-pointer"
                      >
                        {downloadingAdminInvoiceId === selectedOrder.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C25E3E]" />
                            <span>Generating PDF...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 text-[#C25E3E]" />
                            <span>Download Official Invoice (PDF)</span>
                          </>
                        )}
                      </button>
                      {adminInvoiceError && (
                        <p className="text-[11px] text-red-600">{adminInvoiceError}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Snapshot */}
              <div>
                <h4 className="font-serif text-sm text-[#18181B] mb-2 font-medium">
                  Artisanal Creations Snapshot ({selectedOrder.items.length})
                </h4>
                <div className="border border-[#E7E5E4] rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF7F2] text-[#71717A] uppercase text-[9px] tracking-wider border-b border-[#E7E5E4]">
                      <tr>
                        <th className="py-2.5 px-3">Creation Snapshot</th>
                        <th className="py-2.5 px-3">Unit Price</th>
                        <th className="py-2.5 px-3">Qty</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E5E4]">
                      {selectedOrder.items.map((item) => (
                        <tr key={item.id} className="hover:bg-[#FAFAF9]">
                          <td className="py-2.5 px-3 font-medium text-[#18181B]">
                            {item.product_name_snapshot}
                            {item.product_id && (
                              <div className="text-[10px] text-[#A1A1AA] font-mono">
                                ID: {item.product_id.slice(0, 8)}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#71717A]">
                            {formatINR(Number(item.unit_price))}
                          </td>
                          <td className="py-2.5 px-3 font-mono">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-[#18181B]">
                            {formatINR(Number(item.line_total))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Financial summary breakdown */}
                  <div className="bg-[#FAFAF9] p-4 border-t border-[#E7E5E4] space-y-1.5 text-xs">
                    <div className="flex justify-between text-[#71717A]">
                      <span>Subtotal:</span>
                      <span className="font-mono">{formatINR(Number(selectedOrder.subtotal))}</span>
                    </div>
                    <div className="flex justify-between text-[#71717A]">
                      <span>Shipping & White-Glove Handling:</span>
                      <span className="font-mono">{formatINR(Number(selectedOrder.shipping_amount))}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold text-[#18181B] pt-2 border-t border-[#E7E5E4]">
                      <span>Total Consignment Amount:</span>
                      <span className="font-mono text-[#C25E3E]">
                        {formatINR(Number(selectedOrder.total_amount))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Audit Trail */}
              <div>
                <div className="flex items-center gap-1.5 font-serif text-sm text-[#18181B] mb-2 font-medium">
                  <History className="w-4 h-4 text-[#C25E3E]" />
                  <span>Lifecycle Audit Trail</span>
                </div>
                {selectedOrder.history && selectedOrder.history.length > 0 ? (
                  <div className="space-y-2 border border-[#E7E5E4] rounded-lg p-3 bg-[#FAFAF9]">
                    {selectedOrder.history.map((h) => (
                      <div key={h.id} className="text-xs p-2.5 bg-white rounded border border-[#E7E5E4]">
                        <div className="flex items-center justify-between font-medium text-[#18181B]">
                          <span>
                            {h.previous_status ? `${h.previous_status} → ` : ""}{h.new_status}
                          </span>
                          <span className="text-[10px] text-[#A1A1AA] font-normal">
                            {new Date(h.created_at).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#71717A] mt-0.5">
                          Action by: <span className="text-[#18181B]">{h.action_by || "System"}</span>
                          {h.note && <span className="ml-2 italic">— &quot;{h.note}&quot;</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#A1A1AA] italic">No historical transitions recorded yet.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-[#E7E5E4] px-6 py-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 border border-[#E7E5E4] rounded text-xs text-[#71717A] hover:bg-[#F5F5F4]"
              >
                Close Dossier
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleOpenStatusDialog(selectedOrder);
                }}
                disabled={selectedOrder.status === "Delivered" || selectedOrder.status === "Cancelled"}
                className="px-4 py-2 bg-[#18181B] hover:bg-[#C25E3E] disabled:bg-[#E7E5E4] text-white rounded text-xs uppercase tracking-wider font-medium transition-colors"
              >
                Update Fulfillment Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATUS TRANSITION DIALOG */}
      {isUpdateModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E7E5E4] w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7E5E4] pb-3">
              <div>
                <h4 className="font-serif text-lg text-[#18181B]">Update Fulfillment</h4>
                <p className="text-xs text-[#71717A] mt-0.5">
                  Consignment #{selectedOrder.order_number} (Currently: {selectedOrder.status})
                </p>
              </div>
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="p-1 text-[#71717A] hover:text-[#18181B] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {updateError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{updateError}</span>
              </div>
            )}

            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#18181B] mb-1">
                  Target Fulfillment State *
                </label>
                <select
                  required
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] bg-white text-[#18181B]"
                >
                  <option value="">Select permitted transition...</option>
                  {selectedOrder.status === "Placed" && (
                    <>
                      <option value="Confirmed">Confirmed (Payment verified)</option>
                      <option value="Processing">Processing (Workshop allocation)</option>
                      <option value="Cancelled">Cancelled (Restore inventory stock)</option>
                    </>
                  )}
                  {selectedOrder.status === "Confirmed" && (
                    <>
                      <option value="Processing">Processing (Workshop finishing)</option>
                      <option value="Cancelled">Cancelled (Restore inventory stock)</option>
                    </>
                  )}
                  {selectedOrder.status === "Processing" && (
                    <>
                      <option value="Shipped">Shipped (Dispatched to courier)</option>
                      <option value="Cancelled">Cancelled (Restore inventory stock)</option>
                    </>
                  )}
                  {selectedOrder.status === "Shipped" && (
                    <>
                      <option value="Delivered">Delivered (Handed over to patron)</option>
                      <option value="Cancelled">Cancelled (Return to stock)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181B] mb-1">
                  Logistics Carrier
                </label>
                <input
                  type="text"
                  value={carrierInput}
                  onChange={(e) => setCarrierInput(e.target.value)}
                  placeholder="e.g. DTDC, BlueDart, Delhivery"
                  className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181B] mb-1">
                  Waybill / Tracking Number
                </label>
                <input
                  type="text"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="e.g. DTDC-992817264"
                  className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded font-mono focus:outline-none focus:border-[#C25E3E]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181B] mb-1">
                  Audit Log Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  placeholder="Reason for change, batch allocation details..."
                  className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                />
              </div>

              {targetStatus === "Cancelled" && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg space-y-1">
                  <p className="font-semibold">Stock Recovery Trigger:</p>
                  <p>
                    Marking this order as Cancelled will atomically restore purchased item quantities back into the live catalog inventory.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E7E5E4]">
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E5E4] rounded text-xs text-[#71717A] hover:bg-[#F5F5F4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus || !targetStatus}
                  className="px-5 py-2 bg-[#18181B] hover:bg-[#C25E3E] text-white rounded text-xs uppercase tracking-wider font-medium disabled:opacity-50 transition-colors"
                >
                  {isUpdatingStatus ? "Committing..." : "Commit Transition"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Real-time New Order Notification Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {newOrderToasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className="pointer-events-auto bg-[#FAF7F2] border border-[#E7E5E4] shadow-2xl rounded-xl p-4 transition-all duration-300 animate-in slide-in-from-bottom-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#FFDBD0] text-[#C25E3E] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[11px] font-semibold tracking-wider uppercase text-[#C25E3E]">
                    New Order Received
                  </h4>
                  <p className="font-mono text-sm font-bold text-[#18181B]">
                    {toast.orderNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setNewOrderToasts((prev) => prev.filter((t) => t.id !== toast.id))
                }
                className="text-[#A1A1AA] hover:text-[#18181B] p-1 transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-2.5 pt-2 border-t border-[#E7E5E4]/80 flex items-center justify-between text-xs text-[#71717A]">
              <span>Patron: <strong className="text-[#18181B] font-medium">{toast.customerName}</strong></span>
              <span className="font-mono font-semibold text-[#18181B]">{formatINR(toast.totalAmount)}</span>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setNewOrderToasts((prev) => prev.filter((t) => t.id !== toast.id));
                  handleViewOrderById(toast.orderId);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181B] hover:bg-[#C25E3E] text-white text-xs font-medium rounded transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Order</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
