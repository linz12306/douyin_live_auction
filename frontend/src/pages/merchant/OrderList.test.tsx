// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
          amount: 520,
          status: 'paid',
          created_at: '2026-05-29T11:00:00.000Z',
          updated_at: '2026-05-29T11:10:00.000Z',
          paid_at: '2026-05-29T11:10:00.000Z',
          actions: { can_confirm: false, can_pay: false, can_cancel: false },
        },
      ],
      total: 1,
      page: 1,
      size: 20,
    });
  });

  afterEach(() => cleanup());

  it('renders merchant orders with buyer and amount', async () => {
    render(
      <MemoryRouter>
        <OrderList />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '订单管理' })).toBeInTheDocument();
    expect(await screen.findByText('限量手袋')).toBeInTheDocument();
    expect(screen.getByText('买家：小林')).toBeInTheDocument();
    expect(screen.getByText('¥520.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看订单' })).toHaveAttribute('href', '/merchant/orders/12');
  });
});
