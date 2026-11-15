import React, { useCallback, useEffect, useState } from 'react';
import type { NavSection, SettingsTab, StoreSettingsDoc } from './types';
import { apiRequest, getAdminToken, onAdminUnauthorized, setAdminToken } from './lib/api';
import { ToastProvider } from './components/Toast';
import { GoogleDriveProvider } from './components/GoogleDriveContext';
import { AdminLoginPage, type AuthenticatedAdmin } from './components/AdminLoginPage';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductsPage } from './pages/ProductsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { UsersPage } from './pages/UsersPage';
import { InventoryPage } from './pages/InventoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { EmailTemplatesPage } from './pages/EmailTemplatesPage';

interface ShellOverview {
  summary: {
    totalOrders: number;
    pendingOrders: number;
    lowStockProducts: number;
  };
  lowStockList: Array<{ _id: string; name: string; sku: string; stock: number }>;
}

const SECTION_META: Record<NavSection, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Overview of your store performance',
  },
  orders: {
    title: 'Orders',
    subtitle: 'Manage customer orders, track status and update shipments.',
  },
  products: {
    title: 'Products',
    subtitle: 'Manage your store products, stock and pricing',
  },
  categories: {
    title: 'Categories',
    subtitle: 'Manage product categories, create, edit and organize your catalog',
  },
  users: {
    title: 'Users',
    subtitle: 'Manage your customers, view details, orders and account status',
  },
  inventory: {
    title: 'Inventory',
    subtitle: 'Track stock levels, manage inventory and get low stock alerts',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Manage your store configuration, operations and system preferences',
  },
  'email-templates': {
    title: 'Email Templates',
    subtitle: 'Transactional email templates',
  },
};

function ShopAdminWorkspace({
  admin,
  onLogout,
}: {
  admin: AuthenticatedAdmin;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<NavSection>('dashboard');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState<StoreSettingsDoc | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [productSignal, setProductSignal] = useState(0);
  const [categorySignal, setCategorySignal] = useState(0);
  const [userSignal, setUserSignal] = useState(0);

  const [overview, setOverview] = useState<ShellOverview>({
    summary: { totalOrders: 0, pendingOrders: 0, lowStockProducts: 0 },
    lowStockList: [],
  });

  const syncShellData = useCallback(async () => {
    try {
      const [settingsRes, dashRes] = await Promise.all([
        apiRequest<StoreSettingsDoc>('/api/settings'),
        apiRequest<ShellOverview>('/api/dashboard?range=month'),
      ]);
      setSettings(settingsRes);
      setOverview(dashRes);
    } catch (err) {
      console.error('Failed to sync ShopAdmin shell data:', err);
    }
  }, []);

  useEffect(() => {
    syncShellData();
  }, [syncShellData, refreshTick]);

  const bumpRefresh = () => setRefreshTick((t) => t + 1);

  const handleNavigate = (nextSection: NavSection, tab?: 'general' | 'security') => {
    setSection(nextSection);
    if (nextSection === 'settings' && tab) {
      setSettingsTab(tab);
    }
  };

  const handleQuickAction = (action: 'add-product' | 'add-category' | 'add-user') => {
    if (action === 'add-product') {
      setSection('products');
      setProductSignal((s) => s + 1);
    } else if (action === 'add-category') {
      setSection('categories');
      setCategorySignal((s) => s + 1);
    } else if (action === 'add-user') {
      setSection('users');
      setUserSignal((s) => s + 1);
    }
  };

  const currency = settings?.general?.currency || 'INR';
  const meta = SECTION_META[section];

  return (
    <Layout
      activeSection={section}
      onNavigate={handleNavigate}
      ordersCount={overview.summary.totalOrders}
      alerts={{
        pendingOrders: overview.summary.pendingOrders,
        lowStockProducts: overview.summary.lowStockProducts,
        lowStockItems: overview.lowStockList,
      }}
      title={meta.title}
      subtitle={meta.subtitle}
      adminName={admin.name}
      adminRole={admin.role}
      onLogout={onLogout}
    >
      {section === 'dashboard' && (
        <DashboardPage
          currency={currency}
          onNavigate={(s) => setSection(s)}
          onQuickAction={handleQuickAction}
          refreshTick={refreshTick}
          onDataChanged={bumpRefresh}
        />
      )}
      {section === 'orders' && (
        <OrdersPage currency={currency} onDataChanged={bumpRefresh} />
      )}
      {section === 'products' && (
        <ProductsPage
          currency={currency}
          openCreateSignal={productSignal}
          onDataChanged={bumpRefresh}
        />
      )}
      {section === 'categories' && (
        <CategoriesPage
          openCreateSignal={categorySignal}
          onDataChanged={bumpRefresh}
        />
      )}
      {section === 'users' && (
        <UsersPage
          currency={currency}
          openCreateSignal={userSignal}
          onDataChanged={bumpRefresh}
        />
      )}
      {section === 'inventory' && (
        <InventoryPage currency={currency} onDataChanged={bumpRefresh} />
      )}
      {section === 'settings' && (
        <SettingsPage
          activeTab={settingsTab}
          onTabChange={setSettingsTab}
          settings={settings}
          onSettingsUpdated={(next) => {
            setSettings(next);
            bumpRefresh();
          }}
          onDataImported={bumpRefresh}
        />
      )}
      {section === 'email-templates' && (
        <EmailTemplatesPage onBackToDashboard={() => setSection('dashboard')} />
      )}
    </Layout>
  );
}

function ShopAdminAuthGate() {
  const [admin, setAdmin] = useState<AuthenticatedAdmin | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      if (window.location.pathname !== '/admin/login') {
        window.history.replaceState(null, '', '/admin/login');
      }
      setChecking(false);
    } else {
      apiRequest<{ admin: AuthenticatedAdmin }>('/api/auth/admin/me')
        .then((res) => {
          setAdmin(res.admin);
          if (window.location.pathname === '/admin/login') {
            window.history.replaceState(null, '', '/admin');
          }
        })
        .catch(() => {
          setAdminToken(null);
          setAdmin(null);
          if (window.location.pathname !== '/admin/login') {
            window.history.replaceState(null, '', '/admin/login');
          }
        })
        .finally(() => setChecking(false));
    }

    const unsub = onAdminUnauthorized(() => {
      setAdmin(null);
      if (window.location.pathname !== '/admin/login') {
        window.history.replaceState(null, '', '/admin/login');
      }
    });
    return unsub;
  }, []);

  const handleLoginSuccess = (loggedIn: AuthenticatedAdmin) => {
    setAdmin(loggedIn);
    if (window.location.pathname === '/admin/login') {
      window.history.replaceState(null, '', '/admin');
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/admin/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAdminToken(null);
    setAdmin(null);
    window.history.replaceState(null, '', '/admin/login');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0D1121] flex items-center justify-center text-sm font-medium text-slate-300">
        Checking administrator JWT session…
      </div>
    );
  }

  if (!admin) {
    return <AdminLoginPage onSuccess={handleLoginSuccess} />;
  }

  return (
    <GoogleDriveProvider>
      <ShopAdminWorkspace admin={admin} onLogout={handleLogout} />
    </GoogleDriveProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ShopAdminAuthGate />
    </ToastProvider>
  );
}
