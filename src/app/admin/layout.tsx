"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingBag,
  Boxes,
  ArrowUpRight,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { LogoutConfirmationModal } from "@/components/auth/LogoutConfirmationModal";
import { useAuthStore } from "@/store/authStore";
import { API_BASE_URL } from "@/lib/api";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  exact?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Products",
    href: "/admin/products",
    icon: Package,
  },
  {
    label: "Categories",
    href: "/admin/categories",
    icon: FolderTree,
  },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: ShoppingBag,
  },
  {
    label: "Inventory",
    href: "/admin/inventory",
    icon: Boxes,
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useAuthStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function checkDbHealth() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(`${API_BASE_URL}/health`, {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setDbStatus(data.database?.connected ? "connected" : "disconnected");
          }
        } else {
          if (isMounted) setDbStatus("disconnected");
        }
      } catch {
        clearTimeout(timeoutId);
        if (isMounted) setDbStatus("disconnected");
      }
    }
    checkDbHealth();
    const interval = setInterval(checkDbHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleOpenLogoutModal = () => {
    setMobileSidebarOpen(false);
    setIsLogoutModalOpen(true);
  };

  const handleExecuteSignOut = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      router.push("/login");
    } catch (err) {
      console.error("Admin sign out error:", err);
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
    }
  };

  const isActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#18181B] text-[#FAFAF9]">
      {/* Brand Atelier Header */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <Link href="/admin" className="flex flex-col">
          <span className="font-serif text-xl tracking-[0.16em] uppercase text-[#FAFAF9] font-normal">
            AUREL HOME
          </span>
          <span className="text-[9px] uppercase tracking-[0.24em] font-semibold text-[#FFDBD0] mt-0.5">
            Atelier Management
          </span>
        </Link>
        <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#C25E3E]/20 text-[#FFDBD0] border border-[#C25E3E]/40">
          <ShieldCheck className="w-3 h-3 text-[#FFDBD0]" />
          Admin
        </span>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] uppercase tracking-[0.2em] font-medium text-white/40">
          Management
        </div>

        {ADMIN_NAV.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileSidebarOpen(false)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs uppercase tracking-wider font-medium transition-all ${
                active
                  ? "bg-[#C25E3E] text-white shadow-sm"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${active ? "text-white" : "text-white/60"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded tracking-normal normal-case font-normal ${
                    active ? "bg-white/20 text-white" : "bg-white/10 text-white/50"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-6 px-3 pb-2 text-[10px] uppercase tracking-[0.2em] font-medium text-white/40">
          Public Store
        </div>

        <Link
          href="/"
          className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs uppercase tracking-wider font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <ArrowUpRight className="w-4 h-4 text-[#FFDBD0]" />
            <span>View Storefront</span>
          </div>
          <span className="text-[10px] text-white/40">Live</span>
        </Link>
      </div>

      {/* Admin Profile Area */}
      <div className="p-4 border-t border-white/10 bg-black/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-[#C25E3E] text-white flex items-center justify-center font-serif text-sm font-semibold shrink-0">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : "A"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-white truncate">
              {profile?.name || "Curator Administrator"}
            </div>
            <div className="text-[11px] text-white/50 truncate">
              {profile?.email || "admin@aurelhome.com"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenLogoutModal}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs tracking-wider uppercase font-medium transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#FAFAF9] flex">
        {/* Desktop Sidebar (Permanent) */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30 shadow-lg">
          {sidebarContent}
        </aside>

        {/* Mobile Slide-Over Sidebar */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl z-50">
              <div className="absolute top-4 right-3 z-10">
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1 rounded text-white/70 hover:text-white"
                  aria-label="Close sidebar"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              {sidebarContent}
            </div>
          </div>
        )}

        {/* Main Content Workspace */}
        <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
          {/* Top Bar */}
          <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[#E7E5E4] px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-[#18181B] hover:bg-[#F5F5F4] transition-colors"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C25E3E]">
                  Aurel Atelier Control
                </span>
                <h1 className="font-serif text-lg sm:text-xl text-[#18181B] font-normal leading-tight">
                  Atelier Dashboard
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              {dbStatus === "connected" && (
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>PostgreSQL Live</span>
                </div>
              )}
              {dbStatus === "checking" && (
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Connecting DB...</span>
                </div>
              )}
              {dbStatus === "disconnected" && (
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-50 text-red-800 border border-red-200 text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                  <span>DB Disconnected</span>
                </div>
              )}

              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#18181B] text-xs font-medium uppercase tracking-wider transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C25E3E]" />
                <span className="hidden sm:inline">Storefront</span>
              </Link>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>

      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => {
          if (!isLoggingOut) setIsLogoutModalOpen(false);
        }}
        onConfirm={handleExecuteSignOut}
        isProcessing={isLoggingOut}
        title="Sign out of Aurel Home Admin?"
        message="Are you sure you want to sign out of your administrator account?"
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
      />
    </AdminGuard>
  );
}
