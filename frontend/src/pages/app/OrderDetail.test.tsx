// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelOrder, confirmOrder, getOrder, payOrder } from '../../api/order';
import type { OrderDetail as OrderDetailType, OrderStatus } from '../../types/order';
import OrderDetail from './OrderDetail';

vi.mock('../../api/order', () => ({
  getOrder: vi.fn(),
  confirmOrder: vi.fn(),
  payOrder: vi.fn(),
  cancelOrder: vi.fn(),
}));

const mockedGetOrder = vi.mocked(getOrder);
const mockedConfirmOrder = vi.mocked(confirmOrder);
const mockedPayOrder = vi.mocked(payOrder);
const mockedCancelOrder = vi.mocked(cancelOrder);

function order(status: OrderStatus): OrderDetailType {
  return {
    id: 9,
    auction_id: 7,
    product_id: 3,
    merchant_id: 2,
    buyer_id: 4,
    product_title: '复古牛仔夹克',
    product_description: '做旧水洗款',
    product_image_url: 'https://img.test/jacket.jpg',
    amount: 220,
    status,
    confirm_deadline: status === 'pending_confirm' ? '2026-05-29T10:30:00.000Z' : undefined,
    created_at: '2026-05-29T10:00:00.000Z',
    updated_at: '2026-05-29T10:00:00.000Z',
    actions: {
      can_confirm: status === 'pending_confirm',
      can_pay: status === 'pending_payment',
      can_cancel: status === 'pending_confirm',
    },
  };
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/app/orders/9']}>
      <Routes>
        <Route path="/app/orders/:id" element={<OrderDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('App OrderDetail', () => {
  beforeEach(() => {
    mockedGetOrder.mockReset();
    mockedConfirmOrder.mockReset();
    mockedPayOrder.mockReset();
    mockedCancelOrder.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows confirm and cancel for pending_confirm orders', async () => {
    mockedGetOrder.mockResolvedValue(order('pending_confirm'));
    let resolveConfirm: () => void = () => {};
    mockedConfirmOrder.mockImplementation(() => new Promise((resolve) => {
      resolveConfirm = () => resolve(order('pending_payment'));
    }));

    renderDetail();

    expect(await screen.findByRole('heading', { name: '复古牛仔夹克' })).toBeInTheDocument();
    expect(screen.getByText('待确认')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认中标订单' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '申请取消订单' })).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: '确认中标订单' });
    fireEvent.click(confirmButton);
    await waitFor(() => expect(confirmButton).toHaveTextContent('处理中...'));
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);

    await waitFor(() => expect(mockedConfirmOrder).toHaveBeenCalledTimes(1));
    expect(mockedConfirmOrder).toHaveBeenCalledWith(9);

    await act(async () => {
      resolveConfirm();
    });
    expect(await screen.findByText('待支付')).toBeInTheDocument();
  });

  it('shows pay for pending_payment orders', async () => {
    mockedGetOrder.mockResolvedValue(order('pending_payment'));
    mockedPayOrder.mockResolvedValue(order('paid'));

    renderDetail();

    expect(await screen.findByText('待支付')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '立即模拟支付' }));

    await waitFor(() => expect(mockedPayOrder).toHaveBeenCalledWith(9));
  });

  it('hides mutation actions for paid and cancelled orders', async () => {
    mockedGetOrder.mockResolvedValue(order('paid'));

    renderDetail();

    expect(await screen.findByText('已支付')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '确认中标订单' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '立即模拟支付' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '申请取消订单' })).not.toBeInTheDocument();
  });
});
