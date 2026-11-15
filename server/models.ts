import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    icon: { type: String, default: 'folder' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);

const productSpecificationSubSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const productReviewSubSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, required: true, trim: true },
    userEmail: { type: String, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, index: true },
    sku: { type: String, required: true, trim: true, unique: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    categoryName: { type: String, default: 'Uncategorized' },
    price: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 10, min: 0 },
    status: { type: String, enum: ['Active', 'Draft', 'Inactive'], default: 'Active' },
    description: { type: String, default: '' },
    images: { type: [String], default: [] },
    specifications: { type: [productSpecificationSubSchema], default: [] },
    reviews: { type: [productReviewSubSchema], default: [] },
    ratingAverage: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const addressSubSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Home' },
    addressType: { type: String, enum: ['Shipping', 'Billing'], default: 'Shipping' },
    fullName: { type: String, required: true },
    phone: { type: String, default: '' },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const cartItemSubSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, default: '' },
    category: { type: String, default: '' },
    image: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const activitySubSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['login', 'logout', 'cart', 'order', 'profile', 'address'],
      default: 'profile',
    },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    badge: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, default: '' },
    profileImage: { type: String, default: '' },
    user_role: {
      type: String,
      enum: ['super_admin', 'admin', 'manager', 'customer'],
      default: 'customer',
    },
    status: { type: String, enum: ['Active', 'Blocked'], default: 'Active' },
    lastLogin: { type: Date, default: null },
    addresses: { type: [addressSubSchema], default: [] },
    cart: { type: [cartItemSubSchema], default: [] },
    wishlist: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], default: [] },
    activities: { type: [activitySubSchema], default: [] },
  },
  { timestamps: true }
);

const orderItemSubSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    name: { type: String, required: true },
    sku: { type: String, default: '' },
    image: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderTimelineSubSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    shippingAddress: {
      fullName: { type: String, default: '' },
      phone: { type: String, default: '' },
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      postalCode: { type: String, default: '' },
      country: { type: String, default: 'India' },
    },
    items: { type: [orderItemSubSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: '' },
    shippingCost: { type: Number, default: 0, min: 0 },
    shippingMethodName: { type: String, default: 'Standard Delivery' },
    estimatedDelivery: { type: String, default: '3-5 Business Days' },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ['Paid', 'COD', 'Razorpay'], default: 'COD' },
    paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Failed'], default: 'Pending' },
    razorpayPaymentId: { type: String, default: '' },
    confirmationEmailSent: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Placed',
    },
    timeline: { type: [orderTimelineSubSchema], default: [] },
  },
  { timestamps: true }
);

const permissionModuleSchema = new mongoose.Schema(
  {
    view: { type: Boolean, default: true },
    create: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
  },
  { _id: false }
);

const adminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['Super Admin', 'Admin', 'Manager'], default: 'Admin' },
    user_role: { type: String, enum: ['super_admin', 'admin', 'manager'], default: 'admin' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    lastLogin: { type: Date, default: Date.now },
    otpCode: { type: String, default: '' },
    otpExpiresAt: { type: Date, default: null },
    permissions: {
      dashboard: { type: permissionModuleSchema, default: () => ({ view: true, create: true, edit: true, delete: true }) },
      orders: { type: permissionModuleSchema, default: () => ({ view: true, create: true, edit: true, delete: true }) },
      products: { type: permissionModuleSchema, default: () => ({ view: true, create: true, edit: true, delete: true }) },
      categories: { type: permissionModuleSchema, default: () => ({ view: true, create: true, edit: true, delete: true }) },
      users: { type: permissionModuleSchema, default: () => ({ view: true, create: true, edit: true, delete: true }) },
      inventory: { type: permissionModuleSchema, default: () => ({ view: true, create: true, edit: true, delete: true }) },
      settings: { type: permissionModuleSchema, default: () => ({ view: true, create: true, edit: true, delete: true }) },
    },
  },
  { timestamps: true }
);

const shippingMethodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    deliveryTime: { type: String, default: '3-5 Business Days' },
    charge: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { _id: true }
);

const taxRateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    taxType: { type: String, enum: ['GST', 'CGST', 'SGST', 'IGST', 'VAT'], default: 'GST' },
    rate: { type: Number, required: true, min: 0, max: 100 },
    description: { type: String, default: '' },
    region: { type: String, default: 'All India' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { _id: true }
);

const storeSettingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'default', unique: true },
    general: {
      storeName: { type: String, default: 'ShopAdmin Store' },
      storeSlug: { type: String, default: 'shopadmin-store' },
      storeDescription: { type: String, default: '' },
      storeLogo: { type: String, default: '' },
      storeEmail: { type: String, default: 'sikandaritguy@gmail.com' },
      storePhone: { type: String, default: '' },
      addressLine1: { type: String, default: '' },
      addressLine2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pinCode: { type: String, default: '' },
      country: { type: String, default: 'India' },
      currency: { type: String, default: 'INR' },
      timeZone: { type: String, default: 'Asia/Kolkata' },
      allowGuestCheckout: { type: Boolean, default: true },
      autoUpdateStock: { type: Boolean, default: true },
      productReviews: { type: Boolean, default: true },
      orderNotifications: { type: Boolean, default: true },
    },
    shipping: {
      enableShipping: { type: Boolean, default: true },
      freeShipping: { type: Boolean, default: true },
      flatRateShipping: { type: Boolean, default: false },
      shippingCharge: { type: Number, default: 40 },
      freeShippingThreshold: { type: Number, default: 999 },
      processingTime: { type: String, default: '1 Business Day' },
      showEstimatedDelivery: { type: Boolean, default: true },
      allowDifferentShippingAddress: { type: Boolean, default: true },
      methods: { type: [shippingMethodSchema], default: [] },
    },
    tax: {
      enableGst: { type: Boolean, default: true },
      gstin: { type: String, default: '' },
      pricingMode: { type: String, enum: ['inclusive', 'exclusive'], default: 'inclusive' },
      defaultTaxRate: { type: Number, default: 18 },
      businessType: { type: String, default: 'GST Registered Business' },
      legalBusinessName: { type: String, default: '' },
      placeOfSupplyState: { type: String, default: 'Rajasthan' },
      stateCode: { type: String, default: '08' },
      rates: { type: [taxRateSchema], default: [] },
    },
    notifications: {
      emailEnabled: { type: Boolean, default: true },
      smsEnabled: { type: Boolean, default: false },
      inAppEnabled: { type: Boolean, default: true },
      emailEvents: {
        newOrder: { type: Boolean, default: true },
        orderConfirmed: { type: Boolean, default: true },
        orderShipped: { type: Boolean, default: true },
        orderDelivered: { type: Boolean, default: true },
        orderCancelled: { type: Boolean, default: true },
        newUser: { type: Boolean, default: true },
        passwordReset: { type: Boolean, default: true },
      },
      adminEvents: {
        lowStock: { type: Boolean, default: true },
        outOfStock: { type: Boolean, default: true },
        newOrder: { type: Boolean, default: true },
        paymentFailed: { type: Boolean, default: true },
      },
    },
    integrations: {
      smtp: {
        enabled: { type: Boolean, default: false },
        host: { type: String, default: '' },
        port: { type: Number, default: 587 },
        username: { type: String, default: '' },
        password: { type: String, default: '' },
        encryption: { type: String, enum: ['TLS', 'SSL', 'None'], default: 'TLS' },
        fromEmail: { type: String, default: '' },
        fromName: { type: String, default: 'ShopAdmin' },
      },
      razorpay: {
        enabled: { type: Boolean, default: false },
        keyId: { type: String, default: '' },
        keySecret: { type: String, default: '' },
        environment: { type: String, enum: ['Test', 'Live'], default: 'Test' },
      },
      sms: {
        enabled: { type: Boolean, default: false },
        provider: { type: String, default: 'Twilio' },
        apiKey: { type: String, default: '' },
        senderId: { type: String, default: '' },
        apiSecret: { type: String, default: '' },
      },
      googleDrive: {
        connected: { type: Boolean, default: false },
        email: { type: String, default: '' },
        displayName: { type: String, default: '' },
        photoURL: { type: String, default: '' },
        rootFolder: {
          id: { type: String, default: '' },
          name: { type: String, default: 'ecom_store' },
          webViewLink: { type: String, default: '' },
        },
        folders: {
          type: [
            new mongoose.Schema(
              {
                id: { type: String, default: '' },
                name: { type: String, default: '' },
                path: { type: String, default: '' },
                webViewLink: { type: String, default: '' },
                fileCount: { type: Number, default: 0 },
              },
              { _id: false }
            ),
          ],
          default: [],
        },
        lastSyncedAt: { type: Date, default: null },
      },
    },
  },
  { timestamps: true }
);

const otpVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    otpCode: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const customerSessionSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const adminSessionSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', required: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    discountType: { type: String, enum: ['percent', 'flat'], default: 'percent' },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
export const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', adminUserSchema);
export const StoreSettings =
  mongoose.models.StoreSettings || mongoose.model('StoreSettings', storeSettingsSchema);
export const OtpVerification =
  mongoose.models.OtpVerification || mongoose.model('OtpVerification', otpVerificationSchema);
export const CustomerSession =
  mongoose.models.CustomerSession || mongoose.model('CustomerSession', customerSessionSchema);
export const AdminSession =
  mongoose.models.AdminSession || mongoose.model('AdminSession', adminSessionSchema);
export const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
