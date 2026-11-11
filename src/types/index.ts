export interface ProductColor {
  name: string;
  hex: string;
  image?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  subtitle?: string;
  description: string;
  details: string[];
  materials: string;
  dimensions?: string;
  care?: string;
  price: number;
  compareAtPrice?: number;
  rating: number;
  reviewCount: number;
  images: string[];
  badge?: string;
  stock: number;
  colors?: ProductColor[];
  sizes?: string[];
  featured?: boolean;
  bestseller?: boolean;
  isNew?: boolean;
  provenance?: string;
  artisan?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  realmNumber: string;
  description: string;
  image: string;
  itemCount: number;
}

export interface CartItem {
  id: string; // product id + color + size combination key
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
}

export interface Testimonial {
  id: string;
  author: string;
  location: string;
  verified: boolean;
  rating: number;
  headline: string;
  comment: string;
  productPurchased: string;
  date: string;
}

export interface ShippingAddress {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  apartment?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export type OrderStatus = "Placed" | "Confirmed" | "Processing" | "Shipped" | "Delivered" | "Cancelled";

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  status: OrderStatus;
  paymentStatus?: string;
  timeline: {
    status: OrderStatus;
    date: string;
    description: string;
    completed: boolean;
    current?: boolean;
  }[];
  estimatedDelivery?: string;
  trackingNumber?: string;
  carrier?: string;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  originalPaymentMethod?: string;
  paymentReference?: string;
  invoiceNumber?: string;
  paidAt?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

export interface InvoiceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface InvoiceData {
  invoice_number: string;
  order_id: string;
  order_number: string;
  invoice_date: string;
  delivery_date: string;
  status: string;
  payment_status: string;
  payment_status_display: string;
  payment_method?: string;
  payment_display: string;
  original_payment_method?: string;
  paid_online: boolean;
  payment_reference?: string;
  paid_at?: string;
  business: {
    name: string;
    legal_name: string;
    gstin: string;
    address_line1: string;
    address_line2: string;
    contact: string;
    website: string;
  };
  recipient: {
    full_name: string;
    email: string;
    phone: string;
    address: string;
    apartment?: string;
    city: string;
    state: string;
    postal_code: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  shipping_amount: number;
  discount: number;
  total_amount: number;
}

export interface RazorpayOrderInfo {
  order_id: string;
  order_number: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
}

export interface RazorpayVerifyPayload {
  order_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
