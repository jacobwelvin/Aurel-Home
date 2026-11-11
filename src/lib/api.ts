import {
  Product,
  Category,
  Testimonial,
  Order,
  OrderStatus,
  RazorpayOrderInfo,
  RazorpayVerifyPayload,
  InvoiceData,
} from "@/types";
import { PRODUCTS } from "@/data/products";
import { CATEGORIES } from "@/data/categories";
import { TESTIMONIALS } from "@/data/testimonials";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:8000";

export interface ProductFilterParams {
  category?: string;
  search?: string;
  sort?: "featured" | "price-asc" | "price-desc" | "rating" | "newest";
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  minRating?: number;
}

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  realm_number?: string | null;
  description?: string | null;
  image?: string | null;
  active?: boolean;
  item_count?: number | null;
}

interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  price: number | string;
  compare_at_price?: number | string | null;
  stock: number;
  images: string[];
  details?: string[] | null;
  materials?: string | null;
  dimensions?: string | null;
  care?: string | null;
  badge?: string | null;
  colors?: Array<{ name: string; hex: string; image?: string }> | null;
  featured: boolean;
  bestseller: boolean;
  category_id?: string | null;
  active: boolean;
  rating?: number | string | null;
  review_count?: number | null;
  category?: ApiCategory | null;
}

interface ApiProductListResponse {
  items: ApiProduct[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

import { resolveMediaUrl } from "./utils";

function mapApiCategoryToCategory(cat: ApiCategory): Category {
  return {
    id: String(cat.id),
    slug: cat.slug,
    name: cat.name,
    realmNumber: cat.realm_number || "",
    description: cat.description || "",
    image: cat.image ? resolveMediaUrl(cat.image) : "",
    itemCount: typeof cat.item_count === "number" ? cat.item_count : 0,
  };
}

function mapApiProductToProduct(p: ApiProduct): Product {
  const isNew =
    Boolean(p.badge && (p.badge.toLowerCase().includes("new") || p.badge.toLowerCase().includes("arrival")));

  const resolvedImages =
    Array.isArray(p.images) && p.images.length > 0
      ? p.images.map((img) => resolveMediaUrl(img))
      : ["/images/placeholder.jpg"];

  return {
    id: String(p.id),
    slug: p.slug,
    name: p.name,
    category: p.category?.name || "Atelier Object",
    categorySlug: p.category?.slug || "",
    subtitle: p.subtitle ?? undefined,
    description: p.description || "",
    details: Array.isArray(p.details) ? p.details : [],
    materials: p.materials || "",
    dimensions: p.dimensions ?? undefined,
    care: p.care ?? undefined,
    price: Number(p.price) || 0,
    compareAtPrice: p.compare_at_price != null ? Number(p.compare_at_price) : undefined,
    rating: Number(p.rating ?? 5.0),
    reviewCount: Number(p.review_count ?? 0),
    images: resolvedImages,
    badge: p.badge ?? undefined,
    stock: Number(p.stock ?? 0),
    colors: Array.isArray(p.colors) ? p.colors : [],
    featured: Boolean(p.featured),
    bestseller: Boolean(p.bestseller),
    isNew,
  };
}

// Local in-memory filtering fallback for offline or error resilience
function filterLocalProducts(params: ProductFilterParams = {}): Product[] {
  let filtered = [...PRODUCTS];

  if (params.category && params.category !== "all") {
    filtered = filtered.filter(
      (p) =>
        p.categorySlug.toLowerCase() === params.category?.toLowerCase() ||
        p.category.toLowerCase().includes(params.category?.toLowerCase() || "")
    );
  }

  if (params.search && params.search.trim() !== "") {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.materials && p.materials.toLowerCase().includes(q))
    );
  }

  if (params.minPrice !== undefined) {
    filtered = filtered.filter((p) => p.price >= (params.minPrice ?? 0));
  }

  if (params.maxPrice !== undefined) {
    filtered = filtered.filter((p) => p.price <= (params.maxPrice ?? Infinity));
  }

  if (params.inStockOnly) {
    filtered = filtered.filter((p) => p.stock > 0);
  }

  if (params.minRating !== undefined) {
    filtered = filtered.filter((p) => p.rating >= (params.minRating ?? 0));
  }

  if (params.sort) {
    switch (params.sort) {
      case "price-asc":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        filtered.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case "newest":
        filtered.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
      case "featured":
      default:
        filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        break;
    }
  }

  return filtered;
}

/**
 * Fetch all active categories from FastAPI backend / Supabase PostgreSQL.
 * Falls back to local category definitions if API is unreachable.
 */
export async function fetchCategories(): Promise<Category[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${API_BASE_URL}/api/v1/categories?only_active=true`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: ApiCategory[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map(mapApiCategoryToCategory);
      }
    }
  } catch (err) {
    console.warn("FastAPI backend unreachable, falling back to local categories:", err);
  }

  return CATEGORIES;
}

/**
 * Fetch a single category by slug.
 */
export async function fetchCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${API_BASE_URL}/api/v1/categories/slug/${encodeURIComponent(slug)}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: ApiCategory = await res.json();
      return mapApiCategoryToCategory(data);
    }
  } catch (err) {
    console.warn(`FastAPI backend unreachable for category slug '${slug}':`, err);
  }

  return CATEGORIES.find((c) => c.slug === slug) || null;
}

/**
 * Fetch products with optional filtering, searching, and sorting.
 */
export async function fetchProducts(params: ProductFilterParams = {}): Promise<Product[]> {
  try {
    const query = new URLSearchParams();
    query.set("limit", "100");
    query.set("only_active", "true");

    if (params.category && params.category !== "all") {
      query.set("category_slug", params.category);
    }
    if (params.search && params.search.trim() !== "") {
      query.set("search", params.search.trim());
    }
    if (params.sort) {
      query.set("sort", params.sort);
    }
    if (params.minPrice !== undefined) {
      query.set("min_price", String(params.minPrice));
    }
    if (params.maxPrice !== undefined) {
      query.set("max_price", String(params.maxPrice));
    }
    if (params.inStockOnly) {
      query.set("in_stock_only", "true");
    }
    if (params.minRating !== undefined) {
      query.set("min_rating", String(params.minRating));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${API_BASE_URL}/api/v1/products?${query.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: ApiProductListResponse = await res.json();
      if (Array.isArray(data.items)) {
        return data.items.map(mapApiProductToProduct);
      }
    }
  } catch (err) {
    console.warn("FastAPI backend unreachable, falling back to local products:", err);
  }

  return filterLocalProducts(params);
}

/**
 * Fetch product by its unique slug.
 */
export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${API_BASE_URL}/api/v1/products/slug/${encodeURIComponent(slug)}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (res.status === 404) {
      return null;
    }

    if (res.ok) {
      const data: ApiProduct = await res.json();
      return mapApiProductToProduct(data);
    }
  } catch (err) {
    console.warn(`FastAPI backend unreachable for product slug '${slug}':`, err);
  }

  return PRODUCTS.find((p) => p.slug === slug) || null;
}

/**
 * Fetch product by its unique UUID.
 */
export async function fetchProductById(id: string): Promise<Product | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${API_BASE_URL}/api/v1/products/${encodeURIComponent(id)}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (res.status === 404) {
      return null;
    }

    if (res.ok) {
      const data: ApiProduct = await res.json();
      return mapApiProductToProduct(data);
    }
  } catch (err) {
    console.warn(`FastAPI backend unreachable for product id '${id}':`, err);
  }

  return PRODUCTS.find((p) => p.id === id) || null;
}

export interface StockValidationIssue {
  productId: string;
  productName: string;
  requestedQty: number;
  availableStock: number;
  outOfStock: boolean;
}

/**
 * Validate customer cart items against the current database stock.
 */
export async function validateItemsAvailability(
  items: Array<{ product: Product; quantity: number }>
): Promise<{ valid: boolean; issues: StockValidationIssue[] }> {
  const issues: StockValidationIssue[] = [];

  for (const item of items) {
    let liveProduct: Product | null = null;
    if (item.product.slug) {
      liveProduct = await fetchProductBySlug(item.product.slug);
    } else if (item.product.id && !item.product.id.startsWith("local-")) {
      liveProduct = await fetchProductById(item.product.id);
    }

    if (liveProduct) {
      const stock = typeof liveProduct.stock === "number" ? liveProduct.stock : 0;
      if (stock <= 0) {
        issues.push({
          productId: item.product.id,
          productName: liveProduct.name,
          requestedQty: item.quantity,
          availableStock: 0,
          outOfStock: true,
        });
      } else if (item.quantity > stock) {
        issues.push({
          productId: item.product.id,
          productName: liveProduct.name,
          requestedQty: item.quantity,
          availableStock: stock,
          outOfStock: false,
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Fetch related products within the same category.
 */
export async function fetchRelatedProducts(
  currentSlug: string,
  categorySlug: string,
  limit = 4
): Promise<Product[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      `${API_BASE_URL}/api/v1/products?category_slug=${encodeURIComponent(categorySlug)}&limit=10&only_active=true`,
      {
        signal: controller.signal,
        cache: "no-store",
      }
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data: ApiProductListResponse = await res.json();
      if (Array.isArray(data.items)) {
        return data.items
          .filter((p) => p.slug !== currentSlug)
          .slice(0, limit)
          .map(mapApiProductToProduct);
      }
    }
  } catch (err) {
    console.warn(`FastAPI backend unreachable for related products of '${categorySlug}':`, err);
  }

  return PRODUCTS.filter((p) => p.slug !== currentSlug && p.categorySlug === categorySlug).slice(0, limit);
}

export async function fetchTestimonials(): Promise<Testimonial[]> {
  return TESTIMONIALS;
}

export interface OrderCreatePayload {
  items: Array<{
    product_id?: string;
    slug?: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    selected_color?: string;
    selected_size?: string;
  }>;
  shipping_address: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    apartment?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  payment_method: string;
  payment_reference?: string;
  payment_status?: string;
  delivery_method?: string;
  idempotency_key?: string;
}

export interface ApiOrderItem {
  id?: string;
  product_id?: string | null;
  product_name_snapshot: string;
  product_image?: string | null;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
  created_at?: string;
}

export interface ApiOrderHistory {
  id?: string;
  previous_status?: string | null;
  new_status: string;
  action_by?: string | null;
  note?: string | null;
  created_at: string;
}

export interface ApiOrderDetail {
  id: string;
  order_number: string;
  user_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  recipient_name?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  account_name?: string | null;
  account_email?: string | null;
  status: string;
  payment_status: string;
  subtotal: number | string;
  shipping_amount: number | string;
  total_amount: number | string;
  shipping_address?: {
    fullName?: string;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    apartment?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  original_payment_method?: string | null;
  invoice_number?: string | null;
  paid_at?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  tracking_number?: string | null;
  carrier?: string | null;
  created_at: string;
  updated_at?: string;
  items?: ApiOrderItem[];
  history?: ApiOrderHistory[];
}

export function mapApiOrderToOrder(apiOrder: ApiOrderDetail): Order {
  const dateFormatted = new Date(apiOrder.created_at).toLocaleDateString("en-IN", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Map items to CartItem format
  const mappedItems = (apiOrder.items || []).map((it: ApiOrderItem, idx: number) => ({
    id: String(it.id || `item-${idx}`),
    product: {
      id: String(it.product_id || it.id || `prod-${idx}`),
      name: it.product_name_snapshot,
      slug: it.product_id ? String(it.product_id) : "product",
      price: Number(it.unit_price),
      category: "Atelier",
      categorySlug: "atelier",
      images: [it.product_image ? resolveMediaUrl(it.product_image) : "/images/placeholder.jpg"],
      description: "",
      rating: 5,
      reviewCount: 0,
      stock: 99,
      materials: "",
      featured: false,
      bestseller: false,
      details: [],
    },
    quantity: it.quantity,
  }));

  // Map real timeline from order history
  const statusOrder: OrderStatus[] = ["Placed", "Confirmed", "Processing", "Shipped", "Delivered"];
  const currentStatus = (apiOrder.status || "Placed") as OrderStatus;

  let timeline = [];
  if (Array.isArray(apiOrder.history) && apiOrder.history.length > 0) {
    const sortedHistory = [...apiOrder.history].sort(
      (a: ApiOrderHistory, b: ApiOrderHistory) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    timeline = sortedHistory.map((h: ApiOrderHistory, idx: number) => ({
      status: (h.new_status || currentStatus) as OrderStatus,
      date: new Date(h.created_at).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      description: h.note || `Consignment status updated to ${h.new_status}`,
      completed: true,
      current: idx === sortedHistory.length - 1,
    }));
  } else {
    const currentIdx = statusOrder.indexOf(currentStatus);
    timeline = statusOrder.slice(0, Math.max(1, currentIdx + 1)).map((st, idx, arr) => ({
      status: st,
      date: dateFormatted,
      description: `Consignment lifecycle ${st.toLowerCase()}`,
      completed: true,
      current: idx === arr.length - 1,
    }));
  }

  const shippingAddr = apiOrder.shipping_address || {};

  return {
    id: String(apiOrder.id),
    orderNumber: apiOrder.order_number,
    date: dateFormatted,
    items: mappedItems,
    subtotal: Number(apiOrder.subtotal || 0),
    shipping: Number(apiOrder.shipping_amount || 0),
    discount: 0,
    total: Number(apiOrder.total_amount || 0),
    status: currentStatus,
    paymentStatus: apiOrder.payment_status,
    timeline,
    estimatedDelivery: apiOrder.tracking_number ? "4–7 Business Days" : "Pending Dispatch",
    trackingNumber: apiOrder.tracking_number || "",
    carrier: apiOrder.carrier || "",
    shippingAddress: {
      fullName: shippingAddr.fullName || shippingAddr.name || "Valued Patron",
      email: shippingAddr.email || "",
      phone: shippingAddr.phone || "",
      address: shippingAddr.address || "",
      apartment: shippingAddr.apartment || "",
      city: shippingAddr.city || "",
      state: shippingAddr.state || "",
      postalCode: shippingAddr.postalCode || "",
      country: shippingAddr.country || "India",
    },
    paymentMethod: apiOrder.payment_method || "UPI",
    originalPaymentMethod: apiOrder.original_payment_method || undefined,
    paymentReference: apiOrder.payment_reference || undefined,
    invoiceNumber: apiOrder.invoice_number || undefined,
    paidAt: apiOrder.paid_at || undefined,
    razorpayOrderId: apiOrder.razorpay_order_id || undefined,
    razorpayPaymentId: apiOrder.razorpay_payment_id || undefined,
  };
}

/**
 * Create a new customer order in the PostgreSQL database.
 */
export async function createCustomerOrder(
  payload: OrderCreatePayload,
  token?: string | null,
  idempotencyKey?: string | null
): Promise<Order> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const effectiveIdempotencyKey = idempotencyKey || payload.idempotency_key;
  if (effectiveIdempotencyKey) {
    headers["Idempotency-Key"] = effectiveIdempotencyKey;
    headers["X-Idempotency-Key"] = effectiveIdempotencyKey;
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...payload,
      idempotency_key: effectiveIdempotencyKey,
    }),
  });

  if (!res.ok) {
    let errorDetail = "Failed to place order.";
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {}
    throw new Error(errorDetail);
  }

  const data = await res.json();
  return mapApiOrderToOrder(data);
}

/**
 * Fetch authenticated customer's real orders from database.
 */
export async function fetchCustomerOrders(token?: string | null): Promise<Order[]> {
  if (!token) {
    return [];
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/orders/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401) {
      return [];
    }
    throw new Error("Unable to retrieve order archive from server.");
  }

  const data = await res.json();
  if (Array.isArray(data)) {
    return data.map(mapApiOrderToOrder);
  }
  return [];
}

/**
 * Fetch a single order by order number or ID with optional email verification for guests.
 */
export async function fetchCustomerOrderDetail(
  identifier: string,
  token?: string | null,
  email?: string
): Promise<Order | null> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let url = `${API_BASE_URL}/api/v1/orders/${encodeURIComponent(identifier)}`;
  if (email) {
    url += `?email=${encodeURIComponent(email)}`;
  }

  const res = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (res.status === 404 || res.status === 403) {
    return null;
  }

  if (!res.ok) {
    throw new Error("Failed to load consignment details.");
  }

  const data = await res.json();
  return mapApiOrderToOrder(data);
}

export async function fetchOrders(token?: string | null): Promise<Order[]> {
  return fetchCustomerOrders(token);
}

export async function fetchOrderById(
  id: string,
  token?: string | null,
  email?: string
): Promise<Order | null> {
  return fetchCustomerOrderDetail(id, token, email);
}

/**
 * Initialize a Razorpay test mode order for the given consignment.
 */
export async function createRazorpayOrder(
  orderId: string,
  token?: string | null,
  email?: string
): Promise<RazorpayOrderInfo> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  let url = `${API_BASE_URL}/api/v1/orders/${encodeURIComponent(orderId)}/razorpay/create-order`;
  if (email) {
    url += `?email=${encodeURIComponent(email)}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    let errorDetail = "Failed to initialize Razorpay test checkout.";
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {}
    throw new Error(errorDetail);
  }

  return await res.json();
}

/**
 * Verify Razorpay payment signature server-side.
 */
export async function verifyRazorpayPayment(
  payload: RazorpayVerifyPayload,
  token?: string | null,
  email?: string
): Promise<{ success: boolean; message: string; order: Order }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  let url = `${API_BASE_URL}/api/v1/orders/razorpay/verify`;
  if (email) {
    url += `?email=${encodeURIComponent(email)}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorDetail = "Payment signature verification failed.";
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {}
    throw new Error(errorDetail);
  }

  const data = await res.json();
  return {
    success: data.success,
    message: data.message,
    order: mapApiOrderToOrder(data.order),
  };
}

/**
 * Record customer cancellation/dismissal of Razorpay checkout modal.
 */
export async function cancelRazorpayPayment(
  orderId: string,
  reason?: string,
  token?: string | null,
  email?: string
): Promise<Order> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  let url = `${API_BASE_URL}/api/v1/orders/razorpay/cancel`;
  if (email) {
    url += `?email=${encodeURIComponent(email)}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      order_id: orderId,
      reason: reason || "Customer dismissed Razorpay checkout window",
    }),
  });

  if (!res.ok) {
    let errorDetail = "Failed to record payment cancellation.";
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {}
    throw new Error(errorDetail);
  }

  const data = await res.json();
  return mapApiOrderToOrder(data);
}

/**
 * Dynamically load Razorpay Checkout JS SDK with singleton deduplication.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && (window as any).Razorpay) {
      return resolve(true);
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Fetch structured invoice details for delivered consignment.
 */
export async function fetchOrderInvoice(
  orderId: string,
  token?: string | null,
  email?: string
): Promise<InvoiceData> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  let url = `${API_BASE_URL}/api/v1/orders/${encodeURIComponent(orderId)}/invoice`;
  if (email) {
    url += `?email=${encodeURIComponent(email)}`;
  }

  const res = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "Unable to retrieve invoice.";
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  return await res.json();
}

/**
 * Download post-delivery invoice PDF binary blob.
 */
export async function downloadOrderInvoicePdf(
  orderId: string,
  token?: string | null,
  email?: string
): Promise<{ blob: Blob; filename: string }> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  let url = `${API_BASE_URL}/api/v1/orders/${encodeURIComponent(orderId)}/invoice/pdf`;
  if (email) {
    url += `?email=${encodeURIComponent(email)}`;
  }

  const res = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "Unable to download invoice PDF.";
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  let filename = `Invoice-${orderId}.pdf`;
  const disposition = res.headers.get("content-disposition");
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await res.blob();
  return { blob, filename };
}

