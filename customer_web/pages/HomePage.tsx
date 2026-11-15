import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Truck,
  ShieldCheck,
  RotateCcw,
  Headphones,
  FolderOpen,
  ShoppingBag,
  Sparkles,
  Tag,
} from 'lucide-react';
import type { StoreCategory, StoreProduct } from '../types';
import { storeApi } from '../lib/api';
import { formatCurrency } from '../lib/format';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';

interface HomeData {
  categories: StoreCategory[];
  featuredProducts: StoreProduct[];
  newArrivals: StoreProduct[];
  bestSellers: StoreProduct[];
  offers: StoreProduct[];
  totalProducts: number;
}

export function HomePage() {
  const { config, navigate, recentlyViewed } = useStore();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroImgError, setHeroImgError] = useState(false);
  const [failedCatImages, setFailedCatImages] = useState<Record<string, boolean>>({});

  const currency = config?.general?.currency || 'INR';
  const freeThreshold = config?.shipping?.freeShippingThreshold ?? 999;

  useEffect(() => {
    setLoading(true);
    setHeroImgError(false);
    storeApi<HomeData>('/api/store/home')
      .then((res) => setData(res))
      .catch((err) => console.error('Home load failed:', err))
      .finally(() => setLoading(false));
  }, []);

  const heroProduct =
    data?.featuredProducts?.find((p) => p.images?.length > 0) ||
    data?.newArrivals?.find((p) => p.images?.length > 0) ||
    null;

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6 space-y-8 sm:space-y-12">
      {/* 1. Hero Banner (Mobile-First Showcase + Desktop Split) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#F6F3FF] via-[#EDE9FE] to-[#E0E7FF] border border-violet-200/75 shadow-[0_8px_30px_rgba(109,40,217,0.08)]">
        {/* Subtle ambient glow accents */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-[#7C3AED]/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-12 w-56 h-56 rounded-full bg-indigo-400/15 blur-3xl"
        />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8 items-center">
          {/* Hero Product Visual: Full-bleed spotlight at top on mobile, framed card on right for desktop */}
          <div className="order-1 lg:order-2 lg:col-span-5 lg:py-8 lg:pr-10 flex justify-center lg:justify-end">
            {heroProduct && !heroImgError ? (
              <button
                type="button"
                onClick={() => navigate(`/product/${encodeURIComponent(heroProduct.slug)}`)}
                className="group relative w-full lg:max-w-[400px] bg-white lg:rounded-2xl lg:border lg:border-white lg:shadow-xl lg:p-3 text-left overflow-hidden lg:hover:-translate-y-0.5 transition-transform duration-200"
              >
                <div className="relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/3] lg:rounded-xl overflow-hidden bg-slate-100">
                  <img
                    src={heroProduct.images[0]}
                    alt={heroProduct.name}
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgError(true)}
                    className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-300"
                  />
                  {/* Mobile contrast scrim with featured product details */}
                  <div className="lg:hidden absolute inset-0 bg-gradient-to-t from-[#0D1121]/85 via-[#0D1121]/20 to-transparent" />
                  <div className="lg:hidden absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3 text-white">
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-violet-200 truncate">
                        {heroProduct.categoryName}
                        {heroProduct.discountPercent > 0
                          ? ` · ${heroProduct.discountPercent}% OFF`
                          : ''}
                      </div>
                      <div className="text-base font-bold leading-snug truncate">
                        {heroProduct.name}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-base font-extrabold tabular-nums">
                        {formatCurrency(heroProduct.netPrice, currency)}
                      </div>
                      {heroProduct.discountPercent > 0 && (
                        <div className="text-[11px] text-slate-300 line-through tabular-nums">
                          {formatCurrency(heroProduct.price, currency)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desktop card caption */}
                <div className="hidden lg:flex mt-3 px-1 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-[#6D28D9]">
                      {heroProduct.categoryName}
                    </div>
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {heroProduct.name}
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <div className="text-sm font-bold text-slate-900">
                      {formatCurrency(heroProduct.netPrice, currency)}
                    </div>
                    {heroProduct.discountPercent > 0 && (
                      <div className="text-[11px] text-slate-400 line-through">
                        {formatCurrency(heroProduct.price, currency)}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ) : (
              <div className="w-full lg:max-w-[380px] aspect-[16/9] lg:aspect-[4/3] lg:rounded-2xl bg-gradient-to-br from-[#2E1065] via-[#4C1D95] to-[#312E81] lg:border lg:border-white/20 shadow-sm flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-3">
                  <ShoppingBag className="w-7 h-7 text-white" />
                </div>
                <div className="text-sm font-bold">
                  {config?.general?.storeName || 'ShopAdmin Store'}
                </div>
                <p className="text-xs text-violet-200 mt-1">
                  Curated collections · Express delivery
                </p>
              </div>
            )}
          </div>

          {/* Hero Copy & CTAs */}
          <div className="order-2 lg:order-1 lg:col-span-7 p-5 sm:p-8 lg:p-12 space-y-3.5 sm:space-y-5">
            {data && data.totalProducts > 0 && (
              <div className="text-xs font-semibold text-[#5B21B6] flex items-center gap-2">
                <span>
                  {data.totalProducts} Curated {data.totalProducts === 1 ? 'Product' : 'Products'}
                </span>
                <span aria-hidden="true">·</span>
                <span>Free delivery over {formatCurrency(freeThreshold, currency)}</span>
              </div>
            )}

            <h1 className="text-[26px] sm:text-4xl lg:text-[44px] font-extrabold text-slate-900 leading-[1.12] tracking-tight text-balance">
              Discover Products You&apos;ll Love
            </h1>

            <p className="text-[13px] sm:text-base text-slate-600 max-w-xl leading-relaxed">
              Shop quality products at great prices with live inventory, fast shipping, and effortless checkout.
            </p>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
              <button
                type="button"
                onClick={() => navigate('/shop')}
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <span>Shop Now</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/categories')}
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <span className="sm:hidden">Categories</span>
                <span className="hidden sm:inline">Explore Categories</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Value Highlights Bar */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          {
            icon: Truck,
            title: 'Free Shipping',
            sub: `On orders above ${formatCurrency(freeThreshold, currency)}`,
          },
          {
            icon: ShieldCheck,
            title: 'Secure Payment',
            sub: 'Razorpay & Cash on Delivery',
          },
          {
            icon: RotateCcw,
            title: 'Easy Returns',
            sub: '7 days return policy',
          },
          {
            icon: Headphones,
            title: 'Dedicated Support',
            sub: 'Always here to help',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 flex items-center gap-3 sm:gap-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-violet-50 text-[#6D28D9] flex items-center justify-center shrink-0">
                <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">{item.title}</div>
                <div className="text-[11px] sm:text-xs text-slate-500 truncate">{item.sub}</div>
              </div>
            </div>
          );
        })}
      </section>

      {/* 2. Shop by Categories */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Shop by Categories</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Browse active collections from our catalog
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/categories')}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#6D28D9] hover:underline whitespace-nowrap"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 sm:gap-5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2.5">
                <div className="w-[84px] h-[84px] rounded-full bg-white border border-slate-200 animate-pulse" />
                <div className="h-4 w-16 rounded bg-slate-200/80 animate-pulse" />
              </div>
            ))}
          </div>
        ) : !data?.categories?.length ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No active categories yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Categories added in Admin Panel will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 sm:gap-5">
            {data.categories.slice(0, 6).map((cat) => {
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
      </section>

      {/* 3. Featured Products */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Featured Products</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Handpicked favorites from our live inventory
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#6D28D9] hover:underline whitespace-nowrap"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-72 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : !data?.featuredProducts?.length ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <ShoppingBag className="w-9 h-9 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No products available right now</p>
            <p className="text-xs text-slate-500 mt-1">
              Active products saved in MongoDB will appear here immediately.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {data.featuredProducts.slice(0, 4).map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* 4. Special Offers & New Arrivals Split Promo */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="rounded-3xl bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] border border-violet-200 p-6 sm:p-8 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5B21B6]">
              <Tag className="w-3.5 h-3.5" />
              <span>Special Offers</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Save up to 50%
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-sm">
              {data?.offers?.length
                ? `${data.offers.length} discounted product(s) currently live in store.`
                : 'Explore current markdowns and promotional offers across categories.'}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => navigate('/shop?minDiscount=10&tag=offers')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold transition-colors"
            >
              <span>Shop Offers</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] border border-indigo-200 p-6 sm:p-8 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fresh In Stock</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">New Arrivals</h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-sm">
              Discover our latest product additions synced straight from the catalog.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => navigate('/shop?sort=newest')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-colors"
            >
              <span>View All New Arrivals</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 5. New Arrivals & Best Sellers */}
      {!loading && data && data.newArrivals.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">New Arrivals</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Recently added items in our store
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/shop?sort=newest')}
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#6D28D9] hover:underline whitespace-nowrap"
            >
              <span>View All</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {data.newArrivals.slice(0, 4).map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </section>
      )}

      {!loading && data && data.bestSellers.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Best Sellers</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Top customer picks based on order volume and ratings
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/shop?sort=bestselling')}
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#6D28D9] hover:underline whitespace-nowrap"
            >
              <span>View All</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {data.bestSellers.slice(0, 4).map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* 6. Recently Viewed */}
      {recentlyViewed.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Recently Viewed</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Pick up right where you left off
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {recentlyViewed.slice(0, 4).map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
