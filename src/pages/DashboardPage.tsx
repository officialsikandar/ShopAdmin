import React, { useCallback, useEffect, useState } from 'react';
import {
  ShoppingBag,
  IndianRupee,
  Users,
  Package,
  Clock,
  AlertTriangle,
  Plus,
  FolderPlus,
  Truck,
  UserPlus,
  Eye,
  ArrowRight,
} from 'lucide-react';
import type { NavSection, OrderDoc } from '../types';
import { apiRequest } from '../lib/api';
import { formatCurrency, formatDateTime, getInitials } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { OrderDetailsModal } from '../components/OrderDetailsModal';

interface DashboardData {
  summary: {
    totalOrders: number;
    totalSales: number;
    totalUsers: number;
    totalProducts: number;
    pendingOrders: number;
    lowStockProducts: number;
  };
  chartData: Array<{ label: string; sales: number; orders: number }>;
  statusBreakdown: Array<{ status: string; count: number; percentage: number }>;
  recentOrders: OrderDoc[];
  topProducts: Array<{
    id: string;
    name: string;
    image: string;
    category: string;
    unitsSold: number;
    revenue: number;
  }>;
  lowStockList: Array<{
    _id: string;
    name: string;
    sku: string;
    stock: number;
    images: string[];
  }>;
}

interface DashboardPageProps {
  currency: string;
  onNavigate: (section: NavSection) => void;
  onQuickAction: (action: 'add-product' | 'add-category' | 'add-user') => void;
  refreshTick: number;
  onDataChanged: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  Delivered: '#10B981',
  Shipped: '#3B82F6',
  Packed: '#F59E0B',
  Confirmed: '#7C3AED',
  Placed: '#94A3B8',
  Cancelled: '#EF4444',
};

export function DashboardPage({
  currency,
  onNavigate,
  onQuickAction,
  refreshTick,
  onDataChanged,
}: DashboardPageProps) {
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [chartMode, setChartMode] = useState<'sales' | 'orders'>('sales');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderDoc | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<DashboardData>(`/api/dashboard?range=${range}`);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, refreshTick]);

  const summary = data?.summary ?? {
    totalOrders: 0,
    totalSales: 0,
    totalUsers: 0,
    totalProducts: 0,
    pendingOrders: 0,
    lowStockProducts: 0,
  };

  const chartData = data?.chartData ?? [];
  const maxVal = Math.max(
    1,
    ...chartData.map((d) => (chartMode === 'sales' ? d.sales : d.orders))
  );

  // Build SVG path for Sales Overview
  const chartW = 640;
  const chartH = 210;
  const padX = 24;
  const padY = 18;
  const plotW = chartW - padX * 2;
  const plotH = chartH - padY * 2;

  const points = chartData.map((pt, i) => {
    const val = chartMode === 'sales' ? pt.sales : pt.orders;
    const x =
      chartData.length <= 1 ? padX + plotW / 2 : padX + (i / (chartData.length - 1)) * plotW;
    const y = padY + plotH - (val / maxVal) * plotH;
    return { x, y, val, label: pt.label };
  });

  const linePath =
    points.length > 0
      ? points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : '';

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padY + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padY + plotH).toFixed(1)} Z`
      : '';

  // Donut segments
  const totalStatusCount = summary.totalOrders;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let runningOffset = 0;

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards (6 required cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          {
            label: 'Total Orders',
            value: summary.totalOrders.toLocaleString(),
            icon: ShoppingBag,
            iconClass: 'bg-violet-50 text-[#6D28D9]',
          },
          {
            label: 'Total Sales',
            value: formatCurrency(summary.totalSales, currency),
            icon: IndianRupee,
            iconClass: 'bg-amber-50 text-amber-600',
          },
          {
            label: 'Total Users',
            value: summary.totalUsers.toLocaleString(),
            icon: Users,
            iconClass: 'bg-indigo-50 text-indigo-600',
          },
          {
            label: 'Total Products',
            value: summary.totalProducts.toLocaleString(),
            icon: Package,
            iconClass: 'bg-emerald-50 text-emerald-600',
          },
          {
            label: 'Pending Orders',
            value: summary.pendingOrders.toLocaleString(),
            icon: Clock,
            iconClass: 'bg-sky-50 text-sky-600',
          },
          {
            label: 'Low Stock Products',
            value: summary.lowStockProducts.toLocaleString(),
            icon: AlertTriangle,
            iconClass: 'bg-rose-50 text-rose-600',
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex items-start gap-3.5"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.iconClass}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 truncate">{card.label}</div>
                <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums truncate">
                  {loading ? '—' : card.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row: Sales Overview + Orders by Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sales Overview */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Sales Overview</h2>
              <p className="text-xs text-slate-500">Live revenue and order volume from MongoDB</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100">
                {(
                  [
                    { id: 'today', label: 'Today' },
                    { id: 'week', label: 'This Week' },
                    { id: 'month', label: 'This Month' },
                    { id: 'year', label: 'This Year' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRange(item.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      range === item.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100">
                <button
                  type="button"
                  onClick={() => setChartMode('sales')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    chartMode === 'sales'
                      ? 'bg-[#6D28D9] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sales
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('orders')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    chartMode === 'orders'
                      ? 'bg-[#6D28D9] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Orders
                </button>
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-h-[220px]">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-56 overflow-visible">
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = padY + plotH - t * plotH;
                const val = Math.round(maxVal * t);
                return (
                  <g key={t}>
                    <line
                      x1={padX}
                      x2={chartW - padX}
                      y1={y}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padX - 4}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {chartMode === 'sales' ? formatCurrency(val, currency) : val}
                    </text>
                  </g>
                );
              })}

              {areaPath && <path d={areaPath} fill="url(#salesGrad)" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#6D28D9"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {points.map((p, idx) => (
                <g key={p.label}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoverIdx === idx ? 5 : 3.5}
                    fill="#FFFFFF"
                    stroke="#6D28D9"
                    strokeWidth="2"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={14}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoverIdx(idx)}
                    onMouseLeave={() => setHoverIdx(null)}
                  />
                  <text
                    x={p.x}
                    y={chartH - 2}
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px]"
                  >
                    {p.label}
                  </text>
                </g>
              ))}
            </svg>

            {hoverIdx !== null && points[hoverIdx] && (
              <div className="mt-1 text-xs text-slate-600 text-right tabular-nums">
                <span className="font-semibold text-slate-900">{points[hoverIdx].label}:</span>{' '}
                {chartMode === 'sales'
                  ? formatCurrency(points[hoverIdx].val, currency)
                  : `${points[hoverIdx].val} orders`}
              </div>
            )}
          </div>
        </div>

        {/* Orders by Status Donut */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between">
          <h2 className="text-base font-bold text-slate-900">Orders by Status</h2>

          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-5 my-4">
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 140 140" className="w-36 h-36 -rotate-90">
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth="16"
                />
                {totalStatusCount > 0 &&
                  data?.statusBreakdown.map((item) => {
                    if (item.count === 0) return null;
                    const dash = (item.count / totalStatusCount) * circumference;
                    const strokeDashoffset = -runningOffset;
                    runningOffset += dash;
                    return (
                      <circle
                        key={item.status}
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="none"
                        stroke={STATUS_COLORS[item.status] || '#6D28D9'}
                        strokeWidth="16"
                        strokeDasharray={`${dash} ${circumference - dash}`}
                        strokeDashoffset={strokeDashoffset}
                      />
                    );
                  })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-slate-900 tabular-nums">
                  {summary.totalOrders}
                </span>
                <span className="text-xs text-slate-500">Orders</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2">
              {(data?.statusBreakdown || []).map((item) => (
                <div key={item.status} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[item.status] || '#94A3B8' }}
                    />
                    <span>{item.status}</span>
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {item.count}{' '}
                    <span className="text-slate-400 font-normal">({item.percentage}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Orders + Top Products + Quick Actions + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Orders */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Recent Orders</h2>
              <button
                type="button"
                onClick={() => onNavigate('orders')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#6D28D9] hover:text-[#5B21B6]"
              >
                <span>View All Orders</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {!data?.recentOrders?.length ? (
              <div className="p-8 text-center">
                <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">No orders in MongoDB yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Create your first order from the Orders page or convert a customer cart.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 bg-slate-50/60">
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {data.recentOrders.map((order) => (
                      <tr key={order._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 font-mono tabular-nums whitespace-nowrap">
                          {order.orderNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-violet-50 text-[#6D28D9] text-xs font-bold flex items-center justify-center shrink-0">
                              {getInitials(order.customerName)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 truncate max-w-[140px]">
                                {order.customerName}
                              </div>
                              <div className="text-xs text-slate-500 truncate max-w-[140px]">
                                {order.customerEmail}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(order.totalAmount, currency)}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge
                            status={order.paymentMethod === 'COD' ? 'COD' : order.paymentStatus}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                          {formatDateTime(order.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-[#6D28D9] hover:border-violet-200 hover:bg-violet-50 transition-colors"
                            title="View order details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Top Products</h2>
              <button
                type="button"
                onClick={() => onNavigate('products')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#6D28D9] hover:text-[#5B21B6]"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {!data?.topProducts?.length ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Top selling products will appear automatically once orders are placed.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 bg-slate-50/60">
                      <th className="py-2.5 px-4">Product</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4 text-right">Units Sold</th>
                      <th className="py-2.5 px-4 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {data.topProducts.map((tp) => (
                      <tr key={tp.id}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {tp.image ? (
                              <img
                                src={tp.image}
                                alt={tp.name}
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                            <span className="font-medium text-slate-900">{tp.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{tp.category}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums">
                          {tp.unitsSold}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-[#6D28D9] tabular-nums">
                          {formatCurrency(tp.revenue, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quick Actions + Low Stock Alert */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <h2 className="text-base font-bold text-slate-900 mb-3.5">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onQuickAction('add-product')}
                className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 transition-colors text-center"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-[#6D28D9] flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-800">Add Product</span>
              </button>

              <button
                type="button"
                onClick={() => onQuickAction('add-category')}
                className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 transition-colors text-center"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-[#6D28D9] flex items-center justify-center">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-800">Add Category</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('orders')}
                className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 transition-colors text-center"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-[#6D28D9] flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-800">Update Order</span>
              </button>

              <button
                type="button"
                onClick={() => onQuickAction('add-user')}
                className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 transition-colors text-center"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-[#6D28D9] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-800">Add User</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-base font-bold text-slate-900">Low Stock Products</h2>
              <button
                type="button"
                onClick={() => onNavigate('inventory')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#6D28D9] hover:text-[#5B21B6]"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {!data?.lowStockList?.length ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No low stock alerts right now.
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.lowStockList.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/70"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
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
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">SKU: {item.sku}</div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-rose-600 tabular-nums whitespace-nowrap shrink-0">
                      {item.stock === 0 ? 'Out of stock' : `Only ${item.stock} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <OrderDetailsModal
        order={selectedOrder}
        currency={currency}
        onClose={() => setSelectedOrder(null)}
        onUpdated={(updated) => {
          setSelectedOrder(updated);
          loadDashboard();
          onDataChanged();
        }}
      />
    </div>
  );
}
