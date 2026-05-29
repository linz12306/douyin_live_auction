import client from './client';
import type { OrderDetail, OrderListResponse } from '../types/order';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function envelopeData(value: unknown): unknown {
  return isRecord(value) ? value.data : undefined;
}

export async function listOrders(status?: string): Promise<OrderListResponse> {
  const { data } = await client.get('/orders', {
    params: { status, page: 1, size: 50 },
  });
  const payload = envelopeData(data);
  if (!isRecord(payload)) return { items: [], total: 0, page: 1, size: 50 };
  return {
    items: Array.isArray(payload.items) ? (payload.items as OrderListResponse['items']) : [],
    total: Number(payload.total ?? 0),
    page: Number(payload.page ?? 1),
    size: Number(payload.size ?? 50),
  };
}

export async function getOrder(orderId: number): Promise<OrderDetail> {
  const { data } = await client.get(`/orders/${orderId}`);
  return envelopeData(data) as OrderDetail;
}

export async function confirmOrder(orderId: number): Promise<OrderDetail> {
  const { data } = await client.post(`/orders/${orderId}/confirm`);
  return envelopeData(data) as OrderDetail;
}

export async function payOrder(orderId: number): Promise<OrderDetail> {
  const { data } = await client.post(`/orders/${orderId}/pay`);
  return envelopeData(data) as OrderDetail;
}

export async function cancelOrder(orderId: number, reason = 'buyer_cancelled'): Promise<OrderDetail> {
  const { data } = await client.post(`/orders/${orderId}/cancel`, { reason });
  return envelopeData(data) as OrderDetail;
}
