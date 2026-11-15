import React, { useEffect, useState } from 'react';
import { CheckCircle2, Mail, MapPin, Package, ArrowRight } from 'lucide-react';
import type { CustomerOrder } from '../types';
import { formatCurrency } from '../lib/format';
import { storeApi } from '../lib/api';
import { useStore } from '../context/StoreContext';

export function OrderSuccessPage({ orderId }: { orderId: string }) {
  const { config, navigate } = useStore();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const currency = config?.general?.currency || 'INR';

  useEffect(() => {
    storeApi<{ order: CustomerOrder }>(`/api/store/orders/${encodeURIComponent(orderId)}`)
      .then((res) => setOrder(res.order))
      .catch((err) => console.error('Order load error:', err))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-10">
        <div className="h-80 rounded-3xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
      <div className="bg-white rounded-3xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/50 to-white p-6 sm:p-10 text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          Order Placed Successfully!
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Thank you for your purchase! Your order has been received and is being processed.
        </p>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
          <Mail className="w-4 h-4" />
          <span>Order confirmation email sent successfully.</span>
        </div>

        {order && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-left">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200">
              <div className="text-[11px] text-slate-400">Order ID</div>
              <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                {order.orderNumber}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200">
              <div className="text-[11px] text-slate-400">Total Amount</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 tabular-nums">
                {formatCurrency(order.totalAmount, currency)}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200">
              <div className="text-[11px] text-slate-400">Payment Status</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {order.paymentStatus} ({order.paymentMethod})
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200">
              <div className="text-[11px] text-slate-400">Estimated Delivery</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {order.estimatedDelivery || '3-5 Business Days'}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          {order && (
            <button
              type="button"
              onClick={() => navigate(`/account/orders/${encodeURIComponent(order._id)}`)}
              className="px-6 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold"
            >
              Track Order
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold"
          >
            <span>Continue Shopping</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {order && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <MapPin className="w-4 h-4 text-[#6D28D9]" />
              <span>Shipping Address</span>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">
              <div className="font-semibold text-slate-900">
                {order.shippingAddress.fullName || order.customerName}
              </div>
              <div>
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
              </div>
              <div>
                {order.shippingAddress.city}, {order.shippingAddress.state} —{' '}
                {order.shippingAddress.postalCode}
              </div>
              <div>{order.shippingAddress.country}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5">
            <div className="text-sm font-bold text-slate-900">Ordered Products</div>
            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                    <div className="text-slate-500 tabular-nums">Qty: {item.quantity}</div>
                  </div>
                  <div className="font-bold text-slate-900 tabular-nums">
                    {formatCurrency(item.price * item.quantity, currency)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
