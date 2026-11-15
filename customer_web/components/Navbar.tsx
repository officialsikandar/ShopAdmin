import React, { useEffect, useRef, useState } from 'react';
import {
  ShoppingBag,
  Search,
  Heart,
  ShoppingCart,
  User,
  Menu,
  X,
  ChevronDown,
  Home,
  Store,
  Package,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { storeApi } from '../lib/api';
import { formatCurrency } from '../lib/format';
import type { StoreProduct } from '../types';

export function Navbar() {
  const {
    pathname,
    navigate,
    config,
    categories,
    user,
    cartCount,
    wishlistCount,
    openAuthModal,
  } = useStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [liveResults, setLiveResults] = useState<StoreProduct[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  const storeName = config?.general?.storeName || 'ShopAdmin';
  const storeLogo = config?.general?.storeLogo || '';
  const currency = config?.general?.currency || 'INR';

  useEffect(() => {
    setLogoError(false);
  }, [storeLogo]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setLiveResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await storeApi<{ products: StoreProduct[] }>(
          `/api/store/products?search=${encodeURIComponent(trimmed)}&limit=6`
        );
        setLiveResults(res.products || []);
      } catch {
        setLiveResults([]);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchFocused(false);
    setMobileSearchOpen(false);
    const trimmed = query.trim();
    navigate(trimmed ? `/shop?search=${encodeURIComponent(trimmed)}` : '/shop');
  };

  const handleAccountClick = () => {
    if (user) {
      navigate('/account');
    } else {
      openAuthModal(() => navigate('/account'));
    }
  };

  const isNavActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/80">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 lg:gap-8">
          {/* Mobile Hamburger + Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0"
            >
              {storeLogo && !logoError ? (
                <img
                  src={storeLogo}
                  alt={storeName}
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] flex items-center justify-center shadow-sm shrink-0">
                  <ShoppingBag className="w-4.5 h-4.5 text-white" />
                </div>
              )}
              <span className="text-lg font-bold tracking-tight text-slate-900">
                {storeName === 'ShopAdmin Store' ? (
                  <>
                    Shop<span className="text-[#6D28D9]">Admin</span>
                  </>
                ) : (
                  storeName
                )}
              </span>
            </button>
          </div>

          {/* Center Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => navigate('/')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#6D28D9] ${
                isNavActive('/') ? 'text-[#6D28D9] font-semibold' : ''
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#6D28D9] ${
                pathname === '/shop' ? 'text-[#6D28D9] font-semibold' : ''
              }`}
            >
              Shop
            </button>

            {/* Categories Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setCatDropdownOpen(true)}
              onMouseLeave={() => setCatDropdownOpen(false)}
            >
              <button
                type="button"
                onClick={() => navigate('/categories')}
                className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors hover:text-[#6D28D9] ${
                  isNavActive('/categories') || isNavActive('/category/')
                    ? 'text-[#6D28D9] font-semibold'
                    : ''
                }`}
              >
                <span>Categories</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {catDropdownOpen && (
                <div className="absolute left-0 top-full pt-2 w-60 z-50">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCatDropdownOpen(false);
                        navigate('/categories');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#6D28D9] hover:bg-violet-50"
                    >
                      All Categories
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    {categories.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-400">No categories yet</div>
                    ) : (
                      categories.slice(0, 8).map((cat) => (
                        <button
                          key={cat._id}
                          type="button"
                          onClick={() => {
                            setCatDropdownOpen(false);
                            navigate(`/category/${encodeURIComponent(cat.slug)}`);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#6D28D9]"
                        >
                          <span className="truncate">{cat.name}</span>
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            {cat.productCount}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate('/shop?sort=newest')}
              className="whitespace-nowrap shrink-0 transition-colors hover:text-[#6D28D9]"
            >
              New Arrivals
            </button>
            <button
              type="button"
              onClick={() => navigate('/shop?minDiscount=10&tag=offers')}
              className="px-3 py-1 rounded-lg bg-[#6D28D9] text-white text-xs font-semibold hover:bg-[#5B21B6] transition-colors whitespace-nowrap shrink-0"
            >
              Offers
            </button>
          </nav>

          {/* Right Utilities: Live Search, Wishlist, Cart, Account */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Desktop Live Search */}
            <div ref={searchBoxRef} className="hidden lg:block relative w-64 xl:w-72">
              <form onSubmit={handleSearchSubmit}>
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onFocus={() => setSearchFocused(true)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchFocused(true);
                  }}
                  placeholder="Search products, SKU..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-100/80 border border-slate-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
                />
              </form>

              {searchFocused && query.trim().length > 0 && (
                <div className="absolute right-0 left-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50">
                  {liveResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No matching products found. Press Enter to search all.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {liveResults.map((p) => (
                        <button
                          key={p._id}
                          type="button"
                          onClick={() => {
                            setSearchFocused(false);
                            navigate(`/product/${encodeURIComponent(p.slug)}`);
                          }}
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 text-left"
                        >
                          {p.images?.[0] ? (
                            <img
                              src={p.images[0]}
                              alt={p.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {p.categoryName} · {p.sku}
                            </div>
                          </div>
                          <div className="text-xs font-bold text-slate-900 tabular-nums shrink-0">
                            {formatCurrency(p.netPrice, currency)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile / Tablet Search Icon */}
            <button
              type="button"
              onClick={() => setMobileSearchOpen((v) => !v)}
              className="lg:hidden w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50"
              aria-label="Search products"
            >
              <Search className="w-4.5 h-4.5" />
            </button>

            {/* Wishlist */}
            <button
              type="button"
              onClick={() => navigate('/wishlist')}
              className="hidden sm:inline-flex relative w-10 h-10 rounded-xl border border-slate-200 items-center justify-center text-slate-700 hover:bg-slate-50 hover:text-[#6D28D9]"
              aria-label="Wishlist"
              title="Wishlist"
            >
              <Heart className="w-4.5 h-4.5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#6D28D9] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Cart */}
            <button
              type="button"
              onClick={() => navigate('/cart')}
              className="relative w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 hover:text-[#6D28D9]"
              aria-label="Cart"
              title="Shopping Cart"
            >
              <ShoppingCart className="w-4.5 h-4.5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#6D28D9] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Account */}
            <button
              type="button"
              onClick={handleAccountClick}
              className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#6D28D9] whitespace-nowrap"
            >
              <User className="w-4 h-4" />
              <span className="max-w-[96px] truncate">{user ? user.name.split(' ')[0] : 'Account'}</span>
            </button>
          </div>
        </div>

        {/* Expandable Mobile/Tablet Search Bar */}
        {mobileSearchOpen && (
          <div className="lg:hidden px-4 pb-3 border-t border-slate-100 bg-white">
            <form onSubmit={handleSearchSubmit} className="relative mt-2.5">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products by name, SKU, category..."
                className="w-full pl-9 pr-20 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#6D28D9]"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-[#6D28D9] text-white text-xs font-semibold"
              >
                Search
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col justify-between p-5">
            <div className="space-y-5 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-slate-900">{storeName}</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                {[
                  { label: 'Home', to: '/' },
                  { label: 'Shop All', to: '/shop' },
                  { label: 'Categories', to: '/categories' },
                  { label: 'New Arrivals', to: '/shop?sort=newest' },
                  { label: 'Special Offers', to: '/shop?minDiscount=10&tag=offers' },
                  { label: 'Wishlist', to: '/wishlist' },
                  { label: 'Cart', to: '/cart' },
                ].map((link) => (
                  <button
                    key={link.label}
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate(link.to);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-violet-50 hover:text-[#6D28D9]"
                  >
                    {link.label}
                  </button>
                ))}
              </div>

              {categories.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <div className="px-3 text-xs font-semibold text-slate-400 mb-2">
                    Shop by Category
                  </div>
                  <div className="space-y-1">
                    {categories.map((cat) => (
                      <button
                        key={cat._id}
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          navigate(`/category/${encodeURIComponent(cat.slug)}`);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <span>{cat.name}</span>
                        <span className="text-slate-400 tabular-nums">{cat.productCount}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleAccountClick();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#6D28D9] text-white text-sm font-semibold"
            >
              {user ? `${user.name} (My Account)` : 'Login with Email OTP'}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-white border-t border-slate-200 grid grid-cols-5 h-14 px-1">
        {[
          { label: 'Home', icon: Home, active: pathname === '/', onClick: () => navigate('/') },
          {
            label: 'Shop',
            icon: Store,
            active: pathname.startsWith('/shop') || pathname.startsWith('/categor'),
            onClick: () => navigate('/shop'),
          },
          {
            label: 'Wishlist',
            icon: Heart,
            active: pathname === '/wishlist',
            badge: wishlistCount,
            onClick: () => navigate('/wishlist'),
          },
          {
            label: 'Cart',
            icon: ShoppingCart,
            active: pathname === '/cart',
            badge: cartCount,
            onClick: () => navigate('/cart'),
          },
          {
            label: 'Account',
            icon: User,
            active: pathname.startsWith('/account'),
            onClick: handleAccountClick,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                item.active ? 'text-[#6D28D9]' : 'text-slate-500'
              }`}
            >
              <div className="relative">
                <Icon className="w-4.5 h-4.5" />
                {item.badge ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-[#6D28D9] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
