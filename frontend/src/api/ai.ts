import client from './client';
import type { AuctionAIReport, ProductCopyRequest, ProductCopyResponse } from '../types/ai';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function envelopeData(value: unknown): unknown {
  return isRecord(value) ? value.data : undefined;
}

export async function generateProductCopy(request: ProductCopyRequest): Promise<ProductCopyResponse> {
  const { data } = await client.post('/merchant/ai/product-copy', request);
  return envelopeData(data) as ProductCopyResponse;
}

export async function getAuctionAIReport(auctionId: number): Promise<AuctionAIReport> {
  const { data } = await client.get(`/merchant/ai/auctions/${auctionId}/report`);
  return envelopeData(data) as AuctionAIReport;
}

export async function generateAuctionAIReport(auctionId: number): Promise<AuctionAIReport> {
  const { data } = await client.post(`/merchant/ai/auctions/${auctionId}/report`);
  return envelopeData(data) as AuctionAIReport;
}
