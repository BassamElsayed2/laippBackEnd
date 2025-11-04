import { Request } from 'express';

// =====================================================
// User & Auth Types
// =====================================================

export interface User {
  id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  role: 'user' | 'admin';
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export interface Profile {
  id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  street_address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface AuthRequest extends Request {
  user?: User;
  session?: Session;
}

// =====================================================
// Product Types
// =====================================================

export interface Product {
  id: string;
  title: string;
  name_ar?: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
  price: number;
  offer_price?: number;
  images?: string | string[]; // Can be JSON string or array
  category_id?: number;
  stock_quantity: number;
  is_best_seller: boolean;
  limited_time_offer: boolean;
  created_at: Date;
  updated_at: Date;
  attributes?: ProductAttribute[];
}

export interface ProductAttribute {
  id: number;
  product_id: string;
  attribute_name: string;
  attribute_value: string;
}

export interface Category {
  id: number;
  name_ar: string;
  name_en: string;
  image_url?: string;
  created_at: Date;
}

// =====================================================
// Order Types
// =====================================================

export interface Order {
  id: string;
  user_id?: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  total_price: number;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_street_address?: string;
  customer_city?: string;
  customer_state?: string;
  customer_postcode?: string;
  order_notes?: string;
  created_at: Date;
  updated_at: Date;
  order_items?: OrderItem[];
  payments?: Payment[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  created_at: Date;
  product?: Product;
}

export interface Payment {
  id: string;
  order_id: string;
  payment_method: 'easykash' | 'cod';
  payment_provider?: string;
  amount: number;
  payment_status: 'pending' | 'completed' | 'failed';
  transaction_id?: string;
  easykash_ref?: string;
  easykash_product_code?: string;
  voucher?: string;
  customer_reference?: string;
  created_at: Date;
  updated_at: Date;
}

// =====================================================
// Content Types
// =====================================================

export interface Banner {
  id: number;
  desc_ar?: string;
  desc_en?: string;
  image?: string;
  display_order: number;
  is_active: boolean;
  created_at: Date;
}

export interface Blog {
  id: string;
  title_ar?: string;
  title_en?: string;
  content_ar?: string;
  content_en?: string;
  image?: string;
  author?: string;
  status: 'draft' | 'published';
  created_at: Date;
  updated_at: Date;
}

export interface Testimonial {
  id: number;
  name_ar?: string;
  name_en?: string;
  message_ar?: string;
  message_en?: string;
  image?: string;
  created_at: Date;
}

export interface Branch {
  id: number;
  name_ar?: string;
  name_en?: string;
  address_ar?: string;
  address_en?: string;
  phone?: string;
  created_at: Date;
}

export interface News {
  id: number;
  title_ar?: string;
  title_en?: string;
  content_ar?: string;
  content_en?: string;
  image?: string;
  status: 'draft' | 'published';
  price_individual?: number;
  price_family?: number;
  created_at: Date;
  updated_at: Date;
}

// =====================================================
// Payment Gateway Types (Easykash)
// =====================================================

export interface EasykashPaymentRequest {
  amount: number;
  currency: string;
  paymentOptions: number[];
  cashExpiry?: number;
  name: string;
  email: string;
  mobile: string;
  redirectUrl: string;
  customerReference: string;
}

export interface EasykashCallback {
  ProductCode: string;
  PaymentMethod: string;
  ProductType: string;
  Amount: string;
  BuyerEmail: string;
  BuyerMobile: string;
  BuyerName: string;
  Timestamp: string;
  status: 'PAID' | 'PENDING' | 'FAILED';
  voucher?: string;
  easykashRef: string;
  VoucherData?: string;
  customerReference: string;
  signatureHash: string;
}

// =====================================================
// API Response Types
// =====================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}


