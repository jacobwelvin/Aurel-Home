"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  ArrowLeft,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  AlertCircle,
  ImageOff,
  X,
  Upload,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import {
  fetchAdminProducts,
  fetchAdminCategories,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  uploadAdminImage,
  AdminProductItem,
  AdminCategoryItem,
  AdminProductPayload,
} from "@/lib/adminApi";
import { resolveMediaUrl } from "@/lib/utils";

export default function AdminProductsPage() {
  const { token } = useAuthStore();
  const authToken = token || "";

  // Data states
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>("");
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>("all");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProductItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<AdminProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState<AdminProductPayload>({
    name: "",
    slug: "",
    subtitle: "",
    description: "",
    price: 0,
    compare_at_price: null,
    stock: 0,
    images: [],
    details: [],
    materials: "",
    dimensions: "",
    care: "",
    badge: "",
    featured: false,
    bestseller: false,
    category_id: null,
    active: true,
  });

  const [imageUrlInput, setImageUrlInput] = useState("");
  const [urlInputError, setUrlInputError] = useState<string | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<number, boolean>>({});
  const [detailInput, setDetailInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Load Categories once
  useEffect(() => {
    let isMounted = true;
    async function loadCategories() {
      try {
        const cats = await fetchAdminCategories(authToken, false);
        if (isMounted) setCategories(cats);
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    }
    loadCategories();
    return () => {
      isMounted = false;
    };
  }, [authToken]);

  // Load Products with filters
  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activeParam =
        selectedActiveFilter === "active"
          ? true
          : selectedActiveFilter === "inactive"
          ? false
          : undefined;

      const data = await fetchAdminProducts(authToken, {
        page,
        limit,
        search: searchQuery.trim() || undefined,
        category_id: selectedCategory || undefined,
        stock_status: selectedStockStatus || undefined,
        only_active: activeParam,
      });

      setProducts(data.items);
      setTotal(data.total);
      setTotalPages(data.pages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setIsLoading(false);
    }
  }, [authToken, page, limit, searchQuery, selectedCategory, selectedStockStatus, selectedActiveFilter]);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      try {
        const activeParam =
          selectedActiveFilter === "active"
            ? true
            : selectedActiveFilter === "inactive"
            ? false
            : undefined;

        const data = await fetchAdminProducts(authToken, {
          page,
          limit,
          search: searchQuery.trim() || undefined,
          category_id: selectedCategory || undefined,
          stock_status: selectedStockStatus || undefined,
          only_active: activeParam,
        });

        if (isMounted) {
          setProducts(data.items);
          setTotal(data.total);
          setTotalPages(data.pages || 1);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load products");
          setIsLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [authToken, page, limit, searchQuery, selectedCategory, selectedStockStatus, selectedActiveFilter]);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      slug: "",
      subtitle: "",
      description: "",
      price: 0,
      compare_at_price: null,
      stock: 10,
      images: [],
      details: [],
      materials: "",
      dimensions: "",
      care: "",
      badge: "",
      featured: false,
      bestseller: false,
      category_id: categories.length > 0 ? categories[0].id : null,
      active: true,
    });
    setImageUrlInput("");
    setUrlInputError(null);
    setImageLoadErrors({});
    setDetailInput("");
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (p: AdminProductItem) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      slug: p.slug,
      subtitle: p.subtitle || "",
      description: p.description || "",
      price: Number(p.price),
      compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : null,
      stock: p.stock,
      images: p.images || [],
      details: p.details || [],
      materials: p.materials || "",
      dimensions: p.dimensions || "",
      care: p.care || "",
      badge: p.badge || "",
      featured: p.featured,
      bestseller: p.bestseller,
      category_id: p.category_id || (p.category ? p.category.id : null),
      active: p.active,
    });
    setImageUrlInput("");
    setUrlInputError(null);
    setImageLoadErrors({});
    setDetailInput("");
    setFormError(null);
    setIsModalOpen(true);
  };

  // Auto slug generator from name
  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: editingProduct
        ? prev.slug
        : name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, ""),
    }));
  };

  // Add image URL
  const handleAddImageUrl = () => {
    setUrlInputError(null);
    const raw = imageUrlInput.trim();
    if (!raw) {
      setUrlInputError("Please enter an image URL before clicking Add URL.");
      return;
    }

    // Strip accidental surrounding quotes or backticks
    const cleaned = raw.replace(/^["'`]|["'`]$/g, "").trim();

    if (!cleaned) {
      setUrlInputError("Please enter a valid image URL.");
      return;
    }

    if (cleaned.startsWith("blob:")) {
      setUrlInputError(
        "Local browser blob URLs (blob:...) cannot be accessed by other devices. Please use 'Upload from device' or paste a public web URL (https://...)."
      );
      return;
    }

    if (cleaned.startsWith("data:")) {
      setUrlInputError(
        "Inline data URIs (data:...) are not supported as product URLs due to size limits. Please upload the file directly from your device."
      );
      return;
    }

    // Validate URL syntax
    let parsed: URL;
    try {
      parsed = new URL(cleaned);
    } catch {
      setUrlInputError(
        "Invalid URL format. Please provide a full web address starting with https:// or http:// (e.g. https://example.com/image.jpg)."
      );
      return;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      setUrlInputError(
        `Unsupported protocol '${parsed.protocol}'. Only https:// and http:// image URLs are supported.`
      );
      return;
    }

    // Validate that URL is not a webpage
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host === "unsplash.com" && path.startsWith("/photos/")) {
      setUrlInputError(
        "This appears to be an Unsplash webpage link rather than a direct image. On Unsplash, right-click the image and select 'Copy image address' (starts with https://images.unsplash.com/...) and paste that URL."
      );
      return;
    }

    if (host.includes("pinterest.") && path.includes("/pin/")) {
      setUrlInputError(
        "This is a Pinterest webpage link. Right-click the image and select 'Copy image address' to obtain the direct image URL."
      );
      return;
    }

    if (host.includes("google.") && (path.includes("/imgres") || path.includes("/url"))) {
      setUrlInputError(
        "This is a Google search result redirect. Open the image directly and copy its direct web address."
      );
      return;
    }

    if (/\.(html?|php|aspx?|jsp)$/i.test(path)) {
      setUrlInputError(
        "This URL points to an HTML webpage document, not an image file. Please provide a direct link to an image (e.g. ending in .jpg, .png, .webp)."
      );
      return;
    }

    if (formData.images.includes(cleaned)) {
      setUrlInputError("This image URL has already been added to the product.");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, cleaned],
    }));
    setImageUrlInput("");
    setUrlInputError(null);
  };

  // Remove image URL
  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
    setImageLoadErrors((prev) => {
      const next: Record<number, boolean> = {};
      Object.keys(prev).forEach((key) => {
        const k = Number(key);
        if (k < index) next[k] = prev[k];
        else if (k > index) next[k - 1] = prev[k];
      });
      return next;
    });
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setFormError(null);
    try {
      const res = await uploadAdminImage(authToken, file);
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, res.url],
      }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  // Add craftsman bullet point
  const handleAddDetail = () => {
    if (!detailInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      details: [...(prev.details || []), detailInput.trim()],
    }));
    setDetailInput("");
  };

  const handleRemoveDetail = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      details: (prev.details || []).filter((_, i) => i !== index),
    }));
  };

  // Save Product (Create or Update)
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    if (!formData.slug.trim()) {
      setFormError("Product slug is required.");
      return;
    }
    if (formData.price < 0) {
      setFormError("Price must be greater than or equal to 0.");
      return;
    }
    if (formData.stock < 0) {
      setFormError("Stock cannot be negative.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingProduct) {
        await updateAdminProduct(authToken, editingProduct.id, formData);
      } else {
        await createAdminProduct(authToken, formData);
      }
      setIsModalOpen(false);
      await loadProducts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete / Deactivation
  const handleDeleteConfirm = async (soft: boolean) => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAdminProduct(authToken, deleteTarget.id, soft);
      setDeleteTarget(null);
      await loadProducts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete product.");
    } finally {
      setIsDeleting(false);
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
        <span className="text-[#18181B] font-medium">Products Management</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E7E5E4] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#FAF7F2] border border-[#E7E5E4] text-[#C25E3E] text-[10px] font-semibold tracking-wider uppercase mb-2">
            <Sparkles className="w-3 h-3" />
            <span>Catalogue Engine</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#18181B] font-normal">
            Product Catalogue Management
          </h2>
          <p className="text-sm text-[#71717A] mt-1 font-sans">
            Curate, edit, and audit artisanal home pieces across all 6 architectural realms.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadProducts()}
            disabled={isLoading}
            className="p-2 border border-[#E7E5E4] rounded-lg bg-white text-[#71717A] hover:text-[#18181B] hover:border-[#18181B] transition-colors"
            title="Refresh catalogue"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#18181B] hover:bg-[#C25E3E] text-white rounded text-xs uppercase tracking-wider font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Creation</span>
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
              placeholder="Search by title, material..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] bg-[#FAFAF9]"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] bg-[#FAFAF9] text-[#18181B]"
            >
              <option value="">All Category Realms</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.realm_number ? `${c.realm_number} — ` : ""}{c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div>
            <select
              value={selectedStockStatus}
              onChange={(e) => {
                setSelectedStockStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] bg-[#FAFAF9] text-[#18181B]"
            >
              <option value="">All Stock Levels</option>
              <option value="in_stock">In Stock (&gt; 5)</option>
              <option value="low_stock">Low Stock (1 – 5)</option>
              <option value="out_of_stock">Out of Stock (0)</option>
            </select>
          </div>

          {/* Visibility Filter */}
          <div>
            <select
              value={selectedActiveFilter}
              onChange={(e) => {
                setSelectedActiveFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] bg-[#FAFAF9] text-[#18181B]"
            >
              <option value="all">Active & Inactive</option>
              <option value="active">Active Only</option>
              <option value="inactive">Archived / Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Filter stats bar */}
        <div className="flex items-center justify-between text-xs text-[#71717A] pt-2 border-t border-[#F5F5F4]">
          <div>
            Found <span className="font-semibold text-[#18181B]">{total}</span> creations
          </div>
          {(searchQuery || selectedCategory || selectedStockStatus || selectedActiveFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("");
                setSelectedStockStatus("");
                setSelectedActiveFilter("all");
                setPage(1);
              }}
              className="text-[#C25E3E] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#C25E3E] mb-2" />
            <p className="text-xs text-[#71717A]">Querying PostgreSQL catalogue...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm text-[#18181B] font-medium">{error}</p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => loadProducts()}
                className="px-4 py-1.5 text-xs bg-[#18181B] text-white rounded hover:bg-[#27272A] transition-colors cursor-pointer"
              >
                Retry
              </button>
              {(error.toLowerCase().includes("session") ||
                error.toLowerCase().includes("unauthorized") ||
                error.toLowerCase().includes("credentials")) && (
                <Link
                  href="/login?redirect=/admin/products"
                  className="px-4 py-1.5 text-xs bg-[#C25E3E] text-white rounded hover:bg-[#A84F32] transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Package className="w-8 h-8 text-[#A1A1AA] mx-auto" />
            <h4 className="font-serif text-lg text-[#18181B]">No creations matched your criteria</h4>
            <p className="text-xs text-[#71717A] max-w-sm mx-auto">
              Try adjusting your search terms or filters, or create a new product item.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7F2] text-[#71717A] uppercase text-[10px] tracking-wider border-b border-[#E7E5E4]">
                <tr>
                  <th className="py-3 px-4">Creation</th>
                  <th className="py-3 px-4">Realm</th>
                  <th className="py-3 px-4">Price (INR)</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E4]">
                {products.map((p) => {
                  const isLow = p.stock > 0 && p.stock <= 5;
                  const isOut = p.stock === 0;

                  return (
                    <tr key={p.id} className="hover:bg-[#FAFAF9] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-[#F5F5F4] overflow-hidden flex-shrink-0 relative border border-[#E7E5E4]">
                            {p.images && p.images[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={resolveMediaUrl(p.images[0])}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback to placeholder if broken or inaccessible
                                  (e.target as HTMLImageElement).src = "/images/placeholder.jpg";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#A1A1AA]">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-[#18181B] flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {p.badge && (
                                <span className="px-1.5 py-0.2 rounded bg-[#FAF7F2] text-[#C25E3E] text-[9px] font-medium border border-[#E7E5E4]">
                                  {p.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#A1A1AA] font-mono mt-0.5">
                              /{p.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-[#71717A]">
                        {p.category ? (
                          <span className="font-serif text-[#18181B]">
                            {p.category.name}
                          </span>
                        ) : (
                          <span className="text-[#A1A1AA] italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium text-[#18181B]">
                        ₹{Number(p.price).toLocaleString("en-IN")}
                        {p.compare_at_price && (
                          <span className="text-[10px] text-[#A1A1AA] line-through ml-1.5 font-normal">
                            ₹{Number(p.compare_at_price).toLocaleString("en-IN")}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            0 Units (Depleted)
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            {p.stock} Units (Low Stock)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {p.stock} Units
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {p.active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                            <Eye className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#A1A1AA]">
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Archived</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-[#71717A] hover:text-[#18181B] hover:bg-[#F5F5F4] rounded transition-colors"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="p-1.5 text-[#71717A] hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Archive / Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E7E5E4] w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#E7E5E4] px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="font-serif text-xl text-[#18181B]">
                  {editingProduct ? "Edit Atelier Creation" : "New Atelier Creation"}
                </h3>
                <p className="text-xs text-[#71717A]">
                  Configure title, pricing, realm association, and craftsman details.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-[#71717A] hover:text-[#18181B] rounded hover:bg-[#F5F5F4]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#18181B] mb-1">
                    Creation Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Kyoto Minimalist Oak Coffee Table"
                    className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#18181B] mb-1">
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
                    placeholder="kyoto-oak-coffee-table"
                    className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded font-mono focus:outline-none focus:border-[#C25E3E]"
                  />
                </div>
              </div>

              {/* Subtitle & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#18181B] mb-1">
                    Realm Association
                  </label>
                  <select
                    value={formData.category_id || ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        category_id: e.target.value || null,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] bg-white"
                  >
                    <option value="">No Realm (Unassigned)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.realm_number ? `${c.realm_number} — ` : ""}{c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#18181B] mb-1">
                    Editorial Subtitle
                  </label>
                  <input
                    type="text"
                    value={formData.subtitle || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, subtitle: e.target.value }))}
                    placeholder="Hand-joined solid white oak"
                    className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                  />
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#18181B] mb-1">
                    Price (INR ₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#18181B] mb-1">
                    Compare At Price (INR ₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.compare_at_price ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        compare_at_price: e.target.value ? parseFloat(e.target.value) : null,
                      }))
                    }
                    placeholder="Optional original price"
                    className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#18181B] mb-1">
                    Stock Quantity *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, stock: parseInt(e.target.value, 10) || 0 }))
                    }
                    className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-[#18181B] mb-1">
                  Narrative Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Architectural provenance and craftsmanship story..."
                  className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                />
              </div>

              {/* Image Management */}
              <div>
                <label className="block text-xs font-medium text-[#18181B] mb-1">
                  Product Images
                </label>
                <div className="space-y-3">
                  {/* Image thumbnails preview */}
                  {formData.images.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2.5 p-2.5 bg-[#FAFAF9] border border-[#E7E5E4] rounded-lg">
                        {formData.images.map((img, i) => {
                          const isErr = imageLoadErrors[i];
                          return (
                            <div
                              key={i}
                              className={`relative group w-20 h-20 rounded-md border overflow-hidden flex flex-col items-center justify-center transition-all ${
                                isErr
                                  ? "border-amber-300 bg-amber-50/70"
                                  : "border-[#E7E5E4] bg-white shadow-xs"
                              }`}
                              title={img}
                            >
                              {isErr ? (
                                <div className="p-2 text-center flex flex-col items-center justify-center gap-1 w-full h-full">
                                  <ImageOff className="w-4 h-4 text-amber-600" />
                                  <span className="text-[9px] font-medium text-amber-800 leading-tight">
                                    Load Failed
                                  </span>
                                </div>
                              ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={resolveMediaUrl(img)}
                                  alt={`Product preview ${i + 1}`}
                                  className="w-full h-full object-cover"
                                  onLoad={() => {
                                    setImageLoadErrors((prev) => {
                                      if (!prev[i]) return prev;
                                      const n = { ...prev };
                                      delete n[i];
                                      return n;
                                    });
                                  }}
                                  onError={() => {
                                    setImageLoadErrors((prev) => ({ ...prev, [i]: true }));
                                  }}
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(i)}
                                className={`absolute top-1 right-1 p-1 rounded-full text-white transition-all shadow-xs ${
                                  isErr
                                    ? "bg-rose-600 hover:bg-rose-700 opacity-100"
                                    : "bg-black/75 hover:bg-rose-600 opacity-0 group-hover:opacity-100"
                                }`}
                                title="Remove image"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {Object.keys(imageLoadErrors).length > 0 && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-md text-[11px] text-amber-900 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-semibold">One or more image previews could not be loaded</p>
                            <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                              Check that each URL is public, accessible without authentication, and points directly to an image resource rather than an HTML page. You can remove broken images using the red &times; button.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add by URL or File Upload */}
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex gap-1">
                        <input
                          type="url"
                          placeholder="Paste image URL (https://...)"
                          value={imageUrlInput}
                          onChange={(e) => {
                            setImageUrlInput(e.target.value);
                            if (urlInputError) setUrlInputError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddImageUrl();
                            }
                          }}
                          className={`flex-1 px-3 py-1.5 text-xs border rounded focus:outline-none ${
                            urlInputError
                              ? "border-rose-400 focus:border-rose-600 bg-rose-50/30"
                              : "border-[#E7E5E4] focus:border-[#C25E3E]"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={handleAddImageUrl}
                          className="px-3.5 py-1.5 bg-[#18181B] hover:bg-[#C25E3E] text-white rounded text-xs font-medium transition-colors"
                        >
                          Add URL
                        </button>
                      </div>

                      <div className="relative">
                        <label className="flex items-center justify-center gap-2 px-3 py-1.5 border border-dashed border-[#A1A1AA] hover:border-[#18181B] bg-white rounded cursor-pointer text-xs text-[#71717A] hover:text-[#18181B] transition-colors">
                          <Upload className="w-3.5 h-3.5 text-[#C25E3E]" />
                          <span>{isUploading ? "Uploading..." : "Upload from device (Max 10MB)"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {urlInputError && (
                      <p className="text-[11px] text-rose-600 flex items-start gap-1.5 mt-1 leading-snug">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>{urlInputError}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Materials, Dimensions, Care */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#18181B] mb-1">
                    Materials
                  </label>
                  <input
                    type="text"
                    value={formData.materials || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, materials: e.target.value }))}
                    placeholder="Solid Oak, Brass hardware"
                    className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#18181B] mb-1">
                    Dimensions
                  </label>
                  <input
                    type="text"
                    value={formData.dimensions || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, dimensions: e.target.value }))}
                    placeholder='42"W x 24"D x 18"H'
                    className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#18181B] mb-1">
                    Badge
                  </label>
                  <input
                    type="text"
                    value={formData.badge || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, badge: e.target.value }))}
                    placeholder="Bestseller, Limited"
                    className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                  />
                </div>
              </div>

              {/* Craftsman Bullet Points */}
              <div>
                <label className="block text-xs font-medium text-[#18181B] mb-1">
                  Craftsman Details (Bullet Points)
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Hand-finished with organic tung oil"
                      value={detailInput}
                      onChange={(e) => setDetailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddDetail();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                    />
                    <button
                      type="button"
                      onClick={handleAddDetail}
                      className="px-3 py-1.5 bg-[#18181B] text-white text-xs rounded hover:bg-[#C25E3E]"
                    >
                      Add Point
                    </button>
                  </div>

                  {formData.details && formData.details.length > 0 && (
                    <ul className="space-y-1 bg-[#FAFAF9] p-3 rounded border border-[#E7E5E4]">
                      {formData.details.map((d, i) => (
                        <li key={i} className="flex items-center justify-between text-xs text-[#18181B]">
                          <span>• {d}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDetail(i)}
                            className="text-[#A1A1AA] hover:text-rose-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-[#E7E5E4]">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#18181B]">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData((p) => ({ ...p, active: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#C25E3E] focus:ring-0"
                  />
                  <span>Active in Storefront</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#18181B]">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData((p) => ({ ...p, featured: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#C25E3E] focus:ring-0"
                  />
                  <span>Feature on Homepage</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#18181B]">
                  <input
                    type="checkbox"
                    checked={formData.bestseller}
                    onChange={(e) => setFormData((p) => ({ ...p, bestseller: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#C25E3E] focus:ring-0"
                  />
                  <span>Mark as Bestseller</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#E7E5E4]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E5E4] rounded text-xs text-[#71717A] hover:bg-[#F5F5F4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="px-5 py-2 bg-[#18181B] hover:bg-[#C25E3E] text-white rounded text-xs uppercase tracking-wider font-medium disabled:opacity-50 transition-colors"
                >
                  {isSaving
                    ? "Saving to Database..."
                    : isUploading
                    ? "Uploading Image..."
                    : editingProduct
                    ? "Save Changes"
                    : "Create Creation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / DEACTIVATE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E7E5E4] w-full max-w-md p-6 space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center">
              <h4 className="font-serif text-lg text-[#18181B]">Remove or Archive Creation</h4>
              <p className="text-xs text-[#71717A] mt-1">
                You are managing <span className="font-semibold text-[#18181B]">{deleteTarget.name}</span>.
              </p>
            </div>

            <div className="p-3 bg-[#FAF7F2] border border-[#E7E5E4] rounded text-xs text-[#71717A] space-y-1">
              <p className="font-medium text-[#18181B]">Recommended: Deactivate</p>
              <p>
                Deactivating hides the item from the storefront while safely preserving past customer order records.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleDeleteConfirm(true)}
                disabled={isDeleting}
                className="w-full py-2.5 bg-[#18181B] hover:bg-[#C25E3E] text-white text-xs uppercase tracking-wider font-medium rounded transition-colors"
              >
                {isDeleting ? "Processing..." : "Deactivate (Safe Archive)"}
              </button>

              <button
                onClick={() => handleDeleteConfirm(false)}
                disabled={isDeleting}
                className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded transition-colors"
              >
                Hard Delete Permanently
              </button>

              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="w-full py-2 border border-[#E7E5E4] text-xs text-[#71717A] rounded hover:bg-[#F5F5F4]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
