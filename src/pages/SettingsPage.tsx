import React from 'react';
import {
  Settings,
  Truck,
  Percent,
  Bell,
  Users,
  Plug,
  Shield,
  Database,
} from 'lucide-react';
import type { SettingsTab, StoreSettingsDoc } from '../types';
import {
  GeneralSettingsPanel,
  NotificationsSettingsPanel,
  ShippingSettingsPanel,
  TaxSettingsPanel,
} from '../components/settings/SettingsPanelsA';
import {
  AdminPermissionsPanel,
  BackupDataPanel,
  IntegrationsSettingsPanel,
  SecuritySettingsPanel,
} from '../components/settings/SettingsPanelsB';

interface SettingsPageProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  settings: StoreSettingsDoc | null;
  onSettingsUpdated: (next: StoreSettingsDoc) => void;
  onDataImported: () => void;
}

const SETTINGS_NAV: Array<{
  id: SettingsTab;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'general',
    title: 'General',
    subtitle: 'Store information & basic settings',
    icon: Settings,
  },
  {
    id: 'shipping',
    title: 'Shipping',
    subtitle: 'Delivery methods and charges',
    icon: Truck,
  },
  {
    id: 'tax',
    title: 'Tax / GST',
    subtitle: 'GST, VAT and tax settings',
    icon: Percent,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'Email, SMS and order alerts',
    icon: Bell,
  },
  {
    id: 'permissions',
    title: 'Users & Permissions',
    subtitle: 'Admin roles and access control',
    icon: Users,
  },
  {
    id: 'integrations',
    title: 'Integrations',
    subtitle: 'Third-party services (SMTP, Razorpay, SMS)',
    icon: Plug,
  },
  {
    id: 'security',
    title: 'Security',
    subtitle: 'Change admin password',
    icon: Shield,
  },
  {
    id: 'backup',
    title: 'Backup & Data',
    subtitle: 'Export and import store data',
    icon: Database,
  },
];

export function SettingsPage({
  activeTab,
  onTabChange,
  settings,
  onSettingsUpdated,
  onDataImported,
}: SettingsPageProps) {
  if (!settings) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-sm text-slate-500">
        Loading settings from MongoDB…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Secondary Settings Navigation */}
      <aside className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1">
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-colors ${
                  active
                    ? 'bg-violet-50 text-[#6D28D9]'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    active ? 'bg-white text-[#6D28D9] shadow-xs' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-sm font-semibold truncate ${
                      active ? 'text-[#5B21B6]' : 'text-slate-900'
                    }`}
                  >
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Active Settings Panel */}
      <div className="lg:col-span-8 xl:col-span-9 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        {activeTab === 'general' && (
          <GeneralSettingsPanel settings={settings} onUpdated={onSettingsUpdated} />
        )}
        {activeTab === 'shipping' && (
          <ShippingSettingsPanel settings={settings} onUpdated={onSettingsUpdated} />
        )}
        {activeTab === 'tax' && (
          <TaxSettingsPanel settings={settings} onUpdated={onSettingsUpdated} />
        )}
        {activeTab === 'notifications' && (
          <NotificationsSettingsPanel settings={settings} onUpdated={onSettingsUpdated} />
        )}
        {activeTab === 'permissions' && <AdminPermissionsPanel />}
        {activeTab === 'integrations' && (
          <IntegrationsSettingsPanel settings={settings} onUpdated={onSettingsUpdated} />
        )}
        {activeTab === 'security' && <SecuritySettingsPanel />}
        {activeTab === 'backup' && <BackupDataPanel onImported={onDataImported} />}
      </div>
    </div>
  );
}
