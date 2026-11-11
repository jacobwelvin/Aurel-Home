import { API_BASE_URL } from "./api";
import { supabase } from "./supabase";
import { useAuthStore } from "@/store/authStore";
import { syncAuthCookie } from "./authCookie";

/**
 * Standard configurable administrative request timeout.
 * Cloud databases and aggregations require bounded headroom.
 */
export const DEFAULT_ADMIN_TIMEOUT_MS = 25000;

export class AdminTimeoutError extends Error {
  constructor(message = "Request timed out after 25s") {
    super(message);
    this.name = "AdminTimeoutError";
  }
}

export class AdminAuthError extends Error {
  statusCode: number;
  constructor(message = "Administrator authorization required.", statusCode = 401) {
    super(message);
    this.name = "AdminAuthError";
    this.statusCode = statusCode;
  }
}

export class AdminNetworkError extends Error {
  constructor(message = "Network connection failure. Please check your connectivity.") {
    super(message);
    this.name = "AdminNetworkError";
  }
}

/**
 * Retrieve the current active Supabase access token immediately before protected requests.
 * Proactively refreshes expired or expiring tokens, restores session, and updates the auth store.
 * Throws AdminAuthError if no valid authenticated session exists, preventing unauthenticated calls.
 */
export async function getValidAdminToken(providedToken?: string): Promise<string> {
  // 1. Proactively query the live Supabase client for the current authenticated session
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (session && !error) {
      const now = Math.floor(Date.now() / 1000);
      // If token is expiring within 60 seconds, proactively refresh session
      if (session.expires_at && session.expires_at <= now + 60) {
        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshData?.session?.access_token) {
            const freshToken = refreshData.session.access_token;
            if (typeof window !== "undefined") {
              useAuthStore.setState({ token: freshToken });
              syncAuthCookie(freshToken);
            }
            return freshToken;
          }
        } catch {
          // If refresh call fails, fallback to existing access_token if not expired
        }
      }

      if (session.access_token) {
        if (typeof window !== "undefined") {
          useAuthStore.setState({ token: session.access_token });
          syncAuthCookie(session.access_token);
        }
        return session.access_token;
      }
    }
  } catch {
    // If Supabase getSession threw, try fallback
  }

  // 2. Fallback to candidate token passed by caller (if non-empty and non-mock)
  if (
    providedToken &&
    typeof providedToken === "string" &&
    providedToken.trim().length > 20 &&
    !providedToken.startsWith("mock-")
  ) {
    return providedToken.trim();
  }

  // 3. Fallback to token currently held in authStore
  if (typeof window !== "undefined") {
    const storeToken = useAuthStore.getState().token;
    if (
      storeToken &&
      typeof storeToken === "string" &&
      storeToken.trim().length > 20 &&
      !storeToken.startsWith("mock-")
    ) {
      return storeToken.trim();
    }
  }

  // 4. No valid session exists — do NOT send an unauthenticated request to the backend
  throw new AdminAuthError(
    "Authentication credentials were not provided. Provide a Bearer JWT token.",
    401
  );
}

/**
 * Bounded fetch utility with AbortController timeout to prevent permanent UI hangs.
 * Supports caller-provided AbortSignal without transforming cancellations into timeouts.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_ADMIN_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (init.signal) {
    if (init.signal.aborted) {
      clearTimeout(timer);
      controller.abort(init.signal.reason);
    } else {
      init.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          controller.abort(init.signal?.reason);
        },
        { once: true }
      );
    }
  }

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (err: unknown) {
    if (timedOut) {
      throw new AdminTimeoutError(`Request timed out after ${timeoutMs / 1000}s`);
    }
    if (err instanceof Error && err.name === "AbortError") {
      // Clean cancellation propagated from caller's signal
      throw err;
    }
    if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
      throw new AdminNetworkError("Network connection failure. Please verify backend reachability.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Shared authenticated fetch utility for all administrative API requests.
 * Ensures the Authorization: Bearer <token> header is attached with a verified Supabase session token.
 * Automatically attempts a single session refresh on 401 response.
 */
export async function fetchAdminWithAuth(
  endpoint: string,
  init: RequestInit = {},
  options: {
    token?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {}
): Promise<Response> {
  const token = await getValidAdminToken(options.token);

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  const res = await fetchWithTimeout(
    url,
    {
      ...init,
      headers,
      signal: options.signal,
    },
    options.timeoutMs ?? DEFAULT_ADMIN_TIMEOUT_MS
  );

  // If 401 Unauthorized received, attempt session refresh once and retry request
  if (res.status === 401) {
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshData?.session?.access_token) {
        const refreshedToken = refreshData.session.access_token;
        if (typeof window !== "undefined") {
          useAuthStore.setState({ token: refreshedToken });
          syncAuthCookie(refreshedToken);
        }

        const retryHeaders = new Headers(init.headers || {});
        retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);

        return await fetchWithTimeout(
          url,
          {
            ...init,
            headers: retryHeaders,
            signal: options.signal,
          },
          options.timeoutMs ?? DEFAULT_ADMIN_TIMEOUT_MS
        );
      }
    } catch {
      // Refresh failed
    }

    const errorData = await res.clone().json().catch(() => ({}));
    throw new AdminAuthError(
      errorData.detail || "Authentication credentials were not provided. Provide a Bearer JWT token.",
      401
    );
  }

  if (res.status === 403) {
    const errorData = await res.clone().json().catch(() => ({}));
    throw new AdminAuthError(
      errorData.detail || "Forbidden: Administrator privileges required.",
      403
    );
  }

  return res;
}

export interface DashboardStats {
  total_orders: number;
  total_revenue: number;
  total_active_products: number;
  low_stock_products: number;
  low_stock_threshold: number;
  total_categories: number;
  total_customers: number;
}

export interface RecentOrderSummary {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  subtotal: number;
  shipping_amount: number;
  customer_name: string | null;
  customer_email: string | null;
  recipient_name?: string | null;
  account_name?: string | null;
  created_at: string;
  items_count: number;
}

export interface SalesSummary {
  total_revenue: number;
  orders_count: number;
  average_order_value: number;
  status_breakdown: Record<string, number>;
  has_data: boolean;
}

/**
 * Fetch aggregated administrative dashboard metrics.
 * Strictly requires verified administrator Bearer token.
 */
export async function fetchAdminStats(
  token?: string,
  lowStockThreshold = 5,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<DashboardStats> {
  const res = await fetchAdminWithAuth(
    `/api/v1/admin/dashboard/stats?low_stock_threshold=${lowStockThreshold}`,
    {
      cache: "no-store",
    },
    {
      token,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch dashboard stats (${res.status})`);
  }

  return res.json();
}

/**
 * Fetch recent orders for admin overview.
 * Strictly requires verified administrator Bearer token.
 */
export async function fetchAdminRecentOrders(
  token?: string,
  limit = 10,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<RecentOrderSummary[]> {
  const res = await fetchAdminWithAuth(
    `/api/v1/admin/dashboard/recent-orders?limit=${limit}`,
    {
      cache: "no-store",
    },
    {
      token,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch recent orders (${res.status})`);
  }

  return res.json();
}

/**
 * Fetch sales and status summary for admin overview.
 * Strictly requires verified administrator Bearer token.
 */
export async function fetchAdminSalesSummary(
  token?: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<SalesSummary> {
  const res = await fetchAdminWithAuth(
    `/api/v1/admin/dashboard/sales-summary`,
    {
      cache: "no-store",
    },
    {
      token,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch sales summary (${res.status})`);
  }

  return res.json();
}

export interface AdminProductPayload {
  name: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  price: number;
  compare_at_price?: number | null;
  stock: number;
  images: string[];
  details?: string[];
  materials?: string | null;
  dimensions?: string | null;
  care?: string | null;
  badge?: string | null;
  featured?: boolean;
  bestseller?: boolean;
  category_id?: string | null;
  active?: boolean;
}

export interface AdminCategoryPayload {
  name: string;
  slug: string;
  realm_number?: string | null;
  description?: string | null;
  image?: string | null;
  item_count?: number;
  active?: boolean;
}

export interface AdminProductItem {
  id: string;
  slug: string;
  name: string;
  subtitle?: string | null;
  description?: string | null;
  price: number;
  compare_at_price?: number | null;
  stock: number;
  images: string[];
  details: string[];
  materials?: string | null;
  dimensions?: string | null;
  care?: string | null;
  badge?: string | null;
  featured: boolean;
  bestseller: boolean;
  category_id?: string | null;
  active: boolean;
  rating: number;
  review_count: number;
  category?: {
    id: string;
    slug: string;
    name: string;
    realm_number?: string | null;
    description?: string | null;
    image?: string | null;
    item_count?: number;
    active?: boolean;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface AdminProductListResult {
  items: AdminProductItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AdminCategoryItem {
  id: string;
  slug: string;
  name: string;
  realm_number?: string | null;
  description?: string | null;
  image?: string | null;
  item_count: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch products with admin filters (including inactive products, stock_status, etc.)
 */
export async function fetchAdminProducts(
  token?: string,
  params: {
    page?: number;
    limit?: number;
    search?: string;
    category_id?: string;
    stock_status?: string;
    only_active?: boolean;
    sort?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {}
): Promise<AdminProductListResult> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.search) query.set("search", params.search);
  if (params.category_id) query.set("category_id", params.category_id);
  if (params.stock_status) query.set("stock_status", params.stock_status);
  if (params.only_active !== undefined) query.set("only_active", params.only_active.toString());
  if (params.sort) query.set("sort", params.sort);

  const res = await fetchAdminWithAuth(
    `/api/v1/products?${query.toString()}`,
    {
      cache: "no-store",
    },
    {
      token,
      signal: params.signal,
      timeoutMs: params.timeoutMs ?? 10000,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch products (${res.status})`);
  }

  return res.json();
}

/**
 * Create a new product.
 */
export async function createAdminProduct(
  token?: string,
  payload: AdminProductPayload = {} as AdminProductPayload
): Promise<AdminProductItem> {
  const res = await fetchAdminWithAuth(
    `/api/v1/products`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    {
      token,
      timeoutMs: 15000,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create product (${res.status})`);
  }

  return res.json();
}

/**
 * Update an existing product.
 */
export async function updateAdminProduct(
  token?: string,
  productId = "",
  payload: Partial<AdminProductPayload> = {}
): Promise<AdminProductItem> {
  const res = await fetchAdminWithAuth(
    `/api/v1/products/${productId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    {
      token,
      timeoutMs: 15000,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update product (${res.status})`);
  }

  return res.json();
}

/**
 * Delete or deactivate a product.
 */
export async function deleteAdminProduct(
  token?: string,
  productId = "",
  soft = true
): Promise<{ message: string; id: string; active?: boolean }> {
  const res = await fetchAdminWithAuth(
    `/api/v1/products/${productId}?soft=${soft}`,
    {
      method: "DELETE",
    },
    {
      token,
      timeoutMs: 10000,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete product (${res.status})`);
  }

  return res.json();
}

/**
 * Atomically adjust inventory stock.
 */
export async function adjustProductStock(
  token?: string,
  productId = "",
  stock = 0,
  reason?: string
): Promise<AdminProductItem> {
  const res = await fetchAdminWithAuth(
    `/api/v1/products/${productId}/stock`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ stock, reason }),
    },
    {
      token,
      timeoutMs: 10000,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to adjust stock (${res.status})`);
  }

  return res.json();
}

/**
 * Fetch all categories (optionally including inactive).
 */
export async function fetchAdminCategories(
  token?: string,
  onlyActive = false
): Promise<AdminCategoryItem[]> {
  const res = await fetchAdminWithAuth(
    `/api/v1/categories?only_active=${onlyActive}`,
    {
      cache: "no-store",
    },
    {
      token,
      timeoutMs: 10000,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch categories (${res.status})`);
  }

  return res.json();
}

/**
 * Create a new category realm.
 */
export async function createAdminCategory(
  token?: string,
  payload: AdminCategoryPayload = {} as AdminCategoryPayload
): Promise<AdminCategoryItem> {
  const res = await fetchAdminWithAuth(
    `/api/v1/categories`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    {
      token,
      timeoutMs: 15000,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create category (${res.status})`);
  }

  return res.json();
}

/**
 * Update an existing category realm.
 */
export async function updateAdminCategory(
  token?: string,
  categoryId = "",
  payload: Partial<AdminCategoryPayload> = {}
): Promise<AdminCategoryItem> {
  const res = await fetchAdminWithAuth(
    `/api/v1/categories/${categoryId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    {
      token,
      timeoutMs: 15000,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update category (${res.status})`);
  }

  return res.json();
}

/**
 * Delete or deactivate a category realm.
 */
export async function deleteAdminCategory(
  token?: string,
  categoryId = "",
  soft = true
): Promise<{ message: string; id: string; active?: boolean }> {
  const res = await fetchAdminWithAuth(
    `/api/v1/categories/${categoryId}?soft=${soft}`,
    {
      method: "DELETE",
    },
    {
      token,
      timeoutMs: 10000,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete category (${res.status})`);
  }

  return res.json();
}

/**
 * Upload an image asset to the server.
 */
export async function uploadAdminImage(
  token?: string,
  file?: File
): Promise<{ url: string; filename: string; size: number }> {
  if (!file) throw new Error("No file provided for upload.");
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetchAdminWithAuth(
    `/api/v1/admin/upload-image`,
    {
      method: "POST",
      body: formData,
    },
    {
      token,
      timeoutMs: 30000,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to upload image (${res.status})`);
  }

  return res.json();
}

export interface AdminOrderItemDetail {
  id: string;
  product_id?: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface AdminOrderHistoryEntry {
  id: string;
  previous_status?: string | null;
  new_status: string;
  action_by?: string | null;
  note?: string | null;
  created_at: string;
}

export interface AdminOrderDetailItem {
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
  subtotal: number;
  shipping_amount: number;
  total_amount: number;
  shipping_address?: {
    fullName?: string;
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
  original_payment_method?: string | null;
  payment_reference?: string | null;
  invoice_number?: string | null;
  paid_at?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  tracking_number?: string | null;
  carrier?: string | null;
  created_at: string;
  updated_at: string;
  items: AdminOrderItemDetail[];
  history: AdminOrderHistoryEntry[];
}

export interface AdminOrderListResult {
  items: AdminOrderDetailItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface FetchAdminOrdersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  payment_status?: string;
  start_date?: string;
  end_date?: string;
  sort?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Fetch paginated orders with dynamic search and status filters.
 */
export async function fetchAdminOrders(
  token?: string,
  params: FetchAdminOrdersParams = {}
): Promise<AdminOrderListResult> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.payment_status) query.set("payment_status", params.payment_status);
  if (params.start_date) query.set("start_date", params.start_date);
  if (params.end_date) query.set("end_date", params.end_date);
  if (params.sort) query.set("sort", params.sort);

  const res = await fetchAdminWithAuth(
    `/api/v1/admin/orders?${query.toString()}`,
    {
      cache: "no-store",
    },
    {
      token,
      signal: params.signal,
      timeoutMs: params.timeoutMs ?? DEFAULT_ADMIN_TIMEOUT_MS,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch orders (${res.status})`);
  }

  return res.json();
}

/**
 * Fetch detailed order dossier including items, shipping, payment, and audit history.
 */
export async function fetchAdminOrderDetail(
  token?: string,
  orderId = "",
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<AdminOrderDetailItem> {
  const res = await fetchAdminWithAuth(
    `/api/v1/admin/orders/${orderId}`,
    {
      cache: "no-store",
    },
    {
      token,
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? DEFAULT_ADMIN_TIMEOUT_MS,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch order details (${res.status})`);
  }

  return res.json();
}

/**
 * Update order fulfillment lifecycle status.
 */
export async function updateAdminOrderStatus(
  token?: string,
  orderId = "",
  payload: {
    new_status: string;
    carrier?: string;
    tracking_number?: string;
    note?: string;
  } = { new_status: "" },
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<AdminOrderDetailItem> {
  const res = await fetchAdminWithAuth(
    `/api/v1/admin/orders/${orderId}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    {
      token,
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? DEFAULT_ADMIN_TIMEOUT_MS,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update order status (${res.status})`);
  }

  return res.json();
}
