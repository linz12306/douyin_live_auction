// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelAuction } from '../../api/auction';
import { useAuthStore } from '../../store/authStore';
import { useLiveRoomStore, type LiveRoomState } from '../../store/liveRoomStore';
import AuctionMonitor from './AuctionMonitor';

vi.mock('../../api/auction', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/auction')>()),
  cancelAuction: vi.fn(),
}));

const mockedCancelAuction = vi.mocked(cancelAuction);

const merchantUser = {
  id: 1,
  username: 'merchant',
  role: 'merchant' as const,
  display_name: 'Merchant',
  avatar_url: '',
  balance: 0,
  frozen_amount: 0,
};

function seedMonitorRoom(overrides: Partial<LiveRoomState> = {}) {
  useLiveRoomStore.setState({
    auctionId: 7,
    product: {
      id: 22,
      title: '复古牛仔夹克',
      description: '做旧水洗款',
      image_urls: ['https://img.test/jacket.jpg'],
    },
    status: 'active',
    currentPrice: 140,
    highestBidderId: 4,
    startedAt: '2026-05-28T09:00:00.000Z',
    endedAt: '2026-05-28T10:10:00.000Z',
    currentExtendCount: 1,
    bidIncrementType: 'fixed',
    bidIncrementValue: 10,
    nextBidAmount: 150,
    rankings: [
      {
        rank: 1,
        user_id: 4,
        display_name: '阿辰',
        avatar_url: '',
        amount: 140,
        status: 'winning',
        bid_time: '2026-05-28T10:00:01.000Z',
      },
    ],
    winnerId: undefined,
    finalPrice: undefined,
    terminalMessage: undefined,
    submitState: 'idle',
    version: 5,
    notifications: [{ id: 'n1', type: 'status', message: '阿辰 出价 ¥140.00' }],
    connectionState: 'open',
    reconnectAttempt: 0,
    serverTimeOffsetMs: 0,
    error: undefined,
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...overrides,
  } as Partial<LiveRoomState>);
}

function renderMonitor(path = '/merchant/auctions/7/monitor') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/merchant/auctions/:id/monitor" element={<AuctionMonitor />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuctionMonitor', () => {
  beforeEach(() => {
    mockedCancelAuction.mockReset();
    mockedCancelAuction.mockResolvedValue(undefined);
    localStorage.setItem('refresh_token', 'refresh-token');
    useAuthStore.setState({
      user: merchantUser,
      accessToken: 'access-token',
      isAuthenticated: true,
      isHydrating: false,
    });
    seedMonitorRoom();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders console monitor hierarchy while preserving realtime auction state', async () => {
    renderMonitor();

    expect(await screen.findByRole('heading', { name: /实时竞拍监控/ })).toBeInTheDocument();
    expect(screen.getByText('复古牛仔夹克')).toBeInTheDocument();
    expect(screen.getAllByText('¥140.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/出价排行榜|排行榜/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/事件流|实时监控日志/).length).toBeGreaterThan(0);
    expect(screen.getByText('阿辰')).toBeInTheDocument();
    expect(screen.getAllByText('阿辰 出价 ¥140.00').length).toBeGreaterThan(0);
    expect(screen.getByText(/30 秒/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /出价/ })).not.toBeInTheDocument();
  });

  it('cancels a merchant auction with a reason and refreshes the realtime room', async () => {
    renderMonitor();
    const connect = vi.mocked(useLiveRoomStore.getState().connect);

    await waitFor(() => expect(connect).toHaveBeenCalledWith(7, 'access-token'));
    connect.mockClear();

    fireEvent.click(screen.getByRole('button', { name: '取消竞拍' }));
    fireEvent.change(screen.getByLabelText('取消原因'), { target: { value: '库存异常' } });
    fireEvent.click(screen.getByRole('button', { name: '确认取消' }));

    await waitFor(() => expect(mockedCancelAuction).toHaveBeenCalledWith(7, '库存异常'));
    await waitFor(() => expect(connect).toHaveBeenCalledWith(7, 'access-token'));
  });

  it('shows terminal auction state without cancellation controls', () => {
    seedMonitorRoom({
      status: 'ended_sold',
      finalPrice: 140,
      winnerId: 4,
      terminalMessage: '竞拍已成交',
    });

    renderMonitor();

    expect(screen.getByText('竞拍已成交')).toBeInTheDocument();
    expect(screen.getByText(/成交价 ¥140.00/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消竞拍' })).not.toBeInTheDocument();
  });
});
