export type ProductStatus = 'draft' | 'pending' | 'active' | 'ended_sold' | 'ended_no_bid' | 'cancelled';
export type BidIncrementType = 'fixed' | 'percent';

export interface ProductImage {
  id: number;
  product_id: number;
  image_url: string;
  sort_order: number;
}

export interface ProductLiveMedia {
  product_id: number;
  type: 'image' | 'video';
  url: string;
  poster_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: number;
  merchant_id: number;
  auction_id?: number;
  title: string;
  description: string;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface Auction {
  id: number;
  product_id: number;
  start_price: number;
  bid_increment_type: BidIncrementType;
  bid_increment_value: number;
  ceiling_price: number | null;
  duration_seconds: number;
  auto_extend_seconds: number;
  max_extend_count: number;
  current_extend_count: number;
  status: string;
  current_price: number;
  highest_bidder_id: number | null;
  version: number;
  created_at: string;
}

export interface ProductDetail {
  product: Product;
  images: ProductImage[];
  auction: Auction | null;
  live_media?: ProductLiveMedia | null;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  size: number;
}

export interface PublishRequest {
  start_price: number;
  bid_increment_type: BidIncrementType;
  bid_increment_value: number;
  ceiling_price?: number | null;
  duration_seconds: number;
  auto_extend_seconds?: number;
  max_extend_count?: number;
}
