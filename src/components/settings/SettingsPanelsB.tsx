import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Pencil,
  ShieldCheck,
  Trash2,
  Plug,
  Mail,
  CreditCard,
  MessageSquare,
  Lock,
  Eye,
  EyeOff,
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  X,
  Save,
  HardDrive,
  FolderOpen,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import type { AdminUserDoc, PermissionFlags, StoreSettingsDoc } from '../../types';
import { apiRequest, downloadProtectedFile } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { StatusBadge } from '../StatusBadge';
import { ToggleSwitch } from '../ToggleSwitch';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { GoogleSignInButton, useGoogleDrive } from '../GoogleDriveContext';

interface PanelProps {
  settings: StoreSettingsDoc;
  onUpdated: (next: StoreSettingsDoc) => void;
}

const PERMISSION_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'orders', label: 'Orders' },
  { key: 'products', label: 'Products' },
  { key: 'categories', label: 'Categories' },
  { key: 'users', label: 'Users' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'settings', label: 'Settings' },
] as const;

/* ==================== 5. USERS & PERMISSIONS ==================== */
export function AdminPermissionsPanel() {
  const { showToast, confirm } = useToast();
  const [admins, setAdmins] = useState<AdminUserDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUserDoc | null>(null);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Admin' as AdminUserDoc['role'],
    status: 'Active' as AdminUserDoc['status'],
  });

  const [permModalAdmin, setPermModalAdmin] = useState<AdminUserDoc | null>(null);
  const [permState, setPermState] = useState<AdminUserDoc['permissions'] | null>(null);

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ admins: AdminUserDoc[] }>('/api/admins');
      setAdmins(res.admins || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load admin users', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAdmin) {
        await apiRequest(`/api/admins/${editingAdmin._id}`, {
          method: 'PUT',
          body: JSON.stringify(adminForm),
        });
        showToast('Admin updated');
      } else {
        await apiRequest('/api/admins', {
          method: 'POST',
          body: JSON.stringify(adminForm),
        });
        showToast('Admin added to MongoDB');
      }
      setAdminModalOpen(false);
      loadAdmins();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save admin', 'error');
    }
  };

  const handleToggleStatus = async (admin: AdminUserDoc) => {
    const nextStatus = admin.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await apiRequest(`/api/admins/${admin._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      showToast(`Admin ${nextStatus === 'Active' ? 'activated' : 'deactivated'}`);
      loadAdmins();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    }
  };

  const handleDeleteAdmin = async (admin: AdminUserDoc) => {
    const ok = await confirm({
      title: 'Delete Admin User',
      message: `Remove "${admin.name}" from admin access?`,
      confirmLabel: 'Remove Admin',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiRequest(`/api/admins/${admin._id}`, { method: 'DELETE' });
      showToast('Admin removed');
      loadAdmins();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove admin', 'error');
    }
  };

  const handleSavePermissions = async () => {
    if (!permModalAdmin || !permState) return;
    try {
      await apiRequest(`/api/admins/${permModalAdmin._id}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: permState }),
      });
      showToast('Permissions saved to MongoDB');
      setPermModalAdmin(null);
      loadAdmins();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update permissions', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-[#6D28D9] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Users &amp; Permissions</h3>
            <p className="text-xs text-slate-500">
              Manage admin accounts, roles, and module access permissions.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingAdmin(null);
            setAdminForm({
              name: '',
              email: '',
              password: '',
              role: 'Admin',
              status: 'Active',
            });
            setAdminModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold shadow-sm whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Admin</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4">
                    <div className="h-5 bg-slate-100 rounded animate-pulse" />
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin._id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-900">{admin.name}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{admin.email}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-violet-50 text-[#6D28D9] text-xs font-semibold">
                          {admin.role}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          ({admin.user_role || (admin.role === 'Super Admin' ? 'super_admin' : admin.role === 'Manager' ? 'manager' : 'admin')})
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={admin.status} />
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateTime(admin.lastLogin)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPermModalAdmin(admin);
                            setPermState(JSON.parse(JSON.stringify(admin.permissions)));
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:text-[#6D28D9] hover:bg-violet-50"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Permissions</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAdmin(admin);
                            setAdminForm({
                              name: admin.name,
                              email: admin.email,
                              password: '',
                              role: admin.role,
                              status: admin.status,
                            });
                            setAdminModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#6D28D9]"
                          title="Edit Admin"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(admin)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {admin.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAdmin(admin)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600"
                          title="Delete Admin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Admin Center Modal */}
      <Modal
        open={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        title={editingAdmin ? 'Edit Admin' : 'Add Admin'}
        size="sm"
      >
        <form onSubmit={handleSaveAdmin} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              required
              value={adminForm.name}
              onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
            <input
              required
              type="email"
              value={adminForm.email}
              onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {editingAdmin ? 'New Password (leave blank to keep)' : 'Password *'}
            </label>
            <input
              required={!editingAdmin}
              type="password"
              value={adminForm.password}
              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
              <select
                value={adminForm.role}
                onChange={(e) =>
                  setAdminForm({ ...adminForm, role: e.target.value as AdminUserDoc['role'] })
                }
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="Super Admin">Super Admin</option>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={adminForm.status}
                onChange={(e) =>
                  setAdminForm({ ...adminForm, status: e.target.value as AdminUserDoc['status'] })
                }
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAdminModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#6D28D9] text-white text-sm font-semibold"
            >
              {editingAdmin ? 'Update Admin' : 'Create Admin'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage Permissions Center Modal */}
      <Modal
        open={Boolean(permModalAdmin && permState)}
        onClose={() => setPermModalAdmin(null)}
        title={`Manage Permissions — ${permModalAdmin?.name || ''}`}
        subtitle={`Role: ${permModalAdmin?.role || ''}`}
        size="lg"
      >
        {permState && (
          <div className="p-6 space-y-5">
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Module</th>
                    <th className="py-2.5 px-4 text-center">View</th>
                    <th className="py-2.5 px-4 text-center">Create</th>
                    <th className="py-2.5 px-4 text-center">Edit</th>
                    <th className="py-2.5 px-4 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {PERMISSION_MODULES.map((mod) => {
                    const flags = permState[mod.key];
                    const toggleFlag = (f: keyof PermissionFlags) => {
                      setPermState({
                        ...permState,
                        [mod.key]: { ...flags, [f]: !flags[f] },
                      });
                    };
                    return (
                      <tr key={mod.key}>
                        <td className="py-3 px-4 font-semibold text-slate-900">{mod.label}</td>
                        {(['view', 'create', 'edit', 'delete'] as const).map((flag) => (
                          <td key={flag} className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={flags[flag]}
                              onChange={() => toggleFlag(flag)}
                              className="w-4 h-4 accent-[#6D28D9] rounded cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPermModalAdmin(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="px-5 py-2 rounded-xl bg-[#6D28D9] text-white text-sm font-semibold"
              >
                Save Permissions
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ==================== 6. INTEGRATIONS (GOOGLE DRIVE, SMTP, RAZORPAY, SMS) ==================== */
export function IntegrationsSettingsPanel({ settings, onUpdated }: PanelProps) {
  const { showToast } = useToast();
  const {
    connected,
    hasActiveToken,
    connecting,
    googleUser,
    driveFolders,
    connectDrive,
    disconnectDrive,
    fetchFolderSummary,
  } = useGoogleDrive();
  const [form, setForm] = useState(settings.integrations);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showRzpSecret, setShowRzpSecret] = useState(false);
  const [showSmsSecret, setShowSmsSecret] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);

  const handleSyncFolders = useCallback(async () => {
    if (!hasActiveToken) {
      await connectDrive();
      return;
    }
    setLoadingFolders(true);
    try {
      await fetchFolderSummary();
      showToast('Google Drive folders synced');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load Drive folders', 'error');
    } finally {
      setLoadingFolders(false);
    }
  }, [connectDrive, fetchFolderSummary, hasActiveToken, showToast]);

  const handleSave = async (label: string) => {
    setSaving(true);
    try {
      const updated = await apiRequest<StoreSettingsDoc>('/api/settings/integrations', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      onUpdated(updated);
      showToast(`${label} settings saved to MongoDB`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save integration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (type: 'smtp' | 'razorpay' | 'sms') => {
    setTesting(type);
    try {
      const endpoint =
        type === 'smtp'
          ? '/api/settings/integrations/test-smtp'
          : type === 'razorpay'
          ? '/api/settings/integrations/test-razorpay'
          : '/api/settings/integrations/test-sms';
      const payload = type === 'smtp' ? form.smtp : type === 'razorpay' ? form.razorpay : form.sms;
      const res = await apiRequest<{ message: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast(res.message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Connection test failed', 'error');
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-violet-50 text-[#6D28D9] flex items-center justify-center">
          <Plug className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Integrations</h3>
          <p className="text-xs text-slate-500">
            Configure Google Drive media storage, SMTP for emails, Razorpay for payments, and SMS.
          </p>
        </div>
      </div>

      {/* 0. Google Drive Media Storage */}
      <div className="rounded-xl border border-slate-200/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <HardDrive className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Google Drive Storage (<span className="font-mono text-[#6D28D9]">ecom_store</span>)
              </h4>
              <p className="text-xs text-slate-500">
                All uploaded photos save directly into organized subfolders in your Google Drive
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <StatusBadge
              status={connected ? (hasActiveToken ? 'Connected' : 'Pending') : 'Inactive'}
            />
            {!connected ? (
              <GoogleSignInButton
                onClick={connectDrive}
                disabled={connecting}
                label={connecting ? 'Connecting…' : 'Sign in with Google'}
              />
            ) : (
              <div className="flex items-center gap-2">
                {!hasActiveToken && (
                  <button
                    type="button"
                    disabled={connecting}
                    onClick={connectDrive}
                    className="px-3 py-1.5 rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] text-xs font-semibold"
                  >
                    {connecting ? 'Resuming…' : 'Resume Session'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={disconnectDrive}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {connected && (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200/70">
              <span>
                Connected account: <strong className="text-slate-900">{googleUser?.email}</strong>
                {!hasActiveToken && (
                  <span className="ml-2 text-amber-700">
                    (Session paused on refresh — click Resume Session or upload a photo to continue)
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {driveFolders?.rootFolder?.webViewLink && (
                  <a
                    href={driveFolders.rootFolder.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#6D28D9] font-semibold hover:underline"
                  >
                    <span>Open ecom_store in Drive</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  disabled={loadingFolders || connecting}
                  onClick={handleSyncFolders}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFolders ? 'animate-spin' : ''}`} />
                  <span>{hasActiveToken ? 'Sync Folders' : 'Create / Sync Folders'}</span>
                </button>
              </div>
            </div>

            {driveFolders && driveFolders.folders.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {driveFolders.folders.map((f) => (
                  <a
                    key={f.id}
                    href={f.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-xl border border-slate-200/80 hover:border-violet-300 hover:bg-violet-50/30 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-900 truncate">
                        <FolderOpen className="w-3.5 h-3.5 text-[#6D28D9] shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                        {f.fileCount} photo(s)
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. SMTP */}
      <div className="rounded-xl border border-slate-200/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-[#6D28D9] flex items-center justify-center">
              <Mail className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">SMTP</h4>
              <p className="text-xs text-slate-500">Send transactional emails and OTPs</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={form.smtp.enabled ? 'Connected' : 'Inactive'} />
            <ToggleSwitch
              checked={form.smtp.enabled}
              onChange={(v) => setForm({ ...form, smtp: { ...form.smtp, enabled: v } })}
              label="Enable SMTP"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Host</label>
            <input
              value={form.smtp.host}
              onChange={(e) => setForm({ ...form, smtp: { ...form.smtp, host: e.target.value } })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              placeholder="smtp.gmail.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Port</label>
            <input
              type="number"
              value={form.smtp.port}
              onChange={(e) =>
                setForm({ ...form, smtp: { ...form.smtp, port: Number(e.target.value) } })
              }
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm tabular-nums"
              placeholder="587"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
            <input
              value={form.smtp.username}
              onChange={(e) =>
                setForm({ ...form, smtp: { ...form.smtp, username: e.target.value } })
              }
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showSmtpPass ? 'text' : 'password'}
                value={form.smtp.password}
                onChange={(e) =>
                  setForm({ ...form, smtp: { ...form.smtp, password: e.target.value } })
                }
                className="w-full border border-slate-200 rounded-xl pl-3 pr-9 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSmtpPass((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Encryption</label>
            <select
              value={form.smtp.encryption}
              onChange={(e) =>
                setForm({
                  ...form,
                  smtp: { ...form.smtp, encryption: e.target.value as 'TLS' | 'SSL' | 'None' },
                })
              }
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="TLS">TLS</option>
              <option value="SSL">SSL</option>
              <option value="None">None</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">From Email</label>
            <input
              type="email"
              value={form.smtp.fromEmail}
              onChange={(e) =>
                setForm({ ...form, smtp: { ...form.smtp, fromEmail: e.target.value } })
              }
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">From Name</label>
            <input
              value={form.smtp.fromName}
              onChange={(e) =>
                setForm({ ...form, smtp: { ...form.smtp, fromName: e.target.value } })
              }
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={testing === 'smtp'}
            onClick={() => handleTest('smtp')}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {testing === 'smtp' ? 'Testing…' : 'Test Connection'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('SMTP')}
            className="px-4 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold hover:bg-[#5B21B6]"
          >
            Save
          </button>
        </div>
      </div>

      {/* 2. Razorpay */}
      <div className="rounded-xl border border-slate-200/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <CreditCard className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Razorpay</h4>
              <p className="text-xs text-slate-500">Accept online payments via Razorpay</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={form.razorpay.enabled ? 'Connected' : 'Inactive'} />
            <ToggleSwitch
              checked={form.razorpay.enabled}
              onChange={(v) => setForm({ ...form, razorpay: { ...form.razorpay, enabled: v } })}
              label="Enable Razorpay"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Key ID</label>
            <input
              value={form.razorpay.keyId}
              onChange={(e) =>
                setForm({ ...form, razorpay: { ...form.razorpay, keyId: e.target.value } })
              }
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
              placeholder="rzp_test_..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Key Secret</label>
            <div className="relative">
              <input
                type={showRzpSecret ? 'text' : 'password'}
                value={form.razorpay.keySecret}
                onChange={(e) =>
                  setForm({ ...form, razorpay: { ...form.razorpay, keySecret: e.target.value } })
                }
                className="w-full border border-slate-200 rounded-xl pl-3 pr-9 py-2 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowRzpSecret((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showRzpSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Environment</label>
            <select
              value={form.razorpay.environment}
              onChange={(e) =>
                setForm({
                  ...form,
                  razorpay: { ...form.razorpay, environment: e.target.value as 'Test' | 'Live' },
                })
              }
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="Test">Test</option>
              <option value="Live">Live</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={testing === 'razorpay'}
            onClick={() => handleTest('razorpay')}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {testing === 'razorpay' ? 'Testing…' : 'Test Connection'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('Razorpay')}
            className="px-4 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold hover:bg-[#5B21B6]"
          >
            Save
          </button>
        </div>
      </div>

      {/* 3. SMS */}
      <div className="rounded-xl border border-slate-200/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-[#6D28D9] flex items-center justify-center">
              <MessageSquare className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">SMS</h4>
              <p className="text-xs text-slate-500">Send OTPs and order alerts via SMS</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={form.sms.enabled ? 'Connected' : 'Inactive'} />
            <ToggleSwitch
              checked={form.sms.enabled}
              onChange={(v) => setForm({ ...form, sms: { ...form.sms, enabled: v } })}
              label="Enable SMS"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">SMS Provider</label>
            <select
              value={form.sms.provider}
              onChange={(e) => setForm({ ...form, sms: { ...form.sms, provider: e.target.value } })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="Twilio">Twilio</option>
              <option value="MSG91">MSG91</option>
              <option value="Fast2SMS">Fast2SMS</option>
              <option value="AWS SNS">AWS SNS</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">API Key</label>
            <input
              value={form.sms.apiKey}
              onChange={(e) => setForm({ ...form, sms: { ...form.sms, apiKey: e.target.value } })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Sender ID</label>
            <input
              value={form.sms.senderId}
              onChange={(e) => setForm({ ...form, sms: { ...form.sms, senderId: e.target.value } })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono uppercase"
              placeholder="SHOPADM"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              API Secret (Optional)
            </label>
            <div className="relative">
              <input
                type={showSmsSecret ? 'text' : 'password'}
                value={form.sms.apiSecret}
                onChange={(e) =>
                  setForm({ ...form, sms: { ...form.sms, apiSecret: e.target.value } })
                }
                className="w-full border border-slate-200 rounded-xl pl-3 pr-9 py-2 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowSmsSecret((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showSmsSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={testing === 'sms'}
            onClick={() => handleTest('sms')}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {testing === 'sms' ? 'Testing…' : 'Test SMS'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('SMS')}
            className="px-4 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold hover:bg-[#5B21B6]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================== 7. SECURITY (CHANGE ADMIN PASSWORD ONLY) ==================== */
export function SecuritySettingsPanel() {
  const { showToast } = useToast();
  const [method, setMethod] = useState<'password' | 'otp'>('password');
  const [oldPassword, setOldPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otpHint, setOtpHint] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/security/send-otp', {
        method: 'POST',
      });
      setOtpHint(res.message);
      showToast('Verification OTP generated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send OTP', 'error');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleReset = () => {
    setOldPassword('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpHint('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/security/change-password', {
        method: 'POST',
        body: JSON.stringify({
          method,
          oldPassword,
          otp,
          newPassword,
          confirmPassword,
        }),
      });
      showToast(res.message);
      handleReset();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update password', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-violet-50 text-[#6D28D9] flex items-center justify-center">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Security</h3>
          <p className="text-xs text-slate-500">
            Update your admin account password to keep your store secure.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200/80 p-6 space-y-5">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-violet-50/60 border border-violet-100">
          <div className="w-10 h-10 rounded-xl bg-white text-[#6D28D9] flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Change Admin Password</h4>
            <p className="text-xs text-slate-500">Update your password for your admin account.</p>
          </div>
        </div>

        {/* Verification Method */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Verification Method
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMethod('password')}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-semibold transition-colors ${
                method === 'password'
                  ? 'border-[#6D28D9] bg-violet-50/50 text-[#5B21B6]'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  method === 'password' ? 'border-[#6D28D9]' : 'border-slate-300'
                }`}
              >
                {method === 'password' && <span className="w-2 h-2 rounded-full bg-[#6D28D9]" />}
              </span>
              <span>Use Old Password</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('otp')}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-semibold transition-colors ${
                method === 'otp'
                  ? 'border-[#6D28D9] bg-violet-50/50 text-[#5B21B6]'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  method === 'otp' ? 'border-[#6D28D9]' : 'border-slate-300'
                }`}
              >
                {method === 'otp' && <span className="w-2 h-2 rounded-full bg-[#6D28D9]" />}
              </span>
              <span>Get OTP on Email</span>
            </button>
          </div>
        </div>

        {method === 'password' ? (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Old Password *
            </label>
            <div className="relative">
              <input
                required
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-3 pr-10 py-2.5 text-sm"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowOld((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-700">Email OTP *</label>
              <button
                type="button"
                disabled={sendingOtp}
                onClick={handleSendOtp}
                className="text-xs font-semibold text-[#6D28D9] hover:underline"
              >
                {sendingOtp ? 'Sending…' : 'Send OTP to Admin Email'}
              </button>
            </div>
            <input
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono"
              placeholder="Enter 6-digit OTP"
            />
            {otpHint && (
              <p className="text-xs text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg">{otpHint}</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">New Password *</label>
          <div className="relative">
            <input
              required
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-3 pr-10 py-2.5 text-sm"
              placeholder="Minimum 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowNew((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Use 8+ characters with a mix of letters, numbers and special characters.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Re-type New Password *
          </label>
          <div className="relative">
            <input
              required
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-3 pr-10 py-2.5 text-sm"
              placeholder="Confirm new password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Updating…' : 'Update Password'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* ==================== 8. BACKUP & DATA (EXPORT / IMPORT ONLY) ==================== */
export function BackupDataPanel({ onImported }: { onImported: () => void }) {
  const { showToast } = useToast();
  const [exportType, setExportType] = useState<'products' | 'categories' | 'users'>('products');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');

  const [importType, setImportType] = useState<'products' | 'categories' | 'users'>('products');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!selectedFile) {
      showToast('Please select an Excel (.xlsx) or CSV (.csv) file first', 'error');
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('type', importType);
      formData.append('file', selectedFile);
      const res = await apiRequest<{ message: string }>('/api/data/import', {
        method: 'POST',
        body: formData,
      });
      showToast(res.message);
      setSelectedFile(null);
      onImported();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to import data', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-violet-50 text-[#6D28D9] flex items-center justify-center">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Backup &amp; Data</h3>
          <p className="text-xs text-slate-500">
            Export store data in Excel or CSV format and import records from Excel or CSV files.
          </p>
        </div>
      </div>

      {/* Export Data */}
      <div className="rounded-xl border border-slate-200/80 p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Download className="w-4.5 h-4.5 text-[#6D28D9]" />
          <div>
            <h4 className="text-sm font-bold text-slate-900">Export Data</h4>
            <p className="text-xs text-slate-500">
              Download store data in Excel (.xlsx) or CSV (.csv) format.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">Data Type</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(
              [
                { id: 'products', label: 'Products' },
                { id: 'categories', label: 'Categories' },
                { id: 'users', label: 'Users' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setExportType(opt.id)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold transition-colors ${
                  exportType === opt.id
                    ? 'border-[#6D28D9] bg-violet-50/60 text-[#5B21B6]'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    exportType === opt.id ? 'border-[#6D28D9]' : 'border-slate-300'
                  }`}
                >
                  {exportType === opt.id && (
                    <span className="w-2 h-2 rounded-full bg-[#6D28D9]" />
                  )}
                </span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Format</label>
            <div className="flex items-center gap-3">
              {(
                [
                  { id: 'xlsx', label: 'Excel (.xlsx)' },
                  { id: 'csv', label: 'CSV (.csv)' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setExportFormat(fmt.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold ${
                    exportFormat === fmt.id
                      ? 'border-[#6D28D9] bg-violet-50/60 text-[#5B21B6]'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >
                  <span>{fmt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              downloadProtectedFile(
                `/api/data/export?type=${exportType}&format=${exportFormat}`,
                `shopadmin-${exportType}.${exportFormat}`
              ).catch((err) =>
                showToast(err instanceof Error ? err.message : 'Export failed', 'error')
              )
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold shadow-sm whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Export Data</span>
          </button>
        </div>
      </div>

      {/* Import Data */}
      <div className="rounded-xl border border-slate-200/80 p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Upload className="w-4.5 h-4.5 text-[#6D28D9]" />
          <div>
            <h4 className="text-sm font-bold text-slate-900">Import Data</h4>
            <p className="text-xs text-slate-500">
              Upload an Excel (.xlsx) or CSV (.csv) file to add or update records in MongoDB.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">Data Type</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(
              [
                { id: 'products', label: 'Products' },
                { id: 'categories', label: 'Categories' },
                { id: 'users', label: 'Users' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setImportType(opt.id)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold transition-colors ${
                  importType === opt.id
                    ? 'border-[#6D28D9] bg-violet-50/60 text-[#5B21B6]'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    importType === opt.id ? 'border-[#6D28D9]' : 'border-slate-300'
                  }`}
                >
                  {importType === opt.id && (
                    <span className="w-2 h-2 rounded-full bg-[#6D28D9]" />
                  )}
                </span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setSelectedFile(f);
          }}
          className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            dragging ? 'border-[#6D28D9] bg-violet-50/50' : 'border-violet-200 bg-violet-50/20'
          }`}
        >
          <label className="cursor-pointer block">
            <Upload className="w-7 h-7 text-[#6D28D9] mx-auto mb-2" />
            <div className="text-sm font-medium text-slate-800">
              Drag &amp; drop your file here, or{' '}
              <span className="text-[#6D28D9] font-semibold">click to browse</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Supported formats: .xlsx, .csv | Max file size: 10 MB
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setSelectedFile(f);
              }}
            />
          </label>

          {selectedFile && (
            <div className="mt-4 flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {selectedFile.name}
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                aria-label="Remove selected file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() =>
              downloadProtectedFile(
                `/api/data/sample?type=${importType}&format=xlsx`,
                `sample-${importType}.xlsx`
              ).catch((err) =>
                showToast(err instanceof Error ? err.message : 'Sample download failed', 'error')
              )
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            <span>Download Sample</span>
          </button>
          <button
            type="button"
            disabled={importing || !selectedFile}
            onClick={handleImport}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{importing ? 'Importing…' : 'Import Data'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
