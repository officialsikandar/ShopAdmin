import React, { useState } from 'react';
import { Heart, ShoppingCart, Star, Package, Check } from 'lucide-react';
import type { StoreProduct } from '../types';
import { formatCurrency } from '../lib/format';
import { useStore } from '../context/StoreContext';

interface ProductCardProps {
  product: StoreProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const { config, navigate, addToCart, toggleWishlist, isWishlisted } = useStore();
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const currency = config?.general?.currency || 'INR';
  const wishlisted = isWishlisted(product._id);
  const outOfStock = product.stock <= 0;

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (outOfStock || adding) return;
    setAdding(true);
    await addToCart(product, 1);
    setAdding(false);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product);
  };

  const openDetail = () => {
    navigate(`/product/${encodeURIComponent(product.slug || product._id)}`);
  };

  return (
    <div
      onClick={openDetail}
      className="group bg-white rounded-2xl border border-slate-200/85 overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col cursor-pointer"
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
        {product.images?.[0] && !imgError ? (
          <img
            src={product.images[0]}
            alt={product.name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-violet-50/50 text-slate-400">
            <Package className="w-10 h-10 mb-1.5 text-slate-300" />
            <span className="text-[11px] font-medium text-slate-400">{product.categoryName}</span>
          </div>
        )}

        {/* Top-left offer or stock label */}
        {outOfStock ? (
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-slate-900/85 text-white text-[11px] font-semibold">
            Out of Stock
          </span>
        ) : product.discountPercent > 0 ? (
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[#6D28D9] text-white text-[11px] font-bold tabular-nums">
            {product.discountPercent}% OFF
          </span>
        ) : null}

        {/* Wishlist Heart */}
        <button
          type="button"
          onClick={handleWishlist}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${
            wishlisted
              ? 'bg-rose-50 border-rose-200 text-rose-600'
              : 'bg-white/90 border-slate-200/80 text-slate-600 hover:text-rose-600'
          }`}
        >
          <Heart className={`w-4 h-4 ${wishlisted ? 'fill-rose-600' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold text-slate-400 truncate">
            {product.categoryName}
          </div>
          <h3 className="text-sm sm:text-[15px] font-semibold text-slate-900 mt-0.5 line-clamp-1 group-hover:text-[#6D28D9] transition-colors">
            {product.name}
          </h3>

          {/* Rating */}
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500 tabular-nums">
            <Star
              className={`w-3.5 h-3.5 ${
                product.ratingAverage > 0
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-300'
              }`}
            />
            {product.reviewCount > 0 ? (
              <>
                <span className="font-semibold text-slate-700">{product.ratingAverage}</span>
                <span>({product.reviewCount})</span>
              </>
            ) : (
              <span>No reviews yet</span>
            )}
          </div>

          {/* Pricing */}
          <div className="flex items-baseline gap-2 mt-2 tabular-nums">
            <span className="text-base font-bold text-slate-900">
              {formatCurrency(product.netPrice, currency)}
            </span>
            {product.discountPercent > 0 && (
              <span className="text-xs text-slate-400 line-through">
                {formatCurrency(product.price, currency)}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={outOfStock || adding}
          onClick={handleAdd}
          className={`w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold border transition-colors whitespace-nowrap ${
            outOfStock
              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
              : justAdded
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-violet-200 bg-violet-50/40 text-[#6D28D9] hover:bg-[#6D28D9] hover:text-white hover:border-[#6D28D9]'
          }`}
        >
          {justAdded ? (
            <>
              <Check className="w-4 h-4" />
              <span>Added</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4" />
              <span>{outOfStock ? 'Unavailable' : adding ? 'Adding…' : 'Add to Cart'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
