export type NavSection =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'categories'
  | 'users'
  | 'inventory'
  | 'settings'
  | 'email-templates';

export type SettingsTab =
  | 'general'
  | 'shipping'
  | 'tax'
  | 'notifications'
  | 'permissions'
  | 'integrations'
  | 'security'
  | 'backup';

export type OrderStatus =
  | 'Placed'
  | 'Confirmed'
  | 'Packed'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export interface CategoryDoc {
  _id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  icon: string;
  status: 'Active' | 'Inactive';
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDoc {
  _id: string;
  name: string;
  sku: string;
  categoryId?: string | null;
  categoryName: string;
  price: number;
  discountPercent: number;
  stock: number;
  lowStockThreshold: number;
  status: 'Active' | 'Draft' | 'Inactive';
  description: string;
  images: string[];
  stockStatus?: 'In Stock' | 'Low Stock' | 'Out of Stock';
  stockValue?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserAddress {
  _id: string;
  label: string;
  addressType: 'Shipping' | 'Billing';
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface UserCartItem {
  productId: string;
  name: string;
  sku: string;
  category: string;
  image: string;
  price: number;
  quantity: number;
}

export interface UserActivity {
  _id: string;
  type: 'login' | 'logout' | 'cart' | 'order' | 'profile' | 'address';
  title: string;
  description: string;
  badge?: string;
  createdAt: string;
}

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'customer';

export type DriveImageFolder =
  | 'profile_image'
  | 'category_image'
  | 'product_image'
  | 'store_logo'
  | 'other_images';

export interface UserDoc {
  _id: string;
  name: string;
  email: string;
  phone: string;
  profileImage?: string;
  user_role: UserRole;
  status: 'Active' | 'Blocked';
  lastLogin?: string | null;
  addresses: UserAddress[];
  cart: UserCartItem[];
  activities: UserActivity[];
  ordersCount?: number;
  totalSpent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId?: string | null;
  name: string;
  sku: string;
  image: string;
  price: number;
  quantity: number;
}

export interface OrderTimelineEntry {
  status: string;
  note: string;
  timestamp: string;
}

export interface OrderDoc {
  _id: string;
  orderNumber: string;
  userId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: 'Paid' | 'COD' | 'Razorpay';
  paymentStatus: 'Paid' | 'Pending' | 'Failed';
  status: OrderStatus;
  timeline: OrderTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionFlags {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface AdminUserDoc {
  _id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Manager';
  user_role?: 'super_admin' | 'admin' | 'manager';
  status: 'Active' | 'Inactive';
  lastLogin: string;
  permissions: {
    dashboard: PermissionFlags;
    orders: PermissionFlags;
    products: PermissionFlags;
    categories: PermissionFlags;
    users: PermissionFlags;
    inventory: PermissionFlags;
    settings: PermissionFlags;
  };
  createdAt: string;
}

export interface ShippingMethod {
  _id?: string;
  name: string;
  description: string;
  deliveryTime: string;
  charge: number;
  status: 'Active' | 'Inactive';
}

export interface TaxRate {
  _id?: string;
  name: string;
  taxType: 'GST' | 'CGST' | 'SGST' | 'IGST' | 'VAT';
  rate: number;
  description: string;
  region: string;
  status: 'Active' | 'Inactive';
}

export interface StoreSettingsDoc {
  general: {
    storeName: string;
    storeSlug: string;
    storeDescription: string;
    storeLogo: string;
    storeEmail: string;
    storePhone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    pinCode: string;
    country: string;
    currency: string;
    timeZone: string;
    allowGuestCheckout: boolean;
    autoUpdateStock: boolean;
    productReviews: boolean;
    orderNotifications: boolean;
  };
  shipping: {
    enableShipping: boolean;
    freeShipping: boolean;
    flatRateShipping: boolean;
    shippingCharge: number;
    freeShippingThreshold: number;
    processingTime: string;
    showEstimatedDelivery: boolean;
    allowDifferentShippingAddress: boolean;
    methods: ShippingMethod[];
  };
  tax: {
    enableGst: boolean;
    gstin: string;
    pricingMode: 'inclusive' | 'exclusive';
    defaultTaxRate: number;
    businessType: string;
    legalBusinessName: string;
    placeOfSupplyState: string;
    stateCode: string;
    rates: TaxRate[];
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    inAppEnabled: boolean;
    emailEvents: {
      newOrder: boolean;
      orderConfirmed: boolean;
      orderShipped: boolean;
      orderDelivered: boolean;
      orderCancelled: boolean;
      newUser: boolean;
      passwordReset: boolean;
    };
    adminEvents: {
      lowStock: boolean;
      outOfStock: boolean;
      newOrder: boolean;
      paymentFailed: boolean;
    };
  };
  integrations: {
    smtp: {
      enabled: boolean;
      host: string;
      port: number;
      username: string;
      password: string;
      encryption: 'TLS' | 'SSL' | 'None';
      fromEmail: string;
      fromName: string;
    };
    razorpay: {
      enabled: boolean;
      keyId: string;
      keySecret: string;
      environment: 'Test' | 'Live';
    };
    sms: {
      enabled: boolean;
      provider: string;
      apiKey: string;
      senderId: string;
      apiSecret: string;
    };
    googleDrive?: {
      connected: boolean;
      email: string;
      displayName: string;
      photoURL: string;
      rootFolder?: {
        id: string;
        name: string;
        webViewLink: string;
      };
      folders?: Array<{
        id: string;
        name: string;
        path: string;
        webViewLink: string;
        fileCount: number;
      }>;
      lastSyncedAt?: string | null;
    };
  };
}
