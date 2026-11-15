import React, { useCallback, useEffect, useState } from 'react';
import {
  ShoppingBag,
  Truck,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Search,
  Download,
  Eye,
  Trash2,
  Plus,
  RotateCcw,
} from 'lucide-react';
import type { OrderDoc, ProductDoc, UserDoc } from '../types';
import { apiRequest, downloadProtectedFile } from '../lib/api';
import { formatCurrency, formatDateTime, getInitials } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { useToast } from '../components/Toast';

interface OrdersResponse {
  orders: OrderDoc[];
  total: number;
  page: number;
  limit: number;
  stats: {
    total: number;
    Placed: number;
    Confirmed: number;
    Packed: number;
    Shipped: number;
    Delivered: number;
    Cancelled: number;
  };
}

interface OrdersPageProps {
  currency: string;
  onDataChanged: () => void;
}

export function OrdersPage({ currency, onDataChanged }: OrdersPageProps) {
  const { showToast, confirm } = useToast();
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All Orders');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [selectedOrder, setSelectedOrder] = useState<OrderDoc | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Create order form state
  const [usersList, setUsersList] = useState<UserDoc[]>([]);
  const [productsList, setProductsList] = useState<ProductDoc[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingLine1, setShippingLine1] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingPin, setShippingPin] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'Paid' | 'Razorpay'>('COD');
  const [shippingCost, setShippingCost] = useState(0);
  const [orderItems, setOrderItems] = useState<
    Array<{ productId: string; name: string; sku: string; image: string; price: number; quantity: number }>
  >([]);
  const [creating, setCreating] = useState(false);

  const effectiveStatus = activeTab !== 'All Orders' ? activeTab : statusFilter;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        status: effectiveStatus,
        payment: paymentFilter,
        dateFrom,
        dateTo,
        page: String(page),
        limit: String(limit),
      });
      const res = await apiRequest<OrdersResponse>(`/api/orders?${params.toString()}`);
      setData(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, effectiveStatus, paymentFilter, dateFrom, dateTo, page, limit, showToast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openCreateModal = async () => {
    setCreateOpen(true);
    try {
      const [uRes, pRes] = await Promise.all([
        apiRequest<{ users: UserDoc[] }>('/api/users?limit=100'),
        apiRequest<{ products: ProductDoc[] }>('/api/products?limit=100'),
      ]);
      setUsersList(uRes.users || []);
      setProductsList(pRes.products || []);
      if (pRes.products?.length && orderItems.length === 0) {
        const first = pRes.products[0];
        setOrderItems([
          {
            productId: first._id,
            name: first.name,
            sku: first.sku,
            image: first.images?.[0] || '',
            price: first.price,
            quantity: 1,
          },
        ]);
      }
    } catch {
      // ignore
    }
  };

  const handleSelectCustomer = (uid: string) => {
    setSelectedUserId(uid);
    const u = usersList.find((x) => x._id === uid);
    if (u) {
      setCustomerName(u.name);
      setCustomerEmail(u.email);
      setCustomerPhone(u.phone || '');
      const addr = u.addresses?.find((a) => a.isDefault) || u.addresses?.[0];
      if (addr) {
        setShippingLine1(addr.line1);
        setShippingCity(addr.city);
        setShippingState(addr.state);
        setShippingPin(addr.postalCode);
      }
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerEmail.trim() || orderItems.length === 0) {
      showToast('Please enter customer details and at least one item', 'error');
      return;
    }
    setCreating(true);
    try {
      await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedUserId || null,
          customerName,
          customerEmail,
          customerPhone,
          shippingAddress: {
            line1: shippingLine1,
            city: shippingCity,
            state: shippingState,
            postalCode: shippingPin,
            country: 'India',
          },
          items: orderItems,
          shippingCost,
          paymentMethod,
        }),
      });
      showToast('Order created and saved to MongoDB');
      setCreateOpen(false);
      setSelectedUserId('');
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setOrderItems([]);
      loadOrders();
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create order', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteOrder = async (order: OrderDoc) => {
    const ok = await confirm({
      title: 'Delete Order',
      message: `Are you sure you want to permanently delete order ${order.orderNumber}?`,
      confirmLabel: 'Delete Order',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiRequest(`/api/orders/${order._id}`, { method: 'DELETE' });
      showToast(`Order ${order.orderNumber} deleted`);
      loadOrders();
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete order', 'error');
    }
  };

  const stats = data?.stats ?? {
    total: 0,
    Placed: 0,
    Confirmed: 0,
    Packed: 0,
    Shipped: 0,
    Delivered: 0,
    Cancelled: 0,
  };

  const tabs = [
    { label: 'All Orders', count: stats.total },
    { label: 'Placed', count: stats.Placed },
    { label: 'Confirmed', count: stats.Confirmed },
    { label: 'Packed', count: stats.Packed },
    { label: 'Shipped', count: stats.Shipped },
    { label: 'Delivered', count: stats.Delivered },
    { label: 'Cancelled', count: stats.Cancelled },
  ];

  return (
    <div className="space-y-5">
      {/* Statistics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Orders', value: stats.total, icon: ShoppingBag, color: 'bg-violet-50 text-[#6D28D9]' },
          { label: 'Packed', value: stats.Packed, icon: PackageCheck, color: 'bg-amber-50 text-amber-600' },
          { label: 'Shipped', value: stats.Shipped, icon: Truck, color: 'bg-sky-50 text-sky-600' },
          { label: 'Delivered', value: stats.Delivered, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Cancelled', value: stats.Cancelled, icon: XCircle, color: 'bg-rose-50 text-rose-600' },
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

      {/* Status Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.label;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => {
                  setActiveTab(tab.label);
                  setPage(1);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  active
                    ? 'bg-[#6D28D9] text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold shadow-sm whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Order</span>
        </button>
      </div>

      {/* Filters & Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Order ID, Customer, Email..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
            />
          </div>

          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setPage(1);
            }}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
          >
            <option value="All">All Payment</option>
            <option value="Paid">Paid</option>
            <option value="COD">COD</option>
            <option value="Pending">Pending</option>
          </select>

          {activeTab === 'All Orders' && (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
            >
              <option value="All">All Status</option>
              {['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-700"
              aria-label="Start date"
            />
            <span className="text-slate-400 text-xs">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-700"
              aria-label="End date"
            />
          </div>

          {(search || paymentFilter !== 'All' || statusFilter !== 'All' || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPaymentFilter('All');
                setStatusFilter('All');
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              downloadProtectedFile('/api/orders/export?format=xlsx', 'shopadmin-orders.xlsx').catch(
                (err) => showToast(err instanceof Error ? err.message : 'Export failed', 'error')
              )
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ml-auto"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Order Date</th>
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
              ) : !data?.orders?.length ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <ShoppingBag className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-slate-700">No orders found</div>
                    <p className="text-xs text-slate-500 mt-1">
                      Create an order or adjust your filters to view stored MongoDB orders.
                    </p>
                  </td>
                </tr>
              ) : (
                data.orders.map((order) => {
                  const itemsCount = order.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
                  return (
                    <tr
                      key={order._id}
                      onClick={() => setSelectedOrder(order)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900 font-mono tabular-nums whitespace-nowrap">
                        {order.orderNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-violet-50 text-[#6D28D9] text-xs font-bold flex items-center justify-center shrink-0">
                            {getInitials(order.customerName)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 truncate max-w-[160px]">
                              {order.customerName}
                            </div>
                            <div className="text-xs text-slate-500 truncate max-w-[160px]">
                              {order.customerEmail}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatCurrency(order.totalAmount, currency)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={order.paymentMethod === 'COD' ? 'COD' : order.paymentStatus} />
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                        {formatDateTime(order.createdAt)}
                      </td>
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#6D28D9] hover:border-violet-200 hover:bg-violet-50"
                            title="View order details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(order)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
                            title="Delete order"
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
          label="orders"
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
      </div>

      {/* Centered Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        currency={currency}
        onClose={() => setSelectedOrder(null)}
        onUpdated={(updated) => {
          setSelectedOrder(updated);
          loadOrders();
          onDataChanged();
        }}
      />

      {/* Centered Create Order Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Order"
        subtitle="Persist a real customer order directly to MongoDB"
        size="lg"
      >
        <form onSubmit={handleCreateOrder} className="p-6 space-y-5">
          {usersList.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Link Existing Customer (Optional)
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="">Enter customer manually…</option>
                {usersList.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Name *
              </label>
              <input
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="Priya Sharma"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Email *
              </label>
              <input
                required
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="priya@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Address Line 1</label>
              <input
                value={shippingLine1}
                onChange={(e) => setShippingLine1(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="123, Sector 5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <input
                value={shippingCity}
                onChange={(e) => setShippingCity(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="Jaipur"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">PIN / ZIP</label>
              <input
                value={shippingPin}
                onChange={(e) => setShippingPin(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="302020"
              />
            </div>
          </div>

          {/* Items Builder */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Order Items *</span>
              <button
                type="button"
                onClick={() =>
                  setOrderItems((prev) => [
                    ...prev,
                    { productId: '', name: '', sku: '', image: '', price: 0, quantity: 1 },
                  ])
                }
                className="text-xs font-semibold text-[#6D28D9] hover:underline"
              >
                + Add Item Row
              </button>
            </div>

            {orderItems.length === 0 && (
              <p className="text-xs text-slate-500">Click "+ Add Item Row" to add products to this order.</p>
            )}

            {orderItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <div className="sm:col-span-5">
                  {productsList.length > 0 ? (
                    <select
                      value={item.productId}
                      onChange={(e) => {
                        const prod = productsList.find((p) => p._id === e.target.value);
                        setOrderItems((prev) =>
                          prev.map((row, rIdx) =>
                            rIdx === idx && prod
                              ? {
                                  productId: prod._id,
                                  name: prod.name,
                                  sku: prod.sku,
                                  image: prod.images?.[0] || '',
                                  price: prod.price,
                                  quantity: row.quantity,
                                }
                              : row
                          )
                        );
                      }}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    >
                      <option value="">Select product…</option>
                      {productsList.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      placeholder="Product name"
                      value={item.name}
                      onChange={(e) =>
                        setOrderItems((prev) =>
                          prev.map((row, rIdx) => (rIdx === idx ? { ...row, name: e.target.value } : row))
                        )
                      }
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                    />
                  )}
                </div>
                <div className="sm:col-span-3">
                  <input
                    type="number"
                    min={0}
                    placeholder="Price"
                    value={item.price}
                    onChange={(e) =>
                      setOrderItems((prev) =>
                        prev.map((row, rIdx) =>
                          rIdx === idx ? { ...row, price: Number(e.target.value) } : row
                        )
                      )
                    }
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) =>
                      setOrderItems((prev) =>
                        prev.map((row, rIdx) =>
                          rIdx === idx ? { ...row, quantity: Number(e.target.value) } : row
                        )
                      )
                    }
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div className="sm:col-span-2 text-right">
                  <button
                    type="button"
                    onClick={() => setOrderItems((prev) => prev.filter((_, rIdx) => rIdx !== idx))}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'COD' | 'Paid' | 'Razorpay')}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="Paid">Paid (Online)</option>
                <option value="Razorpay">Razorpay</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Shipping Cost</label>
              <input
                type="number"
                min={0}
                value={shippingCost}
                onChange={(e) => setShippingCost(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create Order'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
