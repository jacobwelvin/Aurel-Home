"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  ArrowRight,
  Package,
  Search,
  RefreshCw,
  AlertCircle,
  XCircle,
  ChevronDown,
  CreditCard,
  FileText,
  Download,
  Eye,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { Order, OrderStatus, InvoiceData } from "@/types";
import {
  fetchCustomerOrders,
  fetchCustomerOrderDetail,
  createRazorpayOrder,
  verifyRazorpayPayment,
  cancelRazorpayPayment,
  loadRazorpayScript,
  fetchOrderInvoice,
  downloadOrderInvoicePdf,
} from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";

export default function OrdersPage() {
  const { token, isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Direct Consignment / Tracking Lookup State
  const [trackingQuery, setTrackingQuery] = useState("");
  const [trackingEmail, setTrackingEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Expandable Mobile / Tablet Order Details State
  const [expandedMobileOrderIds, setExpandedMobileOrderIds] = useState<Record<string, boolean>>({});

  const toggleOrderExpand = (orderId: string, e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedOrderId(orderId);
    setExpandedMobileOrderIds((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Pay Online State
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);

  // Invoice Modal State
  const [activeInvoice, setActiveInvoice] = useState<InvoiceData | null>(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  // Helper to check if order is eligible for online payment from COD
  const isCodUnpaid = (ord: Order) => {
    const isCod = (ord.originalPaymentMethod || ord.paymentMethod || "").toLowerCase() === "cod";
    const isUnpaid = (ord.paymentStatus || "").toLowerCase() !== "paid" && (ord.paymentStatus || "").toLowerCase() !== "refunded";
    const isNotCancelled = ord.status !== "Cancelled";
    return isCod && isUnpaid && isNotCancelled;
  };

  const handlePayOnline = async (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPayError(null);
    setPaySuccess(null);
    setPayingOrderId(order.id);

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error("Unable to initialize Razorpay checkout script. Please check your network connection.");
      }

      // 1. Initialize Razorpay test order with server-calculated amount
      const rzpData = await createRazorpayOrder(order.id, token, order.shippingAddress.email);

      // 2. Launch Razorpay Checkout Modal
      const options = {
        key: rzpData.key_id,
        amount: rzpData.amount,
        currency: rzpData.currency || "INR",
        name: "Aurel Home Atelier",
        description: `Settle Consignment ${order.orderNumber} (Test Mode)`,
        order_id: rzpData.razorpay_order_id,
        prefill: {
          name: order.shippingAddress.fullName || "",
          email: order.shippingAddress.email || "",
          contact: order.shippingAddress.phone || "",
        },
        theme: {
          color: "#C25E3E",
        },
        handler: async function (response: any) {
          try {
            await verifyRazorpayPayment(
              {
                order_id: order.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              token,
              order.shippingAddress.email
            );

            setPaySuccess(`Payment verified! Consignment ${order.orderNumber} has been successfully settled online.`);
            await loadOrders(true);
          } catch (vErr) {
            setPayError(vErr instanceof Error ? vErr.message : "Payment signature verification failed.");
          } finally {
            setPayingOrderId(null);
          }
        },
        modal: {
          ondismiss: async function () {
            setPayingOrderId(null);
            try {
              await cancelRazorpayPayment(
                order.id,
                "Checkout window dismissed by customer",
                token,
                order.shippingAddress.email
              );
            } catch {}
            setPayError(`Payment was cancelled. Consignment ${order.orderNumber} remains awaiting payment.`);
          },
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.on("payment.failed", async function (resp: any) {
        setPayingOrderId(null);
        const failMsg = resp.error?.description || "Simulated payment failed";
        try {
          await cancelRazorpayPayment(order.id, `Failure: ${failMsg}`, token, order.shippingAddress.email);
        } catch {}
        setPayError(`Payment failed: ${failMsg}. Order ${order.orderNumber} remains pending payment.`);
      });

      razorpayInstance.open();
    } catch (err) {
      setPayingOrderId(null);
      setPayError(err instanceof Error ? err.message : "Failed to initiate online payment.");
    }
  };

  const handleViewInvoice = async (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInvoiceError(null);
    setIsLoadingInvoice(true);
    try {
      const data = await fetchOrderInvoice(order.id, token, order.shippingAddress.email);
      setActiveInvoice(data);
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : "Failed to load invoice.");
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  const handleDownloadInvoice = async (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsDownloadingPdf(order.id);
    try {
      const { blob, filename } = await downloadOrderInvoicePdf(order.id, token, order.shippingAddress.email);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : "Failed to download invoice PDF.");
    } finally {
      setIsDownloadingPdf(null);
    }
  };

  // Load authenticated patron orders
  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    setError(null);
    try {
      if (token) {
        const data = await fetchCustomerOrders(token);
        setOrders(data);
        if (data.length > 0 && !selectedOrderId) {
          setSelectedOrderId(data[0].id);
        }
      } else {
        setOrders([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load consignments.");
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [token, selectedOrderId]);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        if (token) {
          const data = await fetchCustomerOrders(token);
          if (isMounted) {
            setOrders(data);
            if (data.length > 0) {
              setSelectedOrderId(data[0].id);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load consignments.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Real-time synchronization via Supabase channel + periodic polling
  useEffect(() => {
    const channel = supabase
      .channel("customer-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          loadOrders(true);
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      loadOrders(true);
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [loadOrders]);

  // Handle direct consignment tracking search
  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const order = await fetchCustomerOrderDetail(
        trackingQuery.trim(),
        token,
        trackingEmail.trim() || undefined
      );

      if (order) {
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === order.id);
          return exists ? prev : [order, ...prev];
        });
        setSelectedOrderId(order.id);
        setTrackingQuery("");
        setTrackingEmail("");
      } else {
        setSearchError("Consignment not found. Please verify the code and matching email.");
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Unable to retrieve consignment.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || orders[0] || null;

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "Delivered":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "Shipped":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "Processing":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "Confirmed":
        return "bg-indigo-50 text-indigo-800 border-indigo-200";
      case "Cancelled":
        return "bg-red-50 text-red-800 border-red-200";
      case "Placed":
      default:
        return "bg-[#F5F5F4] text-[#18181B] border-[#E7E5E4]";
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* Header */}
      <div className="border-b border-[#E7E5E4] pb-6 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
            Patron Consignments
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#18181B] font-normal mt-1">
            Order Archive &amp; Tracking
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadOrders()}
            disabled={isLoading}
            className="text-xs uppercase tracking-wider text-[#71717A] hover:text-[#18181B] flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E7E5E4] bg-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/shop"
            className="text-xs uppercase tracking-wider text-[#C25E3E] font-medium hover:underline flex items-center gap-1"
          >
            <span>Explore Collection</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Consignment Tracking Lookup Bar */}
      <div className="mb-8 p-4 sm:p-5 bg-white rounded-xl border border-[#E7E5E4] shadow-2xs">
        {/* Real-time Action Banners */}
        {paySuccess && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{paySuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setPaySuccess(null)}
              className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {payError && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{payError}</span>
            </div>
            <button
              type="button"
              onClick={() => setPayError(null)}
              className="text-red-600 hover:text-red-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {invoiceError && (
          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{invoiceError}</span>
            </div>
            <button
              type="button"
              onClick={() => setInvoiceError(null)}
              className="text-amber-600 hover:text-amber-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <form onSubmit={handleTrackOrder} className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              placeholder="Track Consignment (e.g. AUR-8921-IN)"
              value={trackingQuery}
              onChange={(e) => setTrackingQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#FAFAF9] border border-[#E7E5E4] rounded-lg text-xs font-mono placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-[#18181B]"
            />
          </div>
          {!isAuthenticated && (
            <div className="w-full md:w-64">
              <input
                type="email"
                placeholder="Billing Email (Guest Verification)"
                value={trackingEmail}
                onChange={(e) => setTrackingEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAFAF9] border border-[#E7E5E4] rounded-lg text-xs placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-[#18181B]"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={isSearching || !trackingQuery.trim()}
            className="bg-[#18181B] hover:bg-[#27272A] text-white px-5 py-2.5 rounded-lg text-xs uppercase tracking-wider font-medium transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            {isSearching ? "Locating..." : "Track Consignment"}
          </button>
        </form>
        {searchError && (
          <p className="text-xs text-red-600 mt-2.5 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{searchError}</span>
          </p>
        )}
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[#18181B] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#71717A] tracking-wider uppercase">
            Synchronizing consignment telemetry with PostgreSQL...
          </p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl max-w-lg mx-auto space-y-3">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h3 className="font-serif text-lg text-red-900 font-medium">Archive Synchronization Error</h3>
          <p className="text-xs text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => loadOrders()}
            className="mt-2 inline-flex items-center gap-1.5 bg-red-800 text-white px-4 py-2 rounded text-xs uppercase tracking-wider font-medium hover:bg-red-900"
          >
            Retry Connection
          </button>
        </div>
      ) : orders.length === 0 ? (
        /* Empty State */
        <div className="py-20 text-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#F5F5F4] flex items-center justify-center text-[#71717A] mx-auto shadow-2xs">
            <Package className="w-8 h-8 stroke-1" />
          </div>
          <h3 className="font-serif text-2xl text-[#18181B] font-normal">
            No Consignments in Archive
          </h3>
          <p className="text-xs text-[#71717A] leading-relaxed">
            {isAuthenticated
              ? "You have no recorded acquisitions under this patron account. Browse the atelier catalog to place your first bespoke commission."
              : "Sign in with your patron credentials to review historical acquisitions, or use the tracker above with your consignment code."}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-[#18181B] text-white px-6 py-3 rounded text-xs uppercase tracking-widest font-medium hover:bg-[#27272A] transition-colors"
            >
              <span>Explore Collection</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {!isAuthenticated && (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-white text-[#18181B] border border-[#E7E5E4] px-6 py-3 rounded text-xs uppercase tracking-widest font-medium hover:bg-[#F5F5F4] transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      ) : selectedOrder ? (
        /* Grid with Orders List & Selected Order Detail */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Orders List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-widest text-[#71717A] font-bold">
                Archived Dispatches ({orders.length})
              </span>
              <span className="text-[10px] text-[#71717A] font-mono">Live Sync</span>
            </div>

            <div className="space-y-3">
              {orders.map((order) => {
                const isSelected = order.id === selectedOrder.id;
                const isExpanded = !!expandedMobileOrderIds[order.id];

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`p-4 sm:p-5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-white border-[#18181B] shadow-md ring-1 ring-[#18181B]"
                        : "bg-[#FAFAF9] border-[#E7E5E4] hover:bg-white hover:border-[#18181B]/40"
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-[#18181B]">
                        {order.orderNumber}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${getStatusBadge(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                        {/* Mobile & Tablet Expand Toggle Icon */}
                        <button
                          type="button"
                          onClick={(e) => toggleOrderExpand(order.id, e)}
                          className="lg:hidden p-1 text-[#71717A] hover:text-[#18181B] transition-colors focus:outline-none cursor-pointer"
                          aria-label={isExpanded ? "Collapse consignment details" : "Expand consignment details"}
                          aria-expanded={isExpanded}
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isExpanded ? "rotate-180 text-[#C25E3E]" : ""
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#71717A] mb-2">Allocated on {order.date}</p>

                    {/* Settlement State Badge */}
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                      {isCodUnpaid(order) ? (
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200">
                          Cash on Delivery · Payment Pending
                        </span>
                      ) : order.paymentStatus === "Paid" ? (
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">
                          {order.originalPaymentMethod === "cod" || order.paymentMethod === "upi" ? "Paid Online" : "Paid"}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border bg-[#F5F5F4] text-[#71717A] border-[#E7E5E4]">
                          {order.paymentStatus || "Awaiting Settlement"}
                        </span>
                      )}
                    </div>

                    {/* Tappable Product Information Area on Mobile/Tablet */}
                    <div
                      onClick={(e) => {
                        // Tapping the product info area on mobile/tablet toggles details
                        if (typeof window !== "undefined" && window.innerWidth < 1024) {
                          toggleOrderExpand(order.id, e);
                        }
                      }}
                      className="cursor-pointer group/mobile-prod"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleOrderExpand(order.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 overflow-x-auto py-1">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="relative w-12 h-14 rounded overflow-hidden bg-[#F5F5F4] shrink-0 border border-[#E7E5E4] group-hover/mobile-prod:border-[#C25E3E]/50 transition-colors"
                          >
                            <Image
                              src={item.product.images[0] || "/images/placeholder.jpg"}
                              alt={item.product.name}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E7E5E4] text-xs">
                        <span className="text-[#71717A]">
                          {order.items.reduce((s, i) => s + i.quantity, 0)} pieces
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-semibold text-[#18181B]">
                            {formatINR(order.total)}
                          </span>
                          {/* Mobile/Tablet Expand Cue */}
                          <span className="lg:hidden text-[10.5px] text-[#C25E3E] font-medium flex items-center gap-0.5">
                            <span>{isExpanded ? "Collapse" : "Details"}</span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Card Actions (Pay Online & Invoice) */}
                    {(isCodUnpaid(order) || order.status === "Delivered") && (
                      <div className="mt-3 pt-3 border-t border-[#E7E5E4] flex flex-wrap items-center justify-between gap-2">
                        {isCodUnpaid(order) ? (
                          <div className="w-full flex items-center justify-between gap-2">
                            <span className="text-[11px] text-[#71717A] italic">
                              COD Pending
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handlePayOnline(order, e)}
                              disabled={payingOrderId === order.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C25E3E] hover:bg-[#a84c2f] text-white text-xs uppercase tracking-wider font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {payingOrderId === order.id ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Securing...</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Pay Online</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : null}

                        {order.status === "Delivered" && (
                          <div className="w-full flex items-center justify-between gap-2">
                            <span className="text-[11px] font-mono text-[#71717A]">
                              {order.invoiceNumber || "Invoice Ready"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => handleViewInvoice(order, e)}
                                disabled={isLoadingInvoice}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-[#18181B] text-xs font-medium transition-colors cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#C25E3E]" />
                                <span>Invoice</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDownloadInvoice(order, e)}
                                disabled={isDownloadingPdf === order.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-[#18181B] text-xs font-medium transition-colors cursor-pointer"
                              >
                                {isDownloadingPdf === order.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C25E3E]" />
                                ) : (
                                  <Download className="w-3.5 h-3.5 text-[#C25E3E]" />
                                )}
                                <span>PDF</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mobile & Tablet Inline Expandable Consignment Details */}
                    {isExpanded && (
                      <div className="block lg:hidden mt-4 pt-4 border-t border-[#E7E5E4] space-y-5 animate-in fade-in duration-200">
                        {/* 1. Settlement Status & Consignment Header */}
                        <div className="flex items-center justify-between text-xs pb-3 border-b border-[#E7E5E4]">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-[#71717A] font-semibold block">
                              Payment Status
                            </span>
                            <span className="font-medium text-[#18181B] capitalize">
                              {order.paymentStatus || "Paid"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase tracking-wider text-[#71717A] font-semibold block">
                              Consignment Tracking
                            </span>
                            {order.trackingNumber ? (
                              <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-[#E7E5E4] text-[#18181B]">
                                {order.carrier ? `${order.carrier}: ` : ""}
                                {order.trackingNumber}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#71717A] italic">
                                Awaiting Carrier Dispatch
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. Visual Consignment Progress Timeline */}
                        <div>
                          <h4 className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold mb-3">
                            Consignment Progress Timeline
                          </h4>
                          <div className="relative pl-6 border-l-2 border-[#E7E5E4] space-y-4 my-2">
                            {order.timeline.map((step, idx) => (
                              <div key={idx} className="relative">
                                {/* Step marker */}
                                <div
                                  className={`absolute -left-[31px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 bg-white ${
                                    step.status === "Cancelled"
                                      ? "border-red-600 text-red-600"
                                      : step.completed
                                      ? "border-[#18181B] text-[#18181B]"
                                      : "border-[#E7E5E4] text-[#71717A]"
                                  }`}
                                >
                                  {step.status === "Cancelled" ? (
                                    <XCircle className="w-3.5 h-3.5 fill-red-600 text-white" />
                                  ) : step.completed ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 fill-[#18181B] text-white" />
                                  ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#E7E5E4]" />
                                  )}
                                </div>

                                <div>
                                  <div className="flex items-baseline gap-2">
                                    <span
                                      className={`text-xs font-medium ${
                                        step.status === "Cancelled"
                                          ? "text-red-700"
                                          : step.completed
                                          ? "text-[#18181B]"
                                          : "text-[#71717A]"
                                      }`}
                                    >
                                      {step.status}
                                    </span>
                                    <span className="text-[10px] text-[#71717A] font-mono">
                                      {step.date}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[#71717A] mt-0.5 leading-relaxed font-sans">
                                    {step.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 3. Included Artifacts / Product Line Items */}
                        <div className="border-t border-[#E7E5E4] pt-4 space-y-3">
                          <h4 className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold">
                            Product Details ({order.items.length})
                          </h4>
                          <div className="space-y-2.5">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-[#E7E5E4]"
                              >
                                <div className="relative w-12 h-14 rounded overflow-hidden bg-[#F5F5F4] shrink-0 border border-[#E7E5E4]">
                                  <Image
                                    src={item.product.images[0] || "/images/placeholder.jpg"}
                                    alt={item.product.name}
                                    fill
                                    sizes="48px"
                                    className="object-cover"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-serif text-xs font-medium text-[#18181B] truncate">
                                    {item.product.name}
                                  </p>
                                  <p className="text-[11px] text-[#71717A] mt-0.5">
                                    Qty: {item.quantity}{" "}
                                    {item.selectedColor && `• ${item.selectedColor}`}{" "}
                                    {item.selectedSize && `• ${item.selectedSize}`}
                                  </p>
                                  <p className="text-[11px] text-[#71717A]">
                                    Unit Price: {formatINR(item.product.price)}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-serif text-xs font-semibold text-[#18181B]">
                                    {formatINR(item.product.price * item.quantity)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 4. Delivery & Financial Breakdown */}
                        <div className="border-t border-[#E7E5E4] pt-4 space-y-3 text-xs text-[#71717A]">
                          {/* Delivery Details */}
                          <div className="p-3 bg-white rounded-lg border border-[#E7E5E4] space-y-1">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-[#18181B] block mb-1">
                              Delivery Details
                            </span>
                            <p className="text-[#18181B] font-medium">
                              {order.shippingAddress.fullName}
                            </p>
                            <p>{order.shippingAddress.address}</p>
                            {order.shippingAddress.apartment && (
                              <p>{order.shippingAddress.apartment}</p>
                            )}
                            <p>
                              {order.shippingAddress.city}, {order.shippingAddress.state} -{" "}
                              {order.shippingAddress.postalCode}
                            </p>
                            <p className="text-[11px] text-[#71717A] pt-0.5">
                              {order.shippingAddress.phone}
                            </p>
                          </div>

                          {/* Financial Summary */}
                          <div className="p-3 bg-white rounded-lg border border-[#E7E5E4] space-y-1.5">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-[#18181B] block mb-1">
                              Payment & Settlement
                            </span>
                            <div className="flex justify-between">
                              <span>Payment Protocol</span>
                              <span className="font-medium text-[#18181B] capitalize">
                                {order.paymentMethod}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Subtotal</span>
                              <span className="font-medium text-[#18181B]">
                                {formatINR(order.subtotal)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Shipping Charges</span>
                              <span className="font-medium text-[#18181B]">
                                {order.shipping === 0
                                  ? "Complimentary"
                                  : formatINR(order.shipping)}
                              </span>
                            </div>
                            {order.discount ? (
                              <div className="flex justify-between text-emerald-700">
                                <span>Discount Applied</span>
                                <span>-{formatINR(order.discount)}</span>
                              </div>
                            ) : null}
                            <div className="flex justify-between items-center pt-2 border-t border-[#E7E5E4] font-serif font-bold text-sm text-[#18181B]">
                              <span>Total</span>
                              <span>{formatINR(order.total)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Order Details & Timeline (Desktop) */}
          <div className="hidden lg:block lg:col-span-7 bg-white p-6 sm:p-8 rounded-xl border border-[#E7E5E4] shadow-xs space-y-8 sticky top-28">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7E5E4] pb-6">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#71717A] font-semibold">
                  Consignment Details
                </span>
                <h2 className="font-serif text-2xl text-[#18181B] font-normal mt-0.5">
                  {selectedOrder.orderNumber}
                </h2>
                <p className="text-xs text-[#71717A] mt-1">
                  Ordered: {selectedOrder.date} • Settlement: {selectedOrder.paymentStatus || "Paid"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedOrder.status === "Delivered" && (
                  <button
                    type="button"
                    onClick={(e) => handleDownloadInvoice(selectedOrder, e)}
                    disabled={isDownloadingPdf === selectedOrder.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-[#18181B] text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                  >
                    {isDownloadingPdf === selectedOrder.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C25E3E]" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-[#C25E3E]" />
                    )}
                    <span>Download Invoice</span>
                  </button>
                )}
                {selectedOrder.trackingNumber ? (
                  <span className="text-xs font-mono bg-[#F5F5F4] px-3 py-1.5 rounded border border-[#E7E5E4] text-[#18181B]">
                    {selectedOrder.carrier ? `${selectedOrder.carrier}: ` : "Tracking: "}
                    {selectedOrder.trackingNumber}
                  </span>
                ) : (
                  <span className="text-xs text-[#71717A] bg-[#FAFAF9] px-3 py-1.5 rounded border border-[#E7E5E4] italic">
                    Awaiting Carrier Dispatch
                  </span>
                )}
              </div>
            </div>

            {/* Visual Order Tracking Timeline */}
            <div>
              <h3 className="text-xs uppercase tracking-widest text-[#71717A] font-bold mb-6">
                Consignment Progress Timeline
              </h3>

              <div className="relative pl-6 sm:pl-8 border-l-2 border-[#E7E5E4] space-y-6">
                {selectedOrder.timeline.map((step, idx) => (
                  <div key={idx} className="relative">
                    {/* Step marker */}
                    <div
                      className={`absolute -left-[31px] sm:-left-[39px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-white ${
                        step.status === "Cancelled"
                          ? "border-red-600 text-red-600"
                          : step.completed
                          ? "border-[#18181B] text-[#18181B]"
                          : "border-[#E7E5E4] text-[#71717A]"
                      }`}
                    >
                      {step.status === "Cancelled" ? (
                        <XCircle className="w-4 h-4 fill-red-600 text-white" />
                      ) : step.completed ? (
                        <CheckCircle2 className="w-4 h-4 fill-[#18181B] text-white" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-[#E7E5E4]" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-sm font-medium ${
                            step.status === "Cancelled"
                              ? "text-red-700"
                              : step.completed
                              ? "text-[#18181B]"
                              : "text-[#71717A]"
                          }`}
                        >
                          {step.status}
                        </span>
                        <span className="text-[11px] text-[#71717A] font-mono">{step.date}</span>
                      </div>
                      <p className="text-xs text-[#71717A] mt-0.5 leading-relaxed font-sans">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Items breakdown */}
            <div className="border-t border-[#E7E5E4] pt-6 space-y-4">
              <h3 className="text-xs uppercase tracking-widest text-[#71717A] font-bold">
                Included Artifacts
              </h3>

              <div className="space-y-3">
                {selectedOrder.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 p-3 rounded-lg bg-[#FAFAF9] border border-[#E7E5E4]"
                  >
                    <div className="relative w-14 h-16 rounded overflow-hidden bg-white shrink-0 border border-[#E7E5E4]">
                      <Image
                        src={item.product.images[0] || "/images/placeholder.jpg"}
                        alt={item.product.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-sm text-[#18181B] font-medium truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-[#71717A] mt-0.5">
                        Qty: {item.quantity} {item.selectedColor && `• ${item.selectedColor}`}
                      </p>
                    </div>
                    <span className="font-serif text-sm font-medium text-[#18181B]">
                      {formatINR(item.product.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery & Billing Summary */}
            <div className="border-t border-[#E7E5E4] pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-[#71717A]">
              <div>
                <span className="uppercase tracking-widest font-bold text-[#18181B] block mb-1">
                  Destination Address
                </span>
                <p className="text-[#18181B] font-medium">{selectedOrder.shippingAddress.fullName}</p>
                <p>{selectedOrder.shippingAddress.address}</p>
                {selectedOrder.shippingAddress.apartment && (
                  <p>{selectedOrder.shippingAddress.apartment}</p>
                )}
                <p>
                  {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} -{" "}
                  {selectedOrder.shippingAddress.postalCode}
                </p>
                <p>{selectedOrder.shippingAddress.phone}</p>
              </div>

              <div>
                <span className="uppercase tracking-widest font-bold text-[#18181B] block mb-1">
                  Settlement Summary
                </span>
                <p className="capitalize">Protocol: {selectedOrder.paymentMethod}</p>
                <p>Subtotal: {formatINR(selectedOrder.subtotal)}</p>
                <p>
                  Freight:{" "}
                  {selectedOrder.shipping === 0
                    ? "Complimentary"
                    : formatINR(selectedOrder.shipping)}
                </p>
                <p className="font-serif font-bold text-sm text-[#18181B] mt-1 pt-1 border-t border-[#E7E5E4]">
                  Total: {formatINR(selectedOrder.total)}
                </p>

                {/* Settlement Status Details */}
                {selectedOrder.originalPaymentMethod === "cod" && selectedOrder.paymentMethod !== "cod" && (
                  <p className="text-[11px] text-[#C25E3E] font-medium mt-2">
                    Originated as Cash on Delivery • Converted to Online Payment
                  </p>
                )}
                {selectedOrder.paymentReference && (
                  <p className="text-[11px] font-mono text-[#71717A] mt-1">
                    Razorpay ID: {selectedOrder.paymentReference}
                  </p>
                )}
                {selectedOrder.paidAt && (
                  <p className="text-[11px] text-[#71717A]">
                    Settled: {new Date(selectedOrder.paidAt).toLocaleString()}
                  </p>
                )}

                {/* COD Pay Online Settlement Card */}
                {isCodUnpaid(selectedOrder) && (
                  <div className="mt-4 p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 text-left space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900">
                        Settle Consignment
                      </span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono">
                        COD Pending
                      </span>
                    </div>
                    <p className="text-xs text-amber-800">
                      You can pay this consignment online now using UPI, Google Pay, or Card to avoid handling cash at delivery.
                    </p>
                    <button
                      type="button"
                      onClick={(e) => handlePayOnline(selectedOrder, e)}
                      disabled={payingOrderId === selectedOrder.id}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#C25E3E] hover:bg-[#a84c2f] text-white text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                    >
                      {payingOrderId === selectedOrder.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Securing Razorpay Session...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Pay Online (UPI / Card)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Delivered Order Invoice Card */}
                {selectedOrder.status === "Delivered" && (
                  <div className="mt-4 p-3.5 rounded-lg bg-[#FAFAF9] border border-[#E7E5E4] text-left space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#18181B]">
                        Consignment Invoice
                      </span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-mono">
                        Available
                      </span>
                    </div>
                    <p className="text-xs text-[#71717A]">
                      Invoice is certified and archived for this completed delivery.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={(e) => handleViewInvoice(selectedOrder, e)}
                        disabled={isLoadingInvoice}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-[#18181B] text-xs font-medium transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#C25E3E]" />
                        <span>View Invoice</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDownloadInvoice(selectedOrder, e)}
                        disabled={isDownloadingPdf === selectedOrder.id}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-[#18181B] text-xs font-medium transition-colors cursor-pointer"
                      >
                        {isDownloadingPdf === selectedOrder.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C25E3E]" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-[#C25E3E]" />
                        )}
                        <span>Download PDF</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Structured Invoice Modal */}
      {activeInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#E7E5E4] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#E7E5E4] pb-4">
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
                  Aurel Home Atelier
                </span>
                <h2 className="font-serif text-2xl text-[#18181B] font-normal mt-0.5">
                  Consignment Invoice
                </h2>
                <p className="font-mono text-xs text-[#71717A] mt-1">
                  Invoice No: <span className="text-[#18181B] font-medium">{activeInvoice.invoice_number}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveInvoice(null)}
                className="p-1 rounded-full text-[#71717A] hover:text-[#18181B] hover:bg-[#F5F5F4] transition-colors cursor-pointer"
                aria-label="Close invoice"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-[#FAFAF9] p-4 rounded-xl border border-[#E7E5E4]">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#71717A] block font-medium">Invoice Date</span>
                <span className="font-medium text-[#18181B]">{activeInvoice.invoice_date}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#71717A] block font-medium">Consignment</span>
                <span className="font-mono font-medium text-[#18181B]">{activeInvoice.order_number}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#71717A] block font-medium">Fulfillment</span>
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {activeInvoice.status}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#71717A] block font-medium">Settlement</span>
                <span className="font-medium text-[#18181B]">{activeInvoice.payment_status}</span>
              </div>
            </div>

            {/* Atelier & Recipient Parties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div className="p-3 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4] space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-[#71717A] font-bold block mb-1">
                  Bespoke Atelier
                </span>
                <p className="font-semibold text-[#18181B]">{activeInvoice.business.legal_name}</p>
                <p className="text-[#71717A]">{activeInvoice.business.address_line1}, {activeInvoice.business.address_line2}</p>
                <p className="text-[#71717A]">GSTIN: {activeInvoice.business.gstin}</p>
                <p className="text-[#71717A]">{activeInvoice.business.contact}</p>
              </div>
              <div className="p-3 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4] space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-[#71717A] font-bold block mb-1">
                  Billed &amp; Delivered To
                </span>
                <p className="font-semibold text-[#18181B]">{activeInvoice.recipient.full_name}</p>
                <p className="text-[#71717A]">{activeInvoice.recipient.address}</p>
                <p className="text-[#71717A]">
                  {activeInvoice.recipient.city}, {activeInvoice.recipient.state} - {activeInvoice.recipient.postal_code}
                </p>
                <p className="text-[#71717A]">Phone: {activeInvoice.recipient.phone}</p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-[#E7E5E4] rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAFAF9] border-b border-[#E7E5E4] text-[#71717A] uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Artifact</th>
                    <th className="px-3 py-2.5 text-center">Qty</th>
                    <th className="px-3 py-2.5 text-right">Unit Price</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E4]">
                  {activeInvoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#FAFAF9]/50">
                      <td className="px-4 py-3 font-serif text-[#18181B]">{item.product_name}</td>
                      <td className="px-3 py-3 text-center text-[#71717A]">{item.quantity}</td>
                      <td className="px-3 py-3 text-right text-[#71717A]">{formatINR(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right font-medium text-[#18181B]">{formatINR(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Settlement Details */}
            <div className="bg-[#FAFAF9] p-4 rounded-xl border border-[#E7E5E4] text-xs space-y-2">
              <div className="flex justify-between text-[#71717A]">
                <span>Subtotal</span>
                <span>{formatINR(activeInvoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#71717A]">
                <span>Freight / Shipping</span>
                <span>{activeInvoice.shipping_amount === 0 ? "Complimentary" : formatINR(activeInvoice.shipping_amount)}</span>
              </div>
              {activeInvoice.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Privilege Discount</span>
                  <span>-{formatINR(activeInvoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-serif font-bold text-sm text-[#18181B] pt-2 border-t border-[#E7E5E4]">
                <span>Total Settled</span>
                <span>{formatINR(activeInvoice.total_amount)}</span>
              </div>
              <div className="pt-2 text-[11px] text-[#71717A] border-t border-[#E7E5E4]/60 space-y-0.5">
                <p>
                  Settlement Method: <span className="capitalize font-medium text-[#18181B]">{activeInvoice.payment_method || "Online"}</span>
                  {activeInvoice.original_payment_method && activeInvoice.original_payment_method.toLowerCase() === "cod" && (activeInvoice.payment_method || "").toLowerCase() !== "cod" && (
                    <span className="text-[#C25E3E] font-medium ml-1.5">(Converted from Cash on Delivery)</span>
                  )}
                </p>
                {activeInvoice.payment_reference && (
                  <p className="font-mono">Reference: {activeInvoice.payment_reference}</p>
                )}
                {activeInvoice.paid_at && (
                  <p>Payment Verified: {new Date(activeInvoice.paid_at).toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveInvoice(null)}
                className="px-4 py-2 rounded-lg border border-[#E7E5E4] text-xs font-medium text-[#18181B] hover:bg-[#F5F5F4] transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ord = orders.find((o) => o.orderNumber === activeInvoice.order_number) || selectedOrder;
                  if (ord) {
                    await handleDownloadInvoice(ord);
                  }
                }}
                disabled={isDownloadingPdf !== null}
                className="inline-flex items-center gap-2 bg-[#C25E3E] hover:bg-[#a84c2f] text-white px-5 py-2 rounded-lg text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {isDownloadingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
