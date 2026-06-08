import type { OrderStatus } from '../../types/order';
import type { ProductStatus } from '../../types/product';

export type Tone = 'neutral' | 'inactive' | 'active' | 'pending' | 'danger' | 'info' | 'sold' | 'noBid';

export const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-[#384553] bg-[#182331] text-[#B2BECC]',
  inactive: 'border-[#4B5563]/35 bg-[#111827] text-[#9CA3AF]',
  active: 'border-[#21D19F]/40 bg-[#21D19F]/12 text-[#76F2CD]',
  pending: 'border-[#F4B740]/35 bg-[#F4B740]/10 text-[#FFD47A]',
  danger: 'border-[#F05268]/35 bg-[#F05268]/10 text-[#FF8A9A]',
  info: 'border-[#4BA3FF]/35 bg-[#4BA3FF]/10 text-[#9CCBFF]',
  sold: 'border-[#A3E635]/35 bg-[#A3E635]/10 text-[#D9F99D]',
  noBid: 'border-[#8B5CF6]/35 bg-[#8B5CF6]/10 text-[#C4B5FD]',
};

export const PRODUCT_STATUS_TEXT: Record<ProductStatus, string> = {
  draft: '草稿',
  pending: '待开拍',
  active: '竞拍中',
  ended_sold: '已成交',
  ended_no_bid: '流拍',
  cancelled: '已取消',
};

export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  pending_confirm: '待确认',
  pending_payment: '待支付',
  paid: '已支付',
  cancelled: '已取消',
};

export function productStatusTone(status: ProductStatus): Tone {
  if (status === 'active') return 'active';
  if (status === 'pending') return 'pending';
  if (status === 'ended_sold') return 'sold';
  if (status === 'cancelled') return 'danger';
  if (status === 'ended_no_bid') return 'noBid';
  return 'inactive';
}

export function orderStatusTone(status: OrderStatus): Tone {
  if (status === 'paid') return 'sold';
  if (status === 'pending_confirm') return 'pending';
  if (status === 'pending_payment') return 'info';
  return 'danger';
}
