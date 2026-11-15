import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  FolderKanban,
  Users,
  Boxes,
  Settings,
  Mail,
  ChevronLeft,
  ChevronRight,
  Bell,
  Menu,
  X,
  AlertTriangle,
  Clock,
  HardDrive,
  LogOut,
  FolderOpen,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import type { NavSection } from '../types';
import { GoogleSignInButton, useGoogleDrive } from './GoogleDriveContext';

interface AlertSummary {
  pendingOrders: number;
  lowStockProducts: number;
  lowStockItems: Array<{ _id: string; name: string; sku: string; stock: number }>;
}

interface LayoutProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection, settingsTab?: 'general' | 'security') => void;
  ordersCount: number;
  alerts: AlertSummary;
  title: string;
  subtitle: string;
  adminName?: string;
  adminRole?: string;
  onLogout?: () => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export function Layout({
  activeSection,
  onNavigate,
  ordersCount,
  alerts,
  title,
  subtitle,
  adminName = 'Sikandar Khan',
  adminRole = 'Admin',
  onLogout,
  headerActions,
  children,
}: LayoutProps) {
  const adminInitials = adminName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SK';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [driveMenuOpen, setDriveMenuOpen] = useState(false);
  const {
    connected,
    hasActiveToken,
    connecting,
    googleUser,
    driveFolders,
    connectDrive,
    disconnectDrive,
  } = useGoogleDrive();

  const sidebarWidth = collapsed ? '76px' : '240px';

  const manageItems: Array<{
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: ShoppingBag, badge: ordersCount },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'categories', label: 'Categories', icon: FolderKanban },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
  ];

  const settingsItems: Array<{
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'email-templates', label: 'Email Templates', icon: Mail },
  ];

  const hasAlerts = alerts.pendingOrders > 0 || alerts.lowStockProducts > 0;

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-[#0D1121] text-slate-200 select-none">
      {/* Brand Header */}
      <div
        className={`flex items-center ${
          collapsed && !isMobile ? 'justify-center px-3' : 'justify-between px-5'
        } h-16 border-b border-white/[0.07] shrink-0`}
      >
        <button
          type="button"
          onClick={() => {
            onNavigate('dashboard');
            setMobileOpen(false);
          }}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] flex items-center justify-center shadow-md shadow-violet-950/50 shrink-0">
            <ShoppingBag className="w-4.5 h-4.5 text-white" />
          </div>
          {(!collapsed || isMobile) && (
            <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
              Shop<span className="text-[#A78BFA]">Admin</span>
            </span>
          )}
        </button>

        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        <div>
          {(!collapsed || isMobile) && (
            <div className="px-3 mb-2 text-[11px] font-semibold text-slate-400 tracking-wide">
              Manage
            </div>
          )}
          <nav className="space-y-1">
            {manageItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={collapsed && !isMobile ? item.label : undefined}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileOpen(false);
                  }}
                  className={`w-full flex items-center ${
                    collapsed && !isMobile ? 'justify-center px-2' : 'justify-between px-3.5'
                  } py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#6D28D9] text-white shadow-sm shadow-violet-950/50'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4.5 h-4.5 shrink-0" />
                    {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
                  </span>
                  {(!collapsed || isMobile) && typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-full tabular-nums ${
                        isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-2 border-t border-white/[0.07]">
          {(!collapsed || isMobile) && (
            <div className="px-3 mb-2 text-[11px] font-semibold text-slate-400 tracking-wide">
              Settings
            </div>
          )}
          <nav className="space-y-1">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={collapsed && !isMobile ? item.label : undefined}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileOpen(false);
                  }}
                  className={`w-full flex items-center ${
                    collapsed && !isMobile ? 'justify-center px-2' : 'gap-3 px-3.5'
                  } py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#6D28D9] text-white shadow-sm shadow-violet-950/50'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Admin Profile + Collapse */}
      <div className="p-3 border-t border-white/[0.07] shrink-0 space-y-2">
        <div
          className={`flex items-center ${
            collapsed && !isMobile ? 'flex-col gap-2' : 'justify-between gap-2'
          } px-2 py-2 rounded-xl bg-white/[0.03]`}
        >
          <button
            type="button"
            onClick={() => {
              onNavigate('settings', 'security');
              setMobileOpen(false);
            }}
            className="flex items-center gap-2.5 min-w-0 text-left group"
            title={`${adminName} — Admin Settings`}
          >
            <div className="w-9 h-9 rounded-full bg-white text-[#0D1121] font-bold text-xs flex items-center justify-center shrink-0">
              {adminInitials}
            </div>
            {(!collapsed || isMobile) && (
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate group-hover:text-[#C4B5FD] transition-colors">
                  {adminName}
                </div>
                <div className="text-xs text-slate-400 truncate">{adminRole}</div>
              </div>
            )}
          </button>

          {!isMobile && (
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onLogout();
            }}
            title="Sign Out"
            className={`w-full flex items-center ${
              collapsed && !isMobile ? 'justify-center px-2' : 'gap-2.5 px-3.5'
            } py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-rose-300 hover:bg-rose-500/10 transition-colors`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {(!collapsed || isMobile) && <span>Sign Out</span>}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen flex bg-[#F6F7FB] text-slate-900"
      style={{ '--sidebar-w': sidebarWidth } as React.CSSProperties}
    >
      {/* Fixed Desktop/Tablet Sidebar */}
      <aside
        className="hidden md:block fixed inset-y-0 left-0 z-30 transition-[width] duration-200 ease-out"
        style={{ width: sidebarWidth }}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 max-w-[80vw] h-full z-10 shadow-2xl">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-[margin] duration-200 ease-out md:ml-[var(--sidebar-w)]"
      >
        {/* Top Workspace Header */}
        <header className="sticky top-0 z-20 bg-[#F6F7FB]/95 backdrop-blur-sm border-b border-slate-200/70 px-4 sm:px-7 py-4">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                  {title}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 truncate mt-0.5">{subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {headerActions}

              {/* Google Drive Storage Connection */}
              {!connected ? (
                <GoogleSignInButton
                  onClick={connectDrive}
                  disabled={connecting}
                  label={connecting ? 'Connecting…' : 'Sign in with Google'}
                  className="hidden sm:inline-flex"
                />
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDriveMenuOpen((prev) => !prev)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      hasActiveToken
                        ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100/70'
                        : 'border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-100/70'
                    }`}
                    title={
                      hasActiveToken
                        ? 'Google Drive Active (ecom_store)'
                        : 'Google Drive Linked — Click to resume upload session'
                    }
                  >
                    <HardDrive
                      className={`w-3.5 h-3.5 shrink-0 ${
                        hasActiveToken ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    />
                    <span className="hidden md:inline max-w-[150px] truncate">
                      {googleUser?.email || 'Drive Linked'}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        hasActiveToken ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                  </button>

                  {driveMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDriveMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-20 p-4 space-y-3">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                          {googleUser?.photoURL ? (
                            <img
                              src={googleUser.photoURL}
                              alt={googleUser.displayName || 'Google Account'}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                              GD
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {googleUser?.displayName || 'Google Drive Linked'}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {googleUser?.email}
                            </div>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-600 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                              <FolderOpen className="w-3.5 h-3.5 text-[#6D28D9]" />
                              <span>Drive Root: ecom_store</span>
                            </span>
                            {driveFolders?.rootFolder?.webViewLink && (
                              <a
                                href={driveFolders.rootFolder.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#6D28D9] font-semibold hover:underline"
                              >
                                <span>Open</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 leading-relaxed">
                            profile_image · category_image · product_image · store_logo
                          </div>
                        </div>

                        {!hasActiveToken && (
                          <button
                            type="button"
                            disabled={connecting}
                            onClick={async () => {
                              await connectDrive();
                              setDriveMenuOpen(false);
                            }}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${connecting ? 'animate-spin' : ''}`} />
                            <span>{connecting ? 'Resuming…' : 'Resume Upload Session'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={async () => {
                            setDriveMenuOpen(false);
                            await disconnectDrive();
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Disconnect Google Drive</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <a
                href="/"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#6D28D9] transition-colors whitespace-nowrap"
                title="Open Customer Storefront"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Store</span>
              </a>

              {/* Notifications Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((prev) => !prev)}
                  className="relative w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                  aria-label="View alerts"
                >
                  <Bell className="w-4.5 h-4.5" />
                  {hasAlerts && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500" />
                  )}
                </button>

                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-20 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">Store Alerts</span>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {alerts.pendingOrders + alerts.lowStockProducts} active
                        </span>
                      </div>
                      <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                        {!hasAlerts ? (
                          <p className="text-xs text-slate-500 py-4 text-center">
                            All orders and stock levels look good.
                          </p>
                        ) : (
                          <>
                            {alerts.pendingOrders > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setNotifOpen(false);
                                  onNavigate('orders');
                                }}
                                className="w-full flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 text-left"
                              >
                                <div className="w-8 h-8 rounded-lg bg-violet-50 text-[#6D28D9] flex items-center justify-center shrink-0">
                                  <Clock className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-slate-900">
                                    {alerts.pendingOrders} Pending Order(s)
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Orders awaiting confirmation or shipment
                                  </div>
                                </div>
                              </button>
                            )}
                            {alerts.lowStockItems.map((item) => (
                              <button
                                key={item._id}
                                type="button"
                                onClick={() => {
                                  setNotifOpen(false);
                                  onNavigate('inventory');
                                }}
                                className="w-full flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 text-left"
                              >
                                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                  <AlertTriangle className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-slate-900 truncate">
                                    {item.name}
                                  </div>
                                  <div className="text-[11px] text-rose-600 tabular-nums">
                                    SKU {item.sku} · {item.stock === 0 ? 'Out of stock' : `Only ${item.stock} left`}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Admin Avatar */}
              <button
                type="button"
                onClick={() => onNavigate('settings', 'security')}
                className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/70 text-[#5B21B6] text-xs font-bold flex items-center justify-center hover:bg-indigo-100 transition-colors"
                title={`${adminName} (${adminRole})`}
              >
                {adminInitials}
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-7 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
