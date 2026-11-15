import React, { useState } from 'react';
import {
  Save,
  Upload,
  Truck,
  Plus,
  Pencil,
  Trash2,
  Percent,
  Bell,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import type { ShippingMethod, StoreSettingsDoc, TaxRate } from '../../types';
import { apiRequest } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { ToggleSwitch } from '../ToggleSwitch';
import { StatusBadge } from '../StatusBadge';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { useGoogleDrive } from '../GoogleDriveContext';

interface PanelProps {
  settings: StoreSettingsDoc;
  onUpdated: (next: StoreSettingsDoc) => void;
}

/* ==================== 1. GENERAL SETTINGS ==================== */
export function GeneralSettingsPanel({ settings, onUpdated }: PanelProps) {
  const { showToast } = useToast();
  const { uploadImageToDrive, confirmAndDeleteDriveImage } = useGoogleDrive();
  const [form, setForm] = useState(settings.general);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadImageToDrive(file, 'store_logo');
      setForm((prev) => ({ ...prev, storeLogo: uploaded.url }));
      showToast(`Store logo uploaded to Google Drive (${uploaded.folderPath})`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Logo upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!form.storeLogo) return;
    const ok = await confirmAndDeleteDriveImage(form.storeLogo, 'Store Logo');
    if (ok) {
      setForm((prev) => ({ ...prev, storeLogo: '' }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await apiRequest<StoreSettingsDoc>('/api/settings/general', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      onUpdated(updated);
      showToast('General settings saved to MongoDB');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-bold text-slate-900">General Settings</h3>
          <p className="text-xs text-slate-500">
            Update your store information, contact details, currency, and time zone.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving…' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Store Information */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-slate-900">Store Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">Store Logo</label>
              {form.storeLogo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="text-[11px] font-semibold text-rose-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            <label className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-300 bg-slate-50/60 cursor-pointer text-center min-h-[132px]">
              {form.storeLogo ? (
                <img
                  src={form.storeLogo}
                  alt="Store Logo"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 object-contain rounded-lg mb-2"
                />
              ) : (
                <Upload className="w-6 h-6 text-[#6D28D9] mb-2" />
              )}
              <span className="text-xs font-semibold text-slate-700">
                {uploading ? 'Uploading to Drive…' : 'Upload Logo'}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Saves to ecom_store/store_logo
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <div className="md:col-span-9 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Store Name *
                </label>
                <input
                  required
                  value={form.storeName}
                  onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store Slug</label>
                <input
                  value={form.storeSlug}
                  onChange={(e) => setForm({ ...form, storeSlug: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Store Description
              </label>
              <textarea
                rows={2}
                value={form.storeDescription}
                onChange={(e) => setForm({ ...form, storeDescription: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="Describe your storefront..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contact & Regional */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
        <h4 className="text-sm font-bold text-slate-900">Contact & Regional</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Store Email</label>
            <input
              type="email"
              value={form.storeEmail}
              onChange={(e) => setForm({ ...form, storeEmail: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Store Phone</label>
            <input
              value={form.storePhone}
              onChange={(e) => setForm({ ...form, storePhone: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Time Zone</label>
            <select
              value={form.timeZone}
              onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Store Address */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
        <h4 className="text-sm font-bold text-slate-900">Store Address</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Address Line 1</label>
            <input
              value={form.addressLine1}
              onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Address Line 2</label>
            <input
              value={form.addressLine2}
              onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
            <input
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">PIN / ZIP Code</label>
            <input
              value={form.pinCode}
              onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
            <input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Store Preferences */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <h4 className="text-sm font-bold text-slate-900">Store Preferences</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              key: 'allowGuestCheckout' as const,
              title: 'Allow Guest Checkout',
              desc: 'Let customers place orders without an account',
            },
            {
              key: 'autoUpdateStock' as const,
              title: 'Auto Update Stock',
              desc: 'Reduce stock automatically when orders are placed',
            },
            {
              key: 'productReviews' as const,
              title: 'Product Reviews',
              desc: 'Allow customers to write product reviews',
            },
            {
              key: 'orderNotifications' as const,
              title: 'Order Notifications',
              desc: 'Send order updates to customers via email',
            },
          ].map((pref) => (
            <div
              key={pref.key}
              className="p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs font-semibold text-slate-900">{pref.title}</div>
                <div className="text-[11px] text-slate-500">{pref.desc}</div>
              </div>
              <ToggleSwitch
                checked={form[pref.key]}
                onChange={(v) => setForm({ ...form, [pref.key]: v })}
                label={pref.title}
              />
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}

/* ==================== 2. SHIPPING SETTINGS ==================== */
export function ShippingSettingsPanel({ settings, onUpdated }: PanelProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState(settings.shipping);
  const [saving, setSaving] = useState(false);

  const [methodModalOpen, setMethodModalOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [methodForm, setMethodForm] = useState<ShippingMethod>({
    name: '',
    description: '',
    deliveryTime: '3-5 Business Days',
    charge: 40,
    status: 'Active',
  });

  const handleSaveAll = async (nextShipping = form) => {
    setSaving(true);
    try {
      const updated = await apiRequest<StoreSettingsDoc>('/api/settings/shipping', {
        method: 'PUT',
        body: JSON.stringify(nextShipping),
      });
      onUpdated(updated);
      showToast('Shipping settings saved to MongoDB');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save shipping settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextMethods = [...(form.methods || [])];
    if (editingIdx !== null) {
      nextMethods[editingIdx] = methodForm;
    } else {
      nextMethods.push(methodForm);
    }
    const nextState = { ...form, methods: nextMethods };
    setForm(nextState);
    setMethodModalOpen(false);
    await handleSaveAll(nextState);
  };

  const handleDeleteMethod = async (idx: number) => {
    const nextMethods = (form.methods || []).filter((_, i) => i !== idx);
    const nextState = { ...form, methods: nextMethods };
    setForm(nextState);
    await handleSaveAll(nextState);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-[#6D28D9] flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Shipping Settings</h3>
            <p className="text-xs text-slate-500">
              Configure shipping rules, free shipping threshold, and delivery methods.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSaveAll()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving…' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Shipping Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Enable Shipping</div>
              <div className="text-xs text-slate-500">Turn on/off shipping for your store</div>
            </div>
            <ToggleSwitch
              checked={form.enableShipping}
              onChange={(v) => setForm({ ...form, enableShipping: v })}
              label="Enable Shipping"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div>
              <div className="text-sm font-semibold text-slate-900">Flat-Rate Shipping</div>
              <div className="text-xs text-slate-500">Apply a uniform shipping charge</div>
            </div>
            <ToggleSwitch
              checked={form.flatRateShipping}
              onChange={(v) => setForm({ ...form, flatRateShipping: v })}
              label="Flat-rate shipping"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Standard Shipping Charge ({settings.general.currency})
            </label>
            <input
              type="number"
              min={0}
              value={form.shippingCharge}
              onChange={(e) => setForm({ ...form, shippingCharge: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm tabular-nums"
            />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Free Shipping</div>
              <div className="text-xs text-slate-500">
                Offer free shipping on orders above threshold
              </div>
            </div>
            <ToggleSwitch
              checked={form.freeShipping}
              onChange={(v) => setForm({ ...form, freeShipping: v })}
              label="Free Shipping"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Minimum Order Amount for Free Shipping ({settings.general.currency})
            </label>
            <input
              type="number"
              min={0}
              value={form.freeShippingThreshold}
              onChange={(e) =>
                setForm({ ...form, freeShippingThreshold: Number(e.target.value) })
              }
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Processing Time</label>
            <select
              value={form.processingTime}
              onChange={(e) => setForm({ ...form, processingTime: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="Same Day">Same Day</option>
              <option value="1 Business Day">1 Business Day</option>
              <option value="2-3 Business Days">2-3 Business Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Shipping Methods Table */}
      <div className="rounded-xl border border-slate-200/80 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Shipping Methods</h4>
            <p className="text-xs text-slate-500">Delivery options available to customers</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingIdx(null);
              setMethodForm({
                name: '',
                description: '',
                deliveryTime: '3-5 Business Days',
                charge: 40,
                status: 'Active',
              });
              setMethodModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-violet-200 bg-violet-50/70 text-[#6D28D9] text-xs font-semibold hover:bg-violet-100"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Shipping Method</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">Method Name</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4">Delivery Time</th>
                <th className="py-2.5 px-4 text-right">Charge</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(form.methods || []).map((m, idx) => (
                <tr key={m._id || idx}>
                  <td className="py-3 px-4 font-semibold text-slate-900">{m.name}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{m.description || '—'}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{m.deliveryTime}</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums">
                    {m.charge === 0
                      ? 'Free'
                      : formatCurrency(m.charge, settings.general.currency)}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIdx(idx);
                          setMethodForm(m);
                          setMethodModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#6D28D9]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMethod(idx)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!form.methods || form.methods.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    No shipping methods configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={methodModalOpen}
        onClose={() => setMethodModalOpen(false)}
        title={editingIdx !== null ? 'Edit Shipping Method' : 'Add Shipping Method'}
        size="sm"
      >
        <form onSubmit={handleSaveMethod} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Method Name *</label>
            <input
              required
              value={methodForm.name}
              onChange={(e) => setMethodForm({ ...methodForm, name: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              placeholder="Express Delivery"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <input
              value={methodForm.description}
              onChange={(e) => setMethodForm({ ...methodForm, description: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              placeholder="Faster delivery for urgent orders"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Delivery Time
              </label>
              <input
                value={methodForm.deliveryTime}
                onChange={(e) => setMethodForm({ ...methodForm, deliveryTime: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Charge</label>
              <input
                type="number"
                min={0}
                value={methodForm.charge}
                onChange={(e) => setMethodForm({ ...methodForm, charge: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Status</span>
            <ToggleSwitch
              checked={methodForm.status === 'Active'}
              onChange={(v) => setMethodForm({ ...methodForm, status: v ? 'Active' : 'Inactive' })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setMethodModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#6D28D9] text-white text-sm font-semibold"
            >
              Save Method
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ==================== 3. TAX / GST SETTINGS ==================== */
export function TaxSettingsPanel({ settings, onUpdated }: PanelProps) {
  const { showToast, confirm } = useToast();
  const [form, setForm] = useState(settings.tax);
  const [saving, setSaving] = useState(false);

  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [rateForm, setRateForm] = useState<TaxRate>({
    name: '',
    taxType: 'GST',
    rate: 18,
    description: '',
    region: 'All India',
    status: 'Active',
  });

  const handleSaveTaxConfig = async () => {
    setSaving(true);
    try {
      const updated = await apiRequest<StoreSettingsDoc>('/api/settings/tax', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setForm(updated.tax);
      onUpdated(updated);
      showToast('Tax / GST configuration saved to MongoDB');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save tax settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let updated: StoreSettingsDoc;
      if (editingRate?._id) {
        updated = await apiRequest<StoreSettingsDoc>(`/api/settings/tax/rates/${editingRate._id}`, {
          method: 'PUT',
          body: JSON.stringify(rateForm),
        });
        showToast('Tax rate updated');
      } else {
        updated = await apiRequest<StoreSettingsDoc>('/api/settings/tax/rates', {
          method: 'POST',
          body: JSON.stringify(rateForm),
        });
        showToast('Tax rate added');
      }
      setForm(updated.tax);
      onUpdated(updated);
      setRateModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save tax rate', 'error');
    }
  };

  const handleDeleteRate = async (rate: TaxRate) => {
    if (!rate._id) return;
    const ok = await confirm({
      title: 'Delete Tax Rate',
      message: `Delete "${rate.name}" (${rate.rate}%)?`,
      confirmLabel: 'Delete Rate',
      danger: true,
    });
    if (!ok) return;
    try {
      const updated = await apiRequest<StoreSettingsDoc>(`/api/settings/tax/rates/${rate._id}`, {
        method: 'DELETE',
      });
      setForm(updated.tax);
      onUpdated(updated);
      showToast('Tax rate deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete tax rate', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-[#6D28D9] flex items-center justify-center">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Tax / GST Settings</h3>
            <p className="text-xs text-slate-500">
              Configure GST, tax calculation mode, and applicable product tax rates.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={handleSaveTaxConfig}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving…' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Enable GST</div>
              <div className="text-xs text-slate-500">Turn on GST calculation for your store</div>
            </div>
            <ToggleSwitch
              checked={form.enableGst}
              onChange={(v) => setForm({ ...form, enableGst: v })}
              label="Enable GST"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              GSTIN (15-digit Identification Number)
            </label>
            <input
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono uppercase"
              placeholder="08ABCDE1234F1Z5"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Legal Business Name
            </label>
            <input
              value={form.legalBusinessName}
              onChange={(e) => setForm({ ...form, legalBusinessName: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tax Pricing Mode
            </label>
            <select
              value={form.pricingMode}
              onChange={(e) =>
                setForm({ ...form, pricingMode: e.target.value as 'inclusive' | 'exclusive' })
              }
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="inclusive">Tax Inclusive Pricing</option>
              <option value="exclusive">Tax Exclusive Pricing</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Tax Rate (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.defaultTaxRate}
                onChange={(e) => setForm({ ...form, defaultTaxRate: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Place of Supply State
              </label>
              <input
                value={form.placeOfSupplyState}
                onChange={(e) => setForm({ ...form, placeOfSupplyState: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Business Type</label>
            <select
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="GST Registered Business">GST Registered Business</option>
              <option value="Composition Scheme">Composition Scheme</option>
              <option value="Unregistered">Unregistered</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tax Rates Table */}
      <div className="rounded-xl border border-slate-200/80 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Tax Rates (GST Slabs)</h4>
            <p className="text-xs text-slate-500">Manage tax rates applicable to your products</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingRate(null);
              setRateForm({
                name: '',
                taxType: 'GST',
                rate: 12,
                description: '',
                region: 'All India',
                status: 'Active',
              });
              setRateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-violet-200 bg-violet-50/70 text-[#6D28D9] text-xs font-semibold hover:bg-violet-100"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Tax Rate</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">Tax Name</th>
                <th className="py-2.5 px-4">Tax Type</th>
                <th className="py-2.5 px-4">Rate</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(form.rates || []).map((r) => (
                <tr key={r._id || r.name}>
                  <td className="py-3 px-4 font-semibold text-slate-900">{r.name}</td>
                  <td className="py-3 px-4 text-xs text-slate-600 font-medium">{r.taxType}</td>
                  <td className="py-3 px-4 font-semibold text-[#6D28D9] tabular-nums">{r.rate}%</td>
                  <td className="py-3 px-4 text-xs text-slate-500">{r.description || '—'}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRate(r);
                          setRateForm(r);
                          setRateModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#6D28D9]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRate(r)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!form.rates || form.rates.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    No tax rates created yet. Click &ldquo;Add Tax Rate&rdquo; to create a slab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Tax Rate Center Modal */}
      <Modal
        open={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        title={editingRate ? 'Edit Tax Rate' : 'Add Tax Rate'}
        subtitle={
          editingRate
            ? 'Update the tax rate (GST slab) details.'
            : 'Create a new tax rate (GST slab) for your products.'
        }
        size="md"
      >
        <form onSubmit={handleSaveRate} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Name *</label>
              <input
                required
                value={rateForm.name}
                onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="e.g., GST 12%"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Type *</label>
              <select
                value={rateForm.taxType}
                onChange={(e) =>
                  setRateForm({
                    ...rateForm,
                    taxType: e.target.value as TaxRate['taxType'],
                  })
                }
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="GST">GST</option>
                <option value="CGST">CGST</option>
                <option value="SGST">SGST</option>
                <option value="IGST">IGST</option>
                <option value="VAT">VAT</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tax Rate (%) *
              </label>
              <div className="flex">
                <input
                  required
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={rateForm.rate}
                  onChange={(e) => setRateForm({ ...rateForm, rate: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-l-xl px-3 py-2 text-sm tabular-nums"
                />
                <span className="px-3 py-2 bg-slate-50 border border-l-0 border-slate-200 rounded-r-xl text-sm text-slate-600">
                  %
                </span>
              </div>
            </div>
            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2.5">
                <ToggleSwitch
                  checked={rateForm.status === 'Active'}
                  onChange={(v) => setRateForm({ ...rateForm, status: v ? 'Active' : 'Inactive' })}
                />
                <span className="text-xs font-semibold text-slate-700">
                  {rateForm.status}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={rateForm.description}
              onChange={(e) => setRateForm({ ...rateForm, description: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              placeholder="Applicable on standard electronics..."
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRateModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold"
            >
              {editingRate ? 'Update Tax Rate' : 'Save Tax Rate'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ==================== 4. NOTIFICATIONS SETTINGS ==================== */
export function NotificationsSettingsPanel({ settings, onUpdated }: PanelProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState(settings.notifications);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await apiRequest<StoreSettingsDoc>('/api/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      onUpdated(updated);
      showToast('Notification settings saved to MongoDB');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save notification settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-[#6D28D9] flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Notification Settings</h3>
            <p className="text-xs text-slate-500">
              Configure email and admin alert preferences for store events.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving…' : 'Save Notification Settings'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Email Notifications */}
        <div className="rounded-xl border border-slate-200/80 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4.5 h-4.5 text-[#6D28D9]" />
            <h4 className="text-sm font-bold text-slate-900">Email Notifications</h4>
          </div>
          <div className="divide-y divide-slate-100">
            {(
              [
                { key: 'newOrder', label: 'New Order' },
                { key: 'orderConfirmed', label: 'Order Confirmed' },
                { key: 'orderShipped', label: 'Order Shipped' },
                { key: 'orderDelivered', label: 'Order Delivered' },
                { key: 'orderCancelled', label: 'Order Cancelled' },
                { key: 'newUser', label: 'New User' },
                { key: 'passwordReset', label: 'Password Reset' },
              ] as const
            ).map((item) => (
              <div key={item.key} className="py-3 flex items-center justify-between">
                <span className="text-sm text-slate-700 font-medium">{item.label}</span>
                <ToggleSwitch
                  checked={form.emailEvents[item.key]}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      emailEvents: { ...form.emailEvents, [item.key]: v },
                    })
                  }
                  label={item.label}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Admin Notifications */}
        <div className="rounded-xl border border-slate-200/80 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4.5 h-4.5 text-[#6D28D9]" />
            <h4 className="text-sm font-bold text-slate-900">Admin Notifications</h4>
          </div>
          <div className="divide-y divide-slate-100">
            {(
              [
                { key: 'lowStock', label: 'Low Stock' },
                { key: 'outOfStock', label: 'Out of Stock' },
                { key: 'newOrder', label: 'New Order' },
                { key: 'paymentFailed', label: 'Payment Failed' },
              ] as const
            ).map((item) => (
              <div key={item.key} className="py-3 flex items-center justify-between">
                <span className="text-sm text-slate-700 font-medium">{item.label}</span>
                <ToggleSwitch
                  checked={form.adminEvents[item.key]}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      adminEvents: { ...form.adminEvents, [item.key]: v },
                    })
                  }
                  label={item.label}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
