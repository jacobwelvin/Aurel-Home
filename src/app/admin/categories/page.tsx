"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FolderTree,
  ArrowLeft,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  X,
  Sparkles,
  Layers,
  Upload,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import {
  fetchAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  uploadAdminImage,
  AdminCategoryItem,
  AdminCategoryPayload,
} from "@/lib/adminApi";
import { resolveMediaUrl } from "@/lib/utils";

export default function AdminCategoriesPage() {
  const { token } = useAuthStore();
  const authToken = token || "";

  // Data states
  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategoryItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal states
  const [deleteTarget, setDeleteTarget] = useState<AdminCategoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState<AdminCategoryPayload>({
    name: "",
    slug: "",
    realm_number: "",
    description: "",
    image: "",
    active: true,
  });
  const [isUploading, setIsUploading] = useState(false);

  // Load Categories
  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAdminCategories(authToken, false);
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories.");
    } finally {
      setIsLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      try {
        const data = await fetchAdminCategories(authToken, false);
        if (isMounted) {
          setCategories(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load categories.");
          setIsLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [authToken]);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      slug: "",
      realm_number: `Realm 0${categories.length + 1}`,
      description: "",
      image: "",
      active: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (c: AdminCategoryItem) => {
    setEditingCategory(c);
    setFormData({
      name: c.name,
      slug: c.slug,
      realm_number: c.realm_number || "",
      description: c.description || "",
      image: c.image || "",
      active: c.active,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Auto-generate slug
  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: editingCategory
        ? prev.slug
        : name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, ""),
    }));
  };

  // File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setFormError(null);
    try {
      const res = await uploadAdminImage(authToken, file);
      setFormData((prev) => ({ ...prev, image: res.url }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  // Submit Category
  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Realm name is required.");
      return;
    }
    if (!formData.slug.trim()) {
      setFormError("Slug is required.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingCategory) {
        await updateAdminCategory(authToken, editingCategory.id, formData);
      } else {
        await createAdminCategory(authToken, formData);
      }
      setIsModalOpen(false);
      await loadCategories();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save category.");
    } finally {
      setIsSaving(false);
    }
  };

  // Safe Delete
  const handleDeleteConfirm = async (soft: boolean) => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteErrorMessage(null);
    try {
      await deleteAdminCategory(authToken, deleteTarget.id, soft);
      setDeleteTarget(null);
      await loadCategories();
    } catch (err) {
      setDeleteErrorMessage(
        err instanceof Error ? err.message : "Failed to remove category."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered categories
  const filteredCategories = categories.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      (c.realm_number && c.realm_number.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-[#71717A]">
        <Link href="/admin" className="hover:text-[#18181B] flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </Link>
        <span>/</span>
        <span className="text-[#18181B] font-medium">Category Realms</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E7E5E4] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#FAF7F2] border border-[#E7E5E4] text-[#C25E3E] text-[10px] font-semibold tracking-wider uppercase mb-2">
            <Sparkles className="w-3 h-3" />
            <span>Realm Architecture</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#18181B] font-normal">
            Category & Realm Management
          </h2>
          <p className="text-sm text-[#71717A] mt-1 font-sans">
            Architecture and realm hierarchy for Aurel Home interior design collections.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadCategories()}
            disabled={isLoading}
            className="p-2 border border-[#E7E5E4] rounded-lg bg-white text-[#71717A] hover:text-[#18181B] hover:border-[#18181B] transition-colors"
            title="Refresh realms"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#18181B] hover:bg-[#C25E3E] text-white rounded text-xs uppercase tracking-wider font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Realm</span>
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
          <input
            type="text"
            placeholder="Search realm name or number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E] bg-[#FAFAF9]"
          />
        </div>

        <div className="text-xs text-[#71717A]">
          Total Realms: <span className="font-semibold text-[#18181B]">{categories.length}</span>
        </div>
      </div>

      {/* Category Realm Cards Grid */}
      {isLoading ? (
        <div className="bg-white border border-[#E7E5E4] rounded-lg py-20 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#C25E3E] mb-2" />
          <p className="text-xs text-[#71717A]">Loading living realms...</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-[#E7E5E4] rounded-lg p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm text-[#18181B] font-medium">{error}</p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => loadCategories()}
              className="px-4 py-1.5 text-xs bg-[#18181B] text-white rounded hover:bg-[#27272A] transition-colors cursor-pointer"
            >
              Retry
            </button>
            {(error.toLowerCase().includes("session") ||
              error.toLowerCase().includes("unauthorized") ||
              error.toLowerCase().includes("credentials")) && (
              <Link
                href="/login?redirect=/admin/categories"
                className="px-4 py-1.5 text-xs bg-[#C25E3E] text-white rounded hover:bg-[#A84F32] transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-white border border-[#E7E5E4] rounded-lg py-20 text-center space-y-3">
          <FolderTree className="w-8 h-8 text-[#A1A1AA] mx-auto" />
          <h4 className="font-serif text-lg text-[#18181B]">No category realms found</h4>
          <p className="text-xs text-[#71717A]">
            Try adjusting your search query or create a new living realm.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCategories.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-[#E7E5E4] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Banner Header */}
                <div className="h-32 bg-[#F5F5F4] relative border-b border-[#E7E5E4] overflow-hidden">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveMediaUrl(c.image)}
                      alt={c.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/placeholder.jpg";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#A1A1AA]">
                      <Layers className="w-8 h-8 text-[#D4D4D8]" />
                    </div>
                  )}

                  {/* Active / Inactive Badge */}
                  <div className="absolute top-3 right-3">
                    {c.active ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500 text-white text-[9px] font-semibold uppercase tracking-wider shadow-xs">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-[#71717A] text-white text-[9px] font-semibold uppercase tracking-wider shadow-xs">
                        Archived
                      </span>
                    )}
                  </div>

                  {/* Realm number pill */}
                  {c.realm_number && (
                    <div className="absolute bottom-2.5 left-3 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono">
                      {c.realm_number}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg text-[#18181B] font-normal">
                      {c.name}
                    </h3>
                    <span className="text-[11px] font-mono text-[#71717A] bg-[#FAFAF9] px-2 py-0.5 rounded border border-[#E7E5E4]">
                      {c.item_count} items
                    </span>
                  </div>

                  <div className="text-[11px] text-[#A1A1AA] font-mono">
                    /{c.slug}
                  </div>

                  <p className="text-xs text-[#71717A] line-clamp-2 leading-relaxed">
                    {c.description || "No architectural description provided for this collection."}
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="px-5 py-3 border-t border-[#E7E5E4] bg-[#FAFAF9] flex items-center justify-between">
                <span className="text-[10px] text-[#A1A1AA]">
                  ID: {c.id.slice(0, 8)}...
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(c)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#18181B] hover:bg-[#E7E5E4] rounded transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => {
                      setDeleteTarget(c);
                      setDeleteErrorMessage(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT REALM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E7E5E4] w-full max-w-lg overflow-hidden">
            <div className="bg-white border-b border-[#E7E5E4] px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl text-[#18181B]">
                  {editingCategory ? "Edit Living Realm" : "New Living Realm"}
                </h3>
                <p className="text-xs text-[#71717A]">
                  Define collection name, realm number, and architectural narrative.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-[#71717A] hover:text-[#18181B] rounded hover:bg-[#F5F5F4]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCategory} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Realm Name & Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#18181B] mb-1">
                    Realm Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Dining, Textiles"
                    className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#18181B] mb-1">
                    Realm Number
                  </label>
                  <input
                    type="text"
                    value={formData.realm_number || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, realm_number: e.target.value }))}
                    placeholder="Realm 01"
                    className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded font-mono focus:outline-none focus:border-[#C25E3E]"
                  />
                </div>
              </div>

              {/* URL Slug */}
              <div>
                <label className="block text-xs font-medium text-[#18181B] mb-1">
                  URL Slug *
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
                  placeholder="dining"
                  className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded font-mono focus:outline-none focus:border-[#C25E3E]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-[#18181B] mb-1">
                  Architectural Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Atmospheric narrative introducing this curated realm..."
                  className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                />
              </div>

              {/* Image URL / Upload */}
              <div>
                <label className="block text-xs font-medium text-[#18181B] mb-1">
                  Banner Artwork Image
                </label>
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="Image URL (https://... or uploaded file)"
                    value={formData.image || ""}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (val.startsWith("blob:")) {
                        setFormError("Browser blob: URLs cannot be saved. Please use 'Upload from device' or a valid public URL.");
                        return;
                      }
                      setFormData((p) => ({ ...p, image: val }));
                    }}
                    className="w-full px-3 py-2 text-xs border border-[#E7E5E4] rounded focus:outline-none focus:border-[#C25E3E]"
                  />

                  {formData.image && (
                    <div className="flex items-center gap-3 p-2 bg-[#FAFAF9] rounded border border-[#E7E5E4]">
                      <div className="w-16 h-12 rounded overflow-hidden bg-[#F5F5F4] relative border border-[#E7E5E4] flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveMediaUrl(formData.image)}
                          alt="Category preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/placeholder.jpg";
                          }}
                        />
                      </div>
                      <div className="text-[11px] text-[#71717A] truncate flex-1 font-mono">
                        {formData.image}
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, image: "" }))}
                        className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  <label className="flex items-center justify-center gap-2 px-3 py-1.5 border border-dashed border-[#A1A1AA] hover:border-[#18181B] bg-[#FAFAF9] rounded cursor-pointer text-xs text-[#71717A] hover:text-[#18181B] transition-colors">
                    <Upload className="w-3.5 h-3.5 text-[#C25E3E]" />
                    <span>{isUploading ? "Uploading..." : "Upload from device"}</span>
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

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#18181B]">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData((p) => ({ ...p, active: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#C25E3E] focus:ring-0"
                  />
                  <span>Active & Visible in Storefront Navigation</span>
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
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#18181B] hover:bg-[#C25E3E] text-white rounded text-xs uppercase tracking-wider font-medium disabled:opacity-50 transition-colors"
                >
                  {isSaving ? "Saving..." : editingCategory ? "Update Realm" : "Create Realm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL (REFERENTIAL INTEGRITY GUARDED) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E7E5E4] w-full max-w-md p-6 space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center">
              <h4 className="font-serif text-lg text-[#18181B]">Remove or Archive Realm</h4>
              <p className="text-xs text-[#71717A] mt-1">
                Managing realm <span className="font-semibold text-[#18181B]">{deleteTarget.name}</span>{" "}
                ({deleteTarget.item_count} assigned products).
              </p>
            </div>

            {deleteErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{deleteErrorMessage}</span>
              </div>
            )}

            <div className="p-3 bg-[#FAF7F2] border border-[#E7E5E4] rounded text-xs text-[#71717A] space-y-1">
              <p className="font-medium text-[#18181B]">Referential Integrity Notice</p>
              <p>
                Permanent deletion will be rejected if products are assigned to this realm. Use soft deactivation to safely unpublish the realm without corrupting product references.
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
                Attempt Permanent Deletion
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
