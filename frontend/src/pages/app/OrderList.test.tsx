// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listOrders } from '../../api/order';
import OrderList from './OrderList';

vi.mock('../../api/order', () => ({
  listOrders: vi.fn(),
}));

const mockedListOrders = vi.mocked(listOrders);

describe('App OrderList', () => {
  beforeEach(() => {
    mockedListOrders.mockReset();
    mockedListOrders.mockResolvedValue({
      items: [
        {
          id: 9,
          auction_id: 7,
          product_id: 3,
          merchant_id: 2,
          buyer_id: 4,
          product_title: '复古牛仔夹克',
          product_image_url: 'https://img.test/jacket.jpg',
          amount: 220,
          status: 'pending_confirm',
          confirm_deadline: '2026-05-29T10:30:00.000Z',
          created_at: '2026-05-29T10:00:00.000Z',
          updated_at: '2026-05-29T10:00:00.000Z',
          actions: { can_confirm: true, can_pay: false, can_cancel: true },
        },
      ],
      total: 1,
      page: 1,
      size: 20,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders buyer order states and links to detail', async () => {
    render(
      <MemoryRouter>
        <OrderList />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '我的订单' })).toBeInTheDocument();
    expect(await screen.findByText('复古牛仔夹克')).toBeInTheDocument();
    expect(screen.getByText('待确认')).toBeInTheDocument();
    expect(screen.getByText('¥220.00')).toBeInTheDocument();
    await waitFor(() => expect(mockedListOrders).toHaveBeenCalledWith());
    expect(screen.getByRole('link', { name: '查看详情' })).toHaveAttribute('href', '/app/orders/9');
  });
});
