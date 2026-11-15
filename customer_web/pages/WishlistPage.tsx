import React, { useEffect, useState } from 'react';
import { Heart, ShoppingCart, Trash2, Package } from 'lucide-react';
import type { StoreProduct } from '../types';
import { storeApi } from '../lib/api';
import { formatCurrency } from '../lib/format';
import { useStore } from '../context/StoreContext';

export function WishlistPage() {
  const { config, user, wishlist, navigate, addToCart, toggleWishlist } = useStore();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const currency = config?.general?.currency || 'INR';

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        if (user) {
          const res = await storeApi<{ products: StoreProduct[] }>('/api/store/wishlist');
          if (active) setProducts(res.products || []);
        } else if (wishlist.length === 0) {
          if (active) setProducts([]);
        } else {
          const res = await storeApi<{ products: StoreProduct[] }>(
            '/api/store/products?limit=48'
          );
          const idSet = new Set(wishlist);
          if (active) {
            setProducts((res.products || []).filter((p) => idSet.has(p._id)));
          }
        }
      } catch (err) {
        console.error('Wishlist load error:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [user, wishlist]);

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <button type="button" onClick={() => navigate('/')} className="hover:text-[#6D28D9]">
          Home
        </button>
        <span>/</span>
        <span className="font-medium text-slate-900">Wishlist</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">My Wishlist</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 tabular-nums">
            {wishlist.length} saved {wishlist.length === 1 ? 'item' : 'items'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Your Wishlist is Empty</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Save products you love and find them here later.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="px-6 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((product) => {
            const outOfStock = product.stock <= 0;
            return (
              <div
                key={product._id}
                className="bg-white rounded-2xl border border-slate-200/85 overflow-hidden flex flex-col justify-between shadow-xs"
              >
                <div
                  onClick={() => navigate(`/product/${encodeURIComponent(product.slug)}`)}
                  className="cursor-pointer"
                >
                  <div className="aspect-[4/3] bg-slate-50 overflow-hidden flex items-center justify-center">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-10 h-10 text-slate-300" />
                    )}
                  </div>
                  <div className="p-4 space-y-1.5">
                    <div className="text-xs text-slate-400">{product.categoryName}</div>
                    <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                      {product.name}
                    </h3>
                    <div className="flex items-baseline gap-2 tabular-nums">
                      <span className="text-base font-bold text-slate-900">
                        {formatCurrency(product.netPrice, currency)}
                      </span>
                      {product.discountPercent > 0 && (
                        <span className="text-xs text-slate-400 line-through">
                          {formatCurrency(product.price, currency)}
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-xs font-semibold ${
                        outOfStock ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {outOfStock ? 'Out of Stock' : 'In Stock'}
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={outOfStock}
                    onClick={() => addToCart(product, 1)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold disabled:opacity-50"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Add to Cart</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                    title="Remove from wishlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
