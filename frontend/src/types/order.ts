export type OrderStatus = 'pending_confirm' | 'pending_payment' | 'paid' | 'cancelled';

export interface OrderActions {
  can_confirm: boolean;
  can_pay: boolean;
  can_cancel: boolean;
}

export interface OrderListItem {
  id: number;
  auction_id: number;
  product_id: number;
  merchant_id: number;
  buyer_id: number;
  product_title: string;
  product_image_url?: string;
  buyer_name?: string;
  buyer_avatar_url?: string;
  amount: number;
  status: OrderStatus;
  cancel_reason?: string;
  confirm_deadline?: string;
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  paid_at?: string;
  cancelled_at?: string;
  actions: OrderActions;
}

export interface OrderDetail extends OrderListItem {
  product_description: string;
}

export interface OrderListResponse {
  items: OrderListItem[];
  total: number;
  page: number;
  size: number;
}
