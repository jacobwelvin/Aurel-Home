import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SearchModal } from "@/components/ui/SearchModal";
import { LookbookModal } from "@/components/ui/LookbookModal";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { AuthHashListener } from "@/components/auth/AuthHashListener";
import { AuthInitializer } from "@/components/auth/AuthInitializer";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
// import { FloatingPromo } from "@/components/ui/FloatingPromo";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AUREL HOME | Thoughtfully Made for Beautiful Living",
  description:
    "A sanctuary of tactile craftsmanship and quiet luxury. Discover furniture, Belgian textiles, and objects designed to bring warmth and character into everyday domestic rituals.",
  keywords: [
    "Aurel Home",
    "luxury furniture",
    "Belgian flax linen",
    "home decor",
    "minimalist interior",
    "architectural living",
  ],
  openGraph: {
    title: "AUREL HOME | Thoughtfully Made for Beautiful Living",
    description:
      "A sanctuary of tactile craftsmanship and quiet luxury. Discover furniture, Belgian textiles, and objects designed to bring warmth into everyday spaces.",
    type: "website",
    locale: "en_IN",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${plusJakarta.variable}`}>
      <body className="min-h-screen flex flex-col bg-[#FAFAF9] text-[#18181B] font-sans selection:bg-[#FFDBD0] selection:text-[#742508]">
        {/* Top Announcement Bar */}
        <AnnouncementBar />

        {/* Global Navigation */}
        <Navbar />

        {/* Page Content */}
        <main className="flex-1">{children}</main>

        {/* Global Footer */}
        <Footer />

        {/* Global Slide-Over Cart Drawer */}
        <CartDrawer />

        {/* Search Modal */}
        <SearchModal />

        {/* Lookbook Cinema Dialog */}
        <LookbookModal />

        {/* Toast Notifications */}
        <ToastContainer />

        {/* Global Auth URL Hash & Error Listener */}
        <AuthHashListener />

        {/* Global Auth Session & Cookie Synchronizer */}
        <AuthInitializer />

        {/* Global Authentication Gate Modal for Guests */}
        <AuthGateModal />

        {/* Floating Complimentary Tote Promo Badge (disabled for now) */}
        {/* <FloatingPromo /> */}
      </body>
    </html>
  );
}
