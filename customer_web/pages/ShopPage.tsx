import React, { useCallback, useEffect, useState } from 'react';
import {
  SlidersHorizontal,
  X,
  Star,
  Search,
  ChevronLeft,
  ChevronRight,
  Package,
} from 'lucide-react';
import type { StoreCategory, StoreProduct } from '../types';
import { storeApi } from '../lib/api';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';

interface ShopResponse {
  products: StoreProduct[];
  total: number;
  page: number;
  limit: number;
  categoryInfo: StoreCategory | null;
  categories: StoreCategory[];
  facetCounts: {
    inStock: number;
    outOfStock: number;
    rating5: number;
    rating4: number;
    rating3: number;
    discount10: number;
    discount20: number;
    discount30: number;
    discount50: number;
  };
}

const PRICE_RANGES = [
  { id: 'under-500', label: 'Under ₹500', min: '', max: '500' },
  { id: '500-1000', label: '₹500 – ₹1,000', min: '500', max: '1000' },
  { id: '1000-2500', label: '₹1,000 – ₹2,500', min: '1000', max: '2500' },
  { id: '2500-5000', label: '₹2,500 – ₹5,000', min: '2500', max: '5000' },
  { id: '5000-plus', label: '₹5,000+', min: '5000', max: '' },
];

export function ShopPage({ categorySlug }: { categorySlug?: string }) {
  const { searchParams, navigate } = useStore();

  const initialSearch = searchParams.get('search') || '';
  const initialSort = searchParams.get('sort') || 'recommended';
  const initialCategory = categorySlug || searchParams.get('category') || '';
  const initialDiscount = searchParams.get('minDiscount') || '';
  const initialTag = searchParams.get('tag') || '';

  const [selectedCats, setSelectedCats] = useState<string[]>(
    initialCategory ? initialCategory.split(',').filter(Boolean) : []
  );
  const [pricePreset, setPricePreset] = useState<string>('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [availability, setAvailability] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [minDiscount, setMinDiscount] = useState(initialDiscount);
  const [sort, setSort] = useState(initialSort);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [page, setPage] = useState(1);

  const [draftCats, setDraftCats] = useState<string[]>(selectedCats);
  const [draftPricePreset, setDraftPricePreset] = useState('');
  const [draftMinPrice, setDraftMinPrice] = useState('');
  const [draftMaxPrice, setDraftMaxPrice] = useState('');
  const [draftMinRating, setDraftMinRating] = useState('');
  const [draftAvailability, setDraftAvailability] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [draftMinDiscount, setDraftMinDiscount] = useState(initialDiscount);

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [data, setData] = useState<ShopResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const nextSearch = searchParams.get('search') || '';
    const nextSort = searchParams.get('sort') || 'recommended';
    const nextCat = categorySlug || searchParams.get('category') || '';
    const nextDisc = searchParams.get('minDiscount') || '';
    const nextCatArr = nextCat ? nextCat.split(',').filter(Boolean) : [];

    setSearchTerm(nextSearch);
    setSort(nextSort);
    setSelectedCats(nextCatArr);
    setDraftCats(nextCatArr);
    setMinDiscount(nextDisc);
    setDraftMinDiscount(nextDisc);
    setPage(1);
  }, [categorySlug, searchParams]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        search: searchTerm,
        category: selectedCats.join(','),
        minPrice,
        maxPrice,
        minRating,
        availability,
        minDiscount,
        tag: initialTag,
        sort,
        page: String(page),
        limit: '12',
      });
      const res = await storeApi<ShopResponse>(`/api/store/products?${qs.toString()}`);
      setData(res);
    } catch (err) {
      console.error('Shop load error:', err);
    } finally {
      setLoading(false);
    }
  }, [
    availability,
    initialTag,
    maxPrice,
    minDiscount,
    minPrice,
    minRating,
    page,
    searchTerm,
    selectedCats,
    sort,
  ]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const applyDraftFilters = () => {
    setSelectedCats(draftCats);
    setPricePreset(draftPricePreset);
    setMinPrice(draftMinPrice);
    setMaxPrice(draftMaxPrice);
    setMinRating(draftMinRating);
    setAvailability(draftAvailability);
    setMinDiscount(draftMinDiscount);
    setPage(1);
    setMobileFilterOpen(false);
  };

  const clearAllFilters = () => {
    setSelectedCats([]);
    setDraftCats([]);
    setPricePreset('');
    setDraftPricePreset('');
    setMinPrice('');
    setMaxPrice('');
    setDraftMinPrice('');
    setDraftMaxPrice('');
    setMinRating('');
    setDraftMinRating('');
    setAvailability('all');
    setDraftAvailability('all');
    setMinDiscount('');
    setDraftMinDiscount('');
    setSearchTerm('');
    setPage(1);
    if (categorySlug || searchParams.toString()) {
      navigate('/shop');
    }
  };

  const selectPreset = (presetId: string) => {
    if (draftPricePreset === presetId) {
      setDraftPricePreset('');
      setDraftMinPrice('');
      setDraftMaxPrice('');
    } else {
      const found = PRICE_RANGES.find((r) => r.id === presetId);
      setDraftPricePreset(presetId);
      setDraftMinPrice(found?.min || '');
      setDraftMaxPrice(found?.max || '');
    }
  };

  const toggleDraftCat = (slug: string) => {
    setDraftCats((prev) =>
      prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]
    );
  };

  const renderFilterControls = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900">Filters</h3>
        <button
          type="button"
          onClick={clearAllFilters}
          className="text-xs font-semibold text-[#6D28D9] hover:underline"
        >
          Clear All
        </button>
      </div>

      {/* Categories */}
      <div className="space-y-2.5">
        <div className="text-xs font-bold text-slate-700">Categories</div>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {(data?.categories || []).map((cat) => (
            <label
              key={cat._id}
              className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draftCats.includes(cat.slug) || draftCats.includes(cat.name)}
                  onChange={() => toggleDraftCat(cat.slug)}
                  className="rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
                />
                <span>{cat.name}</span>
              </span>
              <span className="text-slate-400 tabular-nums">({cat.productCount})</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="space-y-2.5 pt-4 border-t border-slate-100">
        <div className="text-xs font-bold text-slate-700">Price Range</div>
        <div className="space-y-1.5">
          {PRICE_RANGES.map((range) => (
            <label
              key={range.id}
              className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
            >
              <input
                type="radio"
                name="pricePreset"
                checked={draftPricePreset === range.id}
                onChange={() => selectPreset(range.id)}
                className="text-[#6D28D9] focus:ring-[#6D28D9]"
              />
              <span>{range.label}</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <input
            type="number"
            min={0}
            value={draftMinPrice}
            onChange={(e) => {
              setDraftPricePreset('');
              setDraftMinPrice(e.target.value);
            }}
            placeholder="Min ₹"
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg tabular-nums"
          />
          <input
            type="number"
            min={0}
            value={draftMaxPrice}
            onChange={(e) => {
              setDraftPricePreset('');
              setDraftMaxPrice(e.target.value);
            }}
            placeholder="Max ₹"
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg tabular-nums"
          />
        </div>
      </div>

      {/* Rating */}
      <div className="space-y-2.5 pt-4 border-t border-slate-100">
        <div className="text-xs font-bold text-slate-700">Rating</div>
        <div className="space-y-1.5">
          {[
            { value: '5', stars: 5, label: '5 Stars', count: data?.facetCounts?.rating5 },
            { value: '4', stars: 4, label: '4★ & up', count: data?.facetCounts?.rating4 },
            { value: '3', stars: 3, label: '3★ & up', count: data?.facetCounts?.rating3 },
          ].map((r) => (
            <label
              key={r.value}
              className="flex items-center justify-between text-xs text-slate-700 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="minRating"
                  checked={draftMinRating === r.value}
                  onChange={() => setDraftMinRating(draftMinRating === r.value ? '' : r.value)}
                  className="text-[#6D28D9]"
                />
                <span className="inline-flex items-center gap-0.5 text-amber-400">
                  {Array.from({ length: r.stars }).map((_, idx) => (
                    <Star key={idx} className="w-3.5 h-3.5 fill-amber-400" />
                  ))}
                </span>
                <span className="text-slate-600">{r.label}</span>
              </span>
              {typeof r.count === 'number' && (
                <span className="text-slate-400 tabular-nums">({r.count})</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Availability */}
      <div className="space-y-2.5 pt-4 border-t border-slate-100">
        <div className="text-xs font-bold text-slate-700">Availability</div>
        <div className="space-y-1.5">
          {[
            { value: 'in_stock' as const, label: 'In Stock', count: data?.facetCounts?.inStock },
            {
              value: 'out_of_stock' as const,
              label: 'Out of Stock',
              count: data?.facetCounts?.outOfStock,
            },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex items-center justify-between text-xs text-slate-700 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="availability"
                  checked={draftAvailability === opt.value}
                  onChange={() =>
                    setDraftAvailability(draftAvailability === opt.value ? 'all' : opt.value)
                  }
                  className="text-[#6D28D9]"
                />
                <span>{opt.label}</span>
              </span>
              {typeof opt.count === 'number' && (
                <span className="text-slate-400 tabular-nums">({opt.count})</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Discount */}
      <div className="space-y-2.5 pt-4 border-t border-slate-100">
        <div className="text-xs font-bold text-slate-700">Discount</div>
        <div className="space-y-1.5">
          {[
            { value: '10', label: '10% & above', count: data?.facetCounts?.discount10 },
            { value: '20', label: '20% & above', count: data?.facetCounts?.discount20 },
            { value: '30', label: '30% & above', count: data?.facetCounts?.discount30 },
            { value: '50', label: '50% & above', count: data?.facetCounts?.discount50 },
          ].map((d) => (
            <label
              key={d.value}
              className="flex items-center justify-between text-xs text-slate-700 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="minDiscount"
                  checked={draftMinDiscount === d.value}
                  onChange={() =>
                    setDraftMinDiscount(draftMinDiscount === d.value ? '' : d.value)
                  }
                  className="text-[#6D28D9]"
                />
                <span>{d.label}</span>
              </span>
              {typeof d.count === 'number' && (
                <span className="text-slate-400 tabular-nums">({d.count})</span>
              )}
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={applyDraftFilters}
        className="w-full py-2.5 px-4 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors"
      >
        Apply Filters
      </button>
    </div>
  );

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / 12));
  const headingTitle = data?.categoryInfo
    ? data.categoryInfo.name
    : searchTerm
    ? `Search: "${searchTerm}"`
    : 'Shop All Products';

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <button type="button" onClick={() => navigate('/')} className="hover:text-[#6D28D9]">
          Home
        </button>
        <span>/</span>
        <span className="font-medium text-slate-900">{headingTitle}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{headingTitle}</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 tabular-nums">
            Showing {data?.products?.length || 0} of {data?.total || 0} products
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className="lg:hidden inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-slate-500">Sort by:</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800"
            >
              <option value="recommended">Recommended</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="bestselling">Best Selling</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Filter Sidebar */}
        <aside className="hidden lg:block lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sticky top-20">
          {renderFilterControls()}
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-9 space-y-6">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-72 rounded-2xl bg-white border border-slate-200 animate-pulse"
                />
              ))}
            </div>
          ) : !data?.products?.length ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              {searchTerm ? (
                <Search className="w-10 h-10 text-slate-300 mx-auto" />
              ) : (
                <Package className="w-10 h-10 text-slate-300 mx-auto" />
              )}
              <h2 className="text-lg font-bold text-slate-900">No products found</h2>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                We couldn&apos;t find anything matching your search or selected filters.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-5 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {data.products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pNum = idx + 1;
                    return (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => setPage(pNum)}
                        className={`w-9 h-9 rounded-xl text-xs font-semibold tabular-nums ${
                          page === pNum
                            ? 'bg-[#6D28D9] text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Filter Modal */}
      {mobileFilterOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 flex items-end sm:items-center justify-center p-0 sm:p-4 lg:hidden"
          onClick={() => setMobileFilterOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Filter Products</span>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderFilterControls()}
          </div>
        </div>
      )}
    </div>
  );
}
