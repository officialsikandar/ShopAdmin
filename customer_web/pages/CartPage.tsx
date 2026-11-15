import React, { useState } from 'react';
import {
  ShoppingCart,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Tag,
  Package,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '../lib/format';
import { storeApi } from '../lib/api';
import { useStore } from '../context/StoreContext';

export function CartPage() {
  const {
    config,
    user,
    cart,
    navigate,
    updateCartQty,
    removeFromCart,
    openAuthModal,
    setBuyNowItem,
    showToast,
  } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(
    null
  );
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const currency = config?.general?.currency || 'INR';
  const shippingCfg = config?.shipping;
  const taxCfg = config?.tax;

  const mrpSubtotal = cart.reduce(
    (sum, item) => sum + (item.originalPrice || item.price) * item.quantity,
    0
  );
  const sellingSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const productDiscount = Math.max(0, mrpSubtotal - sellingSubtotal);
  const couponDiscount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const afterCoupon = Math.max(0, sellingSubtotal - couponDiscount);

  const defaultMethodCharge =
    shippingCfg?.methods?.[0]?.charge ?? shippingCfg?.shippingCharge ?? 40;
  const shippingCost =
    cart.length === 0
      ? 0
      : shippingCfg?.freeShipping && afterCoupon >= (shippingCfg?.freeShippingThreshold ?? 999)
      ? 0
      : defaultMethodCharge;

  const taxAmount =
    taxCfg?.enableGst && taxCfg.pricingMode === 'exclusive'
      ? Math.round((afterCoupon * (taxCfg.defaultTaxRate ?? 18)) / 100)
      : 0;

  const totalAmount = afterCoupon + shippingCost + taxAmount;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setApplyingCoupon(true);
    try {
      const res = await storeApi<{ code: string; discountAmount: number }>(
        '/api/store/coupons/validate',
        {
          method: 'POST',
          body: JSON.stringify({ code: couponInput.trim(), subtotal: sellingSubtotal }),
        }
      );
      setAppliedCoupon(res);
      showToast(`Coupon ${res.code} applied!`);
    } catch (err) {
      setAppliedCoupon(null);
      showToast(err instanceof Error ? err.message : 'Invalid coupon code', 'error');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleProceedCheckout = () => {
    setBuyNowItem(null);
    const targetUrl = appliedCoupon
      ? `/checkout?coupon=${encodeURIComponent(appliedCoupon.code)}`
      : '/checkout';
    if (user) {
      navigate(targetUrl);
    } else {
      openAuthModal(() => navigate(targetUrl));
    }
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <button type="button" onClick={() => navigate('/')} className="hover:text-[#6D28D9]">
          Home
        </button>
        <span>/</span>
        <span className="font-medium text-slate-900">Cart</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
        Your Cart ({cart.reduce((s, i) => s + i.quantity, 0)}{' '}
        {cart.reduce((s, i) => s + i.quantity, 0) === 1 ? 'item' : 'items'})
      </h1>

      {cart.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 text-[#6D28D9] flex items-center justify-center mx-auto">
            <ShoppingCart className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Your Cart is Empty</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Browse our store and add products you love to your shopping cart.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="px-6 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cart Items */}
          <div className="lg:col-span-8 space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/product/${encodeURIComponent(item.slug)}`)}
                    className="w-20 h-20 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-7 h-7 text-slate-300" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/product/${encodeURIComponent(item.slug)}`)}
                      className="text-sm sm:text-base font-bold text-slate-900 hover:text-[#6D28D9] text-left truncate block max-w-full"
                    >
                      {item.name}
                    </button>
                    <div className="flex items-baseline gap-2 mt-1 tabular-nums">
                      <span className="text-sm font-bold text-slate-900">
                        {formatCurrency(item.price, currency)}
                      </span>
                      {item.discountPercent > 0 && (
                        <>
                          <span className="text-xs text-slate-400 line-through">
                            {formatCurrency(item.originalPrice, currency)}
                          </span>
                          <span className="text-xs font-semibold text-rose-600">
                            ({item.discountPercent}% OFF)
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quantity & Subtotal */}
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="inline-flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-semibold"
                      >
                        −
                      </button>
                      <span className="w-9 text-center text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={item.stock > 0 && item.quantity >= item.stock}
                        onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 font-semibold"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right min-w-[82px]">
                      <div className="text-sm sm:text-base font-bold text-slate-900 tabular-nums">
                        {formatCurrency(item.price * item.quantity, currency)}
                      </div>
                      <div className="text-[11px] text-slate-400">Subtotal</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#6D28D9] hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Continue Shopping</span>
            </button>
          </div>

          {/* Right Order Summary */}
          <aside className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sticky top-20">
            <h2 className="text-base font-bold text-slate-900">Order Summary</h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(mrpSubtotal, currency)}
                </span>
              </div>
              {(productDiscount > 0 || couponDiscount > 0) && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount</span>
                  <span className="font-semibold tabular-nums">
                    −{formatCurrency(productDiscount + couponDiscount, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span
                  className={`font-semibold tabular-nums ${
                    shippingCost === 0 ? 'text-emerald-600' : 'text-slate-900'
                  }`}
                >
                  {shippingCost === 0 ? 'Free' : formatCurrency(shippingCost, currency)}
                </span>
              </div>
              {taxCfg?.enableGst && (
                <div className="flex justify-between text-slate-600">
                  <span>
                    GST ({taxCfg.defaultTaxRate ?? 18}%{' '}
                    {taxCfg.pricingMode === 'inclusive' ? 'incl.' : ''})
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {taxCfg.pricingMode === 'inclusive'
                      ? 'Included'
                      : formatCurrency(taxAmount, currency)}
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-between text-base font-bold text-slate-900">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(totalAmount, currency)}</span>
              </div>
            </div>

            {/* Coupon */}
            <form onSubmit={handleApplyCoupon} className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter coupon"
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs uppercase"
                  />
                </div>
                <button
                  type="submit"
                  disabled={applyingCoupon || !couponInput.trim()}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {applyingCoupon ? '…' : 'Apply'}
                </button>
              </div>
              {appliedCoupon && (
                <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {appliedCoupon.code} applied (−
                    {formatCurrency(appliedCoupon.discountAmount, currency)})
                  </span>
                  <button
                    type="button"
                    onClick={() => setAppliedCoupon(null)}
                    className="text-slate-500 hover:text-rose-600 font-semibold"
                  >
                    Remove
                  </button>
                </div>
              )}
            </form>

            <button
              type="button"
              onClick={handleProceedCheckout}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold shadow-sm transition-colors"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
