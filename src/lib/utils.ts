import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:8000";

/**
 * Normalizes an image URL so relative backend upload paths (e.g. /static/uploads/...)
 * resolve against the FastAPI backend server rather than the Next.js port.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") {
    return "/images/placeholder.jpg";
  }

  const trimmed = url.trim().replace(/^["'`]|["'`]$/g, "").trim();
  if (!trimmed || trimmed.startsWith("blob:")) {
    return "/images/placeholder.jpg";
  }

  // Protocol-relative URLs (//example.com/img.jpg) -> prepend https:
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  // Already an absolute URL (http://, https://, or data:)
  if (/^(https?:|data:)/i.test(trimmed)) {
    return trimmed;
  }

  // Backend static upload path
  if (trimmed.startsWith("/static/") || trimmed.startsWith("static/")) {
    const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${API_BASE}${cleanPath}`;
  }

  // Shorthand upload path (/uploads/...)
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("uploads/")) {
    const cleanPath = trimmed.startsWith("/") ? `/static${trimmed}` : `/static/${trimmed}`;
    return `${API_BASE}${cleanPath}`;
  }

  // Frontend public assets (e.g. /images/...)
  return trimmed;
}

/**
 * Maps order fulfillment / lifecycle status to customer-consistent badge color styling.
 * Supports backend values and display labels (e.g. "shipped", "dispatched", "confirmed").
 */
export function getOrderStatusBadgeClasses(status: string): string {
  const s = (status || "").toLowerCase().trim();

  // Delivered -> Green
  if (s === "delivered" || s === "completed") {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }

  // Dispatched / Shipped -> Blue
  if (
    s === "shipped" ||
    s === "dispatched" ||
    s === "dispatched / shipped" ||
    s === "out_for_delivery" ||
    s === "in_transit"
  ) {
    return "bg-blue-50 text-blue-800 border-blue-200";
  }

  // Processing -> Amber / Orange
  if (s === "processing" || s === "workshop processing" || s === "in_processing") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }

  // Payment Confirmed / Confirmed -> Purple
  if (
    s === "confirmed" ||
    s === "payment confirmed" ||
    s === "payment_confirmed" ||
    s === "payment-confirmed"
  ) {
    return "bg-purple-50 text-purple-800 border-purple-200";
  }

  // Cancelled / Restocked -> Red / Pink
  if (
    s === "cancelled" ||
    s === "canceled" ||
    s === "restocked" ||
    s.includes("cancelled") ||
    s.includes("restocked")
  ) {
    return "bg-rose-50 text-rose-800 border-rose-200";
  }

  // Failed / Payment Failed -> Red
  if (s === "failed" || s === "payment failed" || s === "payment_failed") {
    return "bg-red-50 text-red-800 border-red-200";
  }

  // Pending / Awaiting Payment / Placed -> Neutral Grey / Warm Neutral
  if (s === "pending" || s === "awaiting payment" || s === "awaiting_payment") {
    return "bg-[#F5F5F4] text-[#18181B] border-[#E7E5E4]";
  }

  // Default Placed / Awaiting Review -> Neutral Grey
  return "bg-[#F5F5F4] text-[#18181B] border-[#E7E5E4]";
}

