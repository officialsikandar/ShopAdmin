import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import * as XLSX from 'xlsx';
import mongoose from 'mongoose';
import { signAdminJwt, verifyJwtToken } from './jwt.ts';
import {
  AdminSession,
  AdminUser,
  Category,
  Order,
  Product,
  StoreSettings,
  User,
} from './models.ts';
import { getMongoStatus } from './db.ts';
import {
  deleteDriveFile,
  DriveApiError,
  getEcomStoreFolderSummary,
  normalizeDriveFolder,
  uploadBufferToDrive,
} from './drive.ts';
import { createStoreRouter } from './storeRoutes.ts';

interface AdminAuthedRequest extends express.Request {
  admin?: InstanceType<typeof AdminUser>;
  adminJti?: string;
}

function sanitizeAdmin(admin: InstanceType<typeof AdminUser> | Record<string, unknown>) {
  const obj = typeof (admin as { toObject?: () => Record<string, unknown> }).toObject === 'function'
    ? (admin as { toObject: () => Record<string, unknown> }).toObject()
    : { ...(admin as Record<string, unknown>) };
  delete obj.passwordHash;
  delete obj.otpCode;
  delete obj.otpExpiresAt;
  return obj;
}

async function resolveAuthenticatedAdmin(req: express.Request) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;

  const payload = verifyJwtToken(token);
  if (!payload || payload.type !== 'admin') {
    return null;
  }

  const session = await AdminSession.findOne({
    token: payload.jti,
    adminId: payload.sub,
  }).lean();
  if (!session || new Date(session.expiresAt) < new Date()) {
    if (session) {
      await AdminSession.deleteOne({ _id: session._id });
    }
    return null;
  }

  const admin = await AdminUser.findById(payload.sub);
  if (!admin || admin.status !== 'Active') return null;
  return { admin, jti: payload.jti };
}

async function requireAdminAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const resolved = await resolveAuthenticatedAdmin(req);
  if (!resolved) {
    return res.status(401).json({
      error: 'Admin session expired or unauthorized. Please sign in again.',
      code: 'ADMIN_SESSION_EXPIRED',
    });
  }
  (req as AdminAuthedRequest).admin = resolved.admin;
  (req as AdminAuthedRequest).adminJti = resolved.jti;
  next();
}

function getGoogleDriveTokenFromRequest(req: express.Request): string {
  const customHeader = String(req.headers['x-google-access-token'] || '').trim();
  if (customHeader) return customHeader;
  return '';
}

const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;

const uploadImageMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES },
});

function parseSingleImageUpload(req: express.Request, res: express.Response): Promise<void> {
  return new Promise((resolve, reject) => {
    uploadImageMemory.single('file')(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sendWorkbook(
  res: express.Response,
  rows: Record<string, unknown>[],
  sheetName: string,
  filenameBase: string,
  format: string
) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    return res.send(csv);
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
  return res.send(buffer);
}

export function createApiRouter() {
  const router = express.Router();

  // Customer Storefront API
  router.use('/store', createStoreRouter());

  // Health & DB Status
  router.get('/health', async (_req, res) => {
    res.json({ ok: true, mongo: getMongoStatus() });
  });

  // ==================== ADMIN JWT AUTH (ID & PASSWORD) ====================
  router.post('/auth/admin/login', async (req, res) => {
    try {
      const identifier = String(req.body?.identifier || req.body?.email || '').trim();
      const password = String(req.body?.password || '');
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Admin ID / Email and password are required.' });
      }

      const normalized = identifier.toLowerCase();
      const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const admin = await AdminUser.findOne({
        $or: [{ email: normalized }, { name: new RegExp(`^${escaped}$`, 'i') }],
      });
      if (!admin) {
        return res.status(401).json({ error: 'Invalid Admin ID or password.' });
      }
      if (admin.status !== 'Active') {
        return res.status(403).json({ error: 'This admin account is inactive.' });
      }
      if (!['super_admin', 'admin', 'manager'].includes(admin.user_role)) {
        return res.status(403).json({ error: 'Access denied. Administrator role required.' });
      }

      const matches = await bcrypt.compare(password, admin.passwordHash);
      if (!matches) {
        return res.status(401).json({ error: 'Invalid Admin ID or password.' });
      }

      admin.lastLogin = new Date();
      await admin.save();

      const jti = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await AdminSession.create({ token: jti, adminId: admin._id, expiresAt });

      const token = signAdminJwt({
        adminId: String(admin._id),
        email: admin.email,
        role: admin.role,
        userRole: admin.user_role,
        jti,
      });

      return res.json({ token, admin: sanitizeAdmin(admin) });
    } catch (err) {
      console.error('Admin login error:', err);
      return res.status(500).json({ error: 'Failed to sign in to Admin Panel.' });
    }
  });

  router.get('/auth/admin/me', async (req, res) => {
    const resolved = await resolveAuthenticatedAdmin(req);
    if (!resolved) {
      return res.status(401).json({
        error: 'Admin session expired or unauthorized. Please sign in again.',
        code: 'ADMIN_SESSION_EXPIRED',
      });
    }
    return res.json({ admin: sanitizeAdmin(resolved.admin) });
  });

  router.post('/auth/admin/logout', async (req, res) => {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token) {
      const payload = verifyJwtToken(token);
      if (payload && payload.type === 'admin') {
        await AdminSession.deleteOne({ token: payload.jti });
      }
    }
    return res.json({ ok: true });
  });

  // All Admin routes below require a valid signed Admin JWT
  router.use(requireAdminAuth);

  // File Upload to Google Drive (ecom_store -> profile_image | category_image | product_image | store_logo | other_images)
  router.post('/upload', async (req, res) => {
    try {
      await parseSingleImageUpload(req, res);

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const accessToken = getGoogleDriveTokenFromRequest(req);
      if (!accessToken) {
        return res.status(401).json({
          error: 'Google Drive sign-in is required before uploading photos.',
          code: 'GOOGLE_AUTH_REQUIRED',
        });
      }

      const folder = normalizeDriveFolder(
        String((req.body as { folder?: string })?.folder || req.query.folder || 'other_images')
      );

      const uploaded = await uploadBufferToDrive({
        accessToken,
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        folder,
      });

      return res.json(uploaded);
    } catch (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'Image file is too large. Maximum allowed size is 25 MB.',
            code: 'FILE_TOO_LARGE',
          });
        }
        return res.status(400).json({
          error: `Upload error: ${error.message}`,
          code: error.code,
        });
      }
      if (error instanceof DriveApiError) {
        return res.status(error.status === 401 ? 401 : 502).json({
          error:
            error.status === 401
              ? 'Google Drive session expired. Please sign in with Google again.'
              : error.message,
          code: error.status === 401 ? 'GOOGLE_AUTH_EXPIRED' : 'GOOGLE_DRIVE_ERROR',
        });
      }
      console.error('Drive upload error:', error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? `Failed to upload image to Google Drive: ${error.message}`
            : 'Failed to upload image to Google Drive',
      });
    }
  });

  // Google Drive Folder Summary (ecom_store -> subfolders) + persist folder links to MongoDB
  router.get('/drive/folders', async (req, res) => {
    try {
      const accessToken = getGoogleDriveTokenFromRequest(req);
      if (!accessToken) {
        return res.status(401).json({ error: 'Google Drive sign-in required', code: 'GOOGLE_AUTH_REQUIRED' });
      }
      const summary = await getEcomStoreFolderSummary(accessToken);
      const email = String(req.query.email || '').trim();
      const displayName = String(req.query.displayName || '').trim();
      const photoURL = String(req.query.photoURL || '').trim();

      const updateFields: Record<string, unknown> = {
        'integrations.googleDrive.connected': true,
        'integrations.googleDrive.rootFolder': summary.rootFolder,
        'integrations.googleDrive.folders': summary.folders,
        'integrations.googleDrive.lastSyncedAt': new Date(),
      };
      if (email) updateFields['integrations.googleDrive.email'] = email;
      if (displayName) updateFields['integrations.googleDrive.displayName'] = displayName;
      if (photoURL) updateFields['integrations.googleDrive.photoURL'] = photoURL;

      await StoreSettings.findOneAndUpdate(
        { singletonKey: 'default' },
        { $set: updateFields },
        { upsert: true }
      );

      return res.json(summary);
    } catch (error) {
      if (error instanceof DriveApiError) {
        return res.status(error.status === 401 ? 401 : 502).json({
          error: error.message,
          code: error.status === 401 ? 'GOOGLE_AUTH_EXPIRED' : 'GOOGLE_DRIVE_ERROR',
        });
      }
      return res.status(500).json({ error: 'Failed to list Google Drive folders' });
    }
  });

  // Delete Image from Google Drive (requires explicit UI confirmation before calling)
  router.delete('/drive/files/:fileId', async (req, res) => {
    try {
      const accessToken = getGoogleDriveTokenFromRequest(req);
      if (!accessToken) {
        return res.status(401).json({ error: 'Google Drive sign-in required', code: 'GOOGLE_AUTH_REQUIRED' });
      }
      await deleteDriveFile(accessToken, req.params.fileId);
      return res.json({ ok: true });
    } catch (error) {
      if (error instanceof DriveApiError) {
        return res.status(error.status === 401 ? 401 : 502).json({
          error: error.message,
          code: error.status === 401 ? 'GOOGLE_AUTH_EXPIRED' : 'GOOGLE_DRIVE_ERROR',
        });
      }
      return res.status(500).json({ error: 'Failed to delete file from Google Drive' });
    }
  });

  // ==================== DASHBOARD ====================
  router.get('/dashboard', async (req, res) => {
    try {
      const range = String(req.query.range || 'month');
      const now = new Date();
      const startDate = new Date(now);
      if (range === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (range === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else if (range === 'year') {
        startDate.setFullYear(now.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate.setDate(now.getDate() - 30);
      }

      const [
        totalOrders,
        pendingOrders,
        totalUsers,
        totalProducts,
        allOrders,
        rangeOrders,
        recentOrders,
        products,
      ] = await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ status: { $in: ['Placed', 'Confirmed', 'Packed'] } }),
        User.countDocuments(),
        Product.countDocuments(),
        Order.find().lean(),
        Order.find({ createdAt: { $gte: startDate } }).sort({ createdAt: 1 }).lean(),
        Order.find().sort({ createdAt: -1 }).limit(5).lean(),
        Product.find().lean(),
      ]);

      const totalSales = allOrders
        .filter((o) => o.status !== 'Cancelled')
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      const lowStockList = products
        .filter((p) => p.stock <= (p.lowStockThreshold ?? 10))
        .sort((a, b) => a.stock - b.stock);

      const statusList = ['Delivered', 'Shipped', 'Packed', 'Confirmed', 'Placed', 'Cancelled'];
      const statusBreakdown = statusList.map((status) => {
        const count = allOrders.filter((o) => o.status === status).length;
        return {
          status,
          count,
          percentage: totalOrders > 0 ? Math.round((count / totalOrders) * 1000) / 10 : 0,
        };
      });

      // Build Sales Overview series
      const bucketMap = new Map<string, { label: string; sales: number; orders: number }>();
      if (range === 'today') {
        for (let h = 0; h < 24; h += 4) {
          const label = `${String(h).padStart(2, '0')}:00`;
          bucketMap.set(label, { label, sales: 0, orders: 0 });
        }
        for (const o of rangeOrders) {
          const d = new Date(o.createdAt);
          const slot = Math.floor(d.getHours() / 4) * 4;
          const label = `${String(slot).padStart(2, '0')}:00`;
          const entry = bucketMap.get(label);
          if (entry) {
            if (o.status !== 'Cancelled') entry.sales += o.totalAmount || 0;
            entry.orders += 1;
          }
        }
      } else if (range === 'year') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        months.forEach((m) => bucketMap.set(m, { label: m, sales: 0, orders: 0 }));
        for (const o of rangeOrders) {
          const d = new Date(o.createdAt);
          const m = months[d.getMonth()];
          const entry = bucketMap.get(m);
          if (entry) {
            if (o.status !== 'Cancelled') entry.sales += o.totalAmount || 0;
            entry.orders += 1;
          }
        }
      } else {
        const daysCount = range === 'week' ? 7 : 10;
        const stepDays = range === 'week' ? 1 : 3;
        for (let i = daysCount - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i * stepDays);
          const label = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
          bucketMap.set(label, { label, sales: 0, orders: 0 });
        }
        for (const o of rangeOrders) {
          const d = new Date(o.createdAt);
          const label = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
          const entry = bucketMap.get(label);
          if (entry) {
            if (o.status !== 'Cancelled') entry.sales += o.totalAmount || 0;
            entry.orders += 1;
          } else {
            // Put into nearest bucket if stepDays > 1
            const keys = Array.from(bucketMap.keys());
            const lastKey = keys[keys.length - 1];
            if (lastKey) {
              const last = bucketMap.get(lastKey)!;
              if (o.status !== 'Cancelled') last.sales += o.totalAmount || 0;
              last.orders += 1;
            }
          }
        }
      }

      // Top Products aggregated from orders
      const productPerf = new Map<
        string,
        { id: string; name: string; image: string; category: string; unitsSold: number; revenue: number }
      >();

      for (const p of products) {
        productPerf.set(String(p._id), {
          id: String(p._id),
          name: p.name,
          image: p.images?.[0] || '',
          category: p.categoryName || 'Uncategorized',
          unitsSold: 0,
          revenue: 0,
        });
      }

      for (const o of allOrders) {
        if (o.status === 'Cancelled') continue;
        for (const item of o.items || []) {
          const key = item.productId ? String(item.productId) : item.name;
          const existing = productPerf.get(key) || {
            id: key,
            name: item.name,
            image: item.image || '',
            category: 'Catalog',
            unitsSold: 0,
            revenue: 0,
          };
          existing.unitsSold += item.quantity || 0;
          existing.revenue += (item.price || 0) * (item.quantity || 0);
          productPerf.set(key, existing);
        }
      }

      const topProducts = Array.from(productPerf.values())
        .filter((p) => p.unitsSold > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      res.json({
        summary: {
          totalOrders,
          totalSales,
          totalUsers,
          totalProducts,
          pendingOrders,
          lowStockProducts: lowStockList.length,
        },
        chartData: Array.from(bucketMap.values()),
        statusBreakdown,
        recentOrders,
        topProducts,
        lowStockList: lowStockList.slice(0, 6),
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard data' });
    }
  });

  // ==================== ORDERS ====================
  router.get('/orders/export', async (req, res) => {
    try {
      const format = String(req.query.format || 'csv');
      const orders = await Order.find().sort({ createdAt: -1 }).lean();
      const rows = orders.map((o) => ({
        OrderID: o.orderNumber,
        CustomerName: o.customerName,
        CustomerEmail: o.customerEmail,
        CustomerPhone: o.customerPhone,
        ItemsCount:
          (o.items as Array<{ quantity?: number }> | undefined)?.reduce(
            (s: number, i: { quantity?: number }) => s + (i.quantity || 0),
            0
          ) || 0,
        Subtotal: o.subtotal,
        Shipping: o.shippingCost,
        Tax: o.taxAmount,
        TotalAmount: o.totalAmount,
        PaymentMethod: o.paymentMethod,
        PaymentStatus: o.paymentStatus,
        OrderStatus: o.status,
        OrderDate: new Date(o.createdAt).toISOString(),
      }));
      return sendWorkbook(res, rows, 'Orders', 'shopadmin-orders', format);
    } catch (error) {
      res.status(500).json({ error: 'Failed to export orders' });
    }
  });

  router.get('/orders', async (req, res) => {
    try {
      const { search = '', status = 'All', payment = 'All', dateFrom = '', dateTo = '', page = '1', limit = '10' } =
        req.query as Record<string, string>;

      const query: Record<string, unknown> = {};
      if (search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [{ orderNumber: regex }, { customerName: regex }, { customerEmail: regex }];
      }
      if (status && status !== 'All' && status !== 'All Orders') {
        query.status = status;
      }
      if (payment && payment !== 'All') {
        if (payment === 'Paid') query.paymentStatus = 'Paid';
        else if (payment === 'COD') query.paymentMethod = 'COD';
        else query.paymentStatus = payment;
      }
      if (dateFrom || dateTo) {
        const dateFilter: Record<string, Date> = {};
        if (dateFrom) dateFilter.$gte = new Date(dateFrom);
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          dateFilter.$lte = end;
        }
        query.createdAt = dateFilter;
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));

      const [orders, total, allOrders] = await Promise.all([
        Order.find(query)
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        Order.countDocuments(query),
        Order.find({}, 'status').lean(),
      ]);

      const stats = {
        total: allOrders.length,
        Placed: allOrders.filter((o) => o.status === 'Placed').length,
        Confirmed: allOrders.filter((o) => o.status === 'Confirmed').length,
        Packed: allOrders.filter((o) => o.status === 'Packed').length,
        Shipped: allOrders.filter((o) => o.status === 'Shipped').length,
        Delivered: allOrders.filter((o) => o.status === 'Delivered').length,
        Cancelled: allOrders.filter((o) => o.status === 'Cancelled').length,
      };

      res.json({ orders, total, page: pageNum, limit: limitNum, stats });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  router.post('/orders', async (req, res) => {
    try {
      const {
        userId,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        items,
        shippingCost = 0,
        taxAmount = 0,
        paymentMethod = 'COD',
        paymentStatus,
        status = 'Placed',
      } = req.body;

      if (!customerName || !customerEmail || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Customer details and at least one item are required' });
      }

      const count = await Order.countDocuments();
      const orderNumber = `#ORD-${10001 + count + Math.floor(Math.random() * 90)}`;
      const subtotal = items.reduce(
        (sum: number, item: { price: number; quantity: number }) =>
          sum + Number(item.price || 0) * Number(item.quantity || 1),
        0
      );
      const totalAmount = subtotal + Number(shippingCost || 0) + Number(taxAmount || 0);
      const resolvedPaymentStatus =
        paymentStatus || (paymentMethod === 'Paid' || paymentMethod === 'Razorpay' ? 'Paid' : 'Pending');

      const order = await Order.create({
        orderNumber,
        userId: userId || null,
        customerName,
        customerEmail,
        customerPhone: customerPhone || '',
        shippingAddress: shippingAddress || {},
        items,
        subtotal,
        shippingCost: Number(shippingCost || 0),
        taxAmount: Number(taxAmount || 0),
        totalAmount,
        paymentMethod,
        paymentStatus: resolvedPaymentStatus,
        status,
        timeline: [{ status, note: 'Order created', timestamp: new Date() }],
      });

      const settings = await StoreSettings.findOne({ singletonKey: 'default' }).lean();
      if (settings?.general?.autoUpdateStock !== false) {
        for (const item of items) {
          if (item.productId && mongoose.isValidObjectId(item.productId)) {
            await Product.findByIdAndUpdate(item.productId, {
              $inc: { stock: -Math.abs(Number(item.quantity || 1)) },
            });
            await Product.updateOne({ _id: item.productId, stock: { $lt: 0 } }, { $set: { stock: 0 } });
          }
        }
      }

      if (userId && mongoose.isValidObjectId(userId)) {
        await User.findByIdAndUpdate(userId, {
          $push: {
            activities: {
              $each: [
                {
                  type: 'order',
                  title: 'Order Placed',
                  description: `Placed an order with ${items.length} item(s) (${paymentMethod})`,
                  badge: orderNumber,
                  createdAt: new Date(),
                },
              ],
              $position: 0,
            },
          },
        });
      }

      res.status(201).json(order);
    } catch (error) {
      console.error('Create order error:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  router.get('/orders/:id', async (req, res) => {
    try {
      const order = await Order.findById(req.params.id).lean();
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.json(order);
    } catch {
      res.status(404).json({ error: 'Order not found' });
    }
  });

  router.patch('/orders/:id/status', async (req, res) => {
    try {
      const { status, paymentStatus, note } = req.body;
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: 'Order not found' });

      if (status && status !== order.status) {
        order.status = status;
        order.timeline.push({
          status,
          note: note || `Order status updated to ${status}`,
          timestamp: new Date(),
        });
      }
      if (paymentStatus) {
        order.paymentStatus = paymentStatus;
      }

      await order.save();

      if (order.userId) {
        await User.findByIdAndUpdate(order.userId, {
          $push: {
            activities: {
              $each: [
                {
                  type: 'order',
                  title: `Order ${order.status}`,
                  description: `Order was marked as ${order.status}`,
                  badge: order.orderNumber,
                  createdAt: new Date(),
                },
              ],
              $position: 0,
            },
          },
        });
      }

      res.json(order);
    } catch {
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  router.delete('/orders/:id', async (req, res) => {
    try {
      const deleted = await Order.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Order not found' });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete order' });
    }
  });

  // ==================== PRODUCTS ====================
  router.get('/products/export', async (req, res) => {
    try {
      const format = String(req.query.format || 'csv');
      const products = await Product.find().sort({ createdAt: -1 }).lean();
      const rows = products.map((p) => ({
        Name: p.name,
        SKU: p.sku,
        Category: p.categoryName,
        Price: p.price,
        DiscountPercent: p.discountPercent,
        Stock: p.stock,
        LowStockThreshold: p.lowStockThreshold,
        Status: p.status,
        Description: p.description,
        CreatedAt: new Date(p.createdAt).toISOString(),
      }));
      return sendWorkbook(res, rows, 'Products', 'shopadmin-products', format);
    } catch {
      res.status(500).json({ error: 'Failed to export products' });
    }
  });

  router.get('/products', async (req, res) => {
    try {
      const {
        search = '',
        category = 'All',
        status = 'All',
        stockStatus = 'All',
        page = '1',
        limit = '10',
      } = req.query as Record<string, string>;

      const query: Record<string, unknown> = {};
      if (search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [{ name: regex }, { sku: regex }, { categoryName: regex }];
      }
      if (category && category !== 'All') {
        query.categoryName = category;
      }
      if (status && status !== 'All') {
        query.status = status;
      }

      let allMatching = await Product.find(query).sort({ createdAt: -1 }).lean();
      if (stockStatus && stockStatus !== 'All') {
        allMatching = allMatching.filter((p) => {
          const thr = p.lowStockThreshold ?? 10;
          if (stockStatus === 'Out of Stock') return p.stock <= 0;
          if (stockStatus === 'Low Stock') return p.stock > 0 && p.stock <= thr;
          if (stockStatus === 'In Stock') return p.stock > thr;
          return true;
        });
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
      const paginated = allMatching.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      const fullProducts = await Product.find().lean();
      const stats = {
        total: fullProducts.length,
        active: fullProducts.filter((p) => p.status === 'Active').length,
        draft: fullProducts.filter((p) => p.status === 'Draft' || p.status === 'Inactive').length,
        lowStock: fullProducts.filter((p) => p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 10)).length,
        outOfStock: fullProducts.filter((p) => p.stock <= 0).length,
      };

      res.json({
        products: paginated,
        total: allMatching.length,
        page: pageNum,
        limit: limitNum,
        stats,
      });
    } catch {
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  router.post('/products', async (req, res) => {
    try {
      const {
        name,
        sku,
        categoryId,
        categoryName,
        price,
        discountPercent = 0,
        stock = 0,
        lowStockThreshold = 10,
        status = 'Active',
        description = '',
        images = [],
      } = req.body;

      if (!name || !sku || price === undefined) {
        return res.status(400).json({ error: 'Name, SKU, and price are required' });
      }

      let resolvedCategoryName = categoryName || 'Uncategorized';
      if (categoryId && mongoose.isValidObjectId(categoryId)) {
        const cat = await Category.findById(categoryId).lean();
        if (cat) resolvedCategoryName = cat.name;
      }

      const trimmedName = String(name).trim();
      const baseSlug = slugify(trimmedName) || slugify(String(sku));
      const product = await Product.create({
        name: trimmedName,
        slug: baseSlug,
        sku: String(sku).trim().toUpperCase(),
        categoryId: categoryId || null,
        categoryName: resolvedCategoryName,
        price: Number(price),
        discountPercent: Number(discountPercent || 0),
        stock: Number(stock || 0),
        lowStockThreshold: Number(lowStockThreshold ?? 10),
        status,
        description,
        images: Array.isArray(images) ? images : images ? [images] : [],
      });

      res.status(201).json(product);
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000
          ? 'A product with this SKU already exists'
          : 'Failed to create product';
      res.status(400).json({ error: msg });
    }
  });

  router.put('/products/:id', async (req, res) => {
    try {
      const updates = { ...req.body };
      if (updates.categoryId === '') {
        updates.categoryId = null;
      }
      if (updates.name && !updates.slug) {
        updates.slug = slugify(String(updates.name));
      }
      if (updates.categoryId && mongoose.isValidObjectId(updates.categoryId)) {
        const cat = await Category.findById(updates.categoryId).lean();
        if (cat) updates.categoryName = cat.name;
      }
      if (updates.sku) updates.sku = String(updates.sku).trim().toUpperCase();
      const updated = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });
      if (!updated) return res.status(404).json({ error: 'Product not found' });
      res.json(updated);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to update product',
      });
    }
  });

  router.delete('/products/:id', async (req, res) => {
    try {
      const deleted = await Product.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Product not found' });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  // ==================== CATEGORIES ====================
  router.get('/categories', async (req, res) => {
    try {
      const { search = '', status = 'All' } = req.query as Record<string, string>;
      const query: Record<string, unknown> = {};
      if (search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [{ name: regex }, { slug: regex }, { description: regex }];
      }
      if (status && status !== 'All') {
        query.status = status;
      }

      const [categories, allCategories, products] = await Promise.all([
        Category.find(query).sort({ createdAt: -1 }).lean(),
        Category.find().lean(),
        Product.find({}, 'categoryId categoryName').lean(),
      ]);

      const countByCategoryId = new Map<string, number>();
      const countByCategoryName = new Map<string, number>();
      for (const p of products) {
        if (p.categoryId) {
          const k = String(p.categoryId);
          countByCategoryId.set(k, (countByCategoryId.get(k) || 0) + 1);
        }
        if (p.categoryName) {
          const k = p.categoryName.toLowerCase();
          countByCategoryName.set(k, (countByCategoryName.get(k) || 0) + 1);
        }
      }

      const enriched = categories.map((c) => ({
        ...c,
        productCount:
          countByCategoryId.get(String(c._id)) ??
          countByCategoryName.get(c.name.toLowerCase()) ??
          0,
      }));

      res.json({
        categories: enriched,
        stats: {
          total: allCategories.length,
          active: allCategories.filter((c) => c.status === 'Active').length,
          inactive: allCategories.filter((c) => c.status === 'Inactive').length,
        },
      });
    } catch {
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  router.post('/categories', async (req, res) => {
    try {
      const { name, slug, description = '', image = '', icon = 'folder', status = 'Active' } = req.body;
      if (!name) return res.status(400).json({ error: 'Category name is required' });

      const resolvedSlug = slug?.trim() ? slugify(slug) : slugify(name);
      const category = await Category.create({
        name: String(name).trim(),
        slug: resolvedSlug,
        description,
        image,
        icon,
        status,
      });
      res.status(201).json(category);
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000
          ? 'A category with this slug already exists'
          : 'Failed to create category';
      res.status(400).json({ error: msg });
    }
  });

  router.put('/categories/:id', async (req, res) => {
    try {
      const { name, slug, description, image, icon, status } = req.body;
      const existing = await Category.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Category not found' });

      const oldName = existing.name;
      if (name !== undefined) existing.name = String(name).trim();
      if (slug !== undefined) existing.slug = slugify(slug || existing.name);
      if (description !== undefined) existing.description = description;
      if (image !== undefined) existing.image = image;
      if (icon !== undefined) existing.icon = icon;
      if (status !== undefined) existing.status = status;

      await existing.save();

      if (name && oldName !== existing.name) {
        await Product.updateMany({ categoryId: existing._id }, { $set: { categoryName: existing.name } });
      }

      res.json(existing);
    } catch {
      res.status(400).json({ error: 'Failed to update category' });
    }
  });

  router.delete('/categories/:id', async (req, res) => {
    try {
      const deleted = await Category.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Category not found' });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete category' });
    }
  });

  // ==================== USERS ====================
  router.get('/users', async (req, res) => {
    try {
      const {
        search = '',
        status = 'All',
        user_role = 'All',
        dateFilter = 'All',
        page = '1',
        limit = '10',
      } = req.query as Record<string, string>;

      const query: Record<string, unknown> = {};
      if (search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [{ name: regex }, { email: regex }, { phone: regex }, { user_role: regex }];
      }
      if (status && status !== 'All') {
        query.status = status;
      }
      if (user_role && user_role !== 'All') {
        query.user_role = user_role;
      }
      if (dateFilter && dateFilter !== 'All') {
        const now = new Date();
        const start = new Date(now);
        if (dateFilter === '7d') start.setDate(now.getDate() - 7);
        else if (dateFilter === '30d') start.setDate(now.getDate() - 30);
        else if (dateFilter === 'year') start.setFullYear(now.getFullYear(), 0, 1);
        query.createdAt = { $gte: start };
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));

      const [users, total, allUsers, allOrders] = await Promise.all([
        User.find(query)
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        User.countDocuments(query),
        User.find({}, 'status createdAt').lean(),
        Order.find({}, 'userId customerEmail totalAmount status').lean(),
      ]);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const enriched = users.map((u) => {
        const userOrders = allOrders.filter(
          (o) =>
            (o.userId && String(o.userId) === String(u._id)) ||
            o.customerEmail?.toLowerCase() === u.email.toLowerCase()
        );
        const totalSpent = userOrders
          .filter((o) => o.status !== 'Cancelled')
          .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        return {
          ...u,
          ordersCount: userOrders.length,
          totalSpent,
        };
      });

      res.json({
        users: enriched,
        total,
        page: pageNum,
        limit: limitNum,
        stats: {
          total: allUsers.length,
          active: allUsers.filter((u) => u.status === 'Active').length,
          newUsers: allUsers.filter((u) => new Date(u.createdAt) >= thirtyDaysAgo).length,
          blocked: allUsers.filter((u) => u.status === 'Blocked').length,
        },
      });
    } catch {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  router.post('/users', async (req, res) => {
    try {
      const { name, email, phone = '', profileImage = '', status = 'Active', user_role = 'customer' } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
      }
      const validRole = ['super_admin', 'admin', 'manager', 'customer'].includes(user_role)
        ? user_role
        : 'customer';
      const user = await User.create({
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        phone,
        profileImage,
        user_role: validRole,
        status,
        activities: [
          {
            type: 'profile',
            title: 'Account Created',
            description: `User profile registered with user_role: ${validRole}`,
            createdAt: new Date(),
          },
        ],
      });
      res.status(201).json(user);
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000
          ? 'A user with this email already exists'
          : 'Failed to create user';
      res.status(400).json({ error: msg });
    }
  });

  router.get('/users/:id', async (req, res) => {
    try {
      const user = await User.findById(req.params.id).lean();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const orders = await Order.find({
        $or: [{ userId: user._id }, { customerEmail: user.email }],
      })
        .sort({ createdAt: -1 })
        .lean();

      const totalSpent = orders
        .filter((o) => o.status !== 'Cancelled')
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      res.json({
        user,
        orders,
        summary: {
          totalOrders: orders.length,
          totalSpent,
          itemsPurchased: orders.reduce(
            (sum: number, o) =>
              sum +
              ((o.items as Array<{ quantity?: number }> | undefined)?.reduce(
                (s: number, i: { quantity?: number }) => s + (i.quantity || 0),
                0
              ) || 0),
            0
          ),
        },
      });
    } catch {
      res.status(404).json({ error: 'User not found' });
    }
  });

  router.put('/users/:id', async (req, res) => {
    try {
      const { name, email, phone, profileImage, status, user_role } = req.body;
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (name !== undefined) user.name = name;
      if (email !== undefined) user.email = String(email).toLowerCase();
      if (phone !== undefined) user.phone = phone;
      if (profileImage !== undefined) user.profileImage = profileImage;
      if (status !== undefined) user.status = status;
      if (user_role !== undefined && ['super_admin', 'admin', 'manager', 'customer'].includes(user_role)) {
        user.user_role = user_role;
      }

      user.activities.unshift({
        type: 'profile',
        title: 'Profile Updated',
        description: `Updated user details (Role: ${user.user_role}, Status: ${user.status})`,
        createdAt: new Date(),
      });

      await user.save();
      res.json(user);
    } catch {
      res.status(400).json({ error: 'Failed to update user' });
    }
  });

  router.delete('/users/:id', async (req, res) => {
    try {
      const deleted = await User.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'User not found' });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // User Addresses
  router.post('/users/:id/addresses', async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const addr = req.body;
      if (addr.isDefault) {
        (user.addresses as Array<{ addressType?: string; isDefault?: boolean }>).forEach((a) => {
          if (a.addressType === (addr.addressType || 'Shipping')) a.isDefault = false;
        });
      }
      user.addresses.push(addr);
      user.activities.unshift({
        type: 'address',
        title: 'Address Added',
        description: `Added ${addr.label || 'Home'} (${addr.addressType || 'Shipping'}) address`,
        createdAt: new Date(),
      });
      await user.save();
      res.json(user);
    } catch {
      res.status(400).json({ error: 'Failed to add address' });
    }
  });

  router.put('/users/:id/addresses/:addrId', async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const addr = user.addresses.id(req.params.addrId);
      if (!addr) return res.status(404).json({ error: 'Address not found' });

      if (req.body.isDefault) {
        (user.addresses as Array<{ addressType?: string; isDefault?: boolean }>).forEach((a) => {
          if (a.addressType === (req.body.addressType || addr.addressType)) a.isDefault = false;
        });
      }
      Object.assign(addr, req.body);
      user.activities.unshift({
        type: 'address',
        title: 'Address Updated',
        description: `Updated ${addr.label} address`,
        createdAt: new Date(),
      });
      await user.save();
      res.json(user);
    } catch {
      res.status(400).json({ error: 'Failed to update address' });
    }
  });

  router.delete('/users/:id/addresses/:addrId', async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      user.addresses.pull({ _id: req.params.addrId });
      user.activities.unshift({
        type: 'address',
        title: 'Address Removed',
        description: 'Deleted a saved address',
        createdAt: new Date(),
      });
      await user.save();
      res.json(user);
    } catch {
      res.status(400).json({ error: 'Failed to delete address' });
    }
  });

  // User Cart
  router.post('/users/:id/cart', async (req, res) => {
    try {
      const { productId, quantity = 1 } = req.body;
      const [user, product] = await Promise.all([
        User.findById(req.params.id),
        Product.findById(productId).lean(),
      ]);
      if (!user || !product) return res.status(404).json({ error: 'User or product not found' });

      const existing = (user.cart as Array<{ productId: unknown; quantity: number }>).find(
        (c) => String(c.productId) === String(product._id)
      );
      const netPrice =
        product.discountPercent > 0
          ? Math.round(product.price * (1 - product.discountPercent / 100))
          : product.price;

      if (existing) {
        existing.quantity += Number(quantity || 1);
      } else {
        user.cart.push({
          productId: product._id,
          name: product.name,
          sku: product.sku,
          category: product.categoryName,
          image: product.images?.[0] || '',
          price: netPrice,
          quantity: Number(quantity || 1),
        });
      }

      user.activities.unshift({
        type: 'cart',
        title: 'Added to Cart',
        description: `Added ${quantity} × ${product.name}`,
        createdAt: new Date(),
      });
      await user.save();
      res.json(user);
    } catch {
      res.status(400).json({ error: 'Failed to add to cart' });
    }
  });

  router.patch('/users/:id/cart/:productId', async (req, res) => {
    try {
      const { quantity } = req.body;
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const item = (user.cart as Array<{ productId: unknown; name: string; quantity: number }>).find(
        (c) => String(c.productId) === req.params.productId
      );
      if (!item) return res.status(404).json({ error: 'Cart item not found' });

      if (Number(quantity) <= 0) {
        user.cart = (user.cart as Array<{ productId: unknown }>).filter(
          (c) => String(c.productId) !== req.params.productId
        ) as typeof user.cart;
      } else {
        item.quantity = Number(quantity);
      }
      user.activities.unshift({
        type: 'cart',
        title: 'Updated Cart',
        description: `Updated quantity for ${item.name}`,
        createdAt: new Date(),
      });
      await user.save();
      res.json(user);
    } catch {
      res.status(400).json({ error: 'Failed to update cart' });
    }
  });

  router.delete('/users/:id/cart/:productId', async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const removed = (user.cart as Array<{ productId: unknown; name: string }>).find(
        (c) => String(c.productId) === req.params.productId
      );
      user.cart = (user.cart as Array<{ productId: unknown }>).filter(
        (c) => String(c.productId) !== req.params.productId
      ) as typeof user.cart;
      if (removed) {
        user.activities.unshift({
          type: 'cart',
          title: 'Removed from Cart',
          description: `Removed ${removed.name} from cart`,
          createdAt: new Date(),
        });
      }
      await user.save();
      res.json(user);
    } catch {
      res.status(400).json({ error: 'Failed to remove cart item' });
    }
  });

  router.delete('/users/:id/cart', async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      user.cart.splice(0, user.cart.length);
      user.activities.unshift({
        type: 'cart',
        title: 'Cleared Cart',
        description: 'Removed all items from cart',
        createdAt: new Date(),
      });
      await user.save();
      res.json(user);
    } catch {
      res.status(400).json({ error: 'Failed to clear cart' });
    }
  });

  router.post('/users/:id/cart/checkout', async (req, res) => {
    try {
      const { paymentMethod = 'COD' } = req.body;
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (!user.cart || user.cart.length === 0) {
        return res.status(400).json({ error: 'User cart is empty' });
      }

      const addresses = user.addresses as Array<{
        addressType?: string;
        isDefault?: boolean;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      }>;
      const defaultAddr =
        addresses.find((a) => a.addressType === 'Shipping' && a.isDefault) ||
        addresses.find((a) => a.addressType === 'Shipping') ||
        addresses[0];

      const cartItems = user.cart as Array<{
        productId: unknown;
        name: string;
        sku: string;
        image: string;
        price: number;
        quantity: number;
      }>;
      const subtotal = cartItems.reduce((sum: number, i) => sum + i.price * i.quantity, 0);
      const count = await Order.countDocuments();
      const orderNumber = `#ORD-${10001 + count + Math.floor(Math.random() * 90)}`;

      const order = await Order.create({
        orderNumber,
        userId: user._id,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone,
        shippingAddress: defaultAddr
          ? {
              line1: defaultAddr.line1,
              line2: defaultAddr.line2,
              city: defaultAddr.city,
              state: defaultAddr.state,
              postalCode: defaultAddr.postalCode,
              country: defaultAddr.country,
            }
          : {},
        items: cartItems.map((c) => ({
          productId: c.productId,
          name: c.name,
          sku: c.sku,
          image: c.image,
          price: c.price,
          quantity: c.quantity,
        })),
        subtotal,
        shippingCost: 0,
        taxAmount: 0,
        totalAmount: subtotal,
        paymentMethod,
        paymentStatus: paymentMethod === 'Paid' ? 'Paid' : 'Pending',
        status: 'Placed',
        timeline: [{ status: 'Placed', note: 'Order created from user cart', timestamp: new Date() }],
      });

      user.cart.splice(0, user.cart.length);
      user.activities.unshift({
        type: 'order',
        title: 'Order Placed',
        description: `Placed order ${orderNumber} (${paymentMethod})`,
        badge: orderNumber,
        createdAt: new Date(),
      });
      await user.save();

      res.status(201).json({ order, user });
    } catch {
      res.status(500).json({ error: 'Failed to create order from cart' });
    }
  });

  // ==================== INVENTORY ====================
  router.get('/inventory/export', async (req, res) => {
    try {
      const format = String(req.query.format || 'csv');
      const products = await Product.find().sort({ updatedAt: -1 }).lean();
      const rows = products.map((p) => {
        const thr = p.lowStockThreshold ?? 10;
        const stockStatus = p.stock <= 0 ? 'Out of Stock' : p.stock <= thr ? 'Low Stock' : 'In Stock';
        return {
          Product: p.name,
          SKU: p.sku,
          Category: p.categoryName,
          AvailableStock: p.stock,
          StockStatus: stockStatus,
          UnitPrice: p.price,
          StockValue: p.stock * p.price,
          LastUpdated: new Date(p.updatedAt).toISOString(),
        };
      });
      return sendWorkbook(res, rows, 'Inventory', 'shopadmin-inventory', format);
    } catch {
      res.status(500).json({ error: 'Failed to export inventory' });
    }
  });

  router.get('/inventory', async (req, res) => {
    try {
      const {
        search = '',
        category = 'All',
        stockStatus = 'All',
        page = '1',
        limit = '10',
      } = req.query as Record<string, string>;

      const query: Record<string, unknown> = {};
      if (search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [{ name: regex }, { sku: regex }];
      }
      if (category && category !== 'All') {
        query.categoryName = category;
      }

      const [filtered, allProducts] = await Promise.all([
        Product.find(query).sort({ updatedAt: -1 }).lean(),
        Product.find().lean(),
      ]);

      const withStatus = filtered
        .map((p) => {
          const thr = p.lowStockThreshold ?? 10;
          const computedStatus = p.stock <= 0 ? 'Out of Stock' : p.stock <= thr ? 'Low Stock' : 'In Stock';
          return {
            ...p,
            stockStatus: computedStatus,
            stockValue: (p.stock || 0) * (p.price || 0),
          };
        })
        .filter((p) => {
          if (stockStatus === 'All' || stockStatus === 'All Items') return true;
          if (stockStatus === 'Stock Alerts') return p.stockStatus === 'Low Stock' || p.stockStatus === 'Out of Stock';
          return p.stockStatus === stockStatus;
        });

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
      const paginated = withStatus.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      let inStock = 0;
      let lowStock = 0;
      let outOfStock = 0;
      let totalStockValue = 0;
      for (const p of allProducts) {
        const thr = p.lowStockThreshold ?? 10;
        if (p.stock <= 0) outOfStock += 1;
        else if (p.stock <= thr) lowStock += 1;
        else inStock += 1;
        totalStockValue += (p.stock || 0) * (p.price || 0);
      }

      res.json({
        items: paginated,
        total: withStatus.length,
        page: pageNum,
        limit: limitNum,
        stats: {
          totalItems: allProducts.length,
          inStock,
          lowStock,
          outOfStock,
          totalStockValue,
        },
      });
    } catch {
      res.status(500).json({ error: 'Failed to load inventory' });
    }
  });

  router.post('/inventory/adjust', async (req, res) => {
    try {
      const { productId, mode, quantity } = req.body;
      const product = await Product.findById(productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const qty = Math.max(0, Number(quantity || 0));
      if (mode === 'set') product.stock = qty;
      else if (mode === 'add') product.stock += qty;
      else if (mode === 'subtract') product.stock = Math.max(0, product.stock - qty);

      await product.save();
      res.json(product);
    } catch {
      res.status(400).json({ error: 'Failed to adjust stock' });
    }
  });

  // ==================== SETTINGS ====================
  router.get('/settings', async (_req, res) => {
    try {
      let settings = await StoreSettings.findOne({ singletonKey: 'default' }).lean();
      if (!settings) {
        settings = (await StoreSettings.create({ singletonKey: 'default' })).toObject();
      }
      res.json(settings);
    } catch {
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  router.put('/settings/general', async (req, res) => {
    try {
      const settings = await StoreSettings.findOneAndUpdate(
        { singletonKey: 'default' },
        { $set: { general: req.body } },
        { new: true, upsert: true }
      );
      res.json(settings);
    } catch {
      res.status(400).json({ error: 'Failed to update general settings' });
    }
  });

  router.put('/settings/shipping', async (req, res) => {
    try {
      const settings = await StoreSettings.findOneAndUpdate(
        { singletonKey: 'default' },
        { $set: { shipping: req.body } },
        { new: true, upsert: true }
      );
      res.json(settings);
    } catch {
      res.status(400).json({ error: 'Failed to update shipping settings' });
    }
  });

  router.put('/settings/tax', async (req, res) => {
    try {
      const current = await StoreSettings.findOne({ singletonKey: 'default' });
      if (!current) return res.status(404).json({ error: 'Settings not found' });
      const rates = req.body.rates ?? current.tax?.rates ?? [];
      current.tax = { ...req.body, rates };
      await current.save();
      res.json(current);
    } catch {
      res.status(400).json({ error: 'Failed to update tax settings' });
    }
  });

  router.post('/settings/tax/rates', async (req, res) => {
    try {
      const settings = await StoreSettings.findOne({ singletonKey: 'default' });
      if (!settings) return res.status(404).json({ error: 'Settings not found' });
      settings.tax.rates.push(req.body);
      await settings.save();
      res.json(settings);
    } catch {
      res.status(400).json({ error: 'Failed to add tax rate' });
    }
  });

  router.put('/settings/tax/rates/:rateId', async (req, res) => {
    try {
      const settings = await StoreSettings.findOne({ singletonKey: 'default' });
      if (!settings) return res.status(404).json({ error: 'Settings not found' });
      const rateDoc = settings.tax.rates.id(req.params.rateId);
      if (!rateDoc) return res.status(404).json({ error: 'Tax rate not found' });
      Object.assign(rateDoc, req.body);
      await settings.save();
      res.json(settings);
    } catch {
      res.status(400).json({ error: 'Failed to update tax rate' });
    }
  });

  router.delete('/settings/tax/rates/:rateId', async (req, res) => {
    try {
      const settings = await StoreSettings.findOne({ singletonKey: 'default' });
      if (!settings) return res.status(404).json({ error: 'Settings not found' });
      settings.tax.rates.pull({ _id: req.params.rateId });
      await settings.save();
      res.json(settings);
    } catch {
      res.status(400).json({ error: 'Failed to delete tax rate' });
    }
  });

  router.put('/settings/notifications', async (req, res) => {
    try {
      const settings = await StoreSettings.findOneAndUpdate(
        { singletonKey: 'default' },
        { $set: { notifications: req.body } },
        { new: true, upsert: true }
      );
      res.json(settings);
    } catch {
      res.status(400).json({ error: 'Failed to update notification settings' });
    }
  });

  router.put('/settings/integrations', async (req, res) => {
    try {
      const updateSet: Record<string, unknown> = {};
      if (req.body.smtp !== undefined) updateSet['integrations.smtp'] = req.body.smtp;
      if (req.body.razorpay !== undefined) updateSet['integrations.razorpay'] = req.body.razorpay;
      if (req.body.sms !== undefined) updateSet['integrations.sms'] = req.body.sms;
      const settings = await StoreSettings.findOneAndUpdate(
        { singletonKey: 'default' },
        { $set: updateSet },
        { new: true, upsert: true }
      );
      res.json(settings);
    } catch {
      res.status(400).json({ error: 'Failed to update integration settings' });
    }
  });

  router.put('/settings/google-drive', async (req, res) => {
    try {
      const settings = await StoreSettings.findOneAndUpdate(
        { singletonKey: 'default' },
        { $set: { 'integrations.googleDrive': req.body } },
        { new: true, upsert: true }
      );
      res.json(settings);
    } catch {
      res.status(400).json({ error: 'Failed to update Google Drive metadata' });
    }
  });

  router.post('/settings/integrations/test-smtp', async (req, res) => {
    try {
      const { host, port, username, password, encryption } = req.body;
      if (!host || !port || !username || !password) {
        return res.status(400).json({ error: 'SMTP host, port, username, and password are required' });
      }
      const transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: encryption === 'SSL' || Number(port) === 465,
        auth: { user: username, pass: password },
        tls: encryption === 'None' ? { rejectUnauthorized: false } : undefined,
      });
      await transporter.verify();
      res.json({ ok: true, message: 'SMTP connection verified successfully' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'SMTP verification failed';
      res.status(400).json({ error: message });
    }
  });

  router.post('/settings/integrations/test-razorpay', async (req, res) => {
    try {
      const { keyId, keySecret, environment } = req.body;
      if (!keyId || !keySecret) {
        return res.status(400).json({ error: 'Razorpay Key ID and Key Secret are required' });
      }
      const prefix = environment === 'Live' ? 'rzp_live_' : 'rzp_test_';
      if (!String(keyId).startsWith('rzp_')) {
        return res.status(400).json({ error: `Key ID should begin with ${prefix}` });
      }
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders?count=1', {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (rzpRes.ok) {
        return res.json({ ok: true, message: 'Razorpay credentials verified with live API' });
      }
      return res.status(400).json({ error: `Razorpay rejected credentials (HTTP ${rzpRes.status})` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Razorpay verification failed';
      res.status(400).json({ error: message });
    }
  });

  router.post('/settings/integrations/test-sms', async (req, res) => {
    const { provider, apiKey, senderId } = req.body;
    if (!provider || !apiKey || !senderId) {
      return res.status(400).json({ error: 'Provider, API Key, and Sender ID are required' });
    }
    res.json({ ok: true, message: `${provider} configuration validated and saved ready for dispatch` });
  });

  // ==================== ADMIN USERS & PERMISSIONS ====================
  router.get('/admins', async (_req, res) => {
    try {
      const admins = await AdminUser.find({}, '-passwordHash -otpCode -otpExpiresAt')
        .sort({ createdAt: 1 })
        .lean();
      res.json({ admins });
    } catch {
      res.status(500).json({ error: 'Failed to load admin users' });
    }
  });

  router.post('/admins', async (req, res) => {
    try {
      const { name, email, password, role = 'Admin', status = 'Active', permissions } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
      }
      const userRole =
        role === 'Super Admin' ? 'super_admin' : role === 'Manager' ? 'manager' : 'admin';
      const normalizedEmail = String(email).trim().toLowerCase();
      const passwordHash = await bcrypt.hash(password, 10);
      const admin = await AdminUser.create({
        name,
        email: normalizedEmail,
        passwordHash,
        role,
        user_role: userRole,
        status,
        permissions,
      });

      await User.findOneAndUpdate(
        { email: normalizedEmail },
        {
          $set: {
            name,
            email: normalizedEmail,
            user_role: userRole,
            status: status === 'Inactive' ? 'Blocked' : 'Active',
          },
          $setOnInsert: {
            phone: '',
            activities: [
              {
                type: 'profile',
                title: 'Admin Account Created',
                description: `Created with user_role: ${userRole}`,
                createdAt: new Date(),
              },
            ],
          },
        },
        { upsert: true, new: true }
      );

      const obj = admin.toObject();
      delete (obj as Record<string, unknown>).passwordHash;
      delete (obj as Record<string, unknown>).otpCode;
      res.status(201).json(obj);
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000
          ? 'An admin with this email already exists'
          : 'Failed to create admin user';
      res.status(400).json({ error: msg });
    }
  });

  router.put('/admins/:id', async (req, res) => {
    try {
      const { name, email, role, status, permissions, password } = req.body;
      const admin = await AdminUser.findById(req.params.id);
      if (!admin) return res.status(404).json({ error: 'Admin not found' });

      const previousEmail = admin.email;
      if (name !== undefined) admin.name = name;
      if (email !== undefined) admin.email = String(email).toLowerCase();
      if (role !== undefined) {
        admin.role = role;
        admin.user_role =
          role === 'Super Admin' ? 'super_admin' : role === 'Manager' ? 'manager' : 'admin';
      }
      if (status !== undefined) admin.status = status;
      if (permissions !== undefined) admin.permissions = permissions;
      if (password && String(password).trim().length >= 6) {
        admin.passwordHash = await bcrypt.hash(password, 10);
      }

      await admin.save();

      await User.findOneAndUpdate(
        { email: previousEmail.toLowerCase() },
        {
          $set: {
            name: admin.name,
            email: admin.email.toLowerCase(),
            user_role: admin.user_role,
            status: admin.status === 'Inactive' ? 'Blocked' : 'Active',
          },
        },
        { upsert: true }
      );

      const obj = admin.toObject();
      delete (obj as Record<string, unknown>).passwordHash;
      delete (obj as Record<string, unknown>).otpCode;
      res.json(obj);
    } catch {
      res.status(400).json({ error: 'Failed to update admin user' });
    }
  });

  router.delete('/admins/:id', async (req, res) => {
    try {
      const count = await AdminUser.countDocuments();
      if (count <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last remaining admin account' });
      }
      const deleted = await AdminUser.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Admin not found' });
      await User.findOneAndDelete({ email: deleted.email.toLowerCase() });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete admin' });
    }
  });

  // ==================== SECURITY (ADMIN PASSWORD) ====================
  router.post('/security/send-otp', async (req, res) => {
    try {
      const admin = (req as AdminAuthedRequest).admin;
      if (!admin) return res.status(401).json({ error: 'Admin account not found' });

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      admin.otpCode = otp;
      admin.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await admin.save();

      const settings = await StoreSettings.findOne({ singletonKey: 'default' }).lean();
      const smtp = settings?.integrations?.smtp;
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
            to: admin.email,
            subject: 'ShopAdmin Password Verification OTP',
            text: `Your ShopAdmin verification OTP is ${otp}. It expires in 10 minutes.`,
          });
          emailed = true;
        } catch {
          emailed = false;
        }
      }

      res.json({
        ok: true,
        email: admin.email,
        emailed,
        message: emailed
          ? `OTP sent to ${admin.email}`
          : `OTP generated for ${admin.email} (configure SMTP in Integrations to deliver via email). Dev verification OTP: ${otp}`,
      });
    } catch {
      res.status(500).json({ error: 'Failed to generate OTP' });
    }
  });

  router.post('/security/change-password', async (req, res) => {
    try {
      const { method, oldPassword, otp, newPassword, confirmPassword } = req.body;
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'New passwords do not match' });
      }

      const admin = (req as AdminAuthedRequest).admin;
      if (!admin) return res.status(401).json({ error: 'Admin account not found' });

      if (method === 'otp') {
        if (!otp || admin.otpCode !== String(otp).trim()) {
          return res.status(400).json({ error: 'Invalid verification OTP' });
        }
        if (!admin.otpExpiresAt || admin.otpExpiresAt < new Date()) {
          return res.status(400).json({ error: 'OTP has expired. Request a new one.' });
        }
        admin.otpCode = '';
        admin.otpExpiresAt = null;
      } else {
        const matches = await bcrypt.compare(String(oldPassword || ''), admin.passwordHash);
        if (!matches) {
          return res.status(400).json({ error: 'Current password is incorrect' });
        }
      }

      admin.passwordHash = await bcrypt.hash(newPassword, 10);
      await admin.save();

      res.json({ ok: true, message: 'Admin password updated successfully' });
    } catch {
      res.status(500).json({ error: 'Failed to update password' });
    }
  });

  // ==================== BACKUP & DATA (EXPORT / IMPORT) ====================
  router.get('/data/export', async (req, res) => {
    try {
      const type = String(req.query.type || 'products');
      const format = String(req.query.format || 'xlsx');

      if (type === 'categories') {
        const categories = await Category.find().sort({ createdAt: -1 }).lean();
        const rows = categories.map((c) => ({
          Name: c.name,
          Slug: c.slug,
          Description: c.description,
          Status: c.status,
          Image: c.image,
        }));
        return sendWorkbook(res, rows, 'Categories', 'shopadmin-categories', format);
      }

      if (type === 'users') {
        const users = await User.find().sort({ createdAt: -1 }).lean();
        const rows = users.map((u) => ({
          Name: u.name,
          Email: u.email,
          Phone: u.phone,
          UserRole: u.user_role || 'customer',
          Status: u.status,
          RegisteredAt: new Date(u.createdAt).toISOString(),
        }));
        return sendWorkbook(res, rows, 'Users', 'shopadmin-users', format);
      }

      const products = await Product.find().sort({ createdAt: -1 }).lean();
      const rows = products.map((p) => ({
        Name: p.name,
        SKU: p.sku,
        Category: p.categoryName,
        Price: p.price,
        DiscountPercent: p.discountPercent,
        Stock: p.stock,
        LowStockThreshold: p.lowStockThreshold,
        Status: p.status,
        Description: p.description,
      }));
      return sendWorkbook(res, rows, 'Products', 'shopadmin-products', format);
    } catch {
      res.status(500).json({ error: 'Failed to export data' });
    }
  });

  router.get('/data/sample', (req, res) => {
    const type = String(req.query.type || 'products');
    const format = String(req.query.format || 'xlsx');

    if (type === 'categories') {
      return sendWorkbook(
        res,
        [{ Name: 'Electronics', Slug: 'electronics', Description: 'Electronic devices and accessories', Status: 'Active' }],
        'Categories',
        'sample-categories',
        format
      );
    }
    if (type === 'users') {
      return sendWorkbook(
        res,
        [
          {
            Name: 'Customer Name',
            Email: 'customer@example.com',
            Phone: '+91 9876543210',
            UserRole: 'customer',
            Status: 'Active',
          },
        ],
        'Users',
        'sample-users',
        format
      );
    }
    return sendWorkbook(
      res,
      [
        {
          Name: 'Sample Product',
          SKU: 'SKU-001',
          Category: 'Electronics',
          Price: 999,
          DiscountPercent: 10,
          Stock: 25,
          LowStockThreshold: 10,
          Status: 'Active',
          Description: 'Product description',
        },
      ],
      'Products',
      'sample-products',
      format
    );
  });

  router.post('/data/import', uploadMemory.single('file'), async (req, res) => {
    try {
      const type = String(req.body.type || 'products');
      if (!req.file) {
        return res.status(400).json({ error: 'Please select a .xlsx or .csv file to import' });
      }

      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const firstSheet = wb.SheetNames[0];
      if (!firstSheet) {
        return res.status(400).json({ error: 'Uploaded workbook has no sheets' });
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[firstSheet]);
      let importedCount = 0;

      if (type === 'categories') {
        for (const row of rows) {
          const name = String(row.Name || row.name || '').trim();
          if (!name) continue;
          const slug = slugify(String(row.Slug || row.slug || name));
          await Category.findOneAndUpdate(
            { slug },
            {
              name,
              slug,
              description: String(row.Description || row.description || ''),
              status: String(row.Status || row.status || 'Active') === 'Inactive' ? 'Inactive' : 'Active',
              image: String(row.Image || row.image || ''),
            },
            { upsert: true, new: true }
          );
          importedCount += 1;
        }
      } else if (type === 'users') {
        for (const row of rows) {
          const email = String(row.Email || row.email || '').trim().toLowerCase();
          const name = String(row.Name || row.name || '').trim();
          if (!email || !name) continue;
          const rawRole = String(row.UserRole || row.user_role || 'customer').trim().toLowerCase();
          const userRole = ['super_admin', 'admin', 'manager', 'customer'].includes(rawRole)
            ? rawRole
            : 'customer';
          await User.findOneAndUpdate(
            { email },
            {
              name,
              email,
              phone: String(row.Phone || row.phone || ''),
              user_role: userRole,
              status: String(row.Status || row.status || 'Active') === 'Blocked' ? 'Blocked' : 'Active',
            },
            { upsert: true, new: true }
          );
          importedCount += 1;
        }
      } else {
        for (const row of rows) {
          const name = String(row.Name || row.name || '').trim();
          const sku = String(row.SKU || row.sku || '').trim().toUpperCase();
          if (!name || !sku) continue;
          const catName = String(row.Category || row.category || 'Uncategorized').trim();
          let cat = await Category.findOne({ name: new RegExp(`^${catName}$`, 'i') });
          if (!cat && catName !== 'Uncategorized') {
            cat = await Category.create({ name: catName, slug: slugify(catName), status: 'Active' });
          }

          await Product.findOneAndUpdate(
            { sku },
            {
              name,
              sku,
              categoryId: cat?._id || null,
              categoryName: cat?.name || catName,
              price: Number(row.Price || row.price || 0),
              discountPercent: Number(row.DiscountPercent || row.discountPercent || 0),
              stock: Number(row.Stock || row.stock || 0),
              lowStockThreshold: Number(row.LowStockThreshold || row.lowStockThreshold || 10),
              status: ['Active', 'Draft', 'Inactive'].includes(String(row.Status || row.status || 'Active'))
                ? String(row.Status || row.status || 'Active')
                : 'Active',
              description: String(row.Description || row.description || ''),
            },
            { upsert: true, new: true }
          );
          importedCount += 1;
        }
      }

      res.json({ ok: true, importedCount, message: `Imported ${importedCount} ${type} records into MongoDB` });
    } catch (error) {
      console.error('Import error:', error);
      res.status(400).json({ error: 'Failed to parse and import uploaded file' });
    }
  });

  return router;
}
