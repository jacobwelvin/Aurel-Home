"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  CheckCircle2,
  Lock,
  ArrowRight,
  Info,
  ChevronLeft,
  AlertTriangle,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { formatINR } from "@/lib/utils";
import { useIsHydrated } from "@/lib/useHydrated";
import {
  createCustomerOrder,
  validateItemsAvailability,
  fetchProductBySlug,
  fetchProductById,
  createRazorpayOrder,
  verifyRazorpayPayment,
  cancelRazorpayPayment,
  type StockValidationIssue,
} from "@/lib/api";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && (window as any).Razorpay) {
      return resolve(true);
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const checkoutSchema = z.object({
  email: z.string().email("Please provide a valid email address for consignment dispatches"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  address: z.string().min(5, "Street address is required"),
  apartment: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  postalCode: z.string().min(6, "Valid 6-digit postal code required"),
  deliveryMethod: z.enum(["standard", "whiteglove"]),
  paymentMethod: z.enum(["upi", "card", "netbanking", "cod"]),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getSubtotal, clearCart, syncProductStock } = useCartStore();
  const { showToast } = useUIStore();
  const { token, profile, user, isAuthenticated, isInitialized } = useAuthStore();
  const isHydrated = useIsHydrated();
  const [orderComplete, setOrderComplete] = useState(false);
  const [placedOrderNumber, setPlacedOrderNumber] = useState("");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [stockIssues, setStockIssues] = useState<StockValidationIssue[]>([]);
  const [isVerifyingStock, setIsVerifyingStock] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  useEffect(() => {
    if (isHydrated && isInitialized && !isAuthenticated && !token) {
      router.replace("/login?redirect=/checkout");
    }
  }, [isHydrated, isInitialized, isAuthenticated, token, router]);

  // Live stock verification on mount
  useEffect(() => {
    let active = true;
    const verifyStock = async () => {
      if (items.length === 0) return;
      setIsVerifyingStock(true);
      try {
        const result = await validateItemsAvailability(items);
        if (active) {
          setStockIssues(result.issues);
          for (const item of items) {
            const live = item.product.slug
              ? await fetchProductBySlug(item.product.slug)
              : await fetchProductById(item.product.id);
            if (live) {
              syncProductStock(live.id, live.stock, live.price);
            }
          }
        }
      } catch (err) {
        console.warn("Stock verification failed on checkout mount:", err);
      } finally {
        if (active) setIsVerifyingStock(false);
      }
    };
    verifyStock();
    return () => {
      active = false;
    };
  }, []);

  const localStockIssues = items.filter(
    (it) => typeof it.product.stock === "number" && (it.product.stock <= 0 || it.quantity > it.product.stock)
  );
  const hasStockIssue = stockIssues.length > 0 || localStockIssues.length > 0;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: profile?.email || user?.email || "",
      firstName: profile?.name ? profile.name.split(" ")[0] : "",
      lastName: profile?.name && profile.name.split(" ").length > 1 ? profile.name.split(" ").slice(1).join(" ") : "",
      deliveryMethod: "standard",
      paymentMethod: "upi",
      state: "Maharashtra",
    },
  });

  const selectedDelivery = watch("deliveryMethod");
  const selectedPayment = watch("paymentMethod");

  if (!isHydrated) return null;

  if (isInitialized && !isAuthenticated && !token) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="font-serif text-2xl text-[#18181B]">Sign in to complete checkout</h2>
        <p className="text-xs text-[#71717A]">Please sign in with your patron credentials to proceed with your acquisition.</p>
        <Link
          href="/login?redirect=/checkout"
          className="inline-block bg-[#18181B] text-white px-6 py-3 rounded text-xs uppercase tracking-widest font-medium"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const subtotal = getSubtotal();
  const deliveryFee = selectedDelivery === "whiteglove" ? 499 : subtotal >= 2999 ? 0 : 450;
  const total = subtotal + deliveryFee;

  const idempotencyKeyRef = useRef<string | null>(null);
  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `order-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  const onSubmit = async (data: CheckoutFormData) => {
    setSubmissionError(null);
    try {
      // Pre-flight check: verify latest live database stock before checkout
      const stockCheck = await validateItemsAvailability(items);
      if (!stockCheck.valid) {
        setStockIssues(stockCheck.issues);
        const issueMsg = stockCheck.issues
          .map((iss) =>
            iss.outOfStock
              ? `"${iss.productName}" is out of stock`
              : `"${iss.productName}" has only ${iss.availableStock} available (requested: ${iss.requestedQty})`
          )
          .join(". ");
        setSubmissionError(`Cannot proceed: ${issueMsg}. Please return to your cart and adjust your order.`);
        showToast("Stock Unavailable", issueMsg, "error");
        return;
      }

      const payload = {
        items: items.map((it) => ({
          product_id: it.product.id && !it.product.id.startsWith("local-") ? it.product.id : undefined,
          slug: it.product.slug,
          product_name: it.product.name,
          quantity: it.quantity,
          unit_price: it.product.price,
          selected_color: it.selectedColor,
          selected_size: it.selectedSize,
        })),
        shipping_address: {
          fullName: `${data.firstName} ${data.lastName}`.trim(),
          email: data.email.trim(),
          phone: data.phone.trim(),
          address: data.address.trim(),
          apartment: data.apartment?.trim() || undefined,
          city: data.city.trim(),
          state: data.state.trim(),
          postalCode: data.postalCode.trim(),
          country: "India",
        },
        payment_method: data.paymentMethod,
        delivery_method: data.deliveryMethod,
        idempotency_key: idempotencyKeyRef.current || undefined,
        payment_status: data.paymentMethod === "upi" ? "Pending" : undefined,
      };

      if (data.paymentMethod === "upi") {
        setIsProcessingPayment(true);
        // Load Razorpay Checkout JS
        const isLoaded = await loadRazorpayScript();
        if (!isLoaded) {
          throw new Error("Unable to initialize Razorpay checkout script. Please check your network connection.");
        }

        // 1. Create consignment order in database with Pending payment status
        const createdOrder = await createCustomerOrder(payload, token, idempotencyKeyRef.current);

        // 2. Initialize Razorpay test order with exact server amount in paise
        const rzpData = await createRazorpayOrder(createdOrder.id, token, data.email);

        // 3. Launch Razorpay Checkout Modal
        const options = {
          key: rzpData.key_id,
          amount: rzpData.amount,
          currency: rzpData.currency || "INR",
          name: "Aurel Home Atelier",
          description: `Consignment ${createdOrder.orderNumber} (Test Mode)`,
          order_id: rzpData.razorpay_order_id,
          prefill: {
            name: `${data.firstName} ${data.lastName}`.trim(),
            email: data.email.trim(),
            contact: data.phone.trim(),
          },
          theme: {
            color: "#C25E3E",
          },
          handler: async function (response: any) {
            setIsVerifyingPayment(true);
            try {
              await verifyRazorpayPayment(
                {
                  order_id: createdOrder.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
                token,
                data.email
              );

              setPlacedOrderNumber(createdOrder.orderNumber);
              setOrderComplete(true);
              clearCart();
              showToast(
                "Payment Verified",
                `Razorpay test transaction ${response.razorpay_payment_id} approved. Order confirmed!`,
                "success"
              );
            } catch (vErr) {
              const errMsg = vErr instanceof Error ? vErr.message : "Payment verification failed.";
              setSubmissionError(errMsg);
              showToast("Verification Error", errMsg, "error");
            } finally {
              setIsVerifyingPayment(false);
              setIsProcessingPayment(false);
            }
          },
          modal: {
            ondismiss: async function () {
              setIsProcessingPayment(false);
              try {
                await cancelRazorpayPayment(
                  createdOrder.id,
                  "Checkout window closed by patron",
                  token,
                  data.email
                );
              } catch {}
              showToast(
                "Payment Incomplete",
                `The checkout window was closed. Order ${createdOrder.orderNumber} remains pending payment.`,
                "info"
              );
              setSubmissionError(
                `Payment was not completed. Order ${createdOrder.orderNumber} is saved as Pending in your archive.`
              );
            },
          },
        };

        const razorpayInstance = new (window as any).Razorpay(options);
        razorpayInstance.on("payment.failed", async function (resp: any) {
          setIsProcessingPayment(false);
          const failMsg = resp.error?.description || "Simulated payment failed";
          try {
            await cancelRazorpayPayment(
              createdOrder.id,
              `Simulated failure: ${failMsg}`,
              token,
              data.email
            );
          } catch {}
          showToast("Payment Failed", failMsg, "error");
          setSubmissionError(`Payment failed: ${failMsg}. Order ${createdOrder.orderNumber} is pending.`);
        });

        razorpayInstance.open();
        return;
      }

      // Non-UPI payment methods
      const createdOrder = await createCustomerOrder(payload, token, idempotencyKeyRef.current);
      setPlacedOrderNumber(createdOrder.orderNumber);
      setOrderComplete(true);
      clearCart();
      showToast(
        "Consignment Allocated",
        `Order ${createdOrder.orderNumber} confirmed with White-Glove priority.`,
        "success"
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to place order. Please try again.";
      setSubmissionError(msg);
      showToast("Allocation Issue", msg, "error");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (orderComplete) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-[#FFDBD0] text-[#742508] flex items-center justify-center mx-auto mb-6 shadow-sm">
          <CheckCircle2 className="w-8 h-8 text-[#C25E3E]" />
        </div>
        <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
          Acquisition Confirmed
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#18181B] font-normal mt-2">
          Thank you for choosing Aurel Home.
        </h1>
        <p className="text-sm text-[#71717A] mt-3 font-sans leading-relaxed max-w-md mx-auto">
          Your order has been allocated to our master artisan workshop. A verified confirmation dispatch has been routed to your email.
        </p>

        <div className="mt-8 p-6 bg-white rounded-xl border border-[#E7E5E4] shadow-xs text-left max-w-md mx-auto space-y-3">
          <div className="flex justify-between text-xs">
            <span className="text-[#71717A]">Consignment Code:</span>
            <span className="font-mono font-bold text-[#18181B]">{placedOrderNumber}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#71717A]">Estimated Delivery:</span>
            <span className="text-[#18181B] font-medium">4–6 Business Days</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#71717A]">Settlement Status:</span>
            <span className="text-emerald-700 font-medium">Payment Protocol Approved</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
          <Link
            href="/orders"
            className="bg-[#18181B] hover:bg-[#27272A] text-white px-6 py-3 rounded text-xs uppercase tracking-widest font-medium transition-colors"
          >
            Track in Order Archive
          </Link>
          <Link
            href="/shop"
            className="bg-white hover:bg-[#F5F5F4] text-[#18181B] border border-[#E7E5E4] px-6 py-3 rounded text-xs uppercase tracking-widest font-medium transition-colors"
          >
            Return to Collection
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h2 className="font-serif text-2xl text-[#18181B]">No items to checkout.</h2>
        <Link
          href="/shop"
          className="inline-block mt-4 text-xs uppercase tracking-wider text-[#C25E3E] font-medium underline"
        >
          Return to Shop Collection
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* Top Header */}
      <div className="border-b border-[#E7E5E4] pb-6 mb-10 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
            Secure Architectural Checkout
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#18181B] font-normal mt-1">
            Complete Acquisition
          </h1>
        </div>

        <Link
          href="/cart"
          className="flex items-center gap-1.5 text-xs text-[#71717A] hover:text-[#18181B] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Return to Cart</span>
        </Link>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {hasStockIssue && (
          <div className="p-4 sm:p-5 rounded-xl bg-red-50 border border-red-200 text-red-900 mb-8 space-y-2">
            <div className="flex items-center gap-2 font-medium text-sm text-red-800">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Inventory Stock Adjustment Required</span>
            </div>
            <p className="text-xs text-red-700">
              One or more items in your cart have exceeded available stock in our live atelier database:
            </p>
            <ul className="list-disc list-inside text-xs text-red-800 space-y-1 font-mono">
              {items
                .filter(
                  (it) =>
                    typeof it.product.stock === "number" &&
                    (it.product.stock <= 0 || it.quantity > it.product.stock)
                )
                .map((it) => (
                  <li key={it.id}>
                    {it.product.name}: {it.product.stock <= 0 ? "Out of Stock" : `Only ${it.product.stock} units available (Cart: ${it.quantity})`}
                  </li>
                ))}
            </ul>
            <div className="pt-2">
              <Link
                href="/cart"
                className="inline-flex items-center gap-1 text-xs font-semibold underline text-red-800 hover:text-red-950"
              >
                Return to Cart to adjust quantities &rarr;
              </Link>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Form: Contact, Shipping, Delivery, Payment */}
          <div className="lg:col-span-7 space-y-10">
            {/* 1. Contact Information */}
            <div className="bg-white p-6 sm:p-7 rounded-xl border border-[#E7E5E4] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E7E5E4] pb-3">
                <h2 className="font-serif text-lg text-[#18181B] font-medium">
                  1. Contact Information
                </h2>
                <span className="text-[11px] text-[#71717A]">Already have an account? <Link href="/login" className="text-[#C25E3E] underline">Login</Link></span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
                    Correspondence Email *
                  </label>
                  <input
                    type="email"
                    {...register("email")}
                    placeholder="patron@domain.com"
                    className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3.5 py-2.5 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
                  />
                  {errors.email && (
                    <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
                    Contact Phone (For Delivery Concierge) *
                  </label>
                  <input
                    type="tel"
                    {...register("phone")}
                    placeholder="+91 98200 00000"
                    className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3.5 py-2.5 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
                  />
                  {errors.phone && (
                    <p className="text-red-600 text-xs mt-1">{errors.phone.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Shipping Address */}
            <div className="bg-white p-6 sm:p-7 rounded-xl border border-[#E7E5E4] shadow-xs space-y-4">
              <h2 className="font-serif text-lg text-[#18181B] font-medium border-b border-[#E7E5E4] pb-3">
                2. Shipping Address
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    {...register("firstName")}
                    placeholder="Aarav"
                    className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3.5 py-2.5 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
                  />
                  {errors.firstName && (
                    <p className="text-red-600 text-xs mt-1">{errors.firstName.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    {...register("lastName")}
                    placeholder="Deshmukh"
                    className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3.5 py-2.5 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
                  />
                  {errors.lastName && (
                    <p className="text-red-600 text-xs mt-1">{errors.lastName.message}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
                    Street Address & Premise *
                  </label>
                  <input
                    type="text"
                    {...register("address")}
                    placeholder="Flat 14B, Sea View Residences, Worli Sea Face"
                    className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3.5 py-2.5 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
                  />
                  {errors.address && (
                    <p className="text-red-600 text-xs mt-1">{errors.address.message}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
                    Apartment, Suite, Unit (Optional)
                  </label>
                  <input
                    type="text"
                    {...register("apartment")}
                    placeholder="Tower 2, Floor 14"
                    className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3.5 py-2.5 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    {...register("city")}
                    placeholder="Mumbai"
                    className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3.5 py-2.5 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
                  />
                  {errors.city && (
                    <p className="text-red-600 text-xs mt-1">{errors.city.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    {...register("state")}
                    placeholder="Maharashtra"
                    className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3.5 py-2.5 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
                  />
                  {errors.state && (
                    <p className="text-red-600 text-xs mt-1">{errors.state.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
                    Postal PIN Code *
                  </label>
                  <input
                    type="text"
                    {...register("postalCode")}
                    placeholder="400018"
                    className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3.5 py-2.5 text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
                  />
                  {errors.postalCode && (
                    <p className="text-red-600 text-xs mt-1">{errors.postalCode.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    disabled
                    value="India"
                    className="w-full bg-[#EEEEED] border border-[#E7E5E4] rounded px-3.5 py-2.5 text-sm text-[#71717A]"
                  />
                </div>
              </div>
            </div>

            {/* 3. Delivery Method */}
            <div className="bg-white p-6 sm:p-7 rounded-xl border border-[#E7E5E4] shadow-xs space-y-4">
              <h2 className="font-serif text-lg text-[#18181B] font-medium border-b border-[#E7E5E4] pb-3">
                3. Delivery Method
              </h2>

              <div className="space-y-3 pt-2">
                <label
                  className={`flex items-start justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedDelivery === "standard"
                      ? "border-[#18181B] bg-[#FAFAF9] ring-1 ring-[#18181B]"
                      : "border-[#E7E5E4] hover:bg-[#FAFAF9]"
                  }`}
                >
                  <div className="flex gap-3">
                    <input
                      type="radio"
                      value="standard"
                      {...register("deliveryMethod")}
                      className="mt-1 text-[#18181B]"
                    />
                    <div>
                      <span className="font-serif text-sm font-medium text-[#18181B] block">
                        Standard Carbon-Neutral Express
                      </span>
                      <p className="text-xs text-[#71717A] mt-0.5">
                        Delivered safely to your door within 4–6 business days in molded fiber packaging.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#18181B]">
                    {subtotal >= 2999 ? "Complimentary" : formatINR(450)}
                  </span>
                </label>

                <label
                  className={`flex items-start justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedDelivery === "whiteglove"
                      ? "border-[#18181B] bg-[#FAFAF9] ring-1 ring-[#18181B]"
                      : "border-[#E7E5E4] hover:bg-[#FAFAF9]"
                  }`}
                >
                  <div className="flex gap-3">
                    <input
                      type="radio"
                      value="whiteglove"
                      {...register("deliveryMethod")}
                      className="mt-1 text-[#18181B]"
                    />
                    <div>
                      <span className="font-serif text-sm font-medium text-[#18181B] block">
                        White-Glove Architectural Assembly
                      </span>
                      <p className="text-xs text-[#71717A] mt-0.5">
                        Inside room placement, complete unboxing, full joinery assembly, and packaging recycling.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#18181B]">{formatINR(499)}</span>
                </label>
              </div>
            </div>

            {/* 4. Payment Method */}
            <div className="bg-white p-6 sm:p-7 rounded-xl border border-[#E7E5E4] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E7E5E4] pb-3">
                <h2 className="font-serif text-lg text-[#18181B] font-medium">
                  4. Payment Protocol
                </h2>
                <div className="flex items-center gap-1.5 text-[11px] text-[#71717A]">
                  <Lock className="w-3.5 h-3.5 text-[#C25E3E]" />
                  <span>Encrypted 256-bit</span>
                </div>
              </div>

              {/* Developer Notice for Razorpay */}
              <div className="p-3.5 bg-[#FAF7F5] rounded-lg border border-[#EBE1DC] flex items-start gap-2.5 text-xs text-[#71717A]">
                <Info className="w-4 h-4 text-[#C25E3E] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#18181B]">Razorpay Test Mode Integration</p>
                  <p className="mt-0.5 leading-relaxed">
                    Selecting <strong>Instant UPI (GPay / PhonePe)</strong> launches the Razorpay Checkout test interface for the exact order total of <strong>{formatINR(total)}</strong>. No real payment will be charged.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  { id: "upi", label: "Instant UPI (GPay / PhonePe)", sub: "Razorpay Test Mode simulation" },
                  { id: "card", label: "Credit / Debit Card", sub: "Visa, Mastercard, RuPay, Amex" },
                  { id: "netbanking", label: "Net Banking", sub: "All major Indian institutions" },
                  { id: "cod", label: "Cash on Delivery", sub: "Eligible on select domestic pin codes" },
                ].map((pm) => (
                  <label
                    key={pm.id}
                    className={`p-3.5 rounded-lg border cursor-pointer flex gap-3 items-start transition-all ${
                      selectedPayment === pm.id
                        ? "border-[#18181B] bg-[#FAFAF9] ring-1 ring-[#18181B]"
                        : "border-[#E7E5E4] hover:bg-[#FAFAF9]"
                    }`}
                  >
                    <input
                      type="radio"
                      value={pm.id}
                      {...register("paymentMethod")}
                      className="mt-0.5 text-[#18181B]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-[#18181B] block">{pm.label}</span>
                      <span className="text-[11px] text-[#71717A]">{pm.sub}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right Summary Sidebar */}
          <div className="lg:col-span-5 bg-white p-6 sm:p-7 rounded-xl border border-[#E7E5E4] shadow-xs space-y-6 sticky top-28">
            <h2 className="font-serif text-lg text-[#18181B] font-medium border-b border-[#E7E5E4] pb-4">
              Consignment Items ({items.reduce((s, i) => s + i.quantity, 0)})
            </h2>

            {/* Items scroll */}
            <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
              {items.map((item) => {
                const isOutOfStock =
                  typeof item.product.stock === "number" && item.product.stock <= 0;
                const isExcess =
                  typeof item.product.stock === "number" &&
                  item.product.stock > 0 &&
                  item.quantity > item.product.stock;

                return (
                  <div key={item.id} className="flex gap-3 text-xs items-center">
                    <div className="relative w-14 h-16 rounded overflow-hidden bg-[#F5F5F4] shrink-0 border border-[#E7E5E4]">
                      <Image
                        src={item.product.images[0]}
                        alt={item.product.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-sm font-medium text-[#18181B] truncate">
                        {item.product.name}
                      </p>
                      <p className="text-[#71717A] text-[11px]">Qty: {item.quantity}</p>
                      {isOutOfStock ? (
                        <span className="text-[10px] font-semibold text-red-600 block mt-0.5">
                          Out of Stock
                        </span>
                      ) : isExcess ? (
                        <span className="text-[10px] font-semibold text-amber-700 block mt-0.5">
                          Only {item.product.stock} available in stock
                        </span>
                      ) : null}
                    </div>
                    <span className="font-serif font-medium text-[#18181B]">
                      {formatINR(item.product.price * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Calculations */}
            <div className="border-t border-[#E7E5E4] pt-4 space-y-2.5 text-xs text-[#71717A]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-serif font-medium text-[#18181B] text-sm">
                  {formatINR(subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Selected Freight Protocol</span>
                <span className="text-[#18181B]">
                  {deliveryFee === 0 ? "Complimentary" : formatINR(deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Duties & State Taxes</span>
                <span className="text-[#18181B]">Included</span>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-baseline pt-2 border-t border-[#E7E5E4]">
              <span className="text-sm font-bold uppercase tracking-wider text-[#18181B]">
                Total Payable
              </span>
              <span className="font-serif text-2xl font-bold text-[#18181B]">
                {formatINR(total)}
              </span>
            </div>

            {/* Error Message */}
            {submissionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 leading-snug">
                {submissionError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isProcessingPayment || isVerifyingPayment || hasStockIssue || isVerifyingStock}
              className="w-full bg-[#18181B] hover:bg-[#27272A] text-white py-4 rounded text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>
                {isVerifyingPayment
                  ? "Verifying Payment..."
                  : isProcessingPayment
                  ? "Launching Razorpay..."
                  : isSubmitting
                  ? "Placing Order..."
                  : isVerifyingStock
                  ? "Verifying Inventory..."
                  : hasStockIssue
                  ? "Adjust Stock in Cart to Proceed"
                  : selectedPayment === "upi"
                  ? `Pay ${formatINR(total)} via UPI (Test Mode)`
                  : "Place Order"}
              </span>
              {!isSubmitting && !isProcessingPayment && !isVerifyingPayment && !hasStockIssue && !isVerifyingStock && (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>

            <div className="text-center text-[10px] text-[#71717A] leading-relaxed">
              By confirming acquisition, you agree to Aurel Home&apos;s 7-Day In-Home Examination protocol and terms of bespoke craftsmanship.
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
