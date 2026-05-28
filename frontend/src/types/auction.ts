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
