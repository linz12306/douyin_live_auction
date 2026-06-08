// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrder } from '../../api/order';
import type { OrderDetail as OrderDetailType } from '../../types/order';
import OrderDetail from './OrderDetail';

vi.mock('../../api/order', () => ({
  getOrder: vi.fn(),
}));

const mockedGetOrder = vi.mocked(getOrder);

const detail: OrderDetailType = {
  id: 12,
  auction_id: 8,
  product_id: 5,
  merchant_id: 2,
  buyer_id: 7,
  product_title: '限量手袋',
  product_description: '手工编织',
  product_image_url: 'https://img.test/bag.jpg',
  buyer_name: '小林',
  buyer_avatar_url: '',
  amount: 960,
  status: 'paid',
  created_at: '2026-05-29T11:00:00.000Z',
  updated_at: '2026-05-29T11:10:00.000Z',
  paid_at: '2026-05-29T11:10:00.000Z',
  actions: { can_confirm: false, can_pay: false, can_cancel: false },
};

describe('Merchant OrderDetail', () => {
  beforeEach(() => {
    mockedGetOrder.mockReset();
    mockedGetOrder.mockResolvedValue(detail);
  });

  afterEach(() => cleanup());

  it('renders merchant order detail without buyer-only actions', async () => {
    render(
      <MemoryRouter initialEntries={['/merchant/orders/12']}>
        <Routes>
          <Route path="/merchant/orders/:id" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /订单详情|成交详情/ })).toBeInTheDocument();
    expect(screen.getByText('限量手袋')).toBeInTheDocument();
    expect(screen.getByText('买家')).toBeInTheDocument();
    expect(screen.getByText('小林')).toBeInTheDocument();
    expect(screen.getByText('已支付')).toBeInTheDocument();
    expect(screen.getByText('成交金额')).toBeInTheDocument();
    expect(screen.getByText('¥960.00')).toBeInTheDocument();
    expect(screen.getByText('创建时间')).toBeInTheDocument();
    expect(screen.getByText('确认时间')).toBeInTheDocument();
    expect(screen.getByText('支付时间')).toBeInTheDocument();
    expect(screen.getByText('取消时间')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /确认订单|模拟支付|取消订单/ })).not.toBeInTheDocument();
  });
});
