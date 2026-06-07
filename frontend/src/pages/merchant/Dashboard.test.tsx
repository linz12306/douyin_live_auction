// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantDashboard } from '../../api/dashboard';
import Dashboard from './Dashboard';

vi.mock('../../api/dashboard', () => ({
  getMerchantDashboard: vi.fn(),
}));

const mockedGetMerchantDashboard = vi.mocked(getMerchantDashboard);

describe('Merchant Dashboard', () => {
  beforeEach(() => {
    mockedGetMerchantDashboard.mockReset();
  });

  afterEach(() => cleanup());

  it('renders merchant operational metrics and scoped lists', async () => {
    mockedGetMerchantDashboard.mockResolvedValue({
      product_status_counts: [
        { status: 'draft', count: 1 },
        { status: 'pending', count: 0 },
        { status: 'active', count: 2 },
        { status: 'ended_sold', count: 3 },
        { status: 'ended_no_bid', count: 0 },
        { status: 'cancelled', count: 0 },
      ],
      order_status_counts: [
        { status: 'pending_confirm', count: 1 },
        { status: 'pending_payment', count: 0 },
        { status: 'paid', count: 2 },
        { status: 'cancelled', count: 0 },
      ],
      transaction_summary: {
        total_paid_amount: 860,
        paid_order_count: 2,
        average_paid_price: 430,
      },
      active_auctions: [
        {
          auction_id: 8,
          product_id: 12,
          product_title: '复古夹克',
          current_price: 320,
          highest_bidder_id: 7,
          bid_count: 5,
          started_at: '2026-05-30T10:00:00.000Z',
          ended_at: '2026-05-30T10:05:00.000Z',
        },
      ],
      recent_orders: [
        {
          id: 9,
          auction_id: 8,
          product_id: 12,
          product_title: '复古夹克',
          buyer_id: 7,
          buyer_name: '小林',
          buyer_avatar_url: '',
          amount: 520,
          status: 'paid',
          created_at: '2026-05-30T10:06:00.000Z',
          updated_at: '2026-05-30T10:08:00.000Z',
          paid_at: '2026-05-30T10:08:00.000Z',
        },
      ],
      analytics: {
        transaction_trend: [
          { date: '2026-05-24', paid_amount: 0, paid_order_count: 0 },
          { date: '2026-05-25', paid_amount: 0, paid_order_count: 0 },
          { date: '2026-05-26', paid_amount: 0, paid_order_count: 0 },
          { date: '2026-05-27', paid_amount: 220, paid_order_count: 1 },
          { date: '2026-05-28', paid_amount: 0, paid_order_count: 0 },
          { date: '2026-05-29', paid_amount: 640, paid_order_count: 1 },
          { date: '2026-05-30', paid_amount: 0, paid_order_count: 0 },
        ],
        bid_distribution: [
          { bucket: '0-99', min_amount: 0, max_amount: 99, bid_count: 0 },
          { bucket: '100-499', min_amount: 100, max_amount: 499, bid_count: 5 },
          { bucket: '500-999', min_amount: 500, max_amount: 999, bid_count: 2 },
          { bucket: '1000-4999', min_amount: 1000, max_amount: 4999, bid_count: 0 },
          { bucket: '5000+', min_amount: 5000, bid_count: 0 },
        ],
        user_activity: [
          { date: '2026-05-24', active_user_count: 0, bid_count: 0 },
          { date: '2026-05-25', active_user_count: 0, bid_count: 0 },
          { date: '2026-05-26', active_user_count: 1, bid_count: 2 },
          { date: '2026-05-27', active_user_count: 0, bid_count: 0 },
          { date: '2026-05-28', active_user_count: 2, bid_count: 4 },
          { date: '2026-05-29', active_user_count: 0, bid_count: 0 },
          { date: '2026-05-30', active_user_count: 0, bid_count: 0 },
        ],
      },
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '运营看板' })).toBeInTheDocument();
    expect(await screen.findByText('¥860.00')).toBeInTheDocument();
    expect(screen.getByText('成交订单')).toBeInTheDocument();
    expect(screen.getByText('¥430.00')).toBeInTheDocument();
    expect(screen.getAllByText('复古夹克')).toHaveLength(2);
    expect(screen.getByText('5 次出价')).toBeInTheDocument();
    expect(screen.getByText('买家：小林')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '成交趋势' })).toBeInTheDocument();
    expect(screen.getByText(/峰值 ¥640.00/)).toBeInTheDocument();
    expect(screen.getByText(/合计 ¥860.00/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '出价分布区间' })).toBeInTheDocument();
    expect(screen.getByText('100-499')).toBeInTheDocument();
    expect(screen.getByText('5 次')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '买家用户活跃度' })).toBeInTheDocument();
    expect(screen.getByText(/2 位活跃用户/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '商品管理' })).toHaveAttribute('href', '/merchant/products');
    expect(screen.getByRole('link', { name: '订单管理' })).toHaveAttribute('href', '/merchant/orders');
  });

  it('shows zero-data analytics states while keeping operations sections usable', async () => {
    mockedGetMerchantDashboard.mockResolvedValue({
      product_status_counts: [],
      order_status_counts: [],
      transaction_summary: {
        total_paid_amount: 0,
        paid_order_count: 0,
        average_paid_price: 0,
      },
      active_auctions: [],
      recent_orders: [],
      analytics: {
        transaction_trend: [
          { date: '2026-05-24', paid_amount: 0, paid_order_count: 0 },
          { date: '2026-05-25', paid_amount: 0, paid_order_count: 0 },
        ],
        bid_distribution: [
          { bucket: '0-99', min_amount: 0, max_amount: 99, bid_count: 0 },
        ],
        user_activity: [
          { date: '2026-05-24', active_user_count: 0, bid_count: 0 },
        ],
      },
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '运营看板' })).toBeInTheDocument();
    expect(screen.getByText('暂无成交趋势')).toBeInTheDocument();
    expect(screen.getByText('暂无出价分布')).toBeInTheDocument();
    expect(screen.getByText('暂无用户活跃数据')).toBeInTheDocument();
    expect(screen.getByText('暂无进行中竞拍')).toBeInTheDocument();
    expect(screen.getByText('暂无订单')).toBeInTheDocument();
  });

  it('shows an error state when the dashboard cannot load', async () => {
    mockedGetMerchantDashboard.mockRejectedValue(new Error('network'));

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('看板加载失败')).toBeInTheDocument();
  });
});
