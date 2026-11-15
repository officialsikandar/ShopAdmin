import React, { useCallback, useEffect, useState } from 'react';
import {
  FolderKanban,
  CheckCircle2,
  PauseCircle,
  Search,
  Plus,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
import type { CategoryDoc } from '../types';
import { apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { useToast } from '../components/Toast';
import { useGoogleDrive } from '../components/GoogleDriveContext';

interface CategoriesResponse {
  categories: CategoryDoc[];
  stats: {
    total: number;
    active: number;
    inactive: number;
  };
}

interface CategoriesPageProps {
  openCreateSignal?: number;
  onDataChanged: () => void;
}

export function CategoriesPage({ openCreateSignal, onDataChanged }: CategoriesPageProps) {
  const { showToast, confirm } = useToast();
  const { uploadImageToDrive, confirmAndDeleteDriveImage } = useGoogleDrive();
  const [data, setData] = useState<CategoriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDoc | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [active, setActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, status: statusFilter });
      const res = await apiRequest<CategoriesResponse>(`/api/categories?${params.toString()}`);
      setData(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, showToast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openCreateModal = useCallback(() => {
    setEditing(null);
    setName('');
    setSlug('');
    setDescription('');
    setImage('');
    setActive(true);
    setModalOpen(true);
  }, []);

  useEffect(() => {
    if (openCreateSignal && openCreateSignal > 0) {
      openCreateModal();
    }
  }, [openCreateSignal, openCreateModal]);

  const openEditModal = (cat: CategoryDoc) => {
    setEditing(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || '');
    setImage(cat.image || '');
    setActive(cat.status === 'Active');
    setModalOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadImageToDrive(file, 'category_image');
      setImage(uploaded.url);
      showToast(`Category image uploaded to Google Drive (${uploaded.folderPath})`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!image) return;
    const ok = await confirmAndDeleteDriveImage(image, name || 'Category');
    if (ok) {
      setImage('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Category name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        description,
        image,
        status: active ? 'Active' : 'Inactive',
      };
      if (editing) {
        await apiRequest(`/api/categories/${editing._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Category updated');
      } else {
        await apiRequest('/api/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Category created');
      }
      setModalOpen(false);
      loadCategories();
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save category', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: CategoryDoc) => {
    const ok = await confirm({
      title: 'Delete Category',
      message: `Are you sure you want to delete "${cat.name}"?`,
      confirmLabel: 'Delete Category',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiRequest(`/api/categories/${cat._id}`, { method: 'DELETE' });
      showToast('Category deleted');
      loadCategories();
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete category', 'error');
    }
  };

  const stats = data?.stats ?? { total: 0, active: 0, inactive: 0 };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Categories', value: stats.total, icon: FolderKanban, color: 'bg-violet-50 text-[#6D28D9]' },
          { label: 'Active', value: stats.active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Inactive', value: stats.inactive, icon: PauseCircle, color: 'bg-amber-50 text-amber-600' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex items-center gap-3.5"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">{card.label}</div>
                <div className="text-xl font-bold text-slate-900 tabular-nums">{card.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category by name or slug..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-700"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold shadow-sm whitespace-nowrap shrink-0 ml-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Slug</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-center">Products</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="py-4 px-4">
                      <div className="h-5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : !data?.categories?.length ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <FolderKanban className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-slate-700">No categories yet</div>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Create product categories to organize your catalog.
                    </p>
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Category</span>
                    </button>
                  </td>
                </tr>
              ) : (
                data.categories.map((cat, index) => (
                  <tr key={cat._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 text-xs text-slate-500 tabular-nums">{index + 1}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {cat.image ? (
                          <img
                            src={cat.image}
                            alt={cat.name}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-violet-50 text-[#6D28D9] flex items-center justify-center shrink-0">
                            <FolderKanban className="w-4 h-4" />
                          </div>
                        )}
                        <span className="font-semibold text-slate-900">{cat.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{cat.slug}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {cat.description || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-900 tabular-nums">
                      {cat.productCount ?? 0}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={cat.status} />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                      {formatDateTime(cat.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(cat)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#6D28D9] hover:bg-violet-50"
                          title="Edit category"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Centered Add / Edit Category Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Category' : 'Create Category'}
        size="md"
      >
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-7 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category Name *
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!editing) {
                      setSlug(
                        e.target.value
                          .toLowerCase()
                          .trim()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-+|-+$/g, '')
                      );
                    }
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Accessories"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Slug</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
                  placeholder="accessories"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Mobile and daily use accessories..."
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-slate-700">Status</span>
                <div className="flex items-center gap-2.5">
                  <ToggleSwitch checked={active} onChange={setActive} label="Category Status" />
                  <span className="text-xs font-medium text-slate-700">
                    {active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="md:col-span-5 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Category Image</label>
              <label className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-300 bg-slate-50/50 cursor-pointer text-center">
                <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                <span className="text-xs font-medium text-slate-700">
                  {uploading ? 'Uploading to Drive…' : 'Click to upload'}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Saves to ecom_store/category_image
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = '';
                  }}
                />
              </label>

              {image && (
                <div className="relative w-24 h-24 mx-auto rounded-xl overflow-hidden border border-slate-200">
                  <img
                    src={image}
                    alt="Category preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 text-white text-xs flex items-center justify-center"
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving…' : editing ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
