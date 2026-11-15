import React, { useCallback, useEffect, useState } from 'react';
import {
  Boxes,
  Layers,
  AlertTriangle,
  XCircle,
  IndianRupee,
  Search,
  SlidersHorizontal,
  Download,
  Package,
  Pencil,
} from 'lucide-react';
import type { CategoryDoc, ProductDoc } from '../types';
import { apiRequest, downloadProtectedFile } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

interface InventoryResponse {
  items: ProductDoc[];
  total: number;
  stats: {
    totalItems: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
    totalStockValue: number;
  };
}

interface InventoryPageProps {
  currency: string;
  onDataChanged: () => void;
}

export function InventoryPage({ currency, onDataChanged }: InventoryPageProps) {
  const { showToast } = useToast();
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [allProducts, setAllProducts] = useState<ProductDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('All Items');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Adjust Stock Modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [targetProductId, setTargetProductId] = useState('');
  const [adjustMode, setAdjustMode] = useState<'set' | 'add' | 'subtract'>('add');
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [saving, setSaving] = useState(false);

  const effectiveStockStatus = activeTab !== 'All Items' ? activeTab : stockFilter;

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        category: categoryFilter,
        stockStatus: effectiveStockStatus,
        page: String(page),
        limit: String(limit),
      });
      const [invRes, catRes, prodRes] = await Promise.all([
        apiRequest<InventoryResponse>(`/api/inventory?${params.toString()}`),
        apiRequest<{ categories: CategoryDoc[] }>('/api/categories'),
        apiRequest<{ products: ProductDoc[] }>('/api/products?limit=100'),
      ]);
      setData(invRes);
      setCategories(catRes.categories || []);
      setAllProducts(prodRes.products || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load inventory', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, effectiveStockStatus, page, limit, showToast]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const openAdjustModal = (product?: ProductDoc) => {
    setTargetProductId(product?._id || allProducts[0]?._id || '');
    setAdjustMode('add');
    setAdjustQty(10);
    setAdjustOpen(true);
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProductId) {
      showToast('Please select a product', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/api/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId: targetProductId,
          mode: adjustMode,
          quantity: Number(adjustQty),
        }),
      });
      showToast('Inventory stock updated in MongoDB');
      setAdjustOpen(false);
      loadInventory();
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to adjust stock', 'error');
    } finally {
      setSaving(false);
    }
  };

  const stats = data?.stats ?? {
    totalItems: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    totalStockValue: 0,
  };

  const selectedProd = allProducts.find((p) => p._id === targetProductId);
  const previewStock = selectedProd
    ? adjustMode === 'set'
      ? Math.max(0, Number(adjustQty || 0))
      : adjustMode === 'add'
      ? selectedProd.stock + Math.max(0, Number(adjustQty || 0))
      : Math.max(0, selectedProd.stock - Math.max(0, Number(adjustQty || 0)))
    : 0;

  return (
    <div className="space-y-5">
      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Items', value: stats.totalItems, icon: Boxes, color: 'bg-violet-50 text-[#6D28D9]' },
          { label: 'In Stock', value: stats.inStock, icon: Layers, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
          { label: 'Out of Stock', value: stats.outOfStock, icon: XCircle, color: 'bg-rose-50 text-rose-600' },
          {
            label: 'Total Stock Value',
            value: formatCurrency(stats.totalStockValue, currency),
            icon: IndianRupee,
            color: 'bg-amber-50 text-amber-600',
          },
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
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 truncate">{card.label}</div>
                <div className="text-xl font-bold text-slate-900 tabular-nums truncate">
                  {card.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { id: 'All Items', label: `All Items (${stats.totalItems})` },
          { id: 'In Stock', label: `In Stock (${stats.inStock})` },
          { id: 'Low Stock', label: `Low Stock (${stats.lowStock})` },
          { id: 'Out of Stock', label: `Out of Stock (${stats.outOfStock})` },
          { id: 'Stock Alerts', label: 'Stock Alerts' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-[#6D28D9] text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table Card */}
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
              placeholder="Search by product name or SKU..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
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

          {activeTab === 'All Items' && (
            <select
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value);
                setPage(1);
              }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-700"
            >
              <option value="All">All Stock Status</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              disabled={allProducts.length === 0}
              onClick={() => openAdjustModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Adjust Stock</span>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadProtectedFile(
                  '/api/inventory/export?format=xlsx',
                  'shopadmin-inventory.xlsx'
                ).catch((err) =>
                  showToast(err instanceof Error ? err.message : 'Export failed', 'error')
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
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
                <th className="py-3 px-4 text-center">Available Stock</th>
                <th className="py-3 px-4">Stock Status</th>
                <th className="py-3 px-4 text-right">Stock Value</th>
                <th className="py-3 px-4">Last Updated</th>
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
              ) : !data?.items?.length ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Boxes className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-slate-700">No inventory items</div>
                    <p className="text-xs text-slate-500 mt-1">
                      Products added in the catalog appear here automatically for stock tracking.
                    </p>
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {item.images?.[0] ? (
                          <img
                            src={item.images[0]}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <span className="font-semibold text-slate-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">{item.sku}</td>
                    <td className="py-3 px-4 text-xs text-indigo-700 font-medium">
                      {item.categoryName}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-900 tabular-nums">
                      {item.stock}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={item.stockStatus || 'In Stock'} />
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatCurrency(item.stockValue ?? item.stock * item.price, currency)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                      {formatDateTime(item.updatedAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openAdjustModal(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:text-[#6D28D9] hover:border-violet-200 hover:bg-violet-50"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Adjust</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          limit={limit}
          total={data?.total || 0}
          label="items"
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
      </div>

      {/* Adjust Stock Center Modal */}
      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Adjust Stock"
        subtitle="Update available inventory units in MongoDB"
        size="sm"
      >
        <form onSubmit={handleAdjustStock} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product *</label>
            <select
              value={targetProductId}
              onChange={(e) => setTargetProductId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
            >
              {allProducts.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.sku}) — Current: {p.stock}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Adjustment Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'add', label: 'Add (+)' },
                  { id: 'subtract', label: 'Reduce (-)' },
                  { id: 'set', label: 'Set Exact' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setAdjustMode(m.id)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    adjustMode === m.id
                      ? 'bg-[#6D28D9] border-[#6D28D9] text-white'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity *</label>
            <input
              required
              type="number"
              min={0}
              value={adjustQty}
              onChange={(e) => setAdjustQty(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm tabular-nums"
            />
          </div>

          {selectedProd && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
              <span className="text-slate-600">New Stock Level:</span>
              <span className="font-bold text-[#6D28D9] tabular-nums">
                {selectedProd.stock} → {previewStock} units
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAdjustOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Updating…' : 'Update Stock'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
