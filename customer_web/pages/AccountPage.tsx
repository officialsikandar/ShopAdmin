import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutGrid,
  ShoppingBag,
  MapPin,
  Heart,
  ShoppingCart,
  Settings,
  LogOut,
  Package,
  Plus,
  Pencil,
  Trash2,
  Check,
  ShieldCheck,
  X,
  ArrowLeft,
} from 'lucide-react';
import type { CustomerAddress, CustomerOrder, CustomerUser } from '../types';
import { formatCurrency, formatDateTime } from '../lib/format';
import { storeApi } from '../lib/api';
import { useStore } from '../context/StoreContext';

type AccountTab = 'overview' | 'orders' | 'addresses' | 'settings';

const TRACKING_STEPS = ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered'];

export function AccountPage({
  initialTab = 'overview',
  orderId,
}: {
  initialTab?: AccountTab;
  orderId?: string;
}) {
  const {
    config,
    user,
    setUser,
    cartCount,
    wishlistCount,
    navigate,
    openAuthModal,
    logout,
    showToast,
  } = useStore();

  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);

  // Profile form
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Address modal
  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [editingAddr, setEditingAddr] = useState<CustomerAddress | null>(null);
  const [addrLabel, setAddrLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [addrFullName, setAddrFullName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrLine2, setAddrLine2] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPostalCode, setAddrPostalCode] = useState('');
  const [addrCountry, setAddrCountry] = useState('India');
  const [addrDefault, setAddrDefault] = useState(false);

  const currency = config?.general?.currency || 'INR';

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfilePhone(user.phone || '');
      setProfileImage(user.profileImage || '');
    }
  }, [user]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoadingOrders(true);
    try {
      const res = await storeApi<{ orders: CustomerOrder[] }>('/api/store/orders');
      setOrders(res.orders || []);
      if (orderId) {
        const found = (res.orders || []).find(
          (o) => o._id === orderId || o.orderNumber === orderId
        );
        if (found) {
          setSelectedOrder(found);
        } else {
          const single = await storeApi<{ order: CustomerOrder }>(
            `/api/store/orders/${encodeURIComponent(orderId)}`
          );
          setSelectedOrder(single.order);
        }
      } else {
        setSelectedOrder(null);
      }
    } catch (err) {
      console.error('Load orders error:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, [orderId, user]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  if (!user) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center max-w-md mx-auto space-y-4">
          <ShieldCheck className="w-10 h-10 text-[#6D28D9] mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">Sign In to Your Account</h1>
          <p className="text-sm text-slate-500">
            Access your orders, saved addresses, wishlist, and account profile using email OTP.
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await storeApi<{ user: CustomerUser }>('/api/store/account/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: profileName.trim(),
          phone: profilePhone.trim(),
          profileImage: profileImage.trim(),
        }),
      });
      setUser(res.user);
      showToast('Profile saved successfully');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const openAddrModal = (addr?: CustomerAddress) => {
    if (addr) {
      setEditingAddr(addr);
      setAddrLabel((addr.label as 'Home' | 'Work' | 'Other') || 'Home');
      setAddrFullName(addr.fullName);
      setAddrPhone(addr.phone);
      setAddrLine1(addr.line1);
      setAddrLine2(addr.line2 || '');
      setAddrCity(addr.city);
      setAddrState(addr.state);
      setAddrPostalCode(addr.postalCode);
      setAddrCountry(addr.country || 'India');
      setAddrDefault(addr.isDefault);
    } else {
      setEditingAddr(null);
      setAddrLabel('Home');
      setAddrFullName(user.name || '');
      setAddrPhone(user.phone || '');
      setAddrLine1('');
      setAddrLine2('');
      setAddrCity('');
      setAddrState('');
      setAddrPostalCode('');
      setAddrCountry('India');
      setAddrDefault(!user.addresses?.length);
    }
    setAddrModalOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        label: addrLabel,
        fullName: addrFullName.trim(),
        phone: addrPhone.trim(),
        line1: addrLine1.trim(),
        line2: addrLine2.trim(),
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
      setAddrModalOpen(false);
      showToast('Address updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save address', 'error');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      const res = await storeApi<{ user: CustomerUser }>(
        `/api/store/addresses/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      setUser(res.user);
      showToast('Address removed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete address', 'error');
    }
  };

  const handleSetDefaultAddress = async (addr: CustomerAddress) => {
    try {
      const res = await storeApi<{ user: CustomerUser }>(
        `/api/store/addresses/${encodeURIComponent(addr._id)}`,
        { method: 'PUT', body: JSON.stringify({ isDefault: true }) }
      );
      setUser(res.user);
      showToast('Default address updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update default', 'error');
    }
  };

  const statusBadgeColor = (status: string) => {
    if (status === 'Delivered') return 'bg-emerald-50 text-emerald-700';
    if (status === 'Cancelled') return 'bg-rose-50 text-rose-700';
    if (status === 'Shipped' || status === 'Packed') return 'bg-violet-50 text-[#6D28D9]';
    return 'bg-amber-50 text-amber-700';
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <button type="button" onClick={() => navigate('/')} className="hover:text-[#6D28D9]">
          Home
        </button>
        <span>/</span>
        <span className="font-medium text-slate-900">My Account</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Account Sidebar */}
        <aside className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-4 space-y-1 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="px-3 py-3 border-b border-slate-100 mb-2 flex items-center gap-3">
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-violet-100 text-[#6D28D9] font-bold text-sm flex items-center justify-center">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">{user.name}</div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
            </div>
          </div>

          {[
            {
              id: 'overview' as const,
              label: 'Overview',
              icon: LayoutGrid,
              onClick: () => {
                setSelectedOrder(null);
                setActiveTab('overview');
                navigate('/account');
              },
            },
            {
              id: 'orders' as const,
              label: 'My Orders',
              icon: ShoppingBag,
              onClick: () => {
                setSelectedOrder(null);
                setActiveTab('orders');
                navigate('/account/orders');
              },
            },
            {
              id: 'addresses' as const,
              label: 'Addresses',
              icon: MapPin,
              onClick: () => {
                setSelectedOrder(null);
                setActiveTab('addresses');
              },
            },
            {
              id: 'wishlist' as const,
              label: `Wishlist (${wishlistCount})`,
              icon: Heart,
              onClick: () => navigate('/wishlist'),
            },
            {
              id: 'cart' as const,
              label: `Cart (${cartCount})`,
              icon: ShoppingCart,
              onClick: () => navigate('/cart'),
            },
            {
              id: 'settings' as const,
              label: 'Account Settings',
              icon: Settings,
              onClick: () => {
                setSelectedOrder(null);
                setActiveTab('settings');
              },
            },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-violet-50 text-[#6D28D9]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-2 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Account Area */}
        <div className="lg:col-span-9 space-y-6">
          {/* Selected Order Details */}
          {selectedOrder ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrder(null);
                      navigate('/account/orders');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#6D28D9] hover:underline"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Orders</span>
                  </button>
                  <h2 className="text-xl font-bold text-slate-900 font-mono">
                    {selectedOrder.orderNumber}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Placed on {formatDateTime(selectedOrder.createdAt)} ·{' '}
                    {selectedOrder.paymentMethod} ({selectedOrder.paymentStatus})
                  </p>
                </div>

                <span
                  className={`px-3 py-1 rounded-xl text-xs font-bold ${statusBadgeColor(
                    selectedOrder.status
                  )}`}
                >
                  {selectedOrder.status}
                </span>
              </div>

              {/* Horizontal Tracking Timeline */}
              {selectedOrder.status === 'Cancelled' ? (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  This order was cancelled.
                </div>
              ) : (
                <div className="py-2 overflow-x-auto">
                  <div className="flex items-center justify-between min-w-[480px] px-2">
                    {TRACKING_STEPS.map((st, idx) => {
                      const currentIdx = TRACKING_STEPS.indexOf(selectedOrder.status);
                      const completed = idx <= currentIdx;
                      return (
                        <React.Fragment key={st}>
                          <div className="flex flex-col items-center gap-1.5">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                completed
                                  ? 'bg-[#6D28D9] text-white'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {completed ? <Check className="w-4 h-4" /> : idx + 1}
                            </div>
                            <span
                              className={`text-xs font-semibold ${
                                completed ? 'text-slate-900' : 'text-slate-400'
                              }`}
                            >
                              {st}
                            </span>
                          </div>
                          {idx < TRACKING_STEPS.length - 1 && (
                            <div
                              className={`flex-1 h-1 mx-2 rounded-full ${
                                idx < currentIdx ? 'bg-[#6D28D9]' : 'bg-slate-100'
                              }`}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Items & Price Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-7 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">Products</h3>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center gap-3 text-xs">
                        <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
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
                          <div className="text-slate-500 tabular-nums">
                            {formatCurrency(item.price, currency)} × {item.quantity}
                          </div>
                        </div>
                        <div className="font-bold text-slate-900 tabular-nums">
                          {formatCurrency(item.price * item.quantity, currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-5 space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                    <div className="font-bold text-slate-900 mb-1">Shipping Address</div>
                    <div className="font-semibold text-slate-800">
                      {selectedOrder.shippingAddress.fullName || selectedOrder.customerName}
                    </div>
                    <div className="text-slate-600">
                      {selectedOrder.shippingAddress.line1}
                      {selectedOrder.shippingAddress.line2
                        ? `, ${selectedOrder.shippingAddress.line2}`
                        : ''}
                    </div>
                    <div className="text-slate-600">
                      {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} —{' '}
                      {selectedOrder.shippingAddress.postalCode}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(selectedOrder.subtotal, currency)}
                      </span>
                    </div>
                    {(selectedOrder.discountAmount || 0) > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Discount</span>
                        <span className="font-semibold tabular-nums">
                          −{formatCurrency(selectedOrder.discountAmount || 0, currency)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Shipping</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {selectedOrder.shippingCost === 0
                          ? 'Free'
                          : formatCurrency(selectedOrder.shippingCost, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>GST</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {selectedOrder.taxAmount === 0
                          ? 'Included'
                          : formatCurrency(selectedOrder.taxAmount, currency)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-bold text-slate-900">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {formatCurrency(selectedOrder.totalAmount, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Hello, {user.name}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Manage your account, orders, saved addresses, and preferences.
                    </p>

                    <div className="grid grid-cols-3 gap-4 mt-5">
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                        <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
                          {orders.length}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">Total Orders</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                        <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
                          {wishlistCount}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">Wishlist Items</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                        <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
                          {user.addresses?.length || 0}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">Saved Addresses</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold text-slate-900">Recent Orders</h2>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('orders');
                          navigate('/account/orders');
                        }}
                        className="text-xs font-semibold text-[#6D28D9] hover:underline"
                      >
                        View All
                      </button>
                    </div>

                    {loadingOrders ? (
                      <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
                    ) : orders.length === 0 ? (
                      <p className="text-sm text-slate-500 py-4 text-center">
                        You haven&apos;t placed any orders yet.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {orders.slice(0, 3).map((ord) => (
                          <div
                            key={ord._id}
                            className="py-3 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div>
                              <div className="text-sm font-bold font-mono text-slate-900">
                                {ord.orderNumber}
                              </div>
                              <div className="text-xs text-slate-500 tabular-nums">
                                {formatDateTime(ord.createdAt)} ·{' '}
                                {formatCurrency(ord.totalAmount, currency)}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold ${statusBadgeColor(
                                  ord.status
                                )}`}
                              >
                                {ord.status}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(`/account/orders/${encodeURIComponent(ord._id)}`)
                                }
                                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                View Order
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Orders History */}
              {activeTab === 'orders' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <h1 className="text-xl font-bold text-slate-900">My Orders</h1>

                  {loadingOrders ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="h-20 bg-slate-50 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="py-10 text-center space-y-3">
                      <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
                      <div className="text-sm font-bold text-slate-800">No orders placed yet</div>
                      <button
                        type="button"
                        onClick={() => navigate('/shop')}
                        className="px-5 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold"
                      >
                        Start Shopping
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {orders.map((ord) => (
                        <div
                          key={ord._id}
                          className="p-4 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-sm font-bold text-slate-900">
                                {ord.orderNumber}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold ${statusBadgeColor(
                                  ord.status
                                )}`}
                              >
                                {ord.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatDateTime(ord.createdAt)} · {ord.items.length}{' '}
                              {ord.items.length === 1 ? 'item' : 'items'} · {ord.paymentMethod}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm font-bold text-slate-900 tabular-nums">
                                {formatCurrency(ord.totalAmount, currency)}
                              </div>
                              <div className="text-[11px] text-slate-400">{ord.paymentStatus}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/account/orders/${encodeURIComponent(ord._id)}`)
                              }
                              className="px-4 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold"
                            >
                              View Order
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Addresses */}
              {activeTab === 'addresses' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold text-slate-900">Saved Addresses</h1>
                    <button
                      type="button"
                      onClick={() => openAddrModal()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Address</span>
                    </button>
                  </div>

                  {!user.addresses?.length ? (
                    <div className="py-10 text-center space-y-2">
                      <MapPin className="w-9 h-9 text-slate-300 mx-auto" />
                      <p className="text-sm text-slate-500">No saved delivery addresses.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {user.addresses.map((addr) => (
                        <div
                          key={addr._id}
                          className="p-4 rounded-2xl border border-slate-200 flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-slate-900">{addr.label}</span>
                              {addr.isDefault && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="font-semibold text-slate-800">{addr.fullName}</div>
                            <div className="text-slate-600">
                              {addr.line1}
                              {addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} —{' '}
                              {addr.postalCode}, {addr.country}
                            </div>
                            <div className="text-slate-500">{addr.phone}</div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                            {!addr.isDefault ? (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultAddress(addr)}
                                className="font-semibold text-[#6D28D9] hover:underline"
                              >
                                Set as Default
                              </button>
                            ) : (
                              <span className="text-slate-400">Primary delivery address</span>
                            )}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openAddrModal(addr)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAddress(addr._id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Profile & Account Settings */}
              {activeTab === 'settings' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <div>
                    <h1 className="text-xl font-bold text-slate-900">Account Profile</h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Update your personal details synced directly with MongoDB
                    </p>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Full Name
                      </label>
                      <input
                        required
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Verified Email Address
                      </label>
                      <input
                        disabled
                        value={user.email}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 text-slate-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Profile Image URL
                      </label>
                      <input
                        value={profileImage}
                        onChange={(e) => setProfileImage(e.target.value)}
                        placeholder="https://..."
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-6 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold disabled:opacity-50"
                    >
                      {savingProfile ? 'Saving…' : 'Save Changes'}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Address Modal */}
      {addrModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
          onClick={() => setAddrModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6"
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
            <form onSubmit={handleSaveAddress} className="space-y-3 pt-4">
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
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  value={addrFullName}
                  onChange={(e) => setAddrFullName(e.target.value)}
                  placeholder="Full Name *"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
                <input
                  required
                  value={addrPhone}
                  onChange={(e) => setAddrPhone(e.target.value)}
                  placeholder="Phone *"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <input
                required
                value={addrLine1}
                onChange={(e) => setAddrLine1(e.target.value)}
                placeholder="Street Address *"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
              <input
                value={addrLine2}
                onChange={(e) => setAddrLine2(e.target.value)}
                placeholder="Apartment / Area"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  placeholder="City *"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
                <input
                  required
                  value={addrState}
                  onChange={(e) => setAddrState(e.target.value)}
                  placeholder="State *"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  value={addrPostalCode}
                  onChange={(e) => setAddrPostalCode(e.target.value)}
                  placeholder="PIN Code *"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
                <input
                  required
                  value={addrCountry}
                  onChange={(e) => setAddrCountry(e.target.value)}
                  placeholder="Country *"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={addrDefault}
                  onChange={(e) => setAddrDefault(e.target.checked)}
                />
                <span>Use as default address</span>
              </label>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddrModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
