import React, { useCallback, useEffect, useState } from 'react';
import {
  Star,
  Heart,
  ShoppingCart,
  Zap,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Truck,
  RotateCcw,
  ShieldCheck,
  Package,
  Check,
  X,
} from 'lucide-react';
import type { StoreProduct } from '../types';
import { storeApi } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/format';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';

interface ProductDetailResponse {
  product: StoreProduct;
  ratingBreakdown: Record<number, number>;
  relatedProducts: StoreProduct[];
}

export function ProductDetailPage({ slug }: { slug: string }) {
  const {
    config,
    user,
    navigate,
    addToCart,
    toggleWishlist,
    isWishlisted,
    recordRecentlyViewed,
    setBuyNowItem,
    openAuthModal,
    showToast,
  } = useStore();

  const [data, setData] = useState<ProductDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImg, setActiveImg] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'specifications' | 'reviews'>(
    'description'
  );

  // Review form
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const currency = config?.general?.currency || 'INR';
  const freeThreshold = config?.shipping?.freeShippingThreshold ?? 999;

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await storeApi<ProductDetailResponse>(
        `/api/store/products/${encodeURIComponent(slug)}`
      );
      setData(res);
      setActiveImg(0);
      setQuantity(1);
      recordRecentlyViewed(res.product);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Product not found');
    } finally {
      setLoading(false);
    }
  }, [recordRecentlyViewed, slug]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (loading) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 h-[440px] rounded-2xl bg-white border border-slate-200 animate-pulse" />
        <div className="lg:col-span-6 h-[440px] rounded-2xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  if (error || !data?.product) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">Product Not Found</h1>
          <p className="text-sm text-slate-500">{error || 'This item is no longer available.'}</p>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="px-5 py-2.5 rounded-xl bg-[#6D28D9] text-white text-sm font-semibold"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  const product = data.product;
  const images = product.images || [];
  const wishlisted = isWishlisted(product._id);
  const outOfStock = product.stock <= 0;

  const handleBuyNow = () => {
    if (outOfStock) {
      showToast('This product is currently unavailable.', 'error');
      return;
    }
    setBuyNowItem({ product, quantity });
    if (user) {
      navigate('/checkout?mode=buynow');
    } else {
      openAuthModal(() => navigate('/checkout?mode=buynow'));
    }
  };

  const handleWriteReviewClick = () => {
    if (!user) {
      openAuthModal(() => {
        setActiveTab('reviews');
        setReviewFormOpen(true);
      });
      return;
    }
    setReviewFormOpen((v) => !v);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) {
      showToast('Please write your review comment.', 'error');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await storeApi<{
        product: StoreProduct;
        ratingBreakdown: Record<number, number>;
      }>(`/api/store/products/${encodeURIComponent(product.slug)}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              product: res.product,
              ratingBreakdown: res.ratingBreakdown,
            }
          : prev
      );
      setReviewComment('');
      setReviewRating(5);
      setReviewFormOpen(false);
      showToast('Thank you! Your review has been published.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit review', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-6 space-y-12">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <button type="button" onClick={() => navigate('/')} className="hover:text-[#6D28D9]">
          Home
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={() => navigate(`/shop?category=${encodeURIComponent(product.categoryName)}`)}
          className="hover:text-[#6D28D9]"
        >
          {product.categoryName}
        </button>
        <span>/</span>
        <span className="font-semibold text-slate-900 truncate">{product.name}</span>
      </div>

      {/* Main Product Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Gallery */}
        <div className="lg:col-span-6 grid grid-cols-12 gap-3">
          {images.length > 1 && (
            <div className="col-span-2 flex flex-col gap-2.5">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImg(idx)}
                  className={`aspect-square rounded-xl overflow-hidden border-2 transition-colors ${
                    activeImg === idx ? 'border-[#6D28D9]' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img
                    src={img}
                    alt={`${product.name} ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <div
            className={`${
              images.length > 1 ? 'col-span-10' : 'col-span-12'
            } relative aspect-square rounded-2xl bg-white border border-slate-200/80 overflow-hidden flex items-center justify-center`}
          >
            {images[activeImg] ? (
              <>
                <img
                  src={images[activeImg]}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setZoomOpen(true)}
                  className="absolute bottom-3 right-3 w-9 h-9 rounded-xl bg-white/90 border border-slate-200 text-slate-700 hover:text-[#6D28D9] flex items-center justify-center shadow-sm"
                  aria-label="Zoom image"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400">
                <Package className="w-16 h-16 mb-2 text-slate-300" />
                <span className="text-xs">No image available</span>
              </div>
            )}

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveImg((prev) => (prev - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveImg((prev) => (prev + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Contiguous Purchase Module */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 space-y-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#6D28D9]">
              {product.categoryName} · SKU {product.sku}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{product.name}</h1>

            <div className="flex items-center gap-2 text-sm">
              <div className="inline-flex items-center gap-1 text-amber-500 font-semibold tabular-nums">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{product.ratingAverage || 'New'}</span>
              </div>
              <span className="text-slate-400">·</span>
              <button
                type="button"
                onClick={() => setActiveTab('reviews')}
                className="text-slate-600 hover:text-[#6D28D9] text-xs font-medium tabular-nums"
              >
                {product.reviewCount} {product.reviewCount === 1 ? 'review' : 'reviews'}
              </button>
            </div>
          </div>

          {/* Pricing */}
          <div className="flex flex-wrap items-baseline gap-3 pt-1">
            <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
              {formatCurrency(product.netPrice, currency)}
            </span>
            {product.discountPercent > 0 && (
              <>
                <span className="text-lg text-slate-400 line-through tabular-nums">
                  {formatCurrency(product.price, currency)}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold tabular-nums">
                  {product.discountPercent}% OFF
                </span>
              </>
            )}
          </div>

          {/* Stock Status */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            {outOfStock ? (
              <span className="text-rose-600">Out of Stock — Currently unavailable</span>
            ) : product.stockStatus === 'Low Stock' ? (
              <span className="text-amber-600 inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Low Stock — Only {product.stock} left</span>
              </span>
            ) : (
              <span className="text-emerald-600 inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>In Stock ({product.stock} available)</span>
              </span>
            )}
          </div>

          {product.description && (
            <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>
          )}

          {/* Quantity */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Quantity</label>
            <div className="inline-flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              <button
                type="button"
                disabled={outOfStock || quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 font-semibold"
              >
                −
              </button>
              <span className="w-12 text-center text-sm font-bold text-slate-900 tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                disabled={outOfStock || quantity >= product.stock}
                onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 font-semibold"
              >
                +
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2.5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={outOfStock}
                onClick={() => addToCart(product, quantity)}
                className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold shadow-sm disabled:opacity-50 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{outOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
              </button>

              <button
                type="button"
                disabled={outOfStock}
                onClick={handleBuyNow}
                className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm disabled:opacity-50 transition-colors"
              >
                <Zap className="w-4 h-4" />
                <span>Buy Now</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => toggleWishlist(product)}
              className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl border text-sm font-semibold transition-colors ${
                wishlisted
                  ? 'border-rose-200 bg-rose-50 text-rose-600'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${wishlisted ? 'fill-rose-600' : ''}`} />
              <span>{wishlisted ? 'Saved in Wishlist' : 'Add to Wishlist'}</span>
            </button>
          </div>

          {/* Trust Mini Strip */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Truck className="w-4 h-4 text-[#6D28D9] shrink-0" />
              <span>Free above {formatCurrency(freeThreshold, currency)}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <RotateCcw className="w-4 h-4 text-[#6D28D9] shrink-0" />
              <span>7 Days Return</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <ShieldCheck className="w-4 h-4 text-[#6D28D9] shrink-0" />
              <span>Secure Payment</span>
            </div>
          </div>
        </div>
      </div>

      {/* Product Tabs: Description, Specifications, Reviews */}
      <section className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-200 px-6 flex items-center gap-6 overflow-x-auto">
          {[
            { id: 'description' as const, label: 'Description' },
            { id: 'specifications' as const, label: 'Specifications' },
            { id: 'reviews' as const, label: `Reviews (${product.reviewCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#6D28D9] text-[#6D28D9]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'description' && (
            <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed">
              {product.description ? (
                <p className="whitespace-pre-line">{product.description}</p>
              ) : (
                <p>
                  {product.name} ({product.sku}) in {product.categoryName}. Available for immediate
                  order and fast shipping.
                </p>
              )}
            </div>
          )}

          {activeTab === 'specifications' && (
            <div className="overflow-x-auto">
              <table className="w-full max-w-xl text-left border-collapse text-sm">
                <tbody className="divide-y divide-slate-100">
                  {product.specifications.map((spec) => (
                    <tr key={spec.key}>
                      <th className="py-3 pr-6 font-semibold text-slate-500 w-44">{spec.key}</th>
                      <td className="py-3 text-slate-900 font-medium">{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-4xl font-extrabold text-slate-900 tabular-nums">
                      {product.ratingAverage || '0.0'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 tabular-nums">
                      Based on {product.reviewCount} reviews
                    </div>
                  </div>
                  <div className="space-y-1 min-w-[180px]">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = data.ratingBreakdown?.[star] || 0;
                      const pct =
                        product.reviewCount > 0
                          ? Math.round((count / product.reviewCount) * 100)
                          : 0;
                      return (
                        <div key={star} className="flex items-center gap-2 text-xs">
                          <span className="w-5 text-slate-600 tabular-nums">{star}★</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-6 text-right text-slate-400 tabular-nums">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleWriteReviewClick}
                  className="px-4 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold"
                >
                  Write a Review
                </button>
              </div>

              {reviewFormOpen && (
                <form
                  onSubmit={handleSubmitReview}
                  className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">Your Rating:</span>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setReviewRating(s)}
                        className="p-0.5"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            s <= reviewRating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience with this product..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewFormOpen(false)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="px-4 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {submittingReview ? 'Submitting…' : 'Submit Review'}
                    </button>
                  </div>
                </form>
              )}

              {product.reviews.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">
                  No customer reviews yet. Be the first to review this product.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {product.reviews.map((rev, idx) => (
                    <div key={rev._id || idx} className="py-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {rev.userName}
                        </span>
                        <span className="text-xs text-slate-400 tabular-nums">
                          {formatDate(rev.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, sIdx) => (
                          <Star
                            key={sIdx}
                            className={`w-3.5 h-3.5 ${
                              sIdx < rev.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-slate-600">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Related Products */}
      {data.relatedProducts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">You May Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {data.relatedProducts.slice(0, 4).map((rel) => (
              <ProductCard key={rel._id} product={rel} />
            ))}
          </div>
        </section>
      )}

      {/* Image Zoom Lightbox */}
      {zoomOpen && images[activeImg] && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setZoomOpen(false)}
        >
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={images[activeImg]}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[88vh] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
