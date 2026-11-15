import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Check,
  XCircle,
  Truck,
} from 'lucide-react';
import type { OrderDoc, OrderStatus } from '../types';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { formatCurrency, formatDateTime } from '../lib/format';
import { apiRequest } from '../lib/api';
import { useToast } from './Toast';

interface OrderDetailsModalProps {
  order: OrderDoc | null;
  currency: string;
  onClose: () => void;
  onUpdated: (updated: OrderDoc) => void;
}

const ORDER_STEPS: OrderStatus[] = ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered'];

export function OrderDetailsModal({
  order,
  currency,
  onClose,
  onUpdated,
}: OrderDetailsModalProps) {
  const { showToast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('Placed');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<'Paid' | 'Pending' | 'Failed'>('Pending');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setSelectedStatus(order.status);
      setSelectedPaymentStatus(order.paymentStatus);
    }
  }, [order]);

  if (!order) return null;

  const currentStepIndex = ORDER_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'Cancelled';

  const handleUpdateStatus = async () => {
    setSaving(true);
    try {
      const updated = await apiRequest<OrderDoc>(`/api/orders/${order._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: selectedStatus,
          paymentStatus: selectedPaymentStatus,
        }),
      });
      showToast(`Order ${updated.orderNumber} updated to ${updated.status}`);
      onUpdated(updated);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update order', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={Boolean(order)} onClose={onClose} title="Order Details" size="xl">
      <div className="p-6 space-y-5">
        {/* Order Top Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-violet-50/70 border border-violet-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white border border-violet-200/70 text-[#6D28D9] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                {order.orderNumber}
              </div>
              <div className="text-xs text-slate-500">
                Placed on {formatDateTime(order.createdAt)}
              </div>
            </div>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Order Items + Summary + Tracking */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShoppingBag className="w-4 h-4 text-[#6D28D9]" />
                <span>Order Items ({order.items?.length || 0})</span>
              </div>
              <div className="divide-y divide-slate-100">
                {order.items?.map((item, idx) => (
                  <div key={`${item.sku}-${idx}`} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-lg object-cover border border-slate-200 bg-slate-50 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                          <ShoppingBag className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{item.name}</div>
                        <div className="text-xs text-slate-500 font-mono">SKU: {item.sku || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="text-xs text-slate-500">
                        {formatCurrency(item.price, currency)} × {item.quantity}
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {formatCurrency(item.price * item.quantity, currency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600 tabular-nums">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-slate-600 tabular-nums">
                  <span>Shipping</span>
                  <span>{formatCurrency(order.shippingCost || 0, currency)}</span>
                </div>
                {order.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600 tabular-nums">
                    <span>Tax / GST</span>
                    <span>{formatCurrency(order.taxAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200/80 tabular-nums">
                  <span>Total Amount</span>
                  <span className="text-[#6D28D9]">{formatCurrency(order.totalAmount, currency)}</span>
                </div>
              </div>
            </div>

            {/* Order Tracking Stepper */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                <Truck className="w-4 h-4 text-[#6D28D9]" />
                <span>Order Tracking</span>
              </div>

              {isCancelled ? (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>This order was cancelled.</span>
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {ORDER_STEPS.map((step, index) => {
                    const completed = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    const timelineMatch = order.timeline?.find((t) => t.status === step);
                    return (
                      <div key={step} className="flex flex-col items-center text-center relative">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 z-10 ${
                            isCurrent
                              ? 'bg-[#6D28D9] border-[#6D28D9] text-white'
                              : completed
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          {completed ? <Check className="w-3.5 h-3.5" /> : index + 1}
                        </div>
                        <span
                          className={`text-[11px] font-semibold mt-1.5 ${
                            completed ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {step}
                        </span>
                        {timelineMatch && (
                          <span className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                            {new Date(timelineMatch.timestamp).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Customer, Address, Payment */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <UserIcon className="w-4 h-4 text-[#6D28D9]" />
                <span>Customer Details</span>
              </div>
              <div className="space-y-1.5 text-sm text-slate-600">
                <div className="font-semibold text-slate-900">{order.customerName}</div>
                <div className="flex items-center gap-2 text-xs">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{order.customerEmail}</span>
                </div>
                {order.customerPhone && (
                  <div className="flex items-center gap-2 text-xs tabular-nums">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{order.customerPhone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <MapPin className="w-4 h-4 text-[#6D28D9]" />
                <span>Shipping Address</span>
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                {order.shippingAddress?.line1 ? (
                  <>
                    <div className="font-medium text-slate-800">{order.customerName}</div>
                    <div>{order.shippingAddress.line1}</div>
                    {order.shippingAddress.line2 && <div>{order.shippingAddress.line2}</div>}
                    <div>
                      {[
                        order.shippingAddress.city,
                        order.shippingAddress.state,
                        order.shippingAddress.postalCode,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                    <div>{order.shippingAddress.country || 'India'}</div>
                  </>
                ) : (
                  <span className="text-slate-400">No shipping address provided</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CreditCard className="w-4 h-4 text-[#6D28D9]" />
                <span>Payment Details</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Payment Method</span>
                <span className="font-semibold text-slate-900">
                  {order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Payment Status</span>
                <select
                  value={selectedPaymentStatus}
                  onChange={(e) => setSelectedPaymentStatus(e.target.value as 'Paid' | 'Pending' | 'Failed')}
                  className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
                >
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>
            </div>

            {/* Update Status Box */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Update Order Status
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
                >
                  {['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'].map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleUpdateStatus}
                  className="px-4 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {saving ? 'Updating…' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
