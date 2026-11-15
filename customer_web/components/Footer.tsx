import React, { useState } from 'react';
import { ShoppingBag, Mail, Phone, MapPin, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function Footer() {
  const { config, navigate, user, openAuthModal } = useStore();
  const [policyModal, setPolicyModal] = useState<{ title: string; content: string } | null>(null);

  const general = config?.general;
  const shipping = config?.shipping;
  const storeName = general?.storeName || 'ShopAdmin';
  const addressParts = [
    general?.addressLine1,
    general?.addressLine2,
    general?.city,
    general?.state,
    general?.pinCode,
    general?.country,
  ].filter(Boolean);

  const openPolicy = (title: string, content: string) => {
    setPolicyModal({ title, content });
  };

  return (
    <footer className="bg-[#0D1121] text-slate-300 mt-16 pb-16 md:pb-0">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8">
        {/* Brand */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] flex items-center justify-center">
              <ShoppingBag className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">
              {storeName === 'ShopAdmin Store' ? (
                <>
                  Shop<span className="text-[#A78BFA]">Admin</span>
                </>
              ) : (
                storeName
              )}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-400 max-w-sm">
            {general?.storeDescription ||
              'Your one-stop online store for quality products curated with transparent pricing, secure checkout, and reliable delivery.'}
          </p>
        </div>

        {/* Quick Links */}
        <div className="lg:col-span-2 space-y-3">
          <h4 className="text-sm font-semibold text-white">Quick Links</h4>
          <ul className="space-y-2 text-xs text-slate-400">
            <li>
              <button type="button" onClick={() => navigate('/')} className="hover:text-white">
                Home
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/shop')} className="hover:text-white">
                Shop
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate('/categories')}
                className="hover:text-white"
              >
                Categories
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate('/shop?sort=newest')}
                className="hover:text-white"
              >
                New Arrivals
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate('/shop?minDiscount=10&tag=offers')}
                className="hover:text-white"
              >
                Offers
              </button>
            </li>
          </ul>
        </div>

        {/* Customer Support */}
        <div className="lg:col-span-2 space-y-3">
          <h4 className="text-sm font-semibold text-white">Customer Support</h4>
          <ul className="space-y-2 text-xs text-slate-400">
            <li>
              <button
                type="button"
                onClick={() =>
                  openPolicy(
                    'Contact Us',
                    `Reach our support team anytime at ${
                      general?.storeEmail || 'support@shopadmin.local'
                    }${general?.storePhone ? ` or call ${general.storePhone}` : ''}.`
                  )
                }
                className="hover:text-white"
              >
                Contact Us
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() =>
                  openPolicy(
                    'Shipping Policy',
                    `Orders are processed within ${
                      shipping?.processingTime || '1 Business Day'
                    }. Free shipping applies automatically on orders above ₹${
                      shipping?.freeShippingThreshold ?? 999
                    }.`
                  )
                }
                className="hover:text-white"
              >
                Shipping Policy
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() =>
                  openPolicy(
                    'Return Policy',
                    'Eligible unopened or defective items can be returned within 7 days of delivery.'
                  )
                }
                className="hover:text-white"
              >
                Return Policy
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() =>
                  openPolicy(
                    'Privacy Policy',
                    'Your personal information, saved addresses, and order history are securely stored and used exclusively to process and deliver your orders.'
                  )
                }
                className="hover:text-white"
              >
                Privacy Policy
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() =>
                  openPolicy(
                    'Terms & Conditions',
                    'All prices and inventory levels are synchronized live with our store catalog. Orders are confirmed upon OTP login and checkout completion.'
                  )
                }
                className="hover:text-white"
              >
                Terms & Conditions
              </button>
            </li>
          </ul>
        </div>

        {/* Account */}
        <div className="lg:col-span-2 space-y-3">
          <h4 className="text-sm font-semibold text-white">Account</h4>
          <ul className="space-y-2 text-xs text-slate-400">
            <li>
              <button
                type="button"
                onClick={() =>
                  user ? navigate('/account') : openAuthModal(() => navigate('/account'))
                }
                className="hover:text-white"
              >
                My Account
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() =>
                  user
                    ? navigate('/account/orders')
                    : openAuthModal(() => navigate('/account/orders'))
                }
                className="hover:text-white"
              >
                My Orders
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate('/wishlist')}
                className="hover:text-white"
              >
                Wishlist
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/cart')} className="hover:text-white">
                Cart
              </button>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div className="lg:col-span-2 space-y-3">
          <h4 className="text-sm font-semibold text-white">Contact</h4>
          <ul className="space-y-2.5 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <Mail className="w-3.5 h-3.5 text-[#A78BFA] shrink-0 mt-0.5" />
              <span className="break-all">{general?.storeEmail || 'support@shopadmin.local'}</span>
            </li>
            {general?.storePhone && (
              <li className="flex items-start gap-2">
                <Phone className="w-3.5 h-3.5 text-[#A78BFA] shrink-0 mt-0.5" />
                <span>{general.storePhone}</span>
              </li>
            )}
            {addressParts.length > 0 && (
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#A78BFA] shrink-0 mt-0.5" />
                <span>{addressParts.join(', ')}</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/[0.08]">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>© 2026 ShopAdmin. All rights reserved.</span>
          <a href="/admin" className="text-slate-400 hover:text-white transition-colors">
            Admin Panel
          </a>
        </div>
      </div>

      {policyModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setPolicyModal(null)}
        >
          <div
            className="bg-white text-slate-900 rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">{policyModal.title}</h3>
              <button
                type="button"
                onClick={() => setPolicyModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{policyModal.content}</p>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPolicyModal(null)}
                className="px-4 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
