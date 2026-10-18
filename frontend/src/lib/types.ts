import type { publicStoreConfig } from '../../../backend/src/config.js';
export type StoreConfig = ReturnType<typeof publicStoreConfig>;
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'CUSTOMER';
  emailVerified: boolean;
  mfaEnabled: boolean;
}
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  sortOrder: number;
  _count?: { products: number };
}
export interface Inventory {
  id: string;
  onHand: number;
  allocated: number;
  version: number;
  variantId: string;
  variant: Variant & { product: Product };
  movements: {
    id: string;
    reason: string;
    deltaOnHand: number;
    deltaAllocated: number;
    createdAt: string;
  }[];
}
export interface Variant {
  id: string;
  sku: string;
  label: string;
  priceMinor: string;
  available: number;
  active: boolean;
  prices: { marketId: string; currency: string; amountMinor: string }[];
  inventory?: { onHand: number; allocated: number };
}
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  materials: string;
  dimensions: string;
  care: string;
  art: string;
  color: string;
  background: string;
  imageUrl: string;
  badge: string;
  status: string;
  featuredRank: number;
  version: number;
  categoryId: string;
  category: Category;
  variants: Variant[];
  rating: number | null;
  reviewCount: number;
  reviews: {
    id: string;
    rating: number;
    body: string;
    user: { name: string };
  }[];
}
export interface CartItem {
  id: string;
  variantId: string;
  quantity: number;
  name: string;
  slug: string;
  art: string;
  color: string;
  background: string;
  imageUrl: string;
  label: string;
  available: number;
  unitPriceMinor: string;
  purchasable: boolean;
}
export interface Cart {
  id: string;
  version: number;
  marketId: string;
  currency: string;
  items: CartItem[];
  subtotalMinor: string;
  couponCode: string | null;
}
export interface Address {
  id?: string;
  label?: string;
  recipient: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
}
export interface Totals {
  subtotalMinor: string;
  discountMinor: string;
  shippingMinor: string;
  taxMinor: string;
  totalMinor: string;
}
export interface Quote {
  id: string;
  currency: string;
  totals: Totals;
  expiresAt: string;
}
export interface OrderItem {
  id: string;
  name: string;
  sku: string;
  art: string;
  color: string;
  quantity: number;
  returnedQuantity: number;
  unitPriceMinor: string;
  lineTotalMinor: string;
}
export interface ReturnRequest {
  id: string;
  orderId: string;
  order?: Order;
  status: string;
  reason: string;
  resolution: string;
  items: { orderItemId: string; quantity: number }[];
}
export interface Order extends Totals {
  id: string;
  number: string;
  email: string;
  currency: string;
  status: string;
  fulfillment: string;
  paymentStatus: string;
  refundedMinor: string;
  createdAt: string;
  address: Address;
  items: OrderItem[];
  events: { id: string; type: string; message: string; createdAt: string }[];
  shipment?: {
    carrier: string;
    tracking: string;
    shippedAt: string;
    deliveredAt?: string;
  };
  returns?: ReturnRequest[];
  refunds?: {
    id: string;
    amountMinor: string;
    reference: string;
    createdAt: string;
  }[];
}
export interface Content {
  id: string;
  key: string;
  title: string;
  body: string;
  revision: number;
  published: boolean;
}
export interface Coupon {
  id: string;
  code: string;
  percent: number;
  minimumMinor: string;
  maxUses: number;
  used: number;
  currency: string;
  active: boolean;
  expiresAt: string | null;
}
export interface Dashboard {
  range: string;
  currency: string;
  metrics: Metrics;
  comparison: Metrics;
  series: ({ date: string } & Metrics)[];
  categories: Record<string, number>;
  today: Metrics;
  goalMinor: number;
  recent: Order[];
  computedAt: string;
}
export interface Metrics {
  revenue: number;
  orders: number;
  aov: number;
  customers: number;
}
export interface MediaAsset {
  id: string;
  name: string;
  url: string;
  size: number;
  createdAt: string;
}
