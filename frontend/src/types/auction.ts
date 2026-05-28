export type AuctionStatus = 'pending' | 'active' | 'ended_sold' | 'ended_no_bid' | 'cancelled';

export interface AuctionLobbyItem {
  product_id: number;
  auction_id: number;
  title: string;
  image_url?: string;
  status: AuctionStatus;
  current_price: number;
  ended_at?: string;
}

export type RealtimeMessageType = 'snapshot' | 'price_update' | 'extended' | 'auction_end' | 'outbid';

export interface RealtimeEnvelope<T = unknown> {
  type: RealtimeMessageType;
  auction_id: number;
  version: number;
  server_time: string;
  payload: T;
}

export interface ProductSummary {
  id: number;
  title: string;
  description: string;
  image_urls: string[];
}

export interface RankingItem {
  rank: number;
  user_id: number;
  display_name: string;
  avatar_url: string;
  amount: number;
  status: string;
  bid_time: string;
}

export interface SnapshotPayload {
  product: ProductSummary;
  status: AuctionStatus;
  current_price: number;
  highest_bidder_id: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  current_extend_count: number;
  bid_increment_type: string;
  bid_increment_value: number;
  next_bid_amount: number;
  rankings: RankingItem[] | null;
}

export interface PriceUpdatePayload {
  current_price: number;
  highest_bidder_id: number;
  rankings: RankingItem[] | null;
}

export interface ExtendedPayload {
  ended_at: string;
  current_extend_count: number;
}

export interface AuctionEndPayload {
  status: AuctionStatus;
  winner_id?: number | null;
  final_price: number;
  cancel_reason?: string;
  terminal_message: string;
}

export interface OutbidPayload {
  previous_amount: number;
  new_amount: number;
  new_bidder_id: number;
}
