import React from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthOtpModal } from './components/AuthOtpModal';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { WishlistPage } from './pages/WishlistPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderSuccessPage } from './pages/OrderSuccessPage';
import { AccountPage } from './pages/AccountPage';

function StorefrontRouter() {
  const { pathname } = useStore();

  const renderPage = () => {
    if (pathname === '/' || pathname === '') {
      return <HomePage />;
    }
    if (pathname === '/shop') {
      return <ShopPage />;
    }
    if (pathname === '/categories') {
      return <CategoriesPage />;
    }
    if (pathname.startsWith('/category/')) {
      const slug = decodeURIComponent(pathname.slice('/category/'.length));
      return <ShopPage categorySlug={slug} />;
    }
    if (pathname.startsWith('/product/')) {
      const slug = decodeURIComponent(pathname.slice('/product/'.length));
      return <ProductDetailPage slug={slug} />;
    }
    if (pathname === '/wishlist') {
      return <WishlistPage />;
    }
    if (pathname === '/cart') {
      return <CartPage />;
    }
    if (pathname === '/checkout') {
      return <CheckoutPage />;
    }
    if (pathname.startsWith('/order-success/')) {
      const id = decodeURIComponent(pathname.slice('/order-success/'.length));
      return <OrderSuccessPage orderId={id} />;
    }
    if (pathname === '/account') {
      return <AccountPage initialTab="overview" />;
    }
    if (pathname === '/account/orders') {
      return <AccountPage initialTab="orders" />;
    }
    if (pathname.startsWith('/account/orders/')) {
      const id = decodeURIComponent(pathname.slice('/account/orders/'.length));
      return <AccountPage initialTab="orders" orderId={id} />;
    }
    return <HomePage />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FC] text-slate-900">
      <Navbar />
      <main className="flex-1 pb-8">{renderPage()}</main>
      <Footer />
      <AuthOtpModal />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <StorefrontRouter />
    </StoreProvider>
  );
}
