export interface StoreConfig {
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
    productReviews: boolean;
  };
  shipping: {
    enableShipping: boolean;
    freeShipping: boolean;
    flatRateShipping: boolean;
    shippingCharge: number;
    freeShippingThreshold: number;
    processingTime: string;
    showEstimatedDelivery: boolean;
    methods: Array<{
      _id: string;
      name: string;
      description: string;
      deliveryTime: string;
      charge: number;
      status: string;
    }>;
  };
  tax: {
    enableGst: boolean;
    pricingMode: 'inclusive' | 'exclusive';
    defaultTaxRate: number;
  };
  razorpay: {
    enabled: boolean;
    keyId: string;
    environment: 'Test' | 'Live';
  };
}

export interface StoreCategory {
  _id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  icon: string;
  productCount: number;
}

export interface ProductReview {
  _id?: string;
  userId?: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface StoreProduct {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  categoryId: string | null;
  categoryName: string;
  price: number;
  netPrice: number;
  discountPercent: number;
  stock: number;
  lowStockThreshold: number;
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
  status: 'Active' | 'Draft' | 'Inactive';
  description: string;
  images: string[];
  specifications: Array<{ key: string; value: string }>;
  reviews: ProductReview[];
  ratingAverage: number;
  reviewCount: number;
  salesCount: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  _id: string;
  label: string;
  addressType: 'Shipping' | 'Billing';
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface CartItem {
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
}

export interface CustomerUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  profileImage?: string;
  user_role: string;
  status: 'Active' | 'Blocked';
  addresses: CustomerAddress[];
  wishlist: string[];
  createdAt: string;
}

export interface CustomerOrder {
  _id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    fullName?: string;
    phone?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: Array<{
    productId: string;
    name: string;
    sku: string;
    image: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  discountAmount?: number;
  couponCode?: string;
  shippingCost: number;
  shippingMethodName?: string;
  estimatedDelivery?: string;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: 'Paid' | 'COD' | 'Razorpay';
  paymentStatus: 'Paid' | 'Pending' | 'Failed';
  razorpayPaymentId?: string;
  confirmationEmailSent?: boolean;
  status: 'Placed' | 'Confirmed' | 'Packed' | 'Shipped' | 'Delivered' | 'Cancelled';
  timeline: Array<{ status: string; note: string; timestamp: string }>;
  createdAt: string;
  updatedAt: string;
}
