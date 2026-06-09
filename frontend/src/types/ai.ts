export interface ProductCopyRequest {
  title: string;
  description: string;
  start_price: number;
  bid_increment_type: string;
  bid_increment_value: number;
  ceiling_price: number | null;
  duration_seconds: number;
}

export interface ProductCopyDraft {
  title: string;
  description: string;
  selling_points: string[];
  live_script: string;
}

export interface ProductCopyResponse {
  record_id: number;
  model: string;
  draft: ProductCopyDraft;
}

export interface AuctionReportMetrics {
  auction_id: number;
  product_id: number;
  product_title: string;
  status: string;
  start_price: number;
  final_price: number;
  participant_count: number;
  bid_count: number;
  duration_seconds: number;
  last_30_second_bid_count: number;
  last_30_second_bid_share: number;
}

export interface AuctionAIReport {
  record_id: number;
  model: string;
  report: string;
  metrics: AuctionReportMetrics;
  created_at: string;
}
