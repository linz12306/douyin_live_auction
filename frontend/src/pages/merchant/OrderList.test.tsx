// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listOrders } from '../../api/order';
import OrderList from './OrderList';

vi.mock('../../api/order', () => ({
  listOrders: vi.fn(),
}));

const mockedListOrders = vi.mocked(listOrders);

describe('Merchant OrderList', () => {
  beforeEach(() => {
    mockedListOrders.mockReset();
    mockedListOrders.mockResolvedValue({
      items: [
        {
          id: 12,
          auction_id: 8,
          product_id: 5,
          merchant_id: 2,
          buyer_id: 7,
          product_title: '限量手袋',
          product_image_url: 'https://img.test/bag.jpg',
          buyer_name: '小林',
          buyer_avatar_url: '',
          amount: 960,
          status: 'paid',
          created_at: '2026-05-29T11:00:00.000Z',
          updated_at: '2026-05-29T11:10:00.000Z',
          paid_at: '2026-05-29T11:10:00.000Z',
          actions: { can_confirm: false, can_pay: false, can_cancel: false },
        },
        {
          id: 13,
          auction_id: 9,
          product_id: 6,
          merchant_id: 2,
          buyer_id: 8,
          product_title: '复古相机',
          product_image_url: '',
          buyer_name: '阿杰',
          buyer_avatar_url: '',
          amount: 430,
          status: 'cancelled',
          cancel_reason: '买家超时',
          created_at: '2026-05-30T09:00:00.000Z',
          updated_at: '2026-05-30T09:30:00.000Z',
          cancelled_at: '2026-05-30T09:30:00.000Z',
          actions: { can_confirm: false, can_pay: false, can_cancel: false },
        },
      ],
      total: 2,
      page: 1,
      size: 20,
    });
  });

  afterEach(() => cleanup());

  it('renders merchant orders as deal-flow rows with buyer, amount, status, timestamps, and detail navigation', async () => {
    render(
      <MemoryRouter>
        <OrderList />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /成交订单|订单管理/ })).toBeInTheDocument();
    expect(await screen.findByText('限量手袋')).toBeInTheDocument();

    const paidRow = screen.getByRole('article', { name: '订单 12' });
    expect(within(paidRow).getByText('买家')).toBeInTheDocument();
    expect(within(paidRow).getByText('小林')).toBeInTheDocument();
    expect(within(paidRow).getByText('¥960.00')).toBeInTheDocument();
    expect(within(paidRow).getByText('已支付')).toBeInTheDocument();
    expect(within(paidRow).getByText('创建时间')).toBeInTheDocument();
    expect(within(paidRow).getByText('支付时间')).toBeInTheDocument();
    expect(within(paidRow).getByRole('link', { name: '查看订单 12 详情' })).toHaveAttribute('href', '/merchant/orders/12');

    const cancelledRow = screen.getByRole('article', { name: '订单 13' });
    expect(within(cancelledRow).getByText('复古相机')).toBeInTheDocument();
    expect(within(cancelledRow).getByText('已取消')).toBeInTheDocument();
    expect(within(cancelledRow).getByText('取消时间')).toBeInTheDocument();
    expect(within(cancelledRow).getByRole('link', { name: '查看订单 13 详情' })).toHaveAttribute('href', '/merchant/orders/13');
  });
});
