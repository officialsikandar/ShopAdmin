import crypto from 'node:crypto';
import express from 'express';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import { signCustomerJwt, verifyJwtToken } from './jwt.ts';
import {
  Category,
  Coupon,
  CustomerSession,
  Order,
  OtpVerification,
  Product,
  StoreSettings,
  User,
} from './models.ts';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getNetPrice(price: number, discountPercent = 0) {
  if (discountPercent > 0) {
    return Math.round(price * (1 - discountPercent / 100));
  }
  return Math.round(price);
}

interface StoreProductDoc {
  _id: unknown;
  name: string;
  slug?: string;
  sku: string;
  categoryId?: unknown;
  categoryName?: string;
  price: number;
  discountPercent?: number;
  stock: number;
  lowStockThreshold?: number;
  status: string;
  description?: string;
  images?: string[];
  specifications?: Array<{ key: string; value: string }>;
  reviews?: Array<{
    _id?: unknown;
    userId?: unknown;
    userName: string;
    rating: number;
    comment: string;
    createdAt?: Date;
  }>;
  ratingAverage?: number;
  reviewCount?: number;
  isFeatured?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

function formatStoreProduct(p: StoreProductDoc, salesMap?: Map<string, number>) {
  const slug = p.slug || slugify(p.name) || String(p.sku || p._id).toLowerCase();
  const discountPercent = Number(p.discountPercent || 0);
  const netPrice = getNetPrice(Number(p.price || 0), discountPercent);
  const reviews = Array.isArray(p.reviews) ? p.reviews : [];
  const reviewCount = typeof p.reviewCount === 'number' && p.reviewCount > 0 ? p.reviewCount : reviews.length;
  const ratingAverage =
    typeof p.ratingAverage === 'number' && p.ratingAverage > 0
      ? Number(p.ratingAverage.toFixed(1))
      : reviews.length > 0
      ? Number((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1))
      : 0;

  const thr = p.lowStockThreshold ?? 10;
  const stockStatus =
    p.stock <= 0 ? 'Out of Stock' : p.stock <= thr ? 'Low Stock' : 'In Stock';

  const specs =
    Array.isArray(p.specifications) && p.specifications.length > 0
      ? p.specifications
      : [
          { key: 'SKU', value: p.sku },
          { key: 'Category', value: p.categoryName || 'General' },
          { key: 'Availability', value: stockStatus },
          ...(discountPercent > 0 ? [{ key: 'Offer', value: `${discountPercent}% OFF` }] : []),
        ];

  return {
    _id: String(p._id),
    name: p.name,
    slug,
    sku: p.sku,
    categoryId: p.categoryId ? String(p.categoryId) : null,
    categoryName: p.categoryName || 'Uncategorized',
    price: Number(p.price || 0),
    netPrice,
    discountPercent,
    stock: Number(p.stock || 0),
    lowStockThreshold: thr,
    stockStatus,
    status: p.status,
    description: p.description || '',
    images: Array.isArray(p.images) ? p.images : [],
    specifications: specs,
    reviews,
    ratingAverage,
    reviewCount,
    salesCount: salesMap ? salesMap.get(String(p._id)) || 0 : 0,
    isFeatured: Boolean(p.isFeatured),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function getProductSalesMap(): Promise<Map<string, number>> {
  const orders = await Order.find({ status: { $ne: 'Cancelled' } }, 'items').lean();
  const salesMap = new Map<string, number>();
  for (const order of orders) {
    const items = (order.items as Array<{ productId?: unknown; quantity?: number }>) || [];
    for (const item of items) {
      if (item.productId) {
        const key = String(item.productId);
        salesMap.set(key, (salesMap.get(key) || 0) + Number(item.quantity || 0));
      }
    }
  }
  return salesMap;
}

async function getPublicStoreConfig() {
  const settings = await StoreSettings.findOne({ singletonKey: 'default' }).lean();
  return {
    general: {
      storeName: settings?.general?.storeName || 'ShopAdmin Store',
      storeSlug: settings?.general?.storeSlug || 'shopadmin-store',
      storeDescription:
        settings?.general?.storeDescription ||
        'Your one-stop online store for quality products curated with transparent pricing and reliable delivery.',
      storeLogo: settings?.general?.storeLogo || '',
      storeEmail: settings?.general?.storeEmail || 'support@shopadmin.local',
      storePhone: settings?.general?.storePhone || '',
      addressLine1: settings?.general?.addressLine1 || '',
      addressLine2: settings?.general?.addressLine2 || '',
      city: settings?.general?.city || '',
      state: settings?.general?.state || '',
      pinCode: settings?.general?.pinCode || '',
      country: settings?.general?.country || 'India',
      currency: settings?.general?.currency || 'INR',
      productReviews: settings?.general?.productReviews ?? true,
    },
    shipping: {
      enableShipping: settings?.shipping?.enableShipping ?? true,
      freeShipping: settings?.shipping?.freeShipping ?? true,
      flatRateShipping: settings?.shipping?.flatRateShipping ?? false,
      shippingCharge: Number(settings?.shipping?.shippingCharge ?? 40),
      freeShippingThreshold: Number(settings?.shipping?.freeShippingThreshold ?? 999),
      processingTime: settings?.shipping?.processingTime || '1 Business Day',
      showEstimatedDelivery: settings?.shipping?.showEstimatedDelivery ?? true,
      methods:
        settings?.shipping?.methods?.filter((m: { status?: string }) => m.status !== 'Inactive') ||
        [],
    },
    tax: {
      enableGst: settings?.tax?.enableGst ?? true,
      pricingMode: settings?.tax?.pricingMode || 'inclusive',
      defaultTaxRate: Number(settings?.tax?.defaultTaxRate ?? 18),
    },
    razorpay: {
      enabled: Boolean(settings?.integrations?.razorpay?.enabled),
      keyId: settings?.integrations?.razorpay?.keyId || '',
      environment: settings?.integrations?.razorpay?.environment || 'Test',
    },
  };
}

async function getCategoryCountsList() {
  const [categories, activeProducts] = await Promise.all([
    Category.find({ status: 'Active' }).sort({ name: 1 }).lean(),
    Product.find({ status: 'Active' }, 'categoryId categoryName').lean(),
  ]);

  const byId = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const p of activeProducts) {
    if (p.categoryId) {
      const k = String(p.categoryId);
      byId.set(k, (byId.get(k) || 0) + 1);
    }
    if (p.categoryName) {
      const k = String(p.categoryName).toLowerCase();
      byName.set(k, (byName.get(k) || 0) + 1);
    }
  }

  return categories.map((c) => ({
    _id: String(c._id),
    name: c.name,
    slug: c.slug,
    description: c.description || '',
    image: c.image || '',
    icon: c.icon || 'folder',
    productCount: byId.get(String(c._id)) || byName.get(c.name.toLowerCase()) || 0,
  }));
}

async function resolveAuthenticatedCustomer(req: express.Request) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;

  const payload = verifyJwtToken(token);
  if (!payload || payload.type !== 'customer') {
    return null;
  }

  const session = await CustomerSession.findOne({
    token: payload.jti,
    userId: payload.sub,
  }).lean();
  if (!session || new Date(session.expiresAt) < new Date()) {
    if (session) {
      await CustomerSession.deleteOne({ _id: session._id });
    }
    return null;
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status === 'Blocked') return null;
  return { user, token, jti: payload.jti };
}

async function populateUserCartWithLiveProducts(
  user: InstanceType<typeof User>
): Promise<
  Array<{
    productId: string;
    slug: string;
    name: string;
    sku: string;
    category: string;
    image: string;
    originalPrice: number;
    discountPercent: number;
    price: number;
    quantity: number;
    stock: number;
  }>
> {
  const cartItems = (user.cart as Array<{
    productId: unknown;
    name: string;
    sku: string;
    category: string;
    image: string;
    price: number;
    quantity: number;
  }>) || [];
  if (cartItems.length === 0) return [];

  const productIds = cartItems.map((i) => i.productId).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  return cartItems.map((item) => {
    const p = productMap.get(String(item.productId));
    const originalPrice = p ? Number(p.price) : Number(item.price);
    const discountPercent = p ? Number(p.discountPercent || 0) : 0;
    const liveNetPrice = p ? getNetPrice(originalPrice, discountPercent) : Number(item.price);
    return {
      productId: String(item.productId),
      slug: p?.slug || slugify(p?.name || item.name) || String(item.productId),
      name: p?.name || item.name,
      sku: p?.sku || item.sku,
      category: p?.categoryName || item.category,
      image: p?.images?.[0] || item.image || '',
      originalPrice,
      discountPercent,
      price: liveNetPrice,
      quantity: item.quantity,
      stock: p ? Number(p.stock) : 0,
    };
  });
}

async function findProductBySlugOrId(slugOrId: string) {
  const trimmed = decodeURIComponent(String(slugOrId || '')).trim();
  if (!trimmed) return null;

  if (mongoose.isValidObjectId(trimmed)) {
    const byId = await Product.findById(trimmed).lean();
    if (byId) return byId;
  }

  const bySlug = await Product.findOne({ slug: trimmed.toLowerCase() }).lean();
  if (bySlug) return bySlug;

  const bySku = await Product.findOne({ sku: trimmed.toUpperCase() }).lean();
  if (bySku) return bySku;

  const allProducts = await Product.find().lean();
  return (
    allProducts.find((p) => slugify(p.name) === trimmed.toLowerCase()) || null
  );
}

function sanitizeCustomerUser(user: InstanceType<typeof User>) {
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    profileImage: user.profileImage || '',
    user_role: user.user_role,
    status: user.status,
    addresses: user.addresses || [],
    wishlist: (user.wishlist || []).map((id: unknown) => String(id)),
    createdAt: user.createdAt,
  };
}

export function createStoreRouter() {
  const router = express.Router();

  // ==================== BOOTSTRAP & HOME ====================
  router.get('/bootstrap', async (req, res) => {
    try {
      const [config, categories, auth] = await Promise.all([
        getPublicStoreConfig(),
        getCategoryCountsList(),
        resolveAuthenticatedCustomer(req),
      ]);

      let user = null;
      let cart: unknown[] = [];
      let wishlist: string[] = [];

      if (auth) {
        user = sanitizeCustomerUser(auth.user);
        cart = await populateUserCartWithLiveProducts(auth.user);
        wishlist = (auth.user.wishlist || []).map((id: unknown) => String(id));
      }

      res.json({ config, categories, user, cart, wishlist });
    } catch (err) {
      console.error('Store bootstrap error:', err);
      res.status(500).json({ error: 'Failed to load store data' });
    }
  });

  router.get('/home', async (_req, res) => {
    try {
      const [categories, activeProducts, salesMap] = await Promise.all([
        getCategoryCountsList(),
        Product.find({ status: 'Active' }).sort({ createdAt: -1 }).lean(),
        getProductSalesMap(),
      ]);

      const formatted = activeProducts.map((p) =>
        formatStoreProduct(p as unknown as StoreProductDoc, salesMap)
      );

      const featuredProducts = [...formatted]
        .sort((a, b) => {
          if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
          if (b.discountPercent !== a.discountPercent) return b.discountPercent - a.discountPercent;
          return b.ratingAverage - a.ratingAverage;
        })
        .slice(0, 8);

      const newArrivals = formatted.slice(0, 8);

      const bestSellers = [...formatted]
        .sort((a, b) => {
          if (b.salesCount !== a.salesCount) return b.salesCount - a.salesCount;
          return b.reviewCount - a.reviewCount;
        })
        .slice(0, 8);

      const offers = formatted
        .filter((p) => p.discountPercent > 0)
        .sort((a, b) => b.discountPercent - a.discountPercent)
        .slice(0, 8);

      res.json({
        categories,
        featuredProducts,
        newArrivals,
        bestSellers,
        offers,
        totalProducts: formatted.length,
      });
    } catch (err) {
      console.error('Store home error:', err);
      res.status(500).json({ error: 'Failed to load homepage products' });
    }
  });

  router.get('/categories', async (_req, res) => {
    try {
      const categories = await getCategoryCountsList();
      res.json({ categories });
    } catch {
      res.status(500).json({ error: 'Failed to load categories' });
    }
  });

  // ==================== SHOP / PRODUCT LISTING ====================
  router.get('/products', async (req, res) => {
    try {
      const {
        search = '',
        category = '',
        minPrice = '',
        maxPrice = '',
        minRating = '',
        availability = 'all',
        minDiscount = '',
        tag = '',
        sort = 'recommended',
        page = '1',
        limit = '12',
      } = req.query as Record<string, string>;

      const [activeProducts, categories, salesMap] = await Promise.all([
        Product.find({ status: 'Active' }).sort({ createdAt: -1 }).lean(),
        getCategoryCountsList(),
        getProductSalesMap(),
      ]);

      const allFormatted = activeProducts.map((p) =>
        formatStoreProduct(p as unknown as StoreProductDoc, salesMap)
      );

      let list = [...allFormatted];

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.categoryName.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q)
        );
      }

      let categoryInfo = null;
      if (category.trim() && category.toLowerCase() !== 'all') {
        const selectedSlugsOrNames = category
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        const matchedCategories = categories.filter(
          (c) =>
            selectedSlugsOrNames.includes(c.slug.toLowerCase()) ||
            selectedSlugsOrNames.includes(c.name.toLowerCase())
        );
        if (selectedSlugsOrNames.length === 1 && matchedCategories.length === 1) {
          categoryInfo = matchedCategories[0];
        }
        const matchedIds = new Set(matchedCategories.map((c) => c._id));
        const matchedNames = new Set([
          ...selectedSlugsOrNames,
          ...matchedCategories.map((c) => c.name.toLowerCase()),
        ]);
        list = list.filter(
          (p) =>
            (p.categoryId && matchedIds.has(p.categoryId)) ||
            matchedNames.has(p.categoryName.toLowerCase()) ||
            matchedNames.has(slugify(p.categoryName))
        );
      }

      if (minPrice !== '' && !Number.isNaN(Number(minPrice))) {
        const minP = Number(minPrice);
        list = list.filter((p) => p.netPrice >= minP);
      }
      if (maxPrice !== '' && !Number.isNaN(Number(maxPrice))) {
        const maxP = Number(maxPrice);
        list = list.filter((p) => p.netPrice <= maxP);
      }

      if (minRating !== '' && !Number.isNaN(Number(minRating))) {
        const minR = Number(minRating);
        list = list.filter((p) => p.ratingAverage >= minR);
      }

      if (availability === 'in_stock') {
        list = list.filter((p) => p.stock > 0);
      } else if (availability === 'out_of_stock') {
        list = list.filter((p) => p.stock <= 0);
      }

      if (minDiscount !== '' && !Number.isNaN(Number(minDiscount))) {
        const minD = Number(minDiscount);
        list = list.filter((p) => p.discountPercent >= minD);
      }

      if (tag === 'offers') {
        list = list.filter((p) => p.discountPercent > 0);
      } else if (tag === 'featured') {
        list.sort((a, b) => (a.isFeatured === b.isFeatured ? 0 : a.isFeatured ? -1 : 1));
      }

      // Sort
      if (sort === 'newest') {
        list.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
      } else if (sort === 'price_asc') {
        list.sort((a, b) => a.netPrice - b.netPrice);
      } else if (sort === 'price_desc') {
        list.sort((a, b) => b.netPrice - a.netPrice);
      } else if (sort === 'bestselling') {
        list.sort((a, b) => b.salesCount - a.salesCount);
      } else if (sort === 'rating') {
        list.sort((a, b) => b.ratingAverage - a.ratingAverage);
      } else {
        // recommended
        list.sort((a, b) => {
          if (a.stock > 0 !== b.stock > 0) return a.stock > 0 ? -1 : 1;
          if (b.salesCount !== a.salesCount) return b.salesCount - a.salesCount;
          return b.discountPercent - a.discountPercent;
        });
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(48, Math.max(1, parseInt(limit, 10) || 12));
      const paginated = list.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      const facetCounts = {
        inStock: allFormatted.filter((p) => p.stock > 0).length,
        outOfStock: allFormatted.filter((p) => p.stock <= 0).length,
        rating5: allFormatted.filter((p) => p.ratingAverage >= 5).length,
        rating4: allFormatted.filter((p) => p.ratingAverage >= 4).length,
        rating3: allFormatted.filter((p) => p.ratingAverage >= 3).length,
        discount10: allFormatted.filter((p) => p.discountPercent >= 10).length,
        discount20: allFormatted.filter((p) => p.discountPercent >= 20).length,
        discount30: allFormatted.filter((p) => p.discountPercent >= 30).length,
        discount50: allFormatted.filter((p) => p.discountPercent >= 50).length,
      };

      res.json({
        products: paginated,
        total: list.length,
        page: pageNum,
        limit: limitNum,
        categoryInfo,
        categories,
        facetCounts,
      });
    } catch (err) {
      console.error('Store products list error:', err);
      res.status(500).json({ error: 'Failed to load products' });
    }
  });

  // ==================== PRODUCT DETAILS & REVIEWS ====================
  router.get('/products/:slugOrId', async (req, res) => {
    try {
      const productDoc = await findProductBySlugOrId(req.params.slugOrId);
      if (!productDoc || productDoc.status !== 'Active') {
        return res.status(404).json({ error: 'Product not found' });
      }

      const [salesMap, otherProducts] = await Promise.all([
        getProductSalesMap(),
        Product.find({ status: 'Active', _id: { $ne: productDoc._id } })
          .sort({ createdAt: -1 })
          .limit(12)
          .lean(),
      ]);

      const formatted = formatStoreProduct(productDoc as unknown as StoreProductDoc, salesMap);

      const related = otherProducts
        .sort((a, b) => {
          const sameCatA = a.categoryName === productDoc.categoryName ? 1 : 0;
          const sameCatB = b.categoryName === productDoc.categoryName ? 1 : 0;
          return sameCatB - sameCatA;
        })
        .slice(0, 6)
        .map((p) => formatStoreProduct(p as unknown as StoreProductDoc, salesMap));

      const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      for (const r of formatted.reviews) {
        const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
        breakdown[star] = (breakdown[star] || 0) + 1;
      }

      res.json({
        product: formatted,
        ratingBreakdown: breakdown,
        relatedProducts: related,
      });
    } catch (err) {
      console.error('Store product detail error:', err);
      res.status(500).json({ error: 'Failed to load product details' });
    }
  });

  router.post('/products/:slugOrId/reviews', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }

      const productDoc = await findProductBySlugOrId(req.params.slugOrId);
      if (!productDoc) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const rating = Number(req.body?.rating);
      const comment = String(req.body?.comment || '').trim();
      if (!rating || rating < 1 || rating > 5 || !comment) {
        return res.status(400).json({ error: 'Please provide a rating (1-5) and review comment.' });
      }

      const product = await Product.findById(productDoc._id);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      product.reviews.unshift({
        userId: auth.user._id,
        userName: auth.user.name,
        userEmail: auth.user.email,
        rating,
        comment,
        createdAt: new Date(),
      });
      const count = product.reviews.length;
      const sum = product.reviews.reduce((acc: number, r: { rating: number }) => acc + r.rating, 0);
      product.reviewCount = count;
      product.ratingAverage = Number((sum / count).toFixed(1));
      await product.save();

      const salesMap = await getProductSalesMap();
      const formatted = formatStoreProduct(product.toObject() as unknown as StoreProductDoc, salesMap);

      const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      for (const r of formatted.reviews) {
        const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
        breakdown[star] = (breakdown[star] || 0) + 1;
      }

      res.status(201).json({ product: formatted, ratingBreakdown: breakdown });
    } catch {
      res.status(400).json({ error: 'Failed to submit review' });
    }
  });

  // ==================== CUSTOMER EMAIL OTP AUTH ====================
  router.post('/auth/send-otp', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      const existingUser = await User.findOne({ email }).lean();
      if (existingUser && existingUser.status === 'Blocked') {
        return res.status(403).json({
          error: 'This account has been blocked. Please contact store support.',
        });
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await OtpVerification.findOneAndUpdate(
        { email },
        { otpCode: otp, expiresAt, lastSentAt: new Date() },
        { upsert: true, new: true }
      );

      const settings = await StoreSettings.findOne({ singletonKey: 'default' }).lean();
      const smtp = settings?.integrations?.smtp;
      const storeName = settings?.general?.storeName || 'ShopAdmin';
      let emailed = false;

      if (smtp?.enabled && smtp.host && smtp.username && smtp.password) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: Number(smtp.port || 587),
            secure: smtp.encryption === 'SSL' || Number(smtp.port) === 465,
            auth: { user: smtp.username, pass: smtp.password },
          });
          await transporter.sendMail({
            from: smtp.fromEmail || smtp.username,
            to: email,
            subject: `${storeName} Login Verification OTP`,
            text: `Your ${storeName} login verification OTP is ${otp}. It expires in 10 minutes.`,
            html: `<div style="font-family:sans-serif;padding:20px;color:#0f172a">
              <h2 style="color:#6D28D9;margin:0 0 8px">${storeName} Verification Code</h2>
              <p>Use the 6-digit OTP below to sign in to your account:</p>
              <div style="font-size:28px;font-weight:700;letter-spacing:6px;padding:14px 20px;background:#f5f3ff;border-radius:10px;display:inline-block;color:#5B21B6">${otp}</div>
              <p style="color:#64748b;font-size:13px;margin-top:16px">This code expires in 10 minutes.</p>
            </div>`,
          });
          emailed = true;
        } catch (mailErr) {
          console.warn('SMTP customer OTP delivery failed:', mailErr);
          emailed = false;
        }
      }

      res.json({
        ok: true,
        email,
        emailed,
        resendAfterSeconds: 30,
        devOtp: emailed ? undefined : otp,
        message: emailed
          ? `Verification OTP sent to ${email}`
          : `OTP generated for ${email}. Configure SMTP in Admin Settings -> Integrations to send real emails.`,
      });
    } catch (err) {
      console.error('Customer send-otp error:', err);
      res.status(500).json({ error: 'Failed to generate verification OTP.' });
    }
  });

  router.post('/auth/verify-otp', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const otp = String(req.body?.otp || '').trim();
      const guestCart = Array.isArray(req.body?.guestCart) ? req.body.guestCart : [];
      const guestWishlist = Array.isArray(req.body?.guestWishlist) ? req.body.guestWishlist : [];

      if (!email || !otp) {
        return res.status(400).json({ error: 'Please enter a valid OTP.' });
      }

      const record = await OtpVerification.findOne({ email });
      if (!record || record.otpCode !== otp) {
        return res.status(400).json({ error: 'Please enter a valid OTP.' });
      }
      if (record.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Your OTP has expired. Please request a new OTP.' });
      }

      let user = await User.findOne({ email });
      const derivedName = email
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());

      if (!user) {
        user = await User.create({
          name: derivedName || 'Customer',
          email,
          phone: '',
          user_role: 'customer',
          status: 'Active',
          lastLogin: new Date(),
          activities: [
            {
              type: 'login',
              title: 'Account Created via Email OTP',
              description: `Registered and logged in with ${email}`,
              createdAt: new Date(),
            },
          ],
        });
      } else {
        if (user.status === 'Blocked') {
          return res.status(403).json({
            error: 'This account has been blocked. Please contact store support.',
          });
        }
        user.lastLogin = new Date();
        user.activities.unshift({
          type: 'login',
          title: 'Customer Logged In',
          description: `Verified via Email OTP (${email})`,
          createdAt: new Date(),
        });
      }

      // Merge guest cart into MongoDB user.cart
      if (guestCart.length > 0) {
        const guestIds = guestCart
          .map((g: { productId?: string }) => g.productId)
          .filter((id: unknown) => typeof id === 'string' && mongoose.isValidObjectId(id));
        const products = await Product.find({ _id: { $in: guestIds }, status: 'Active' }).lean();
        const productMap = new Map(products.map((p) => [String(p._id), p]));

        let mergedCount = 0;
        for (const g of guestCart as Array<{ productId?: string; quantity?: number }>) {
          const p = g.productId ? productMap.get(String(g.productId)) : null;
          if (!p || p.stock <= 0) continue;
          const qtyToAdd = Math.max(1, Number(g.quantity || 1));
          const netPrice = getNetPrice(p.price, p.discountPercent);
          const existing = (user.cart as Array<{ productId: unknown; quantity: number; price: number }>).find(
            (c) => String(c.productId) === String(p._id)
          );
          if (existing) {
            existing.quantity = Math.min(p.stock, existing.quantity + qtyToAdd);
            existing.price = netPrice;
          } else {
            user.cart.push({
              productId: p._id,
              name: p.name,
              sku: p.sku,
              category: p.categoryName,
              image: p.images?.[0] || '',
              price: netPrice,
              quantity: Math.min(p.stock, qtyToAdd),
            });
          }
          mergedCount += 1;
        }
        if (mergedCount > 0) {
          user.activities.unshift({
            type: 'cart',
            title: 'Guest Cart Synced',
            description: `Merged ${mergedCount} item(s) from browser cart into account`,
            createdAt: new Date(),
          });
        }
      }

      // Merge guest wishlist into MongoDB user.wishlist
      if (guestWishlist.length > 0) {
        const existingSet = new Set((user.wishlist || []).map((id: unknown) => String(id)));
        for (const wid of guestWishlist) {
          if (typeof wid === 'string' && mongoose.isValidObjectId(wid) && !existingSet.has(wid)) {
            user.wishlist.push(new mongoose.Types.ObjectId(wid));
            existingSet.add(wid);
          }
        }
      }

      await user.save();
      await OtpVerification.deleteMany({ email });

      const jti = crypto.randomUUID();
      const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await CustomerSession.create({ token: jti, userId: user._id, expiresAt: sessionExpiresAt });

      const token = signCustomerJwt({
        userId: String(user._id),
        email: user.email,
        userRole: user.user_role,
        jti,
      });

      const cart = await populateUserCartWithLiveProducts(user);

      res.json({
        token,
        user: sanitizeCustomerUser(user),
        cart,
        wishlist: (user.wishlist || []).map((id: unknown) => String(id)),
      });
    } catch (err) {
      console.error('Customer verify-otp error:', err);
      res.status(500).json({ error: 'Failed to verify OTP. Please try again.' });
    }
  });

  router.get('/auth/me', async (req, res) => {
    const auth = await resolveAuthenticatedCustomer(req);
    if (!auth) {
      return res.status(401).json({
        error: 'Your session has expired. Please log in again.',
        code: 'SESSION_EXPIRED',
      });
    }
    const cart = await populateUserCartWithLiveProducts(auth.user);
    res.json({
      user: sanitizeCustomerUser(auth.user),
      cart,
      wishlist: (auth.user.wishlist || []).map((id: unknown) => String(id)),
    });
  });

  router.post('/auth/logout', async (req, res) => {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token) {
      const payload = verifyJwtToken(token);
      const sessionKey = payload && payload.type === 'customer' ? payload.jti : token;
      const session = await CustomerSession.findOne({ token: sessionKey });
      if (session) {
        await User.findByIdAndUpdate(session.userId, {
          $push: {
            activities: {
              $each: [
                {
                  type: 'logout',
                  title: 'Customer Logged Out',
                  description: 'Signed out from storefront',
                  createdAt: new Date(),
                },
              ],
              $position: 0,
            },
          },
        });
        await CustomerSession.deleteOne({ _id: session._id });
      }
    }
    res.json({ ok: true });
  });

  // ==================== ACCOUNT PROFILE ====================
  router.put('/account/profile', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }

      const name = String(req.body?.name || '').trim();
      const phone = String(req.body?.phone || '').trim();
      const profileImage = req.body?.profileImage;

      if (!name) {
        return res.status(400).json({ error: 'Full name is required.' });
      }

      auth.user.name = name;
      auth.user.phone = phone;
      if (typeof profileImage === 'string') {
        auth.user.profileImage = profileImage;
      }
      auth.user.activities.unshift({
        type: 'profile',
        title: 'Profile Updated',
        description: 'Customer updated profile details from storefront',
        createdAt: new Date(),
      });
      await auth.user.save();

      res.json({ user: sanitizeCustomerUser(auth.user) });
    } catch {
      res.status(400).json({ error: 'Failed to update profile' });
    }
  });

  // ==================== CART (MONGO BACKEND) ====================
  router.get('/cart', async (req, res) => {
    const auth = await resolveAuthenticatedCustomer(req);
    if (!auth) {
      return res.status(401).json({
        error: 'Your session has expired. Please log in again.',
        code: 'SESSION_EXPIRED',
      });
    }
    const cart = await populateUserCartWithLiveProducts(auth.user);
    res.json({ cart });
  });

  router.post('/cart', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }
      const { productId, quantity = 1 } = req.body;
      const product = await Product.findById(productId).lean();
      if (!product || product.status !== 'Active') {
        return res.status(404).json({ error: 'This product is currently unavailable.' });
      }
      if (product.stock <= 0) {
        return res.status(400).json({ error: 'This product is currently unavailable.' });
      }

      const netPrice = getNetPrice(product.price, product.discountPercent);
      const existing = (auth.user.cart as Array<{ productId: unknown; quantity: number; price: number }>).find(
        (c) => String(c.productId) === String(product._id)
      );
      const reqQty = Math.max(1, Number(quantity || 1));

      if (existing) {
        existing.quantity = Math.min(product.stock, existing.quantity + reqQty);
        existing.price = netPrice;
      } else {
        auth.user.cart.push({
          productId: product._id,
          name: product.name,
          sku: product.sku,
          category: product.categoryName,
          image: product.images?.[0] || '',
          price: netPrice,
          quantity: Math.min(product.stock, reqQty),
        });
      }

      auth.user.activities.unshift({
        type: 'cart',
        title: 'Added to Cart',
        description: `Added ${reqQty} × ${product.name}`,
        createdAt: new Date(),
      });
      await auth.user.save();

      const cart = await populateUserCartWithLiveProducts(auth.user);
      res.json({ cart });
    } catch {
      res.status(400).json({ error: 'Failed to add product to cart' });
    }
  });

  router.patch('/cart/:productId', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }

      const qty = Number(req.body?.quantity);
      const item = (auth.user.cart as Array<{ productId: unknown; name: string; quantity: number }>).find(
        (c) => String(c.productId) === req.params.productId
      );
      if (!item) return res.status(404).json({ error: 'Cart item not found' });

      if (qty <= 0) {
        auth.user.cart = (auth.user.cart as Array<{ productId: unknown }>).filter(
          (c) => String(c.productId) !== req.params.productId
        ) as typeof auth.user.cart;
      } else {
        const product = await Product.findById(req.params.productId).lean();
        if (product && qty > product.stock) {
          return res.status(400).json({ error: `Only ${product.stock} unit(s) available in stock.` });
        }
        item.quantity = qty;
      }

      await auth.user.save();
      const cart = await populateUserCartWithLiveProducts(auth.user);
      res.json({ cart });
    } catch {
      res.status(400).json({ error: 'Failed to update cart item' });
    }
  });

  router.delete('/cart/:productId', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }
      auth.user.cart = (auth.user.cart as Array<{ productId: unknown }>).filter(
        (c) => String(c.productId) !== req.params.productId
      ) as typeof auth.user.cart;
      await auth.user.save();
      const cart = await populateUserCartWithLiveProducts(auth.user);
      res.json({ cart });
    } catch {
      res.status(400).json({ error: 'Failed to remove item from cart' });
    }
  });

  router.delete('/cart', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }
      auth.user.cart.splice(0, auth.user.cart.length);
      await auth.user.save();
      res.json({ cart: [] });
    } catch {
      res.status(400).json({ error: 'Failed to clear cart' });
    }
  });

  // ==================== WISHLIST ====================
  router.get('/wishlist', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }
      const ids = auth.user.wishlist || [];
      const [products, salesMap] = await Promise.all([
        Product.find({ _id: { $in: ids }, status: 'Active' }).lean(),
        getProductSalesMap(),
      ]);
      res.json({
        products: products.map((p) => formatStoreProduct(p as unknown as StoreProductDoc, salesMap)),
      });
    } catch {
      res.status(500).json({ error: 'Failed to fetch wishlist' });
    }
  });

  router.post('/wishlist/toggle', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }
      const productId = String(req.body?.productId || '');
      if (!mongoose.isValidObjectId(productId)) {
        return res.status(400).json({ error: 'Invalid product ID' });
      }
      const existing = (auth.user.wishlist || []).map((id: unknown) => String(id));
      let added = false;
      if (existing.includes(productId)) {
        auth.user.wishlist = auth.user.wishlist.filter(
          (id: unknown) => String(id) !== productId
        ) as typeof auth.user.wishlist;
      } else {
        auth.user.wishlist.push(new mongoose.Types.ObjectId(productId));
        added = true;
      }
      await auth.user.save();
      res.json({
        added,
        wishlist: (auth.user.wishlist || []).map((id: unknown) => String(id)),
      });
    } catch {
      res.status(400).json({ error: 'Failed to update wishlist' });
    }
  });

  // ==================== ADDRESSES ====================
  router.post('/addresses', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }
      const addr = req.body;
      if (!addr?.fullName || !addr?.line1 || !addr?.city || !addr?.state || !addr?.postalCode) {
        return res.status(400).json({ error: 'Please complete all required address fields.' });
      }
      if (addr.isDefault) {
        (auth.user.addresses as Array<{ isDefault?: boolean }>).forEach((a) => {
          a.isDefault = false;
        });
      }
      auth.user.addresses.push({
        label: addr.label || 'Home',
        addressType: 'Shipping',
        fullName: addr.fullName,
        phone: addr.phone || auth.user.phone || '',
        line1: addr.line1,
        line2: addr.line2 || '',
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country || 'India',
        isDefault: Boolean(addr.isDefault || auth.user.addresses.length === 0),
      });
      auth.user.activities.unshift({
        type: 'address',
        title: 'Address Added',
        description: `Added ${addr.label || 'Home'} delivery address`,
        createdAt: new Date(),
      });
      await auth.user.save();
      res.status(201).json({ user: sanitizeCustomerUser(auth.user) });
    } catch {
      res.status(400).json({ error: 'Failed to save address' });
    }
  });

  router.put('/addresses/:addrId', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }
      const addr = auth.user.addresses.id(req.params.addrId);
      if (!addr) return res.status(404).json({ error: 'Address not found' });

      if (req.body.isDefault) {
        (auth.user.addresses as Array<{ isDefault?: boolean }>).forEach((a) => {
          a.isDefault = false;
        });
      }
      Object.assign(addr, req.body);
      auth.user.activities.unshift({
        type: 'address',
        title: 'Address Updated',
        description: `Updated ${addr.label} delivery address`,
        createdAt: new Date(),
      });
      await auth.user.save();
      res.json({ user: sanitizeCustomerUser(auth.user) });
    } catch {
      res.status(400).json({ error: 'Failed to update address' });
    }
  });

  router.delete('/addresses/:addrId', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }
      auth.user.addresses.pull({ _id: req.params.addrId });
      await auth.user.save();
      res.json({ user: sanitizeCustomerUser(auth.user) });
    } catch {
      res.status(400).json({ error: 'Failed to delete address' });
    }
  });

  // ==================== COUPONS ====================
  router.post('/coupons/validate', async (req, res) => {
    try {
      const code = String(req.body?.code || '').trim().toUpperCase();
      const subtotal = Number(req.body?.subtotal || 0);
      if (!code) return res.status(400).json({ error: 'Please enter a coupon code.' });

      const coupon = await Coupon.findOne({ code, active: true }).lean();
      if (!coupon || (coupon.expiresAt && new Date(coupon.expiresAt) < new Date())) {
        return res.status(400).json({ error: 'Invalid or expired coupon code.' });
      }
      if (subtotal < (coupon.minOrderAmount || 0)) {
        return res.status(400).json({
          error: `Minimum order of ₹${coupon.minOrderAmount} required for this coupon.`,
        });
      }
      let discount =
        coupon.discountType === 'percent'
          ? Math.round((subtotal * coupon.discountValue) / 100)
          : coupon.discountValue;
      if (coupon.maxDiscount && coupon.maxDiscount > 0) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
      discount = Math.min(discount, subtotal);

      res.json({
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discount,
      });
    } catch {
      res.status(400).json({ error: 'Failed to validate coupon code.' });
    }
  });

  // ==================== CHECKOUT & CUSTOMER ORDERS ====================
  router.post('/checkout', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }

      const {
        shippingAddress,
        shippingMethodId,
        paymentMethod = 'COD',
        couponCode = '',
        buyNowItem,
        razorpayPaymentId = '',
      } = req.body;

      if (
        !shippingAddress ||
        !shippingAddress.line1 ||
        !shippingAddress.city ||
        !shippingAddress.state ||
        !shippingAddress.postalCode
      ) {
        return res.status(400).json({ error: 'Please select or enter a complete delivery address.' });
      }

      if (paymentMethod === 'Razorpay' && !razorpayPaymentId) {
        return res.status(400).json({ error: 'Payment could not be completed. Please try again.' });
      }

      const rawItems: Array<{ productId: string; quantity: number }> = buyNowItem?.productId
        ? [{ productId: String(buyNowItem.productId), quantity: Math.max(1, Number(buyNowItem.quantity || 1)) }]
        : (auth.user.cart as Array<{ productId: unknown; quantity: number }>).map((c) => ({
            productId: String(c.productId),
            quantity: c.quantity,
          }));

      if (rawItems.length === 0) {
        return res.status(400).json({ error: 'Your cart is empty.' });
      }

      const productDocs = await Product.find({
        _id: { $in: rawItems.map((i) => i.productId) },
      });
      const productMap = new Map(productDocs.map((p) => [String(p._id), p]));

      let mrpSubtotal = 0;
      let sellingSubtotal = 0;
      const orderItems = [];

      for (const reqItem of rawItems) {
        const prod = productMap.get(reqItem.productId);
        if (!prod || prod.status !== 'Active' || prod.stock <= 0) {
          return res.status(400).json({ error: 'This product is currently unavailable.' });
        }
        if (reqItem.quantity > prod.stock) {
          return res.status(400).json({
            error: `Only ${prod.stock} unit(s) available for ${prod.name}.`,
          });
        }
        const netPrice = getNetPrice(prod.price, prod.discountPercent);
        mrpSubtotal += prod.price * reqItem.quantity;
        sellingSubtotal += netPrice * reqItem.quantity;

        orderItems.push({
          productId: prod._id,
          name: prod.name,
          sku: prod.sku,
          image: prod.images?.[0] || '',
          price: netPrice,
          quantity: reqItem.quantity,
        });
      }

      const productDiscount = Math.max(0, mrpSubtotal - sellingSubtotal);
      let couponDiscount = 0;
      let appliedCoupon = '';
      if (couponCode) {
        const coupon = await Coupon.findOne({
          code: String(couponCode).trim().toUpperCase(),
          active: true,
        }).lean();
        if (
          coupon &&
          (!coupon.expiresAt || new Date(coupon.expiresAt) >= new Date()) &&
          sellingSubtotal >= (coupon.minOrderAmount || 0)
        ) {
          couponDiscount =
            coupon.discountType === 'percent'
              ? Math.round((sellingSubtotal * coupon.discountValue) / 100)
              : coupon.discountValue;
          if (coupon.maxDiscount && coupon.maxDiscount > 0) {
            couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
          }
          couponDiscount = Math.min(couponDiscount, sellingSubtotal);
          appliedCoupon = coupon.code;
        }
      }

      const settings = await StoreSettings.findOne({ singletonKey: 'default' }).lean();
      const shippingCfg = settings?.shipping;
      const taxCfg = settings?.tax;

      let shippingCost = Number(shippingCfg?.shippingCharge ?? 40);
      let shippingMethodName = 'Standard Delivery';
      let estimatedDelivery = '3-5 Business Days';

      const activeMethods = (shippingCfg?.methods || []).filter(
        (m: { status?: string }) => m.status !== 'Inactive'
      );
      if (shippingMethodId && activeMethods.length > 0) {
        const found = activeMethods.find(
          (m: { _id?: unknown }) => String(m._id) === String(shippingMethodId)
        );
        if (found) {
          shippingCost = Number(found.charge || 0);
          shippingMethodName = found.name;
          estimatedDelivery = found.deliveryTime || '3-5 Business Days';
        }
      } else if (activeMethods.length > 0) {
        shippingCost = Number(activeMethods[0].charge || 0);
        shippingMethodName = activeMethods[0].name;
        estimatedDelivery = activeMethods[0].deliveryTime || '3-5 Business Days';
      }

      const afterCoupon = Math.max(0, sellingSubtotal - couponDiscount);
      if (
        shippingCfg?.freeShipping &&
        afterCoupon >= Number(shippingCfg.freeShippingThreshold ?? 999)
      ) {
        shippingCost = 0;
      }

      let taxAmount = 0;
      if (taxCfg?.enableGst && taxCfg.pricingMode === 'exclusive') {
        taxAmount = Math.round((afterCoupon * Number(taxCfg.defaultTaxRate ?? 18)) / 100);
      }

      const totalAmount = afterCoupon + shippingCost + taxAmount;
      const totalDiscount = productDiscount + couponDiscount;

      const count = await Order.countDocuments();
      const orderNumber = `#ORD-${10001 + count + Math.floor(Math.random() * 90)}`;

      const isOnlinePaid = paymentMethod === 'Razorpay' || paymentMethod === 'Paid';

      const order = await Order.create({
        orderNumber,
        userId: auth.user._id,
        customerName: shippingAddress.fullName || auth.user.name,
        customerEmail: auth.user.email,
        customerPhone: shippingAddress.phone || auth.user.phone || '',
        shippingAddress: {
          fullName: shippingAddress.fullName || auth.user.name,
          phone: shippingAddress.phone || auth.user.phone || '',
          line1: shippingAddress.line1,
          line2: shippingAddress.line2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country || 'India',
        },
        items: orderItems,
        subtotal: sellingSubtotal,
        discountAmount: totalDiscount,
        couponCode: appliedCoupon,
        shippingCost,
        shippingMethodName,
        estimatedDelivery,
        taxAmount,
        totalAmount,
        paymentMethod: isOnlinePaid ? 'Razorpay' : 'COD',
        paymentStatus: isOnlinePaid ? 'Paid' : 'Pending',
        razorpayPaymentId,
        confirmationEmailSent: false,
        status: 'Placed',
        timeline: [
          {
            status: 'Placed',
            note: `Order placed via storefront (${isOnlinePaid ? 'Online Payment' : 'Cash on Delivery'})`,
            timestamp: new Date(),
          },
        ],
      });

      // Decrement stock in MongoDB
      if (settings?.general?.autoUpdateStock !== false) {
        for (const reqItem of rawItems) {
          const prod = productMap.get(reqItem.productId);
          if (prod) {
            prod.stock = Math.max(0, prod.stock - reqItem.quantity);
            await prod.save();
          }
        }
      }

      // Clear cart if standard cart checkout
      if (!buyNowItem?.productId) {
        auth.user.cart.splice(0, auth.user.cart.length);
      }
      auth.user.activities.unshift({
        type: 'order',
        title: 'Order Placed',
        description: `Placed order ${orderNumber} (${isOnlinePaid ? 'Razorpay' : 'COD'})`,
        badge: orderNumber,
        createdAt: new Date(),
      });
      await auth.user.save();

      // Send confirmation email if SMTP is enabled
      let emailSent = false;
      const smtp = settings?.integrations?.smtp;
      const storeName = settings?.general?.storeName || 'ShopAdmin';
      if (smtp?.enabled && smtp.host && smtp.username && smtp.password) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: Number(smtp.port || 587),
            secure: smtp.encryption === 'SSL' || Number(smtp.port) === 465,
            auth: { user: smtp.username, pass: smtp.password },
          });
          const itemLines = orderItems
            .map((i) => `${i.name} × ${i.quantity} — ₹${i.price * i.quantity}`)
            .join('\n');
          await transporter.sendMail({
            from: smtp.fromEmail || smtp.username,
            to: auth.user.email,
            subject: `${storeName} Order Confirmation — ${orderNumber}`,
            text: `Hi ${order.customerName},\n\nThank you for your purchase! Your order ${orderNumber} has been placed.\n\nItems:\n${itemLines}\n\nTotal Amount: ₹${totalAmount}\nPayment Status: ${order.paymentStatus}\nOrder Status: ${order.status}\n\nShipping Address:\n${order.shippingAddress.line1}, ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.postalCode}`,
          });
          emailSent = true;
          order.confirmationEmailSent = true;
          await order.save();
        } catch (mailErr) {
          console.warn('Order confirmation email failed:', mailErr);
        }
      }

      const cart = await populateUserCartWithLiveProducts(auth.user);

      res.status(201).json({
        order,
        cart,
        emailSent,
        emailMessage: 'Order confirmation email sent successfully.',
      });
    } catch (err) {
      console.error('Store checkout error:', err);
      res.status(500).json({ error: 'Failed to place order. Please try again.' });
    }
  });

  router.get('/orders', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }
      const orders = await Order.find({
        $or: [{ userId: auth.user._id }, { customerEmail: auth.user.email }],
      })
        .sort({ createdAt: -1 })
        .lean();
      res.json({ orders });
    } catch {
      res.status(500).json({ error: 'Failed to load orders' });
    }
  });

  router.get('/orders/:id', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }
      const rawId = decodeURIComponent(req.params.id);
      const query: Record<string, unknown> = mongoose.isValidObjectId(rawId)
        ? { _id: rawId }
        : { orderNumber: rawId.startsWith('#') ? rawId : `#${rawId}` };

      const order = await Order.findOne({
        ...query,
        $or: [{ userId: auth.user._id }, { customerEmail: auth.user.email }],
      }).lean();

      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.json({ order });
    } catch {
      res.status(404).json({ error: 'Order not found' });
    }
  });

  router.post('/orders/:id/cancel', async (req, res) => {
    try {
      const auth = await resolveAuthenticatedCustomer(req);
      if (!auth) {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }
      const order = await Order.findOne({
        _id: req.params.id,
        $or: [{ userId: auth.user._id }, { customerEmail: auth.user.email }],
      });
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (!['Placed', 'Confirmed'].includes(order.status)) {
        return res.status(400).json({ error: 'This order can no longer be cancelled.' });
      }
      order.status = 'Cancelled';
      order.timeline.push({
        status: 'Cancelled',
        note: 'Cancelled by customer from storefront',
        timestamp: new Date(),
      });
      await order.save();

      // Restore stock
      for (const item of order.items as Array<{ productId?: unknown; quantity: number }>) {
        if (item.productId) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
        }
      }

      res.json({ order });
    } catch {
      res.status(400).json({ error: 'Failed to cancel order' });
    }
  });

  return router;
}
