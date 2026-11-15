import React, { useCallback, useEffect, useState } from 'react';
import {
  Package,
  CheckCircle2,
  FileEdit,
  AlertTriangle,
  XCircle,
  Search,
  Plus,
  Download,
  Eye,
  Pencil,
  Trash2,
  Upload,
  RotateCcw,
} from 'lucide-react';
import type { CategoryDoc, ProductDoc } from '../types';
import { apiRequest, downloadProtectedFile } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useGoogleDrive } from '../components/GoogleDriveContext';

interface ProductsResponse {
  products: ProductDoc[];
  total: number;
  stats: {
    total: number;
    active: number;
    draft: number;
    lowStock: number;
    outOfStock: number;
  };
}

interface ProductsPageProps {
  currency: string;
  openCreateSignal?: number;
  onDataChanged: () => void;
}

export function ProductsPage({ currency, openCreateSignal, onDataChanged }: ProductsPageProps) {
  const { showToast, confirm } = useToast();
  const { uploadImageToDrive, confirmAndDeleteDriveImage } = useGoogleDrive();
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [detailProduct, setDetailProduct] = useState<ProductDoc | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductDoc | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState<number | string>('');
  const [discountPercent, setDiscountPercent] = useState<number | string>(0);
  const [stock, setStock] = useState<number | string>(0);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | string>(10);
  const [status, setStatus] = useState<'Active' | 'Draft' | 'Inactive'>('Active');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        category: categoryFilter,
        status: statusFilter,
        stockStatus: stockFilter,
        page: String(page),
        limit: String(limit),
      });
      const [pRes, cRes] = await Promise.all([
        apiRequest<ProductsResponse>(`/api/products?${params.toString()}`),
        apiRequest<{ categories: CategoryDoc[] }>('/api/categories'),
      ]);
      setData(pRes);
      setCategories(cRes.categories || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter, stockFilter, page, limit, showToast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const openAddModal = useCallback(() => {
    setEditingProduct(null);
    setName('');
    setSku('');
    setCategoryId(categories[0]?._id || '');
    setPrice('');
    setDiscountPercent(0);
    setStock(0);
    setLowStockThreshold(10);
    setStatus('Active');
    setDescription('');
    setImageUrl('');
    setEditModalOpen(true);
  }, [categories]);

  useEffect(() => {
    if (openCreateSignal && openCreateSignal > 0) {
      openAddModal();
    }
  }, [openCreateSignal, openAddModal]);

  const openEditModal = (product: ProductDoc) => {
    setDetailProduct(null);
    setEditingProduct(product);
    setName(product.name);
    setSku(product.sku);
    setCategoryId(product.categoryId || '');
    setPrice(product.price);
    setDiscountPercent(product.discountPercent || 0);
    setStock(product.stock);
    setLowStockThreshold(product.lowStockThreshold ?? 10);
    setStatus(product.status);
    setDescription(product.description || '');
    setImageUrl(product.images?.[0] || '');
    setEditModalOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadImageToDrive(file, 'product_image');
      setImageUrl(uploaded.url);
      showToast(`Product image uploaded to Google Drive (${uploaded.folderPath})`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Image upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!imageUrl) return;
    const ok = await confirmAndDeleteDriveImage(imageUrl, name || 'Product');
    if (ok) {
      setImageUrl('');
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim() || price === '') {
      showToast('Name, SKU, and price are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const selectedCat = categories.find((c) => c._id === categoryId);
      const payload = {
        name: name.trim(),
        sku: sku.trim(),
        categoryId: categoryId || null,
        categoryName: selectedCat?.name || 'Uncategorized',
        price: Number(price),
        discountPercent: Number(discountPercent || 0),
        stock: Number(stock || 0),
        lowStockThreshold: Number(lowStockThreshold ?? 10),
        status,
        description,
        images: imageUrl.trim() ? [imageUrl.trim()] : [],
      };

      if (editingProduct) {
        await apiRequest(`/api/products/${editingProduct._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Product updated in MongoDB');
      } else {
        await apiRequest('/api/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Product added to MongoDB');
      }

      setEditModalOpen(false);
      loadProducts();
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (product: ProductDoc) => {
    const ok = await confirm({
      title: 'Delete Product',
      message: `Are you sure you want to delete "${product.name}" (SKU: ${product.sku})?`,
      confirmLabel: 'Delete Product',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiRequest(`/api/products/${product._id}`, { method: 'DELETE' });
      showToast('Product deleted');
      loadProducts();
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete product', 'error');
    }
  };

  const stats = data?.stats ?? { total: 0, active: 0, draft: 0, lowStock: 0, outOfStock: 0 };

  return (
    <div className="space-y-5">
      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Products', value: stats.total, icon: Package, color: 'bg-violet-50 text-[#6D28D9]' },
          { label: 'Active', value: stats.active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Draft / Inactive', value: stats.draft, icon: FileEdit, color: 'bg-indigo-50 text-indigo-600' },
          { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
          { label: 'Out of Stock', value: stats.outOfStock, icon: XCircle, color: 'bg-rose-50 text-rose-600' },
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

      {/* Filters & Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[210px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search products by name, SKU..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-700"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-700"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Draft">Draft</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value);
              setPage(1);
            }}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-700"
          >
            <option value="All">All Stock</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>

          {(search || categoryFilter !== 'All' || statusFilter !== 'All' || stockFilter !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryFilter('All');
                setStatusFilter('All');
                setStockFilter('All');
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() =>
                downloadProtectedFile(
                  '/api/products/export?format=xlsx',
                  'shopadmin-products.xlsx'
                ).catch((err) =>
                  showToast(err instanceof Error ? err.message : 'Export failed', 'error')
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold shadow-sm whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4 text-center">Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="py-4 px-4">
                      <div className="h-5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : !data?.products?.length ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Package className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-slate-700">No products found</div>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Add your first product to sync with MongoDB.
                    </p>
                    <button
                      type="button"
                      onClick={openAddModal}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Product</span>
                    </button>
                  </td>
                </tr>
              ) : (
                data.products.map((product) => {
                  const stockLow = product.stock > 0 && product.stock <= (product.lowStockThreshold ?? 10);
                  const stockZero = product.stock <= 0;
                  return (
                    <tr
                      key={product._id}
                      onClick={() => setDetailProduct(product)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                              <Package className="w-4.5 h-4.5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate max-w-[200px]">
                              {product.name}
                            </div>
                            <div className="text-xs text-slate-500 truncate max-w-[220px]">
                              {product.description || 'No description'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {product.sku}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-indigo-700">
                        {product.categoryName}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatCurrency(product.price, currency)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-semibold tabular-nums ${
                            stockZero
                              ? 'bg-rose-50 text-rose-700'
                              : stockLow
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {product.stock}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={stockZero ? 'Out of Stock' : product.status} />
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                        {formatDateTime(product.createdAt)}
                      </td>
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailProduct(product)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#6D28D9] hover:bg-violet-50"
                            title="View product details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit product"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          limit={limit}
          total={data?.total || 0}
          label="products"
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
      </div>

      {/* Centered Product Details Modal */}
      <Modal
        open={Boolean(detailProduct)}
        onClose={() => setDetailProduct(null)}
        title="Product Details"
        size="lg"
        footer={
          detailProduct && (
            <>
              <button
                type="button"
                onClick={() => openEditModal(detailProduct)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="w-4 h-4" />
                <span>Edit Product</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailProduct(null)}
                className="px-5 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold"
              >
                Close
              </button>
            </>
          )
        }
      >
        {detailProduct && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-5">
              {detailProduct.images?.[0] ? (
                <img
                  src={detailProduct.images[0]}
                  alt={detailProduct.name}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-square object-cover rounded-2xl border border-slate-200 bg-slate-50"
                />
              ) : (
                <div className="w-full aspect-square rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                  <Package className="w-12 h-12 mb-2" />
                  <span className="text-xs">No image uploaded</span>
                </div>
              )}
            </div>

            <div className="md:col-span-7 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{detailProduct.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="font-mono">SKU: {detailProduct.sku}</span>
                      <span>·</span>
                      <span>Category: {detailProduct.categoryName}</span>
                    </div>
                  </div>
                  <StatusBadge
                    status={detailProduct.stock <= 0 ? 'Out of Stock' : detailProduct.status}
                  />
                </div>

                <div className="flex items-baseline gap-3 mt-4">
                  <span className="text-2xl font-bold text-slate-900 tabular-nums">
                    {formatCurrency(detailProduct.price, currency)}
                  </span>
                  {detailProduct.discountPercent > 0 && (
                    <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                      {detailProduct.discountPercent}% OFF
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-600 mt-4 leading-relaxed">
                  {detailProduct.description || 'No product description provided.'}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <div className="text-slate-400">Stock</div>
                  <div className="font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {detailProduct.stock} units
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Status</div>
                  <div className="font-semibold text-slate-900 mt-0.5">{detailProduct.status}</div>
                </div>
                <div>
                  <div className="text-slate-400">Created At</div>
                  <div className="font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {new Date(detailProduct.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Updated At</div>
                  <div className="font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {new Date(detailProduct.updatedAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Centered Add/Edit Product Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        subtitle="Save product catalog details to MongoDB"
        size="lg"
      >
        <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Name *
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="Wireless Headphones"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SKU *</label>
              <input
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono uppercase"
                placeholder="WH-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Price *</label>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm tabular-nums"
                placeholder="999"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Discount (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stock *</label>
              <input
                required
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Low Stock Alert Threshold
              </label>
              <input
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Active' | 'Draft' | 'Inactive')}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              placeholder="High quality product details..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Product Image <span className="font-normal text-slate-400">(Saved to Google Drive: ecom_store/product_image)</span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-violet-300 bg-violet-50/40 text-xs font-semibold text-[#6D28D9] cursor-pointer hover:bg-violet-50">
                <Upload className="w-4 h-4" />
                <span>{uploading ? 'Uploading to Drive…' : 'Upload to Drive'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.target.value = '';
                  }}
                />
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Or paste image URL..."
                className="flex-1 min-w-[200px] border border-slate-200 rounded-xl px-3 py-2 text-xs"
              />
              {imageUrl && (
                <div className="relative inline-flex items-center">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="ml-1.5 text-xs font-semibold text-rose-600 hover:underline"
                    title="Remove image"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving…' : editingProduct ? 'Update Product' : 'Save Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
