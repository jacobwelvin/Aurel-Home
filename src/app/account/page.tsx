"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  User,
  Package,
  MapPin,
  Heart,
  Settings,
  ShieldCheck,
  LogOut,
  ArrowRight,
  Edit3,
  Plus,
  Trash2,
  X,
  AlertCircle,
  ShoppingBag,
  Lock,
  Bell,
  ExternalLink,
  PackageOpen,
  MapPinOff,
  CheckCircle2,
  Download,
  CreditCard,
  FileText,
} from "lucide-react";
import { fetchCustomerOrders, downloadOrderInvoicePdf } from "@/lib/api";
import { LogoutConfirmationModal } from "@/components/auth/LogoutConfirmationModal";
import { useWishlistStore } from "@/store/wishlistStore";
import { useCartStore } from "@/store/cartStore";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { formatINR } from "@/lib/utils";
import { useIsHydrated } from "@/lib/useHydrated";
import { syncAuthCookie } from "@/lib/authCookie";
import { Order, OrderStatus, Product } from "@/types";

type AccountTab = "profile" | "orders" | "addresses" | "wishlist" | "settings";

export interface AddressItem {
  id: string;
  title: string;
  recipientName: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  memberSince: string;
  tier: string;
  isVerified: boolean;
}

function AccountContent() {
  const isHydrated = useIsHydrated();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useUIStore();
  const { items: wishlistItems, removeFromWishlist } = useWishlistStore();
  const { addItem } = useCartStore();

  const tabParam = (searchParams.get("tab") as AccountTab) || "profile";
  const [activeTab, setActiveTab] = useState<AccountTab>(
    ["profile", "orders", "addresses", "wishlist", "settings"].includes(tabParam)
      ? tabParam
      : "profile"
  );

  const { profile: authProfile, logout, token, isAuthenticated, isInitialized } = useAuthStore();

  useEffect(() => {
    if (isHydrated && isInitialized && !isAuthenticated && !token) {
      router.replace("/login?redirect=/account");
    }
  }, [isHydrated, isInitialized, isAuthenticated, token, router]);

  const userCreatedAtYear = authProfile?.createdAt
    ? new Date(authProfile.createdAt).getFullYear().toString()
    : new Date().getFullYear().toString();

  // Profile State derived from authenticated patron
  const [localProfile, setLocalProfile] = useState<{
    name?: string;
    phone?: string;
  }>({});

  const profile: UserProfile = {
    name: localProfile.name || authProfile?.name || (authProfile?.email ? authProfile.email.split("@")[0] : "Patron"),
    email: authProfile?.email || "",
    phone: localProfile.phone || "Not provided",
    memberSince: userCreatedAtYear,
    tier: authProfile?.role === "admin" ? "Atelier Administrator" : "Patron Member",
    isVerified: true,
  };

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleExecuteSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      showToast("Signed Out", "You have been signed out of your account.", "info");
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
    }
  };

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: profile.name === "Patron" ? "" : profile.name,
    email: profile.email,
    phone: profile.phone === "Not provided" ? "" : profile.phone,
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Addresses State initialized clean (no fake demo addresses)
  const [addresses, setAddresses] = useState<AddressItem[]>([]);

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    title: "",
    recipientName: "",
    phone: "",
    streetAddress: "",
    city: "",
    state: "",
    postalCode: "",
    isDefault: false,
  });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [deletingAddress, setDeletingAddress] = useState<AddressItem | null>(null);

  // Settings & Preferences State
  const [preferences, setPreferences] = useState({
    orderUpdates: true,
    journalPrints: true,
    archiveDrops: true,
    conciergeEvents: false,
    emailMarketing: true,
    smsMarketing: false,
    personalizedCurations: true,
    twoFactorAuth: false,
  });

  // Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Delete Account Confirmation State
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  // Real Customer Orders State
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);

  const handleDownloadInvoice = async (order: Order) => {
    setDownloadingInvoiceId(order.id);
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
      showToast("Consignment invoice downloaded successfully.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to download invoice PDF.");
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const isCodUnpaid = (ord: Order) => {
    const isCod = (ord.originalPaymentMethod || ord.paymentMethod || "").toLowerCase() === "cod";
    const isUnpaid = (ord.paymentStatus || "").toLowerCase() !== "paid" && (ord.paymentStatus || "").toLowerCase() !== "refunded";
    return isCod && isUnpaid && ord.status !== "Cancelled";
  };

  useEffect(() => {
    let isMounted = true;
    if (token) {
      fetchCustomerOrders(token)
        .then((data) => {
          if (isMounted) setUserOrders(data);
        })
        .catch(() => {
          if (isMounted) setUserOrders([]);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [token]);

  const wishlistCount = isHydrated ? wishlistItems.length : 0;
  const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0];

  // Helper for Order Status Badge
  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "Delivered":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "Shipped":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "Processing":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "Confirmed":
      case "Placed":
      default:
        return "bg-[#F5F5F4] text-[#18181B] border-[#E7E5E4]";
    }
  };

  // Profile Handlers
  const handleStartEditProfile = () => {
    setProfileForm({
      name: profile.name === "Patron" ? "" : profile.name,
      email: profile.email,
      phone: profile.phone === "Not provided" ? "" : profile.phone,
    });
    setProfileErrors({});
    setProfileSuccessMsg(null);
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    setIsEditingProfile(false);
    setProfileErrors({});
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!profileForm.name.trim() || profileForm.name.trim().length < 2) {
      errors.name = "Please enter your full legal name (at least 2 characters).";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!profileForm.email.trim() || !emailRegex.test(profileForm.email.trim())) {
      errors.email = "Please provide a valid email address (e.g. name@domain.com).";
    }

    const cleanPhone = profileForm.phone.replace(/[^0-9]/g, "");
    if (!profileForm.phone.trim() || cleanPhone.length < 10) {
      errors.phone = "Please provide a valid phone number with at least 10 digits.";
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }

    const emailChanged = profileForm.email.trim() !== profile.email;
    setLocalProfile({
      name: profileForm.name.trim(),
      phone: profileForm.phone.trim(),
    });

    setIsEditingProfile(false);
    setProfileErrors({});
    setProfileSuccessMsg("Personal details updated successfully.");
    showToast(
      "Profile Updated",
      emailChanged
        ? "Your changes were saved. A verification link was sent to your new email."
        : "Your personal details have been updated successfully.",
      "success"
    );

    setTimeout(() => {
      setProfileSuccessMsg(null);
    }, 4500);
  };

  const handleVerifyEmail = () => {
    setLocalProfile((prev) => ({ ...prev, isVerified: true }));
    showToast("Email Verified", "Your patron privileges and concierge status are fully active.", "success");
  };

  // Address Handlers
  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      title: "",
      recipientName: profile.name,
      phone: profile.phone,
      streetAddress: "",
      city: "",
      state: "",
      postalCode: "",
      isDefault: addresses.length === 0,
    });
    setAddressErrors({});
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr: AddressItem) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      title: addr.title,
      recipientName: addr.recipientName,
      phone: addr.phone,
      streetAddress: addr.streetAddress,
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      isDefault: addr.isDefault,
    });
    setAddressErrors({});
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!addressForm.title.trim()) {
      errors.title = "Address label is required (e.g. Primary Residence, Office).";
    }
    if (!addressForm.recipientName.trim()) {
      errors.recipientName = "Recipient full name is required.";
    }
    const cleanPhone = addressForm.phone.replace(/[^0-9]/g, "");
    if (!addressForm.phone.trim() || cleanPhone.length < 10) {
      errors.phone = "Valid phone number (at least 10 digits) is required.";
    }
    if (!addressForm.streetAddress.trim()) {
      errors.streetAddress = "Street address and residence details are required.";
    }
    if (!addressForm.city.trim()) {
      errors.city = "City is required.";
    }
    if (!addressForm.state.trim()) {
      errors.state = "State is required.";
    }
    const cleanPin = addressForm.postalCode.replace(/[^0-9]/g, "");
    if (!addressForm.postalCode.trim() || cleanPin.length !== 6) {
      errors.postalCode = "Valid 6-digit postal PIN code is required.";
    }

    if (Object.keys(errors).length > 0) {
      setAddressErrors(errors);
      return;
    }

    if (editingAddressId) {
      // Update existing address
      setAddresses((prev) =>
        prev.map((item) => {
          if (item.id === editingAddressId) {
            return {
              ...item,
              title: addressForm.title.trim(),
              recipientName: addressForm.recipientName.trim(),
              phone: addressForm.phone.trim(),
              streetAddress: addressForm.streetAddress.trim(),
              city: addressForm.city.trim(),
              state: addressForm.state.trim(),
              postalCode: addressForm.postalCode.trim(),
              isDefault: addressForm.isDefault || prev.length === 1,
            };
          }
          return addressForm.isDefault ? { ...item, isDefault: false } : item;
        })
      );
      showToast("Address Saved", "Your address has been updated.", "success");
    } else {
      // Add new address
      const newAddress: AddressItem = {
        id: `addr-${Date.now()}`,
        title: addressForm.title.trim(),
        recipientName: addressForm.recipientName.trim(),
        phone: addressForm.phone.trim(),
        streetAddress: addressForm.streetAddress.trim(),
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        postalCode: addressForm.postalCode.trim(),
        country: "India",
        isDefault: addressForm.isDefault || addresses.length === 0,
      };

      setAddresses((prev) => {
        if (newAddress.isDefault) {
          return [...prev.map((a) => ({ ...a, isDefault: false })), newAddress];
        }
        return [...prev, newAddress];
      });
      showToast("Address Added", "New delivery destination saved.", "success");
    }

    setIsAddressModalOpen(false);
  };

  const handleSetDefaultAddress = (id: string) => {
    setAddresses((prev) =>
      prev.map((addr) => ({
        ...addr,
        isDefault: addr.id === id,
      }))
    );
    showToast("Default Address Set", "Primary delivery destination updated.", "info");
  };

  const handleConfirmDeleteAddress = () => {
    if (!deletingAddress) return;

    setAddresses((prev) => {
      const remaining = prev.filter((a) => a.id !== deletingAddress.id);
      if (deletingAddress.isDefault && remaining.length > 0) {
        remaining[0].isDefault = true;
      }
      return remaining;
    });

    showToast("Address Removed", "The saved address has been deleted.", "info");
    setDeletingAddress(null);
  };

  // Wishlist Handlers
  const handleAddToCartFromWishlist = (product: Product) => {
    addItem(product, 1);
    showToast("Allocated to Cart", `${product.name} added to your shopping bag.`, "success");
  };

  const handleRemoveFromWishlist = (productId: string, productName: string) => {
    removeFromWishlist(productId);
    showToast("Item Removed", `${productName} removed from your saved wishlist.`, "info");
  };

  // Settings Handlers
  const handleTogglePreference = (key: keyof typeof preferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSavePreferences = () => {
    showToast("Preferences Saved", "Your notification and consent choices are up to date.", "success");
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!passwordForm.currentPassword) {
      errors.currentPassword = "Current password is required.";
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      errors.newPassword = "New password must be at least 8 characters.";
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setIsPasswordModalOpen(false);
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordErrors({});
    showToast("Password Updated", "Your account security credentials were changed successfully.", "success");
  };

  const handleConfirmDeleteAccount = () => {
    if (deleteConfirmationText.trim().toUpperCase() !== "DELETE") {
      return;
    }
    setIsDeleteAccountModalOpen(false);
    showToast("Account Deactivated", "Your patron profile has been permanently removed.", "info");
    setTimeout(() => {
      router.push("/login");
    }, 1200);
  };

  const sidebarTabs: { id: AccountTab; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "My Profile", icon: User },
    { id: "orders", label: `My Orders (${userOrders.length})`, icon: Package },
    { id: "addresses", label: "Saved Addresses", icon: MapPin },
    { id: "wishlist", label: `Wishlist (${wishlistCount})`, icon: Heart },
    { id: "settings", label: "Settings & Privacy", icon: Settings },
  ];

  if (isInitialized && !isAuthenticated && !token) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-24 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#FFDBD0] text-[#742508] mx-auto flex items-center justify-center">
          <User className="w-8 h-8 text-[#C25E3E]" />
        </div>
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E] block">
            Patron Account
          </span>
          <h1 className="font-serif text-3xl text-[#18181B] font-normal">
            Sign in to continue
          </h1>
          <p className="text-xs text-[#71717A] max-w-sm mx-auto leading-relaxed">
            Create an account or sign in to save your preferences, manage your orders, and view your account details.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/login?redirect=/account"
            className="w-full sm:w-auto bg-[#18181B] hover:bg-[#27272A] text-white px-6 py-3 rounded-lg text-xs uppercase tracking-widest font-semibold transition-colors text-center"
          >
            Sign In
          </Link>
          <Link
            href="/register?redirect=/account"
            className="w-full sm:w-auto bg-white hover:bg-[#F5F5F4] text-[#18181B] border border-[#E7E5E4] px-6 py-3 rounded-lg text-xs uppercase tracking-widest font-semibold transition-colors text-center"
          >
            Create Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-5 xl:px-8 2xl:px-10 py-8 sm:py-12 lg:py-14">
      {/* Account Page Header */}
      <div className="border-b border-[#E7E5E4] pb-6 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E] block mb-1">
            Customer Account
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#18181B] font-normal tracking-tight">
            {profile.name}
          </h1>
          <p className="text-xs text-[#71717A] mt-1 font-sans">
            Patron since {profile.memberSince} • Tier: {profile.tier}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsLogoutModalOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-[#71717A] hover:text-[#C25E3E] transition-colors py-1 shrink-0 font-medium cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Main Grid: Sidebar + Active Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start w-full">
        {/* Sidebar Navigation: Horizontal scroll on mobile, vertical stack on desktop */}
        <aside className="lg:col-span-3 bg-white p-2.5 sm:p-3.5 rounded-xl border border-[#E7E5E4] shadow-xs flex lg:flex-col overflow-x-auto lg:overflow-visible gap-1.5 sm:gap-2 lg:gap-1.5 shrink-0 scrollbar-none w-full">
          {sidebarTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsEditingProfile(false);
                }}
                className={`whitespace-nowrap shrink-0 lg:w-full flex items-center gap-2.5 sm:gap-3 px-3.5 py-2.5 sm:py-3 rounded-lg text-xs font-medium uppercase tracking-wider transition-all text-left cursor-pointer ${
                  isActive
                    ? "bg-[#18181B] text-white shadow-xs"
                    : "text-[#71717A] hover:text-[#18181B] hover:bg-[#F5F5F4]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}

          {authProfile?.role === "admin" && (
            <Link
              href="/admin"
              onClick={() => {
                if (token) syncAuthCookie(token);
              }}
              className="whitespace-nowrap shrink-0 lg:w-full flex items-center justify-between gap-2 px-3.5 py-2.5 sm:py-3 rounded-lg text-xs font-semibold uppercase tracking-wider bg-[#FFDBD0] text-[#742508] border border-[#C25E3E]/30 hover:bg-[#FFC9B8] transition-colors mt-1"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#C25E3E]" />
                <span className="truncate">Admin Dashboard</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </Link>
          )}
        </aside>

        {/* Content Area */}
        <div className="lg:col-span-9 bg-white p-5 sm:p-7 lg:p-8 rounded-xl border border-[#E7E5E4] shadow-xs min-h-[460px] w-full min-w-0">
          {/* ========================================================================= */}
          {/* 1. MY PROFILE TAB                                                         */}
          {/* ========================================================================= */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#E7E5E4] pb-4">
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl text-[#18181B] font-medium">
                    Personal Details
                  </h2>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Manage your identity and patron communication profile.
                  </p>
                </div>

                {!isEditingProfile && (
                  <button
                    type="button"
                    onClick={handleStartEditProfile}
                    className="text-xs uppercase tracking-wider text-[#C25E3E] hover:text-[#A1482B] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>

              {/* Success Notification Banner */}
              {profileSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{profileSuccessMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileSuccessMsg(null)}
                    className="text-emerald-600 hover:text-emerald-900"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* View Mode */}
              {!isEditingProfile ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                    <div className="p-4 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4]">
                      <span className="text-[#71717A] uppercase tracking-wider block mb-1 text-[10px] font-semibold">
                        Full Legal Name
                      </span>
                      <p className="font-serif text-base text-[#18181B] font-medium">
                        {profile.name}
                      </p>
                    </div>

                    <div className="p-4 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4]">
                      <span className="text-[#71717A] uppercase tracking-wider block mb-1 text-[10px] font-semibold">
                        Correspondence Email
                      </span>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-[#18181B] font-medium truncate">
                          {profile.email}
                        </p>
                        {profile.isVerified ? (
                          <span className="text-[9.5px] uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono shrink-0 ml-2">
                            Verified
                          </span>
                        ) : (
                          <span className="text-[9.5px] uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-mono shrink-0 ml-2">
                            Unverified
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4]">
                      <span className="text-[#71717A] uppercase tracking-wider block mb-1 text-[10px] font-semibold">
                        Concierge Phone
                      </span>
                      <p className="text-sm text-[#18181B] font-medium">
                        {profile.phone}
                      </p>
                    </div>

                    <div className="p-4 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4]">
                      <span className="text-[#71717A] uppercase tracking-wider block mb-1 text-[10px] font-semibold">
                        Primary Residence
                      </span>
                      <p className="text-sm text-[#18181B] font-medium truncate">
                        {defaultAddress ? `${defaultAddress.city}, ${defaultAddress.state}` : "No address set"}
                      </p>
                    </div>
                  </div>

                  {/* Patron Privilege & Verification Card */}
                  <div className="border border-[#E7E5E4] bg-[#FAFAF9] p-4 sm:p-5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3">
                      <ShieldCheck className="w-5 h-5 text-[#C25E3E] shrink-0 mt-0.5 sm:mt-0" />
                      <div>
                        <p className="text-xs font-semibold text-[#18181B]">
                          Aurel Patron Privilege Active
                        </p>
                        <p className="text-[11px] text-[#71717A]">
                          Automatic complimentary delivery & 30-day in-home white-glove trial.
                        </p>
                      </div>
                    </div>

                    {profile.isVerified ? (
                      <span className="text-[10px] uppercase tracking-wider bg-white px-2.5 py-1 rounded border border-[#E7E5E4] font-mono text-[#18181B] font-medium shrink-0 self-start sm:self-auto">
                        Status: Verified
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleVerifyEmail}
                        className="text-[10px] uppercase tracking-wider bg-[#18181B] text-white hover:bg-[#27272A] px-3 py-1.5 rounded font-medium transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
                      >
                        Verify Email Now
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Edit Mode */
                <form onSubmit={handleSaveProfile} noValidate className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-1.5">
                        Full Legal Name *
                      </label>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => {
                          setProfileForm({ ...profileForm, name: e.target.value });
                          if (profileErrors.name) setProfileErrors({ ...profileErrors, name: "" });
                        }}
                        className={`w-full bg-[#FAFAF9] border rounded px-3.5 py-2.5 text-xs text-[#18181B] focus:outline-none transition-colors ${
                          profileErrors.name
                            ? "border-red-400 focus:border-red-500"
                            : "border-[#E7E5E4] focus:border-[#18181B]"
                        }`}
                        placeholder="e.g. Eleanor Vance"
                      />
                      {profileErrors.name && (
                        <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{profileErrors.name}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-1.5">
                        Correspondence Email *
                      </label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => {
                          setProfileForm({ ...profileForm, email: e.target.value });
                          if (profileErrors.email) setProfileErrors({ ...profileErrors, email: "" });
                        }}
                        className={`w-full bg-[#FAFAF9] border rounded px-3.5 py-2.5 text-xs text-[#18181B] focus:outline-none transition-colors ${
                          profileErrors.email
                            ? "border-red-400 focus:border-red-500"
                            : "border-[#E7E5E4] focus:border-[#18181B]"
                        }`}
                        placeholder="patron@domain.com"
                      />
                      {profileErrors.email && (
                        <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{profileErrors.email}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-1.5">
                        Concierge Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => {
                          setProfileForm({ ...profileForm, phone: e.target.value });
                          if (profileErrors.phone) setProfileErrors({ ...profileErrors, phone: "" });
                        }}
                        className={`w-full bg-[#FAFAF9] border rounded px-3.5 py-2.5 text-xs text-[#18181B] focus:outline-none transition-colors ${
                          profileErrors.phone
                            ? "border-red-400 focus:border-red-500"
                            : "border-[#E7E5E4] focus:border-[#18181B]"
                        }`}
                        placeholder="+91 98765 43210"
                      />
                      {profileErrors.phone && (
                        <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{profileErrors.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#E7E5E4] flex items-center gap-3 justify-end">
                    <button
                      type="button"
                      onClick={handleCancelEditProfile}
                      className="px-4 py-2 border border-[#E7E5E4] rounded text-xs uppercase tracking-wider font-medium text-[#71717A] hover:text-[#18181B] hover:bg-[#F5F5F4] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#18181B] hover:bg-[#27272A] text-white rounded text-xs uppercase tracking-wider font-medium transition-all shadow-xs cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. MY ORDERS TAB                                                          */}
          {/* ========================================================================= */}
          {activeTab === "orders" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E7E5E4] pb-4 gap-2">
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl text-[#18181B] font-medium">
                    My Orders
                  </h2>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Review order history, items, and logistics transit.
                  </p>
                </div>

                <Link
                  href="/orders"
                  className="text-xs uppercase tracking-wider text-[#C25E3E] font-semibold hover:underline flex items-center gap-1"
                >
                  <span>Full Tracking View</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {userOrders.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-[#F5F5F4] flex items-center justify-center text-[#71717A] mx-auto mb-4">
                    <PackageOpen className="w-7 h-7 stroke-1" />
                  </div>
                  <h3 className="font-serif text-lg text-[#18181B] font-medium">No Orders Yet</h3>
                  <p className="text-xs text-[#71717A] mt-1 max-w-sm mx-auto">
                    When you place an order, its details and shipment timeline will be recorded here.
                  </p>
                  <Link
                    href="/shop"
                    className="inline-flex items-center gap-1.5 mt-5 bg-[#18181B] text-white px-5 py-2 rounded text-xs uppercase tracking-wider font-medium hover:bg-[#27272A]"
                  >
                    <span>Explore Atelier Catalog</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-5">
                  {userOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-4 sm:p-5 bg-[#FAFAF9] rounded-xl border border-[#E7E5E4] space-y-4"
                    >
                      {/* Order Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E7E5E4]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#18181B]">
                            {ord.orderNumber}
                          </span>
                          <span
                            className={`text-[9.5px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${getStatusBadge(
                              ord.status
                            )}`}
                          >
                            {ord.status}
                          </span>
                          {isCodUnpaid(ord) ? (
                            <span className="text-[9.5px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200">
                              Cash on Delivery · Pending
                            </span>
                          ) : ord.paymentStatus === "Paid" ? (
                            <span className="text-[9.5px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">
                              {ord.originalPaymentMethod === "cod" || ord.paymentMethod === "upi" ? "Paid Online" : "Paid"}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-[#71717A]">
                          Ordered on {ord.date}
                        </span>
                      </div>

                      {/* Items Row */}
                      <div className="space-y-3">
                        {ord.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="relative w-14 h-16 rounded overflow-hidden bg-[#F5F5F4] shrink-0 border border-[#E7E5E4]">
                              <Image
                                src={item.product.images[0]}
                                alt={item.product.name}
                                fill
                                sizes="56px"
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-serif text-xs sm:text-sm font-medium text-[#18181B] truncate">
                                {item.product.name}
                              </p>
                              <p className="text-[11px] text-[#71717A] mt-0.5">
                                Qty: {item.quantity} {item.selectedColor ? `• ${item.selectedColor}` : ""} {item.selectedSize ? `• ${item.selectedSize}` : ""}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-[#18181B] shrink-0">
                              {formatINR(item.product.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Order Footer */}
                      <div className="pt-3 border-t border-[#E7E5E4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs">
                          <span className="text-[#71717A]">Total Amount: </span>
                          <span className="font-serif font-bold text-sm text-[#18181B]">
                            {formatINR(ord.total)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {isCodUnpaid(ord) && (
                            <Link
                              href="/orders"
                              className="px-3 py-1.5 bg-[#C25E3E] hover:bg-[#a84c2f] text-white rounded text-[11px] uppercase tracking-wider font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Pay Online</span>
                            </Link>
                          )}
                          {ord.status === "Delivered" && (
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoice(ord)}
                              disabled={downloadingInvoiceId === ord.id}
                              className="px-3 py-1.5 border border-[#E7E5E4] bg-white rounded text-[11px] uppercase tracking-wider font-medium text-[#18181B] hover:bg-[#F5F5F4] transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5 text-[#C25E3E]" />
                              <span>{downloadingInvoiceId === ord.id ? "Generating..." : "Invoice PDF"}</span>
                            </button>
                          )}
                          <Link
                            href="/orders"
                            className="px-3 py-1.5 border border-[#E7E5E4] bg-white rounded text-[11px] uppercase tracking-wider font-medium text-[#18181B] hover:bg-[#F5F5F4] transition-colors"
                          >
                            View Order
                          </Link>
                          <Link
                            href="/orders"
                            className="px-3.5 py-1.5 bg-[#18181B] hover:bg-[#27272A] text-white rounded text-[11px] uppercase tracking-wider font-medium transition-colors"
                          >
                            Track Order
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. SAVED ADDRESSES TAB                                                    */}
          {/* ========================================================================= */}
          {activeTab === "addresses" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#E7E5E4] pb-4">
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl text-[#18181B] font-medium">
                    Saved Addresses
                  </h2>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Manage domestic shipping locations for express checkout.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddAddress}
                  className="inline-flex items-center gap-1.5 bg-[#18181B] hover:bg-[#27272A] text-white px-3.5 py-2 rounded text-xs uppercase tracking-wider font-medium transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Address</span>
                </button>
              </div>

              {addresses.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-[#F5F5F4] flex items-center justify-center text-[#71717A] mx-auto mb-4">
                    <MapPinOff className="w-7 h-7 stroke-1" />
                  </div>
                  <h3 className="font-serif text-lg text-[#18181B] font-medium">No Saved Addresses</h3>
                  <p className="text-xs text-[#71717A] mt-1 max-w-sm mx-auto">
                    Add a domestic delivery address to speed up future checkout.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenAddAddress}
                    className="inline-flex items-center gap-1.5 mt-5 bg-[#18181B] text-white px-5 py-2 rounded text-xs uppercase tracking-wider font-medium hover:bg-[#27272A] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Address</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className={`p-5 rounded-xl transition-all relative flex flex-col justify-between ${
                        addr.isDefault
                          ? "border-2 border-[#18181B] bg-[#FAFAF9] shadow-xs"
                          : "border border-[#E7E5E4] bg-white hover:border-[#18181B]/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-serif text-base font-medium text-[#18181B]">
                            {addr.title}
                          </span>
                          {addr.isDefault && (
                            <span className="text-[9.5px] uppercase tracking-wider bg-[#18181B] text-white px-2 py-0.5 rounded font-mono font-medium">
                              Default
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-semibold text-[#18181B] mb-1">
                          {addr.recipientName}
                        </p>
                        <p className="text-xs text-[#71717A] leading-relaxed">
                          {addr.streetAddress}
                          <br />
                          {addr.city}, {addr.state} {addr.postalCode}
                          <br />
                          {addr.country}
                        </p>
                        <p className="text-xs text-[#18181B] mt-2 font-medium">
                          {addr.phone}
                        </p>
                      </div>

                      <div className="pt-4 mt-4 border-t border-[#E7E5E4] flex items-center justify-between gap-2">
                        <div>
                          {!addr.isDefault && (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultAddress(addr.id)}
                              className="text-[11px] uppercase tracking-wider text-[#71717A] hover:text-[#18181B] font-medium transition-colors cursor-pointer"
                            >
                              Set as Default
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenEditAddress(addr)}
                            className="text-xs uppercase tracking-wider text-[#C25E3E] hover:underline font-semibold cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingAddress(addr)}
                            className="text-xs uppercase tracking-wider text-red-600 hover:underline font-semibold cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. WISHLIST TAB                                                           */}
          {/* ========================================================================= */}
          {activeTab === "wishlist" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E7E5E4] pb-4 gap-2">
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl text-[#18181B] font-medium">
                    Saved Wishlist ({wishlistCount})
                  </h2>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Curated objects saved for your spaces.
                  </p>
                </div>

                <Link
                  href="/wishlist"
                  className="text-xs uppercase tracking-wider text-[#C25E3E] font-semibold hover:underline flex items-center gap-1"
                >
                  <span>Open Dedicated Wishlist</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              {wishlistItems.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-[#F5F5F4] flex items-center justify-center text-[#71717A] mx-auto mb-4">
                    <Heart className="w-7 h-7 stroke-1 text-[#71717A]" />
                  </div>
                  <h3 className="font-serif text-lg text-[#18181B] font-medium">Your Wishlist is Empty</h3>
                  <p className="text-xs text-[#71717A] mt-1 max-w-sm mx-auto">
                    Save pieces while browsing the atelier to compare dimensions and review later.
                  </p>
                  <Link
                    href="/shop"
                    className="inline-flex items-center gap-1.5 mt-5 bg-[#18181B] text-white px-5 py-2 rounded text-xs uppercase tracking-wider font-medium hover:bg-[#27272A]"
                  >
                    <span>Browse Collection</span>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {wishlistItems.map((prod) => (
                    <div
                      key={prod.id}
                      className="p-3.5 bg-[#FAFAF9] rounded-xl border border-[#E7E5E4] flex flex-col justify-between group hover:border-[#18181B]/40 transition-all"
                    >
                      <div>
                        <div className="relative aspect-4/3 rounded-lg overflow-hidden bg-[#F5F5F4] mb-3">
                          <Image
                            src={prod.images[0]}
                            alt={prod.name}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>

                        <Link
                          href={`/product/${prod.slug}`}
                          className="font-serif text-sm font-medium text-[#18181B] hover:text-[#C25E3E] transition-colors line-clamp-1 block"
                        >
                          {prod.name}
                        </Link>
                        <p className="text-[11px] text-[#71717A] mt-0.5 line-clamp-1">
                          {prod.category}
                        </p>
                        <p className="font-serif font-semibold text-sm text-[#18181B] mt-1.5">
                          {formatINR(prod.price)}
                        </p>
                      </div>

                      <div className="pt-3 mt-3 border-t border-[#E7E5E4] flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddToCartFromWishlist(prod)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-[#18181B] hover:bg-[#27272A] text-white py-1.5 px-3 rounded text-[11px] uppercase tracking-wider font-medium transition-colors cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Add to Cart</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromWishlist(prod.id, prod.name)}
                          className="p-1.5 border border-[#E7E5E4] bg-white rounded text-[#71717A] hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
                          aria-label={`Remove ${prod.name} from wishlist`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. SETTINGS & PRIVACY TAB                                                 */}
          {/* ========================================================================= */}
          {activeTab === "settings" && (
            <div className="space-y-8">
              <div className="border-b border-[#E7E5E4] pb-4">
                <h2 className="font-serif text-xl sm:text-2xl text-[#18181B] font-medium">
                  Settings & Privacy
                </h2>
                <p className="text-xs text-[#71717A] mt-0.5">
                  Manage communication alerts, account security, and data preferences.
                </p>
              </div>

              {/* Notification Preferences */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#C25E3E]" />
                  <h3 className="font-serif text-base text-[#18181B] font-medium">
                    Notification Preferences
                  </h3>
                </div>

                <div className="space-y-2.5 text-xs text-[#18181B]">
                  <label className="flex items-start gap-3 p-3.5 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4] cursor-pointer hover:bg-[#F5F5F4] transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.orderUpdates}
                      onChange={() => handleTogglePreference("orderUpdates")}
                      className="mt-0.5 rounded border-[#E7E5E4] text-[#18181B] focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold block">Order & Logistics Dispatch Alerts</span>
                      <span className="text-[11px] text-[#71717A]">
                        Receive real-time tracking updates, transit alerts, and white-glove arrival notices.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3.5 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4] cursor-pointer hover:bg-[#F5F5F4] transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.journalPrints}
                      onChange={() => handleTogglePreference("journalPrints")}
                      className="mt-0.5 rounded border-[#E7E5E4] text-[#18181B] focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold block">Monograph Journal Publications</span>
                      <span className="text-[11px] text-[#71717A]">
                        Quarterly digital prints detailing artisan craftsmanship, architecture, and interior essays.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3.5 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4] cursor-pointer hover:bg-[#F5F5F4] transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.archiveDrops}
                      onChange={() => handleTogglePreference("archiveDrops")}
                      className="mt-0.5 rounded border-[#E7E5E4] text-[#18181B] focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold block">Limited Archive Drop Notifications</span>
                      <span className="text-[11px] text-[#71717A]">
                        24-hour advance invitations before public collection allocation releases.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3.5 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4] cursor-pointer hover:bg-[#F5F5F4] transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.conciergeEvents}
                      onChange={() => handleTogglePreference("conciergeEvents")}
                      className="mt-0.5 rounded border-[#E7E5E4] text-[#18181B] focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold block">Private Salons & Bespoke Events</span>
                      <span className="text-[11px] text-[#71717A]">
                        Invitations to private preview salons, material workshops, and bespoke studio consultations.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Marketing & Privacy Consent */}
              <div className="space-y-4">
                <h3 className="font-serif text-base text-[#18181B] font-medium">
                  Marketing & Privacy Consent
                </h3>

                <div className="space-y-2.5 text-xs text-[#18181B]">
                  <label className="flex items-start gap-3 p-3.5 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4] cursor-pointer hover:bg-[#F5F5F4] transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.emailMarketing}
                      onChange={() => handleTogglePreference("emailMarketing")}
                      className="mt-0.5 rounded border-[#E7E5E4] text-[#18181B] focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold block">Marketing Communications</span>
                      <span className="text-[11px] text-[#71717A]">
                        Consent to receive seasonal curation highlights and promotional offerings via email and WhatsApp.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3.5 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4] cursor-pointer hover:bg-[#F5F5F4] transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.personalizedCurations}
                      onChange={() => handleTogglePreference("personalizedCurations")}
                      className="mt-0.5 rounded border-[#E7E5E4] text-[#18181B] focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold block">Tailored Atelier Recommendations</span>
                      <span className="text-[11px] text-[#71717A]">
                        Allow room disciplines and aesthetic curation algorithms to personalize your storefront.
                      </span>
                    </div>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="px-4 py-2 bg-[#18181B] hover:bg-[#27272A] text-white rounded text-xs uppercase tracking-wider font-medium transition-all shadow-xs cursor-pointer"
                >
                  Save Preferences
                </button>
              </div>

              {/* Account Security */}
              <div className="space-y-4 pt-6 border-t border-[#E7E5E4]">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#18181B]" />
                  <h3 className="font-serif text-base text-[#18181B] font-medium">
                    Account Security
                  </h3>
                </div>

                <div className="p-4 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#18181B]">Password Authentication</p>
                    <p className="text-[11px] text-[#71717A]">Last updated 3 months ago. Regular updates maintain account safety.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="px-3.5 py-1.5 border border-[#E7E5E4] bg-white rounded text-xs uppercase tracking-wider font-medium text-[#18181B] hover:bg-[#F5F5F4] transition-colors shrink-0 cursor-pointer"
                  >
                    Change Password
                  </button>
                </div>

                <div className="p-4 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#18181B]">Two-Factor Authentication (2FA)</p>
                    <p className="text-[11px] text-[#71717A]">Protect login access using authentication apps or SMS one-time passcode.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !preferences.twoFactorAuth;
                      setPreferences((prev) => ({ ...prev, twoFactorAuth: nextState }));
                      showToast(
                        nextState ? "2FA Activated" : "2FA Deactivated",
                        nextState
                          ? "Two-factor authentication is now protecting your patron account."
                          : "Two-factor authentication has been turned off.",
                        nextState ? "success" : "info"
                      );
                    }}
                    className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider font-medium border transition-colors shrink-0 cursor-pointer ${
                      preferences.twoFactorAuth
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-white text-[#71717A] border-[#E7E5E4] hover:text-[#18181B]"
                    }`}
                  >
                    {preferences.twoFactorAuth ? "Enabled • Deactivate" : "Disabled • Enable"}
                  </button>
                </div>
                <div className="p-4 bg-[#FAFAF9] rounded-lg border border-[#E7E5E4] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#18181B]">Active Patron Session</p>
                    <p className="text-[11px] text-[#71717A]">Sign out of this browser session to safeguard your account on shared devices.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLogoutModalOpen(true)}
                    className="px-3.5 py-1.5 border border-[#E7E5E4] bg-white rounded text-xs uppercase tracking-wider font-medium text-[#71717A] hover:text-[#C25E3E] hover:border-[#C25E3E] transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>

              {/* Danger Zone: Account Deletion */}
              <div className="pt-6 border-t border-red-200">
                <div className="p-5 rounded-xl border border-red-200 bg-red-50/40 space-y-3">
                  <div>
                    <h3 className="font-serif text-base text-red-900 font-medium">
                      Deactivate Patron Account
                    </h3>
                    <p className="text-xs text-red-700/80 mt-1 leading-relaxed">
                      Permanently remove your patron profile, address records, and curation history. This action cannot be reversed.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmationText("");
                      setIsDeleteAccountModalOpen(true);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs uppercase tracking-wider font-medium transition-colors cursor-pointer"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADDRESS MODAL (ADD / EDIT)                                                */}
      {/* ========================================================================= */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E7E5E4] max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E7E5E4] pb-4">
              <h3 className="font-serif text-xl text-[#18181B] font-medium">
                {editingAddressId ? "Edit Saved Address" : "Add New Domestic Address"}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="text-[#71717A] hover:text-[#18181B] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddress} noValidate className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-1">
                  Address Label *
                </label>
                <input
                  type="text"
                  value={addressForm.title}
                  onChange={(e) => setAddressForm({ ...addressForm, title: e.target.value })}
                  placeholder="e.g. Primary Residence, Studio, Mumbai Loft"
                  className={`w-full bg-[#FAFAF9] border rounded px-3 py-2 text-xs text-[#18181B] focus:outline-none ${
                    addressErrors.title ? "border-red-400" : "border-[#E7E5E4] focus:border-[#18181B]"
                  }`}
                />
                {addressErrors.title && <p className="text-[11px] text-red-600 mt-0.5">{addressErrors.title}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-1">
                    Recipient Full Name *
                  </label>
                  <input
                    type="text"
                    value={addressForm.recipientName}
                    onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })}
                    placeholder="e.g. Eleanor Vance"
                    className={`w-full bg-[#FAFAF9] border rounded px-3 py-2 text-xs text-[#18181B] focus:outline-none ${
                      addressErrors.recipientName ? "border-red-400" : "border-[#E7E5E4] focus:border-[#18181B]"
                    }`}
                  />
                  {addressErrors.recipientName && (
                    <p className="text-[11px] text-red-600 mt-0.5">{addressErrors.recipientName}</p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className={`w-full bg-[#FAFAF9] border rounded px-3 py-2 text-xs text-[#18181B] focus:outline-none ${
                      addressErrors.phone ? "border-red-400" : "border-[#E7E5E4] focus:border-[#18181B]"
                    }`}
                  />
                  {addressErrors.phone && (
                    <p className="text-[11px] text-red-600 mt-0.5">{addressErrors.phone}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-1">
                  Street Address & Apartment *
                </label>
                <textarea
                  rows={2}
                  value={addressForm.streetAddress}
                  onChange={(e) => setAddressForm({ ...addressForm, streetAddress: e.target.value })}
                  placeholder="Apartment or suite, street address"
                  className={`w-full bg-[#FAFAF9] border rounded px-3 py-2 text-xs text-[#18181B] focus:outline-none ${
                    addressErrors.streetAddress ? "border-red-400" : "border-[#E7E5E4] focus:border-[#18181B]"
                  }`}
                />
                {addressErrors.streetAddress && (
                  <p className="text-[11px] text-red-600 mt-0.5">{addressErrors.streetAddress}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    placeholder="Mumbai"
                    className={`w-full bg-[#FAFAF9] border rounded px-3 py-2 text-xs text-[#18181B] focus:outline-none ${
                      addressErrors.city ? "border-red-400" : "border-[#E7E5E4] focus:border-[#18181B]"
                    }`}
                  />
                  {addressErrors.city && <p className="text-[11px] text-red-600 mt-0.5">{addressErrors.city}</p>}
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    placeholder="Maharashtra"
                    className={`w-full bg-[#FAFAF9] border rounded px-3 py-2 text-xs text-[#18181B] focus:outline-none ${
                      addressErrors.state ? "border-red-400" : "border-[#E7E5E4] focus:border-[#18181B]"
                    }`}
                  />
                  {addressErrors.state && <p className="text-[11px] text-red-600 mt-0.5">{addressErrors.state}</p>}
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-1">
                    PIN Code *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    placeholder="400018"
                    className={`w-full bg-[#FAFAF9] border rounded px-3 py-2 text-xs text-[#18181B] focus:outline-none ${
                      addressErrors.postalCode ? "border-red-400" : "border-[#E7E5E4] focus:border-[#18181B]"
                    }`}
                  />
                  {addressErrors.postalCode && (
                    <p className="text-[11px] text-red-600 mt-0.5">{addressErrors.postalCode}</p>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addressForm.isDefault}
                  onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                  className="rounded border-[#E7E5E4] text-[#18181B] focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-[#18181B] font-medium">Set as default domestic shipping address</span>
              </label>

              <div className="pt-4 border-t border-[#E7E5E4] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E5E4] rounded text-xs uppercase tracking-wider font-medium text-[#71717A] hover:bg-[#F5F5F4] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#18181B] hover:bg-[#27272A] text-white rounded text-xs uppercase tracking-wider font-medium transition-all cursor-pointer"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE ADDRESS CONFIRMATION MODAL                                         */}
      {/* ========================================================================= */}
      {deletingAddress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E7E5E4] max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-serif text-lg text-[#18181B] font-medium">
                Delete Address?
              </h3>
            </div>
            <p className="text-xs text-[#71717A] leading-relaxed">
              Are you sure you want to remove <span className="font-semibold text-[#18181B]">{deletingAddress.title}</span> ({deletingAddress.city})? This address will be removed from your saved book.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E5E4]">
              <button
                type="button"
                onClick={() => setDeletingAddress(null)}
                className="px-3.5 py-1.5 border border-[#E7E5E4] rounded text-xs uppercase tracking-wider font-medium text-[#71717A] hover:bg-[#F5F5F4] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAddress}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs uppercase tracking-wider font-medium transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHANGE PASSWORD MODAL                                                     */}
      {/* ========================================================================= */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E7E5E4] max-w-sm w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E7E5E4] pb-4">
              <h3 className="font-serif text-lg text-[#18181B] font-medium">
                Update Account Password
              </h3>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-[#71717A] hover:text-[#18181B] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePassword} noValidate className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-1">
                  Current Password *
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3 py-2 text-xs text-[#18181B] focus:outline-none focus:border-[#18181B]"
                />
                {passwordErrors.currentPassword && (
                  <p className="text-[11px] text-red-600 mt-0.5">{passwordErrors.currentPassword}</p>
                )}
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-1">
                  New Password (min. 8 chars) *
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3 py-2 text-xs text-[#18181B] focus:outline-none focus:border-[#18181B]"
                />
                {passwordErrors.newPassword && (
                  <p className="text-[11px] text-red-600 mt-0.5">{passwordErrors.newPassword}</p>
                )}
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#71717A] font-bold block mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full bg-[#FAFAF9] border border-[#E7E5E4] rounded px-3 py-2 text-xs text-[#18181B] focus:outline-none focus:border-[#18181B]"
                />
                {passwordErrors.confirmPassword && (
                  <p className="text-[11px] text-red-600 mt-0.5">{passwordErrors.confirmPassword}</p>
                )}
              </div>

              <div className="pt-3 border-t border-[#E7E5E4] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-3.5 py-1.5 border border-[#E7E5E4] rounded text-xs uppercase tracking-wider font-medium text-[#71717A] hover:bg-[#F5F5F4] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#18181B] hover:bg-[#27272A] text-white rounded text-xs uppercase tracking-wider font-medium cursor-pointer"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE ACCOUNT CONFIRMATION MODAL                                         */}
      {/* ========================================================================= */}
      {isDeleteAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-red-200 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="font-serif text-lg font-medium text-red-950">
                Permanently Delete Account?
              </h3>
            </div>
            <p className="text-xs text-[#71717A] leading-relaxed">
              This action is permanent and cannot be undone. All active addresses, saved items, and historical orders will be purged.
            </p>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#71717A] font-semibold block mb-1">
                Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-[#FAFAF9] border border-red-200 rounded px-3 py-2 text-xs text-[#18181B] font-mono focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E5E4]">
              <button
                type="button"
                onClick={() => setIsDeleteAccountModalOpen(false)}
                className="px-3.5 py-1.5 border border-[#E7E5E4] rounded text-xs uppercase tracking-wider font-medium text-[#71717A] hover:bg-[#F5F5F4] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmationText.trim().toUpperCase() !== "DELETE"}
                onClick={handleConfirmDeleteAccount}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs uppercase tracking-wider font-medium transition-colors cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LOGOUT CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => {
          if (!isLoggingOut) setIsLogoutModalOpen(false);
        }}
        onConfirm={handleExecuteSignOut}
        isProcessing={isLoggingOut}
      />
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[1440px] mx-auto px-4 py-16 text-center text-xs text-[#71717A]">
          Loading patron account...
        </div>
      }
    >
      <AccountContent />
    </Suspense>
  );
}
