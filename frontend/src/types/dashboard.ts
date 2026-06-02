import type { OrderStatus } from './order';
import type { ProductStatus } from './product';

export interface DashboardStatusCount<TStatus extends string = string> {
  status: TStatus;
  count: number;
}

export interface DashboardTransactionSummary {
  total_paid_amount: number;
  paid_order_count: number;
  average_paid_price: number;
}

export interface DashboardActiveAuction {
  auction_id: number;
  product_id: number;
  product_title: string;
  current_price: number;
  highest_bidder_id?: number;
  bid_count: number;
  started_at?: string;
  ended_at?: string;
}

export interface DashboardRecentOrder {
  id: number;
  auction_id: number;
  product_id: number;
  product_title: string;
  product_image_url?: string;
  buyer_id: number;
  buyer_name: string;
  buyer_avatar_url: string;
  amount: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  paid_at?: string;
  cancelled_at?: string;
}

export interface DashboardTransactionTrendPoint {
  date: string;
  paid_amount: number;
  paid_order_count: number;
}

export interface DashboardBidDistributionBucket {
  bucket: string;
  min_amount: number;
  max_amount?: number;
  bid_count: number;
}

export interface DashboardUserActivityPoint {
  date: string;
  active_user_count: number;
  bid_count: number;
}

export interface DashboardAnalytics {
  transaction_trend: DashboardTransactionTrendPoint[];
  bid_distribution: DashboardBidDistributionBucket[];
  user_activity: DashboardUserActivityPoint[];
}

export interface MerchantDashboard {
  product_status_counts: DashboardStatusCount<ProductStatus>[];
  order_status_counts: DashboardStatusCount<OrderStatus>[];
  transaction_summary: DashboardTransactionSummary;
  active_auctions: DashboardActiveAuction[];
  recent_orders: DashboardRecentOrder[];
  analytics?: DashboardAnalytics;
}
