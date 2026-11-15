import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Truck,
  CreditCard,
  Banknote,
  ShieldCheck,
  Package,
  X,
} from 'lucide-react';
import type { CustomerAddress, CustomerOrder, CustomerUser } from '../types';
import { formatCurrency } from '../lib/format';
import { storeApi } from '../lib/api';
import { useStore } from '../context/StoreContext';

export function CheckoutPage() {
  const {
    config,
    user,
    setUser,
    cart,
    buyNowItem,
    setBuyNowItem,
    searchParams,
    navigate,
    openAuthModal,
    refreshBootstrap,
    showToast,
  } = useStore();

  const isBuyNow = searchParams.get('mode') === 'buynow' && Boolean(buyNowItem);
  const initialCoupon = searchParams.get('coupon') || '';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'Razorpay'>('COD');
  const [couponCode, setCouponCode] = useState(initialCoupon);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [placingOrder, setPlacingOrder] = useState(false);

  // Razorpay Interactive Payment Modal
  const [razorpayModalOpen, setRazorpayModalOpen] = useState(false);
  const [razorpayProcessing, setRazorpayProcessing] = useState(false);

  // Add/Edit Address Modal
  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [editingAddr, setEditingAddr] = useState<CustomerAddress | null>(null);
  const [addrLabel, setAddrLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [addrFullName, setAddrFullName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrApartment, setAddrApartment] = useState('');
  const [addrArea, setAddrArea] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPostalCode, setAddrPostalCode] = useState('');
  const [addrCountry, setAddrCountry] = useState('India');
  const [addrDefault, setAddrDefault] = useState(true);
  const [savingAddr, setSavingAddr] = useState(false);

  const currency = config?.general?.currency || 'INR';
  const shippingCfg = config?.shipping;
  const taxCfg = config?.tax;

  const checkoutItems = useMemo(() => {
    if (isBuyNow && buyNowItem) {
      const p = buyNowItem.product;
      return [
        {
          productId: p._id,
          name: p.name,
          image: p.images?.[0] || '',
          originalPrice: p.price,
          price: p.netPrice,
          quantity: buyNowItem.quantity,
        },
      ];
    }
    return cart.map((c) => ({
      productId: c.productId,
      name: c.name,
      image: c.image,
      originalPrice: c.originalPrice || c.price,
      price: c.price,
      quantity: c.quantity,
    }));
  }, [buyNowItem, cart, isBuyNow]);

  useEffect(() => {
    if (user?.addresses?.length && !selectedAddressId) {
      const def = user.addresses.find((a) => a.isDefault) || user.addresses[0];
      if (def) setSelectedAddressId(def._id);
    }
  }, [selectedAddressId, user]);

  useEffect(() => {
    if (shippingCfg?.methods?.length && !selectedMethodId) {
      setSelectedMethodId(shippingCfg.methods[0]._id);
    }
  }, [selectedMethodId, shippingCfg]);

  useEffect(() => {
    if (initialCoupon && checkoutItems.length > 0) {
      const sub = checkoutItems.reduce((s, i) => s + i.price * i.quantity, 0);
      storeApi<{ code: string; discountAmount: number }>('/api/store/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code: initialCoupon, subtotal: sub }),
      })
        .then((res) => {
          setCouponCode(res.code);
          setCouponDiscount(res.discountAmount);
        })
        .catch(() => {
          setCouponDiscount(0);
        });
    }
  }, [checkoutItems, initialCoupon]);

  if (!user) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center max-w-md mx-auto space-y-4">
          <ShieldCheck className="w-10 h-10 text-[#6D28D9] mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">Sign In to Complete Checkout</h1>
          <p className="text-sm text-slate-500">
            Verify your email with a quick 6-digit OTP to access your addresses and place your
            order.
          </p>
          <button
            type="button"
            onClick={() => openAuthModal()}
            className="w-full py-2.5 px-5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold"
          >
            Login with Email OTP
          </button>
        </div>
      </div>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center max-w-md mx-auto space-y-4">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">No Items to Checkout</h1>
          <p className="text-sm text-slate-500">Add products to your cart before checking out.</p>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="px-6 py-2.5 rounded-xl bg-[#6D28D9] text-white text-sm font-semibold"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  const mrpSubtotal = checkoutItems.reduce(
    (s, i) => s + (i.originalPrice || i.price) * i.quantity,
    0
  );
  const sellingSubtotal = checkoutItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const productDiscount = Math.max(0, mrpSubtotal - sellingSubtotal);
  const afterCoupon = Math.max(0, sellingSubtotal - couponDiscount);

  const selectedMethod =
    shippingCfg?.methods?.find((m) => m._id === selectedMethodId) || shippingCfg?.methods?.[0];
  const baseShippingCharge = selectedMethod?.charge ?? shippingCfg?.shippingCharge ?? 40;
  const shippingCost =
    shippingCfg?.freeShipping && afterCoupon >= (shippingCfg?.freeShippingThreshold ?? 999)
      ? 0
      : baseShippingCharge;

  const taxAmount =
    taxCfg?.enableGst && taxCfg.pricingMode === 'exclusive'
      ? Math.round((afterCoupon * (taxCfg.defaultTaxRate ?? 18)) / 100)
      : 0;

  const totalAmount = afterCoupon + shippingCost + taxAmount;

  const selectedAddress =
    user.addresses?.find((a) => a._id === selectedAddressId) || user.addresses?.[0] || null;

  const openAddAddressModal = () => {
    setEditingAddr(null);
    setAddrLabel('Home');
    setAddrFullName(user.name || '');
    setAddrPhone(user.phone || '');
    setAddrLine1('');
    setAddrApartment('');
    setAddrArea('');
    setAddrCity('');
    setAddrState('');
    setAddrPostalCode('');
    setAddrCountry('India');
    setAddrDefault(!user.addresses?.length);
    setAddrModalOpen(true);
  };

  const openEditAddressModal = (addr: CustomerAddress) => {
    setEditingAddr(addr);
    setAddrLabel((addr.label as 'Home' | 'Work' | 'Other') || 'Home');
    setAddrFullName(addr.fullName);
    setAddrPhone(addr.phone);
    setAddrLine1(addr.line1);
    const parts = (addr.line2 || '').split(',').map((s) => s.trim());
    setAddrApartment(parts[0] || '');
    setAddrArea(parts.slice(1).join(', ') || '');
    setAddrCity(addr.city);
    setAddrState(addr.state);
    setAddrPostalCode(addr.postalCode);
    setAddrCountry(addr.country || 'India');
    setAddrDefault(addr.isDefault);
    setAddrModalOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAddr(true);
    try {
      const combinedLine2 = [addrApartment.trim(), addrArea.trim()].filter(Boolean).join(', ');
      const body = {
        label: addrLabel,
        fullName: addrFullName.trim(),
        phone: addrPhone.trim(),
        line1: addrLine1.trim(),
        line2: combinedLine2,
        city: addrCity.trim(),
        state: addrState.trim(),
        postalCode: addrPostalCode.trim(),
        country: addrCountry.trim() || 'India',
        isDefault: addrDefault,
      };
      const res = editingAddr
        ? await storeApi<{ user: CustomerUser }>(
            `/api/store/addresses/${encodeURIComponent(editingAddr._id)}`,
            { method: 'PUT', body: JSON.stringify(body) }
          )
        : await storeApi<{ user: CustomerUser }>('/api/store/addresses', {
            method: 'POST',
            body: JSON.stringify(body),
          });
      setUser(res.user);
      const latestAddr =
        res.user.addresses.find((a) => a.isDefault) ||
        res.user.addresses[res.user.addresses.length - 1];
      if (latestAddr) setSelectedAddressId(latestAddr._id);
      setAddrModalOpen(false);
      showToast('Address saved to your account');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save address', 'error');
    } finally {
      setSavingAddr(false);
    }
  };

  const handleDeleteAddress = async (addrId: string) => {
    try {
      const res = await storeApi<{ user: CustomerUser }>(
        `/api/store/addresses/${encodeURIComponent(addrId)}`,
        { method: 'DELETE' }
      );
      setUser(res.user);
      if (selectedAddressId === addrId) {
        setSelectedAddressId(res.user.addresses[0]?._id || '');
      }
      showToast('Address deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete address', 'error');
    }
  };

  const executeOrderCreation = async (rzpPaymentId = '') => {
    if (!selectedAddress) {
      showToast('Please add and select a delivery address.', 'error');
      setStep(1);
      return;
    }
    setPlacingOrder(true);
    try {
      const res = await storeApi<{
        order: CustomerOrder;
        emailSent: boolean;
        emailMessage: string;
      }>('/api/store/checkout', {
        method: 'POST',
        body: JSON.stringify({
          shippingAddress: selectedAddress,
          shippingMethodId: selectedMethod?._id,
          paymentMethod,
          couponCode,
          buyNowItem:
            isBuyNow && buyNowItem
              ? { productId: buyNowItem.product._id, quantity: buyNowItem.quantity }
              : undefined,
          razorpayPaymentId: rzpPaymentId,
        }),
      });
      if (isBuyNow) setBuyNowItem(null);
      await refreshBootstrap();
      navigate(`/order-success/${encodeURIComponent(res.order._id)}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to place order', 'error');
    } finally {
      setPlacingOrder(false);
      setRazorpayProcessing(false);
      setRazorpayModalOpen(false);
    }
  };

  const handlePlaceOrderClick = () => {
    if (!selectedAddress) {
      showToast('Please select a delivery address first.', 'error');
      setStep(1);
      return;
    }
    if (paymentMethod === 'Razorpay') {
      setRazorpayModalOpen(true);
    } else {
      executeOrderCreation('');
    }
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <button type="button" onClick={() => navigate('/')} className="hover:text-[#6D28D9]">
          Home
        </button>
        <span>/</span>
        <span className="font-medium text-slate-900">Checkout</span>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 sm:gap-6 bg-white rounded-2xl border border-slate-200/80 p-4">
        {[
          { num: 1 as const, label: 'Address' },
          { num: 2 as const, label: 'Shipping' },
          { num: 3 as const, label: 'Payment' },
        ].map((s, idx) => (
          <React.Fragment key={s.num}>
            <button
              type="button"
              onClick={() => {
                if (s.num < step || selectedAddress) setStep(s.num);
              }}
              className="flex items-center gap-2"
            >
              <div
                className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center tabular-nums ${
                  step > s.num
                    ? 'bg-emerald-500 text-white'
                    : step === s.num
                    ? 'bg-[#6D28D9] text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span
                className={`text-xs sm:text-sm font-semibold ${
                  step === s.num ? 'text-slate-900' : 'text-slate-500'
                }`}
              >
                {s.label}
              </span>
            </button>
            {idx < 2 && <div className="w-8 sm:w-16 h-px bg-slate-200" />}
          </React.Fragment>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Main Step Content */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-5">
          {step === 1 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Select Delivery Address</h2>
                  <p className="text-xs text-slate-500">
                    Choose a saved address or add a new shipping location
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddAddressModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-violet-200 bg-violet-50/60 text-xs font-semibold text-[#6D28D9] hover:bg-violet-100"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Address</span>
                </button>
              </div>

              {!user.addresses?.length ? (
                <div className="p-8 rounded-2xl border border-dashed border-slate-200 text-center space-y-3">
                  <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
                  <div className="text-sm font-semibold text-slate-700">
                    No saved addresses yet
                  </div>
                  <button
                    type="button"
                    onClick={openAddAddressModal}
                    className="px-4 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold"
                  >
                    Add Delivery Address
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {user.addresses.map((addr) => {
                    const active = selectedAddress?._id === addr._id;
                    return (
                      <div
                        key={addr._id}
                        onClick={() => setSelectedAddressId(addr._id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-colors flex items-start justify-between gap-4 ${
                          active
                            ? 'border-[#6D28D9] bg-violet-50/35'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            checked={active}
                            onChange={() => setSelectedAddressId(addr._id)}
                            className="mt-1 text-[#6D28D9]"
                          />
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{addr.label}</span>
                              {addr.isDefault && (
                                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="font-semibold text-slate-800">{addr.fullName}</div>
                            <div className="text-xs text-slate-600">
                              {addr.line1}
                              {addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} —{' '}
                              {addr.postalCode}, {addr.country}
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums">{addr.phone}</div>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => openEditAddressModal(addr)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(addr._id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  disabled={!selectedAddress}
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold disabled:opacity-50"
                >
                  Continue to Shipping
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Select Shipping Method</h2>
                <p className="text-xs text-slate-500">
                  Free shipping applies automatically on orders above{' '}
                  {formatCurrency(shippingCfg?.freeShippingThreshold ?? 999, currency)}
                </p>
              </div>

              <div className="space-y-3">
                {(shippingCfg?.methods?.length
                  ? shippingCfg.methods
                  : [
                      {
                        _id: 'standard',
                        name: 'Standard Delivery',
                        description: 'Regular reliable courier delivery',
                        deliveryTime: '3-5 Business Days',
                        charge: shippingCfg?.shippingCharge ?? 40,
                        status: 'Active',
                      },
                    ]
                ).map((m) => {
                  const active = (selectedMethod?._id || 'standard') === m._id;
                  const effectiveCharge =
                    shippingCfg?.freeShipping &&
                    afterCoupon >= (shippingCfg?.freeShippingThreshold ?? 999)
                      ? 0
                      : m.charge;
                  return (
                    <label
                      key={m._id}
                      onClick={() => setSelectedMethodId(m._id)}
                      className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between gap-4 ${
                        active ? 'border-[#6D28D9] bg-violet-50/35' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          checked={active}
                          onChange={() => setSelectedMethodId(m._id)}
                          className="mt-1 text-[#6D28D9]"
                        />
                        <div>
                          <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Truck className="w-4 h-4 text-[#6D28D9]" />
                            <span>{m.name}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{m.deliveryTime}</div>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          effectiveCharge === 0 ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {effectiveCharge === 0
                          ? 'Free'
                          : formatCurrency(effectiveCharge, currency)}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-6 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold"
                >
                  Continue to Payment
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Payment Method</h2>
                <p className="text-xs text-slate-500">
                  Choose your preferred payment option to confirm your order
                </p>
              </div>

              <div className="space-y-3">
                <label
                  onClick={() => setPaymentMethod('Razorpay')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between gap-4 ${
                    paymentMethod === 'Razorpay'
                      ? 'border-[#6D28D9] bg-violet-50/35'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={paymentMethod === 'Razorpay'}
                      onChange={() => setPaymentMethod('Razorpay')}
                      className="mt-1 text-[#6D28D9]"
                    />
                    <div>
                      <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#6D28D9]" />
                        <span>Razorpay / Online Payment</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Pay securely via UPI, Card, or NetBanking
                      </div>
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setPaymentMethod('COD')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between gap-4 ${
                    paymentMethod === 'COD'
                      ? 'border-[#6D28D9] bg-violet-50/35'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                      className="mt-1 text-[#6D28D9]"
                    />
                    <div>
                      <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-emerald-600" />
                        <span>Cash on Delivery (COD)</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Pay in cash or UPI when your order arrives
                      </div>
                    </div>
                  </div>
                </label>
              </div>

              {selectedAddress && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                  <div className="font-semibold text-slate-700">Delivering to:</div>
                  <div className="font-bold text-slate-900">
                    {selectedAddress.fullName} ({selectedAddress.label})
                  </div>
                  <div className="text-slate-600">
                    {selectedAddress.line1}, {selectedAddress.city}, {selectedAddress.state} —{' '}
                    {selectedAddress.postalCode}
                  </div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={placingOrder}
                  onClick={handlePlaceOrderClick}
                  className="px-6 py-3 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                >
                  {placingOrder
                    ? 'Placing Order…'
                    : paymentMethod === 'Razorpay'
                    ? `Pay ${formatCurrency(totalAmount, currency)}`
                    : `Place Order (${formatCurrency(totalAmount, currency)})`}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Persistent Order Summary */}
        <aside className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sticky top-20">
          <h2 className="text-base font-bold text-slate-900">Order Summary</h2>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {checkoutItems.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 text-xs">
                <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
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
                <div className="font-bold text-slate-900 tabular-nums shrink-0">
                  {formatCurrency(item.price * item.quantity, currency)}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2 text-sm">
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
                <span>GST ({taxCfg.defaultTaxRate ?? 18}%)</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {taxCfg.pricingMode === 'inclusive'
                    ? 'Included'
                    : formatCurrency(taxAmount, currency)}
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-100 flex justify-between text-base font-bold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(totalAmount, currency)}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Add / Edit Address Centered Modal */}
      {addrModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
          onClick={() => setAddrModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingAddr ? 'Edit Address' : 'Add New Address'}
              </h3>
              <button
                type="button"
                onClick={() => setAddrModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-3.5 pt-4">
              <div className="grid grid-cols-3 gap-2">
                {(['Home', 'Work', 'Other'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAddrLabel(t)}
                    className={`py-2 rounded-xl text-xs font-semibold border ${
                      addrLabel === t
                        ? 'border-[#6D28D9] bg-violet-50 text-[#6D28D9]'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    required
                    value={addrFullName}
                    onChange={(e) => setAddrFullName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    required
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address / Street *
                </label>
                <input
                  required
                  value={addrLine1}
                  onChange={(e) => setAddrLine1(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Apartment / Building
                  </label>
                  <input
                    value={addrApartment}
                    onChange={(e) => setAddrApartment(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Area / Landmark
                  </label>
                  <input
                    value={addrArea}
                    onChange={(e) => setAddrArea(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                  <input
                    required
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State *</label>
                  <input
                    required
                    value={addrState}
                    onChange={(e) => setAddrState(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    PIN Code *
                  </label>
                  <input
                    required
                    value={addrPostalCode}
                    onChange={(e) => setAddrPostalCode(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Country *
                  </label>
                  <input
                    required
                    value={addrCountry}
                    onChange={(e) => setAddrCountry(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 pt-1">
                <input
                  type="checkbox"
                  checked={addrDefault}
                  onChange={(e) => setAddrDefault(e.target.checked)}
                  className="rounded border-slate-300 text-[#6D28D9]"
                />
                <span>Use as default address</span>
              </label>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddrModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAddr}
                  className="px-5 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold disabled:opacity-50"
                >
                  {savingAddr ? 'Saving…' : 'Save Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Razorpay Checkout Interface */}
      {razorpayModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-4"
          onClick={() => !razorpayProcessing && setRazorpayModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0D1121] text-white p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">
                  {config?.general?.storeName || 'ShopAdmin'} · Razorpay{' '}
                  {config?.razorpay?.environment || 'Test'}
                </div>
                <div className="text-xl font-extrabold mt-0.5 tabular-nums">
                  {formatCurrency(totalAmount, currency)}
                </div>
              </div>
              <button
                type="button"
                disabled={razorpayProcessing}
                onClick={() => setRazorpayModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-xs text-slate-600">
                Paying as <strong className="text-slate-900">{user.email}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-slate-900">UPI / Card / NetBanking</div>
                <div className="text-slate-500">
                  {config?.razorpay?.keyId
                    ? `Gateway Key: ${config.razorpay.keyId}`
                    : 'Razorpay Checkout'}
                </div>
              </div>

              <button
                type="button"
                disabled={razorpayProcessing}
                onClick={() => {
                  setRazorpayProcessing(true);
                  const txId = `pay_${Date.now()}`;
                  executeOrderCreation(txId);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold disabled:opacity-50"
              >
                {razorpayProcessing
                  ? 'Confirming Payment…'
                  : `Confirm & Pay ${formatCurrency(totalAmount, currency)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
