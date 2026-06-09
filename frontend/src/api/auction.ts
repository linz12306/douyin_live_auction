import client from './client';
import type { AuctionLobbyItem, AuctionStatus } from '../types/auction';

const AUCTION_STATUSES: AuctionStatus[] = ['pending', 'active', 'ended_sold', 'ended_no_bid', 'cancelled'];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isAuctionStatus(status: unknown): status is AuctionStatus {
  return typeof status === 'string' && AUCTION_STATUSES.includes(status as AuctionStatus);
}

function normalizeLobbyItem(item: unknown): AuctionLobbyItem | null {
  if (!isRecord(item)) return null;

  const auction = isRecord(item.auction) ? item.auction : undefined;
  const auctionID = Number(item.auction_id ?? auction?.id);
  if (!Number.isFinite(auctionID) || auctionID <= 0) return null;

  const productID = Number(item.product_id ?? item.id ?? auction?.product_id);
  const currentPrice = Number(item.current_price ?? auction?.current_price ?? 0);
  const status = item.status ?? auction?.status;
  const endedAt = item.ended_at ?? auction?.ended_at;

  return {
    product_id: Number.isFinite(productID) ? productID : 0,
    auction_id: auctionID,
    title: typeof item.title === 'string' ? item.title : '未命名竞拍',
    image_url: typeof item.image_url === 'string' ? item.image_url : undefined,
    status: isAuctionStatus(status) ? status : 'active',
    current_price: Number.isFinite(currentPrice) ? currentPrice : 0,
    ended_at: typeof endedAt === 'string' ? endedAt : undefined,
  };
}

export async function listAuctionLobby(): Promise<AuctionLobbyItem[]> {
  const { data } = await client.get('/products', { params: { status: 'active', page: 1, size: 50 } });
  const envelope = isRecord(data) && isRecord(data.data) ? data.data : undefined;
  const items = Array.isArray(envelope?.items) ? envelope.items : [];
  return items.map(normalizeLobbyItem).filter((item: AuctionLobbyItem | null): item is AuctionLobbyItem => item !== null);
}

export async function placeBid(auctionId: number, amount: number): Promise<void> {
  await client.post(`/auctions/${auctionId}/bid`, { amount });
}

export interface BidCommand {
  command_id: string;
  auction_id: number;
  amount: number;
  status: 'queued' | 'processing' | 'accepted' | 'rejected' | 'failed';
  failure_reason?: string | null;
  bid_id?: number | null;
  order_id?: number | null;
  auction_version?: number | null;
  created_at: string;
  updated_at: string;
  processed_at?: string | null;
}

export async function enqueueBid(auctionId: number, amount: number, idempotencyKey?: string): Promise<BidCommand> {
  const { data } = await client.post(
    `/auctions/${auctionId}/bid/async`,
    { amount },
    idempotencyKey ? { headers: { 'X-Idempotency-Key': idempotencyKey } } : undefined,
  );
  return data.data as BidCommand;
}

export async function getBidCommand(auctionId: number, commandId: string): Promise<BidCommand> {
  const { data } = await client.get(`/auctions/${auctionId}/bid-commands/${commandId}`);
  return data.data as BidCommand;
}

export async function activateAuction(auctionId: number): Promise<void> {
  await client.post(`/auctions/${auctionId}/activate`);
}

export async function cancelAuction(auctionId: number, reason: string): Promise<void> {
  await client.delete(`/auctions/${auctionId}`, { data: { reason } });
}
