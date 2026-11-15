import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import type {
  CartItem,
  CustomerUser,
  StoreCategory,
  StoreConfig,
  StoreProduct,
} from '../types';
import {
  getCustomerToken,
  readLocalJson,
  setCustomerToken,
  STORAGE_KEYS,
  storeApi,
  writeLocalJson,
} from '../lib/api';

interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error';
}

interface BuyNowSelection {
  product: StoreProduct;
  quantity: number;
}

interface StoreContextValue {
  pathname: string;
  searchParams: URLSearchParams;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
  config: StoreConfig | null;
  categories: StoreCategory[];
  user: CustomerUser | null;
  setUser: (u: CustomerUser | null) => void;
  cart: CartItem[];
  wishlist: string[];
  recentlyViewed: StoreProduct[];
  bootstrapped: boolean;
  cartCount: number;
  wishlistCount: number;
  buyNowItem: BuyNowSelection | null;
  setBuyNowItem: (item: BuyNowSelection | null) => void;
  addToCart: (product: StoreProduct, quantity?: number) => Promise<void>;
  updateCartQty: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleWishlist: (product: StoreProduct) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  recordRecentlyViewed: (product: StoreProduct) => void;
  refreshBootstrap: () => Promise<void>;
  authModalOpen: boolean;
  openAuthModal: (onSuccess?: () => void) => void;
  closeAuthModal: () => void;
  completeAuthSuccess: (payload: {
    token: string;
    user: CustomerUser;
    cart: CartItem[];
    wishlist: string[];
  }) => void;
  logout: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error') => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [locationUrl, setLocationUrl] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'
  );
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() =>
    readLocalJson<CartItem[]>(STORAGE_KEYS.GUEST_CART_KEY, [])
  );
  const [wishlist, setWishlist] = useState<string[]>(() =>
    readLocalJson<string[]>(STORAGE_KEYS.GUEST_WISHLIST_KEY, [])
  );
  const [recentlyViewed, setRecentlyViewed] = useState<StoreProduct[]>(() =>
    readLocalJson<StoreProduct[]>(STORAGE_KEYS.RECENTLY_VIEWED_KEY, [])
  );
  const [buyNowItem, setBuyNowItemState] = useState<BuyNowSelection | null>(() =>
    readLocalJson<BuyNowSelection | null>(STORAGE_KEYS.BUY_NOW_KEY, null)
  );
  const [bootstrapped, setBootstrapped] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const pendingAuthCallbackRef = useRef<(() => void) | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-2), { id, text, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setLocationUrl(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (to.startsWith('/admin')) {
      window.location.href = to;
      return;
    }
    const target = to.startsWith('/') ? to : `/${to}`;
    if (opts?.replace) {
      window.history.replaceState({}, '', target);
    } else {
      window.history.pushState({}, '', target);
    }
    setLocationUrl(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await storeApi<{
        config: StoreConfig;
        categories: StoreCategory[];
        user: CustomerUser | null;
        cart: CartItem[];
        wishlist: string[];
      }>('/api/store/bootstrap');

      setConfig(data.config);
      setCategories(data.categories || []);
      if (data.user) {
        setUser(data.user);
        setCart(data.cart || []);
        setWishlist(data.wishlist || []);
      } else {
        setUser(null);
        setCart(readLocalJson<CartItem[]>(STORAGE_KEYS.GUEST_CART_KEY, []));
        setWishlist(readLocalJson<string[]>(STORAGE_KEYS.GUEST_WISHLIST_KEY, []));
      }
    } catch (err) {
      console.error('Bootstrap error:', err);
    } finally {
      setBootstrapped(true);
    }
  }, []);

  useEffect(() => {
    refreshBootstrap();
  }, [refreshBootstrap]);

  const setBuyNowItem = useCallback((item: BuyNowSelection | null) => {
    setBuyNowItemState(item);
    writeLocalJson(STORAGE_KEYS.BUY_NOW_KEY, item);
  }, []);

  const addToCart = useCallback(
    async (product: StoreProduct, quantity = 1) => {
      if (product.stock <= 0) {
        showToast('This product is currently unavailable.', 'error');
        return;
      }

      if (user && getCustomerToken()) {
        try {
          const res = await storeApi<{ cart: CartItem[] }>('/api/store/cart', {
            method: 'POST',
            body: JSON.stringify({ productId: product._id, quantity }),
          });
          setCart(res.cart);
          showToast(`${product.name} added to cart`);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Failed to add to cart', 'error');
        }
        return;
      }

      // Guest local cart
      setCart((prev) => {
        const next = [...prev];
        const idx = next.findIndex((i) => i.productId === product._id);
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            quantity: Math.min(product.stock, next[idx].quantity + quantity),
            price: product.netPrice,
            originalPrice: product.price,
            discountPercent: product.discountPercent,
            stock: product.stock,
          };
        } else {
          next.push({
            productId: product._id,
            slug: product.slug,
            name: product.name,
            sku: product.sku,
            category: product.categoryName,
            image: product.images?.[0] || '',
            originalPrice: product.price,
            discountPercent: product.discountPercent,
            price: product.netPrice,
            quantity: Math.min(product.stock, quantity),
            stock: product.stock,
          });
        }
        writeLocalJson(STORAGE_KEYS.GUEST_CART_KEY, next);
        return next;
      });
      showToast(`${product.name} added to cart`);
    },
    [showToast, user]
  );

  const updateCartQty = useCallback(
    async (productId: string, quantity: number) => {
      if (user && getCustomerToken()) {
        try {
          const res = await storeApi<{ cart: CartItem[] }>(
            `/api/store/cart/${encodeURIComponent(productId)}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ quantity }),
            }
          );
          setCart(res.cart);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Failed to update cart', 'error');
        }
        return;
      }

      setCart((prev) => {
        const next =
          quantity <= 0
            ? prev.filter((i) => i.productId !== productId)
            : prev.map((i) =>
                i.productId === productId
                  ? { ...i, quantity: Math.min(Math.max(1, i.stock || 99), quantity) }
                  : i
              );
        writeLocalJson(STORAGE_KEYS.GUEST_CART_KEY, next);
        return next;
      });
    },
    [showToast, user]
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      if (user && getCustomerToken()) {
        try {
          const res = await storeApi<{ cart: CartItem[] }>(
            `/api/store/cart/${encodeURIComponent(productId)}`,
            { method: 'DELETE' }
          );
          setCart(res.cart);
          showToast('Item removed from cart');
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Failed to remove item', 'error');
        }
        return;
      }

      setCart((prev) => {
        const next = prev.filter((i) => i.productId !== productId);
        writeLocalJson(STORAGE_KEYS.GUEST_CART_KEY, next);
        return next;
      });
      showToast('Item removed from cart');
    },
    [showToast, user]
  );

  const clearCart = useCallback(async () => {
    if (user && getCustomerToken()) {
      try {
        await storeApi('/api/store/cart', { method: 'DELETE' });
        setCart([]);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to clear cart', 'error');
      }
      return;
    }
    setCart([]);
    writeLocalJson(STORAGE_KEYS.GUEST_CART_KEY, []);
  }, [showToast, user]);

  const toggleWishlist = useCallback(
    async (product: StoreProduct) => {
      if (user && getCustomerToken()) {
        try {
          const res = await storeApi<{ added: boolean; wishlist: string[] }>(
            '/api/store/wishlist/toggle',
            {
              method: 'POST',
              body: JSON.stringify({ productId: product._id }),
            }
          );
          setWishlist(res.wishlist);
          showToast(res.added ? 'Saved to wishlist' : 'Removed from wishlist');
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Failed to update wishlist', 'error');
        }
        return;
      }

      setWishlist((prev) => {
        const exists = prev.includes(product._id);
        const next = exists ? prev.filter((id) => id !== product._id) : [...prev, product._id];
        writeLocalJson(STORAGE_KEYS.GUEST_WISHLIST_KEY, next);
        showToast(exists ? 'Removed from wishlist' : 'Saved to wishlist');
        return next;
      });
    },
    [showToast, user]
  );

  const isWishlisted = useCallback(
    (productId: string) => wishlist.includes(productId),
    [wishlist]
  );

  const recordRecentlyViewed = useCallback((product: StoreProduct) => {
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((p) => p._id !== product._id);
      const next = [product, ...filtered].slice(0, 8);
      writeLocalJson(STORAGE_KEYS.RECENTLY_VIEWED_KEY, next);
      return next;
    });
  }, []);

  const openAuthModal = useCallback((onSuccess?: () => void) => {
    pendingAuthCallbackRef.current = onSuccess || null;
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    pendingAuthCallbackRef.current = null;
    setAuthModalOpen(false);
  }, []);

  const completeAuthSuccess = useCallback(
    (payload: {
      token: string;
      user: CustomerUser;
      cart: CartItem[];
      wishlist: string[];
    }) => {
      setCustomerToken(payload.token);
      setUser(payload.user);
      setCart(payload.cart || []);
      setWishlist(payload.wishlist || []);
      // Clear guest storage once merged into MongoDB
      writeLocalJson(STORAGE_KEYS.GUEST_CART_KEY, []);
      writeLocalJson(STORAGE_KEYS.GUEST_WISHLIST_KEY, []);
      setAuthModalOpen(false);
      showToast(`Welcome back, ${payload.user.name}!`);

      const cb = pendingAuthCallbackRef.current;
      pendingAuthCallbackRef.current = null;
      if (cb) {
        cb();
      }
    },
    [showToast]
  );

  const logout = useCallback(async () => {
    try {
      await storeApi('/api/store/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout error
    }
    setCustomerToken(null);
    setUser(null);
    setCart([]);
    setWishlist([]);
    showToast('Signed out successfully');
    navigate('/');
  }, [navigate, showToast]);

  const { pathname, searchParams } = useMemo(() => {
    const qIdx = locationUrl.indexOf('?');
    const path = qIdx >= 0 ? locationUrl.slice(0, qIdx) : locationUrl;
    const qs = qIdx >= 0 ? locationUrl.slice(qIdx + 1) : '';
    return {
      pathname: path || '/',
      searchParams: new URLSearchParams(qs),
    };
  }, [locationUrl]);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const wishlistCount = wishlist.length;

  return (
    <StoreContext.Provider
      value={{
        pathname,
        searchParams,
        navigate,
        config,
        categories,
        user,
        setUser,
        cart,
        wishlist,
        recentlyViewed,
        bootstrapped,
        cartCount,
        wishlistCount,
        buyNowItem,
        setBuyNowItem,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        toggleWishlist,
        isWishlisted,
        recordRecentlyViewed,
        refreshBootstrap,
        authModalOpen,
        openAuthModal,
        closeAuthModal,
        completeAuthSuccess,
        logout,
        showToast,
      }}
    >
      {children}

      {/* Floating Toast Container */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-[80] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium bg-white ${
              t.type === 'error'
                ? 'border-rose-200 text-rose-700'
                : 'border-emerald-200 text-slate-900'
            }`}
          >
            {t.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span className="flex-1">{t.text}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
