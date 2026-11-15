import React, { useCallback, useEffect, useState } from 'react';
import {
  Users as UsersIcon,
  UserCheck,
  UserPlus,
  ShieldAlert,
  Search,
  Eye,
  ShieldBan,
  ShieldCheck,
  Trash2,
  Plus,
  ShoppingBag,
  MapPin,
  ShoppingCart,
  Activity as ActivityIcon,
  LayoutGrid,
  Pencil,
  Minus,
  Package,
  Clock,
  Upload,
} from 'lucide-react';
import type { OrderDoc, ProductDoc, UserAddress, UserDoc, UserRole } from '../types';
import { apiRequest } from '../lib/api';
import { formatCurrency, formatDateOnly, formatDateTime, getInitials } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { useToast } from '../components/Toast';
import { useGoogleDrive } from '../components/GoogleDriveContext';

interface UsersResponse {
  users: UserDoc[];
  total: number;
  stats: {
    total: number;
    active: number;
    newUsers: number;
    blocked: number;
  };
}

interface UserDetailsResponse {
  user: UserDoc;
  orders: OrderDoc[];
  summary: {
    totalOrders: number;
    totalSpent: number;
    itemsPurchased: number;
  };
}

interface UsersPageProps {
  currency: string;
  openCreateSignal?: number;
  onDataChanged: () => void;
}

type UserModalTab = 'overview' | 'orders' | 'addresses' | 'cart' | 'activity';

export function UsersPage({ currency, openCreateSignal, onDataChanged }: UsersPageProps) {
  const { showToast, confirm } = useToast();
  const { uploadImageToDrive, confirmAndDeleteDriveImage } = useGoogleDrive();
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Add User Modal
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newProfileImage, setNewProfileImage] = useState('');
  const [uploadingNewAvatar, setUploadingNewAvatar] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>('customer');
  const [newStatus, setNewStatus] = useState<'Active' | 'Blocked'>('Active');
  const [creating, setCreating] = useState(false);

  // Large User Details Modal
  const [detailData, setDetailData] = useState<UserDetailsResponse | null>(null);
  const [detailTab, setDetailTab] = useState<UserModalTab>('overview');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editProfileImage, setEditProfileImage] = useState('');
  const [uploadingEditAvatar, setUploadingEditAvatar] = useState(false);
  const [editRole, setEditRole] = useState<UserRole>('customer');
  const [editActive, setEditActive] = useState(true);
  const [savingUser, setSavingUser] = useState(false);

  // Orders sub-tab state
  const [orderSearch, setOrderSearch] = useState('');
  const [inspectOrder, setInspectOrder] = useState<OrderDoc | null>(null);

  // Addresses sub-tab state
  const [addrTypeTab, setAddrTypeTab] = useState<'Shipping' | 'Billing'>('Shipping');
  const [addrFormOpen, setAddrFormOpen] = useState(false);
  const [editingAddr, setEditingAddr] = useState<UserAddress | null>(null);
  const [addrForm, setAddrForm] = useState({
    label: 'Home',
    addressType: 'Shipping' as 'Shipping' | 'Billing',
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    isDefault: false,
  });

  // Cart sub-tab state
  const [catalogProducts, setCatalogProducts] = useState<ProductDoc[]>([]);
  const [addCartProductId, setAddCartProductId] = useState('');

  // Activity sub-tab state
  const [activityCategory, setActivityCategory] = useState('all');
  const [activityDays, setActivityDays] = useState('30');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        user_role: roleFilter,
        status: statusFilter,
        dateFilter,
        page: String(page),
        limit: String(limit),
      });
      const res = await apiRequest<UsersResponse>(`/api/users?${params.toString()}`);
      setData(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, dateFilter, page, limit, showToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (openCreateSignal && openCreateSignal > 0) {
      setAddOpen(true);
    }
  }, [openCreateSignal]);

  const openUserModal = async (userId: string, initialTab: UserModalTab = 'overview') => {
    try {
      const [res, pRes] = await Promise.all([
        apiRequest<UserDetailsResponse>(`/api/users/${userId}`),
        apiRequest<{ products: ProductDoc[] }>('/api/products?limit=100'),
      ]);
      setDetailData(res);
      setDetailTab(initialTab);
      setEditName(res.user.name);
      setEditEmail(res.user.email);
      setEditPhone(res.user.phone || '');
      setEditProfileImage(res.user.profileImage || '');
      setEditRole(res.user.user_role || 'customer');
      setEditActive(res.user.status === 'Active');
      setCatalogProducts(pRes.products || []);
      setAddCartProductId(pRes.products?.[0]?._id || '');
      setAddrFormOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load user details', 'error');
    }
  };

  const refreshSelectedUser = async (userId: string) => {
    const res = await apiRequest<UserDetailsResponse>(`/api/users/${userId}`);
    setDetailData(res);
    setEditName(res.user.name);
    setEditEmail(res.user.email);
    setEditPhone(res.user.phone || '');
    setEditProfileImage(res.user.profileImage || '');
    setEditRole(res.user.user_role || 'customer');
    setEditActive(res.user.status === 'Active');
    loadUsers();
    onDataChanged();
  };

  const handleUploadNewAvatar = async (file: File) => {
    setUploadingNewAvatar(true);
    try {
      const uploaded = await uploadImageToDrive(file, 'profile_image');
      setNewProfileImage(uploaded.url);
      showToast(`Profile photo uploaded to Google Drive (${uploaded.folderPath})`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Profile upload failed', 'error');
    } finally {
      setUploadingNewAvatar(false);
    }
  };

  const handleUploadEditAvatar = async (file: File) => {
    setUploadingEditAvatar(true);
    try {
      const uploaded = await uploadImageToDrive(file, 'profile_image');
      setEditProfileImage(uploaded.url);
      showToast(`Profile photo uploaded to Google Drive (${uploaded.folderPath})`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Profile upload failed', 'error');
    } finally {
      setUploadingEditAvatar(false);
    }
  };

  const handleRemoveEditAvatar = async () => {
    if (!editProfileImage) return;
    const ok = await confirmAndDeleteDriveImage(
      editProfileImage,
      `${detailData?.user.name || 'User'} Profile Photo`
    );
    if (ok) {
      setEditProfileImage('');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      showToast('Name and email are required', 'error');
      return;
    }
    setCreating(true);
    try {
      await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim(),
          profileImage: newProfileImage,
          user_role: newRole,
          status: newStatus,
        }),
      });
      showToast('User added to MongoDB');
      setAddOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewProfileImage('');
      setNewRole('customer');
      setNewStatus('Active');
      loadUsers();
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create user', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleBlock = async (u: UserDoc) => {
    const nextStatus = u.status === 'Active' ? 'Blocked' : 'Active';
    try {
      await apiRequest(`/api/users/${u._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      showToast(`User ${nextStatus === 'Blocked' ? 'blocked' : 'unblocked'}`);
      loadUsers();
      if (detailData?.user._id === u._id) refreshSelectedUser(u._id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update user status', 'error');
    }
  };

  const handleDeleteUser = async (u: UserDoc) => {
    const ok = await confirm({
      title: 'Delete User',
      message: `Are you sure you want to permanently delete "${u.name}"?`,
      confirmLabel: 'Delete User',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiRequest(`/api/users/${u._id}`, { method: 'DELETE' });
      showToast('User deleted');
      if (detailData?.user._id === u._id) setDetailData(null);
      loadUsers();
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete user', 'error');
    }
  };

  const handleSaveUserOverview = async () => {
    if (!detailData) return;
    setSavingUser(true);
    try {
      await apiRequest(`/api/users/${detailData.user._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          phone: editPhone,
          profileImage: editProfileImage,
          user_role: editRole,
          status: editActive ? 'Active' : 'Blocked',
        }),
      });
      showToast('User profile updated');
      await refreshSelectedUser(detailData.user._id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update user', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailData) return;
    try {
      if (editingAddr) {
        await apiRequest(`/api/users/${detailData.user._id}/addresses/${editingAddr._id}`, {
          method: 'PUT',
          body: JSON.stringify(addrForm),
        });
        showToast('Address updated');
      } else {
        await apiRequest(`/api/users/${detailData.user._id}/addresses`, {
          method: 'POST',
          body: JSON.stringify(addrForm),
        });
        showToast('Address added');
      }
      setAddrFormOpen(false);
      setEditingAddr(null);
      await refreshSelectedUser(detailData.user._id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save address', 'error');
    }
  };

  const handleDeleteAddress = async (addrId: string) => {
    if (!detailData) return;
    try {
      await apiRequest(`/api/users/${detailData.user._id}/addresses/${addrId}`, {
        method: 'DELETE',
      });
      showToast('Address deleted');
      await refreshSelectedUser(detailData.user._id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete address', 'error');
    }
  };

  const handleAddToCart = async () => {
    if (!detailData || !addCartProductId) return;
    try {
      await apiRequest(`/api/users/${detailData.user._id}/cart`, {
        method: 'POST',
        body: JSON.stringify({ productId: addCartProductId, quantity: 1 }),
      });
      showToast('Added item to user cart');
      await refreshSelectedUser(detailData.user._id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add to cart', 'error');
    }
  };

  const handleUpdateCartQty = async (productId: string, quantity: number) => {
    if (!detailData) return;
    try {
      await apiRequest(`/api/users/${detailData.user._id}/cart/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      });
      await refreshSelectedUser(detailData.user._id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update cart', 'error');
    }
  };

  const handleRemoveCartItem = async (productId: string) => {
    if (!detailData) return;
    try {
      await apiRequest(`/api/users/${detailData.user._id}/cart/${productId}`, {
        method: 'DELETE',
      });
      await refreshSelectedUser(detailData.user._id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove item', 'error');
    }
  };

  const handleClearCart = async () => {
    if (!detailData) return;
    try {
      await apiRequest(`/api/users/${detailData.user._id}/cart`, { method: 'DELETE' });
      showToast('Cart cleared');
      await refreshSelectedUser(detailData.user._id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clear cart', 'error');
    }
  };

  const handleCreateOrderFromCart = async () => {
    if (!detailData) return;
    try {
      await apiRequest(`/api/users/${detailData.user._id}/cart/checkout`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod: 'COD' }),
      });
      showToast('Order created from cart');
      await refreshSelectedUser(detailData.user._id);
      setDetailTab('orders');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create order', 'error');
    }
  };

  const stats = data?.stats ?? { total: 0, active: 0, newUsers: 0, blocked: 0 };

  return (
    <div className="space-y-5">
      {/* Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.total, icon: UsersIcon, color: 'bg-violet-50 text-[#6D28D9]' },
          { label: 'Active Users', value: stats.active, icon: UserCheck, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'New Users (30d)', value: stats.newUsers, icon: UserPlus, color: 'bg-sky-50 text-sky-600' },
          { label: 'Blocked Users', value: stats.blocked, icon: ShieldAlert, color: 'bg-rose-50 text-rose-600' },
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
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search users by name, email or phone..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-700"
          >
            <option value="All">All Roles</option>
            <option value="super_admin">Super Admin (super_admin)</option>
            <option value="admin">Admin (admin)</option>
            <option value="manager">Manager (manager)</option>
            <option value="customer">Customer (customer)</option>
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
            <option value="Blocked">Blocked</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-700"
          >
            <option value="All">All Dates</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="year">This Year</option>
          </select>

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold shadow-sm whitespace-nowrap shrink-0 ml-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">User Role</th>
                <th className="py-3 px-4 text-center">Orders</th>
                <th className="py-3 px-4 text-right">Total Spent</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={10} className="py-4 px-4">
                      <div className="h-5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : !data?.users?.length ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <UsersIcon className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-slate-700">No users found</div>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Add users manually or import them via Settings → Backup &amp; Data.
                    </p>
                    <button
                      type="button"
                      onClick={() => setAddOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add User</span>
                    </button>
                  </td>
                </tr>
              ) : (
                data.users.map((u, idx) => (
                  <tr
                    key={u._id}
                    onClick={() => openUserModal(u._id)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 text-xs text-slate-500 tabular-nums">
                      {(page - 1) * limit + idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        {u.profileImage ? (
                          <img
                            src={u.profileImage}
                            alt={u.name}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70 text-xs font-bold flex items-center justify-center shrink-0">
                            {getInitials(u.name)}
                          </div>
                        )}
                        <span className="font-semibold text-slate-900">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">{u.email}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {u.phone || '—'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold font-mono ${
                          u.user_role === 'super_admin'
                            ? 'bg-violet-50 text-[#6D28D9]'
                            : u.user_role === 'admin'
                            ? 'bg-indigo-50 text-indigo-700'
                            : u.user_role === 'manager'
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {u.user_role || 'customer'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-900 tabular-nums">
                      {u.ordersCount ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatCurrency(u.totalSpent ?? 0, currency)}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                      {formatDateTime(u.createdAt)}
                    </td>
                    <td
                      className="py-3.5 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openUserModal(u._id)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#6D28D9] hover:bg-violet-50"
                          title="View User Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleBlock(u)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-amber-600 hover:bg-amber-50"
                          title={u.status === 'Active' ? 'Block User' : 'Unblock User'}
                        >
                          {u.status === 'Active' ? (
                            <ShieldBan className="w-4 h-4" />
                          ) : (
                            <ShieldCheck className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete User"
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

        <Pagination
          page={page}
          limit={limit}
          total={data?.total || 0}
          label="users"
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
      </div>

      {/* Add User Center Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Customer"
        subtitle="Create a new customer profile in MongoDB"
        size="md"
      >
        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            {newProfileImage ? (
              <img
                src={newProfileImage}
                alt="Profile preview"
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-violet-50 text-[#6D28D9] font-bold text-sm flex items-center justify-center shrink-0 border border-violet-100">
                {getInitials(newName || 'U')}
              </div>
            )}
            <div>
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-dashed border-violet-300 bg-violet-50/40 text-xs font-semibold text-[#6D28D9] cursor-pointer hover:bg-violet-50">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingNewAvatar ? 'Uploading to Drive…' : 'Upload Profile Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadNewAvatar(f);
                    e.target.value = '';
                  }}
                />
              </label>
              <div className="text-[11px] text-slate-400 mt-1">
                Saves to Google Drive: ecom_store/profile_image
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              placeholder="Priya Sharma"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
            <input
              required
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              placeholder="priya@example.com"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="+91 98765 43211"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">User Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="customer">customer</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as 'Active' | 'Blocked')}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="Active">Active</option>
                <option value="Blocked">Blocked</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold disabled:opacity-50"
            >
              {creating ? 'Adding…' : 'Add User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Large Center User Details Modal (5 Tabs inside the same modal) */}
      <Modal
        open={Boolean(detailData)}
        onClose={() => setDetailData(null)}
        title="User Details"
        size="2xl"
      >
        {detailData && (
          <div className="flex flex-col md:flex-row min-h-[540px]">
            {/* Left Sidebar inside Modal */}
            <div className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 p-5 flex flex-col justify-between bg-slate-50/40">
              <div>
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  {editProfileImage || detailData.user.profileImage ? (
                    <img
                      src={editProfileImage || detailData.user.profileImage}
                      alt={detailData.user.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 font-bold text-base flex items-center justify-center shrink-0">
                      {getInitials(detailData.user.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {detailData.user.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={detailData.user.status} />
                      <span className="px-2 py-0.5 rounded-md bg-violet-50 text-[#6D28D9] text-[11px] font-mono font-semibold">
                        {detailData.user.user_role || 'customer'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Member since {formatDateOnly(detailData.user.createdAt)}
                    </div>
                  </div>
                </div>

                <nav className="mt-4 space-y-1">
                  {(
                    [
                      { id: 'overview', label: 'Overview', icon: LayoutGrid },
                      {
                        id: 'orders',
                        label: `Orders (${detailData.orders.length})`,
                        icon: ShoppingBag,
                      },
                      {
                        id: 'addresses',
                        label: `Addresses (${detailData.user.addresses.length})`,
                        icon: MapPin,
                      },
                      {
                        id: 'cart',
                        label: `Cart (${detailData.user.cart.length})`,
                        icon: ShoppingCart,
                      },
                      { id: 'activity', label: 'Activity', icon: ActivityIcon },
                    ] as const
                  ).map((t) => {
                    const Icon = t.icon;
                    const active = detailTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setDetailTab(t.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-violet-50 text-[#6D28D9]'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="hidden md:block space-y-2 pt-4 mt-4 border-t border-slate-100">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total Orders</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {detailData.summary.totalOrders}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total Spent</span>
                  <span className="font-bold text-[#6D28D9] tabular-nums">
                    {formatCurrency(detailData.summary.totalSpent, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Tab Content inside Modal */}
            <div className="flex-1 p-6 flex flex-col justify-between min-w-0">
              {/* OVERVIEW TAB */}
              {detailTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Orders', value: detailData.summary.totalOrders },
                      {
                        label: 'Total Spent',
                        value: formatCurrency(detailData.summary.totalSpent, currency),
                      },
                      { label: 'Addresses', value: detailData.user.addresses.length },
                      { label: 'Cart Items', value: detailData.user.cart.length },
                    ].map((kpi) => (
                      <div
                        key={kpi.label}
                        className="p-3 rounded-xl border border-slate-200/80 bg-white"
                      >
                        <div className="text-[11px] text-slate-500">{kpi.label}</div>
                        <div className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">
                          {kpi.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200/80 space-y-3">
                      <h4 className="text-sm font-bold text-slate-900">Profile Information</h4>
                      <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                        {editProfileImage ? (
                          <img
                            src={editProfileImage}
                            alt={editName}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 font-bold text-sm flex items-center justify-center shrink-0">
                            {getInitials(editName || detailData.user.name)}
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-violet-300 bg-violet-50/50 text-xs font-semibold text-[#6D28D9] cursor-pointer hover:bg-violet-50">
                              <Upload className="w-3.5 h-3.5" />
                              <span>
                                {uploadingEditAvatar ? 'Uploading…' : 'Upload Photo'}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadEditAvatar(f);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {editProfileImage && (
                              <button
                                type="button"
                                onClick={handleRemoveEditAvatar}
                                className="text-xs font-semibold text-rose-600 hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Google Drive: ecom_store/profile_image
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          Full Name
                        </label>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          Phone
                        </label>
                        <input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          User Role (user_role)
                        </label>
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white font-mono"
                        >
                          <option value="customer">customer</option>
                          <option value="manager">manager</option>
                          <option value="admin">admin</option>
                          <option value="super_admin">super_admin</option>
                        </select>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500 pt-1">
                        <span>Joined At:</span>
                        <span className="font-medium text-slate-800 tabular-nums">
                          {formatDateTime(detailData.user.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 rounded-xl border border-slate-200/80">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-bold text-slate-900">Default Address</h4>
                          <button
                            type="button"
                            onClick={() => setDetailTab('addresses')}
                            className="text-xs font-semibold text-[#6D28D9] hover:underline"
                          >
                            Manage
                          </button>
                        </div>
                        {(() => {
                          const def =
                            detailData.user.addresses.find((a) => a.isDefault) ||
                            detailData.user.addresses[0];
                          if (!def) {
                            return (
                              <p className="text-xs text-slate-400">
                                No saved addresses for this customer.
                              </p>
                            );
                          }
                          return (
                            <div className="text-xs text-slate-600 leading-relaxed">
                              <div className="font-semibold text-slate-900">{def.label}</div>
                              <div>{def.line1}</div>
                              <div>
                                {[def.city, def.state, def.postalCode].filter(Boolean).join(', ')}
                              </div>
                              <div>{def.country}</div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200/80 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-slate-900">Account Status</div>
                          <div className="text-xs text-slate-500">
                            Toggle active or blocked state
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <ToggleSwitch
                            checked={editActive}
                            onChange={setEditActive}
                            label="User Account Status"
                          />
                          <span className="text-xs font-semibold text-slate-700">
                            {editActive ? 'Active' : 'Blocked'}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200/80">
                        <h4 className="text-sm font-bold text-slate-900 mb-2">Recent Activity</h4>
                        {!detailData.user.activities?.length ? (
                          <p className="text-xs text-slate-400">No recent activity recorded.</p>
                        ) : (
                          <div className="space-y-2">
                            {detailData.user.activities.slice(0, 3).map((act) => (
                              <div
                                key={act._id}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-slate-700 truncate">{act.title}</span>
                                <span className="text-slate-400 tabular-nums shrink-0 ml-2">
                                  {formatDateOnly(act.createdAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(detailData.user)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs sm:text-sm font-semibold"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete User</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailData(null)}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingUser}
                        onClick={handleSaveUserOverview}
                        className="px-5 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
                      >
                        {savingUser ? 'Updating…' : 'Update User'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ORDERS TAB */}
              {detailTab === 'orders' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-bold text-slate-900">
                        Orders ({detailData.orders.length})
                      </h4>
                      <p className="text-xs text-slate-500">All orders placed by this user</p>
                    </div>
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Search by Order ID or product..."
                      className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs w-56"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl border border-slate-200/80">
                      <div className="text-[11px] text-slate-500">Total Orders</div>
                      <div className="text-base font-bold text-slate-900 tabular-nums">
                        {detailData.summary.totalOrders}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200/80">
                      <div className="text-[11px] text-slate-500">Total Spent</div>
                      <div className="text-base font-bold text-slate-900 tabular-nums">
                        {formatCurrency(detailData.summary.totalSpent, currency)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200/80">
                      <div className="text-[11px] text-slate-500">Items Purchased</div>
                      <div className="text-base font-bold text-slate-900 tabular-nums">
                        {detailData.summary.itemsPurchased}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200/80">
                      <div className="text-[11px] text-slate-500">Average Order</div>
                      <div className="text-base font-bold text-slate-900 tabular-nums">
                        {formatCurrency(
                          detailData.summary.totalOrders > 0
                            ? Math.round(
                                detailData.summary.totalSpent / detailData.summary.totalOrders
                              )
                            : 0,
                          currency
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                          <th className="py-2.5 px-3">Order ID</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Items</th>
                          <th className="py-2.5 px-3">Payment</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3 text-right">View</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailData.orders
                          .filter(
                            (o) =>
                              !orderSearch.trim() ||
                              o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
                              o.items.some((i) =>
                                i.name.toLowerCase().includes(orderSearch.toLowerCase())
                              )
                          )
                          .map((o) => (
                            <tr key={o._id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                                {o.orderNumber}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 tabular-nums">
                                {formatDateTime(o.createdAt)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 tabular-nums">
                                {o.items.reduce((s, i) => s + i.quantity, 0)} items
                              </td>
                              <td className="py-2.5 px-3">
                                <StatusBadge
                                  status={o.paymentMethod === 'COD' ? 'COD' : o.paymentStatus}
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <StatusBadge status={o.status} />
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900 tabular-nums">
                                {formatCurrency(o.totalAmount, currency)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setInspectOrder(o)}
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#6D28D9]"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        {detailData.orders.length === 0 && (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400">
                              This customer has not placed any orders yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ADDRESSES TAB */}
              {detailTab === 'addresses' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-bold text-slate-900">Addresses</h4>
                      <p className="text-xs text-slate-500">
                        Manage user&apos;s saved shipping and billing addresses
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAddr(null);
                        setAddrForm({
                          label: addrTypeTab === 'Billing' ? 'Billing' : 'Home',
                          addressType: addrTypeTab,
                          fullName: detailData.user.name,
                          phone: detailData.user.phone || '',
                          line1: '',
                          line2: '',
                          city: '',
                          state: '',
                          postalCode: '',
                          country: 'India',
                          isDefault: detailData.user.addresses.length === 0,
                        });
                        setAddrFormOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Address</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {(['Shipping', 'Billing'] as const).map((type) => {
                      const count = detailData.user.addresses.filter(
                        (a) => a.addressType === type
                      ).length;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setAddrTypeTab(type)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            addrTypeTab === type
                              ? 'bg-[#6D28D9] text-white'
                              : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {type} Addresses ({count})
                        </button>
                      );
                    })}
                  </div>

                  {addrFormOpen && (
                    <form
                      onSubmit={handleSaveAddress}
                      className="p-4 rounded-xl border border-violet-200 bg-violet-50/30 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          required
                          placeholder="Label (Home, Office)"
                          value={addrForm.label}
                          onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white"
                        />
                        <select
                          value={addrForm.addressType}
                          onChange={(e) =>
                            setAddrForm({
                              ...addrForm,
                              addressType: e.target.value as 'Shipping' | 'Billing',
                            })
                          }
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white"
                        >
                          <option value="Shipping">Shipping</option>
                          <option value="Billing">Billing</option>
                        </select>
                        <input
                          required
                          placeholder="Full Name"
                          value={addrForm.fullName}
                          onChange={(e) => setAddrForm({ ...addrForm, fullName: e.target.value })}
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          required
                          placeholder="Address Line 1"
                          value={addrForm.line1}
                          onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })}
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white"
                        />
                        <input
                          placeholder="Phone"
                          value={addrForm.phone}
                          onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <input
                          required
                          placeholder="City"
                          value={addrForm.city}
                          onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white"
                        />
                        <input
                          required
                          placeholder="State"
                          value={addrForm.state}
                          onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white"
                        />
                        <input
                          required
                          placeholder="PIN / ZIP"
                          value={addrForm.postalCode}
                          onChange={(e) => setAddrForm({ ...addrForm, postalCode: e.target.value })}
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white"
                        />
                        <input
                          placeholder="Country"
                          value={addrForm.country}
                          onChange={(e) => setAddrForm({ ...addrForm, country: e.target.value })}
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={addrForm.isDefault}
                            onChange={(e) =>
                              setAddrForm({ ...addrForm, isDefault: e.target.checked })
                            }
                          />
                          <span>Set as default {addrForm.addressType} address</span>
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setAddrFormOpen(false)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3.5 py-1.5 rounded-lg bg-[#6D28D9] text-white text-xs font-semibold"
                          >
                            Save Address
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3">
                    {detailData.user.addresses
                      .filter((a) => a.addressType === addrTypeTab)
                      .map((addr) => (
                        <div
                          key={addr._id}
                          className="p-4 rounded-xl border border-slate-200/80 flex flex-wrap items-start justify-between gap-3"
                        >
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-violet-50 text-[#6D28D9] font-semibold">
                                {addr.label}
                              </span>
                              {addr.isDefault && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="text-slate-700 font-medium pt-1">
                              {addr.line1}
                              {addr.line2 ? `, ${addr.line2}` : ''}
                            </div>
                            <div className="text-slate-500">
                              {[addr.city, addr.state, addr.postalCode, addr.country]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                            <div className="text-slate-500">
                              {addr.fullName} {addr.phone ? `· ${addr.phone}` : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAddr(addr);
                                setAddrForm({
                                  label: addr.label,
                                  addressType: addr.addressType,
                                  fullName: addr.fullName,
                                  phone: addr.phone || '',
                                  line1: addr.line1,
                                  line2: addr.line2 || '',
                                  city: addr.city,
                                  state: addr.state,
                                  postalCode: addr.postalCode,
                                  country: addr.country || 'India',
                                  isDefault: addr.isDefault,
                                });
                                setAddrFormOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(addr._id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 text-xs font-medium text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    {detailData.user.addresses.filter((a) => a.addressType === addrTypeTab).length ===
                      0 && (
                      <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        No {addrTypeTab.toLowerCase()} addresses saved yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CART TAB */}
              {detailTab === 'cart' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-base font-bold text-slate-900">
                      User Cart ({detailData.user.cart.length} Items)
                    </h4>
                    {catalogProducts.length > 0 && (
                      <div className="flex items-center gap-2">
                        <select
                          value={addCartProductId}
                          onChange={(e) => setAddCartProductId(e.target.value)}
                          className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs bg-white"
                        >
                          {catalogProducts.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name} ({formatCurrency(p.price, currency)})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleAddToCart}
                          className="px-3 py-1.5 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold"
                        >
                          + Add to Cart
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                          <th className="py-2.5 px-3">Product</th>
                          <th className="py-2.5 px-3 text-right">Price</th>
                          <th className="py-2.5 px-3 text-center">Quantity</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                          <th className="py-2.5 px-3 text-right">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailData.user.cart.map((item) => (
                          <tr key={item.productId}>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    referrerPolicy="no-referrer"
                                    className="w-9 h-9 rounded-lg object-cover border border-slate-200"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center">
                                    <Package className="w-4 h-4" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-semibold text-slate-900">{item.name}</div>
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    SKU: {item.sku}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {formatCurrency(item.price, currency)}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="inline-flex items-center gap-1 border border-slate-200 rounded-lg px-1 py-0.5 mx-auto">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCartQty(item.productId, item.quantity - 1)
                                  }
                                  className="p-1 hover:bg-slate-100 rounded"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="px-2 font-semibold tabular-nums">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCartQty(item.productId, item.quantity + 1)
                                  }
                                  className="p-1 hover:bg-slate-100 rounded"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-900 tabular-nums">
                              {formatCurrency(item.price * item.quantity, currency)}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveCartItem(item.productId)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {detailData.user.cart.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              Cart is currently empty.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {detailData.user.cart.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-violet-50/60 border border-violet-100">
                      <div className="text-sm font-bold text-slate-900 tabular-nums">
                        Total:{' '}
                        <span className="text-[#6D28D9]">
                          {formatCurrency(
                            detailData.user.cart.reduce((s, i) => s + i.price * i.quantity, 0),
                            currency
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleClearCart}
                          className="px-3.5 py-2 rounded-xl border border-rose-200 bg-white text-rose-600 text-xs font-semibold hover:bg-rose-50"
                        >
                          Clear Cart
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateOrderFromCart}
                          className="px-4 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold"
                        >
                          Create Order
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ACTIVITY TAB */}
              {detailTab === 'activity' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-bold text-slate-900">Activity</h4>
                      <p className="text-xs text-slate-500">
                        Complete account activity and event history for this user.
                      </p>
                    </div>
                    <select
                      value={activityDays}
                      onChange={(e) => setActivityDays(e.target.value)}
                      className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs bg-white"
                    >
                      <option value="30">Last 30 Days</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'all', label: 'All Activities' },
                        { id: 'login', label: 'Login / Logout' },
                        { id: 'order', label: 'Orders' },
                        { id: 'cart', label: 'Cart' },
                        { id: 'profile', label: 'Profile' },
                        { id: 'address', label: 'Addresses' },
                      ] as const
                    ).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActivityCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                          activityCategory === cat.id
                            ? 'bg-[#6D28D9] text-white'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {detailData.user.activities
                      .filter((act) => {
                        if (activityCategory === 'login') {
                          return act.type === 'login' || act.type === 'logout';
                        }
                        if (activityCategory !== 'all' && act.type !== activityCategory) {
                          return false;
                        }
                        if (activityDays === '30') {
                          const cutoff = new Date();
                          cutoff.setDate(cutoff.getDate() - 30);
                          return new Date(act.createdAt) >= cutoff;
                        }
                        return true;
                      })
                      .map((act) => (
                        <div
                          key={act._id}
                          className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200/80 bg-white"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-violet-50 text-[#6D28D9] flex items-center justify-center shrink-0">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-900">
                                {act.title}{' '}
                                {act.badge && (
                                  <span className="ml-1.5 font-mono text-[11px] text-[#6D28D9]">
                                    {act.badge}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">{act.description}</div>
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                            {formatDateTime(act.createdAt)}
                          </span>
                        </div>
                      ))}
                    {detailData.user.activities.length === 0 && (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No activity logs recorded yet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <OrderDetailsModal
        order={inspectOrder}
        currency={currency}
        onClose={() => setInspectOrder(null)}
        onUpdated={(updated) => {
          setInspectOrder(updated);
          if (detailData) refreshSelectedUser(detailData.user._id);
        }}
      />
    </div>
  );
}
