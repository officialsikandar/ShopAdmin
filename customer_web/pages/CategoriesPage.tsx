import React, { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import type { StoreCategory } from '../types';
import { storeApi } from '../lib/api';
import { useStore } from '../context/StoreContext';

export function CategoriesPage() {
  const { navigate } = useStore();
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedCatImages, setFailedCatImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    storeApi<{ categories: StoreCategory[] }>('/api/store/categories')
      .then((res) => setCategories(res.categories || []))
      .catch((err) => console.error('Categories error:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <button type="button" onClick={() => navigate('/')} className="hover:text-[#6D28D9]">
          Home
        </button>
        <span>/</span>
        <span className="font-medium text-slate-900">Categories</span>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">All Categories</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Explore our product collections synced live from MongoDB
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 sm:gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2.5">
              <div className="w-[84px] h-[84px] rounded-full bg-white border border-slate-200 animate-pulse" />
              <div className="h-4 w-16 rounded bg-slate-200/80 animate-pulse" />
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h2 className="text-base font-bold text-slate-900">No active categories</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Add categories in the ShopAdmin panel to organize your storefront.
          </p>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="px-5 py-2.5 rounded-xl bg-[#6D28D9] text-white text-sm font-semibold"
          >
            Browse Products
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 sm:gap-5">
          {categories.map((cat) => {
            const showImage = Boolean(cat.image) && !failedCatImages[cat._id];
            return (
              <button
                key={cat._id}
                type="button"
                onClick={() => navigate(`/category/${encodeURIComponent(cat.slug)}`)}
                className="group flex flex-col items-center text-center focus-visible:outline-none"
              >
                <div className="w-[84px] h-[84px] rounded-full overflow-hidden bg-white border border-slate-200/90 shadow-sm group-hover:border-[#6D28D9]/50 group-hover:shadow-md transition-all flex items-center justify-center shrink-0">
                  {showImage ? (
                    <img
                      src={cat.image}
                      alt={cat.name}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedCatImages((prev) => ({ ...prev, [cat._id]: true }))
                      }
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <FolderOpen className="w-7 h-7 text-violet-400" />
                  )}
                </div>
                <div className="mt-2.5 font-category-display uppercase text-lg sm:text-xl tracking-wider leading-tight text-slate-900 group-hover:text-[#6D28D9] transition-colors max-w-[110px] truncate">
                  {cat.name}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
