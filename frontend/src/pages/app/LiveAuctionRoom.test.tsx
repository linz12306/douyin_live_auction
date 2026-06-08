// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { placeBid } from '../../api/auction';
import { getMe } from '../../api/user';
import { ProtectedRoute } from '../../App';
import { useAuthStore } from '../../store/authStore';
import { useLiveRoomStore, type LiveRoomState } from '../../store/liveRoomStore';
import LiveAuctionRoom from './LiveAuctionRoom';

vi.mock('../../api/auction', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/auction')>()),
  placeBid: vi.fn(),
}));

vi.mock('../../api/user', () => ({
  getMe: vi.fn(),
}));

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }
}

const mockedPlaceBid = vi.mocked(placeBid);
const mockedGetMe = vi.mocked(getMe);

const buyerUser = {
  id: 2,
  username: 'buyer',
  role: 'user' as const,
  display_name: 'Buyer',
  avatar_url: '',
  balance: 1000,
  frozen_amount: 0,
};

function seedRoom(overrides: Partial<LiveRoomState> = {}) {
  useLiveRoomStore.setState({
    auctionId: 7,
    product: {
      id: 22,
      title: '复古牛仔夹克',
      description: '做旧水洗款',
      image_urls: ['https://img.test/jacket.jpg'],
    },
    status: 'active',
    currentPrice: 120,
    highestBidderId: 3,
    startedAt: '2026-05-28T09:00:00.000Z',
    endedAt: '2026-05-28T10:10:00.000Z',
    currentExtendCount: 0,
    bidIncrementType: 'fixed',
    bidIncrementValue: 10,
    nextBidAmount: 130,
    rankings: [
      {
        rank: 1,
        user_id: 3,
        display_name: '小林',
        avatar_url: '',
        amount: 120,
        status: 'winning',
        bid_time: '2026-05-28T10:00:00.000Z',
      },
    ],
    winnerId: undefined,
    finalPrice: undefined,
    terminalMessage: undefined,
    submitState: 'idle',
    version: 4,
    notifications: [{ id: 'n1', type: 'outbid', message: '您已被超过，当前最高出价为 120' }],
    connectionState: 'open',
    reconnectAttempt: 0,
    serverTimeOffsetMs: 0,
    error: undefined,
    ...overrides,
  } as Partial<LiveRoomState>);
}

function renderRoom(initialPath = '/app/auctions/7') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/app/auctions/:id" element={<LiveAuctionRoom />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LiveAuctionRoom', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    FakeWebSocket.instances = [];
    mockedPlaceBid.mockReset();
    mockedPlaceBid.mockResolvedValue(undefined);
    mockedGetMe.mockReset();
    localStorage.setItem('refresh_token', 'refresh-token');
    useAuthStore.setState({
      user: buyerUser,
      accessToken: 'access-token',
      isAuthenticated: true,
      isHydrating: false,
    });
    seedRoom();
  });

  afterEach(() => {
    cleanup();
    useLiveRoomStore.getState().disconnect();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders the live room state and connects with the hydrated token', () => {
    renderRoom();

    expect(screen.getByRole('heading', { name: '复古牛仔夹克' })).toBeInTheDocument();
    expect(screen.getByText('拍场主理人')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开出价面板' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '打开商品橱窗' })).toBeInTheDocument();
    expect(screen.getAllByText('¥120.00').length).toBeGreaterThan(0);
    expect(screen.getByText('小林')).toBeInTheDocument();
    expect(screen.getByText('您已被超过，当前最高出价为 120')).toBeInTheDocument();
    expect(new URL(FakeWebSocket.instances[0].url).searchParams.get('token')).toBe('access-token');
  });

  it('renders merchant-uploaded live video as the room stage background', () => {
    seedRoom({
      product: {
        id: 22,
        title: '复古牛仔夹克',
        description: '做旧水洗款',
        image_urls: ['https://img.test/jacket.jpg'],
        live_media: {
          type: 'video',
          url: 'https://media.test/live-room.mp4',
          poster_url: 'https://media.test/live-room-poster.jpg',
        },
      },
    });

    renderRoom();

    const video = screen.getByTestId('live-room-media-video');
    expect(video).toHaveAttribute('src', 'https://media.test/live-room.mp4');
    expect(video).toHaveAttribute('poster', 'https://media.test/live-room-poster.jpg');
  });

  it('submits the next bid through REST without directly changing realtime price', async () => {
    renderRoom();

    fireEvent.click(screen.getByRole('button', { name: '打开出价面板' }));
    expect(screen.getByRole('dialog', { name: '竞拍出价' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '立即追回 ¥130.00' }));

    await waitFor(() => expect(mockedPlaceBid).toHaveBeenCalledWith(7, 130));
    expect(useLiveRoomStore.getState().currentPrice).toBe(120);
    expect(screen.getAllByText('¥120.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('价格已更新')).not.toBeInTheDocument();
  });

  it('updates current price and the next bid button from websocket price_update messages', async () => {
    seedRoom({ notifications: [] });
    renderRoom();

    act(() => {
      useLiveRoomStore.getState().applyMessage({
        type: 'price_update',
        auction_id: 7,
        version: 5,
        server_time: '2026-05-28T10:00:01.000Z',
        payload: {
          current_price: 140,
          highest_bidder_id: 4,
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
        },
      });
    });

    expect(screen.getAllByText('¥140.00').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '打开出价面板' }));
    expect(screen.getByRole('button', { name: '立即出价 ¥150.00' })).toBeEnabled();
  });

  it('marks the visible price as updated only after websocket price_update', () => {
    seedRoom({ notifications: [] });
    renderRoom();

    expect(screen.queryByText('价格已更新')).not.toBeInTheDocument();

    act(() => {
      useLiveRoomStore.getState().applyMessage({
        type: 'price_update',
        auction_id: 7,
        version: 5,
        server_time: '2026-05-28T10:00:01.000Z',
        payload: {
          current_price: 140,
          highest_bidder_id: 4,
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
        },
      });
    });

    expect(screen.getAllByText('¥140.00').length).toBeGreaterThan(0);
    expect(screen.getByText('价格已更新')).toBeInTheDocument();
  });

  it('keeps polished live room controls discoverable', () => {
    renderRoom();

    expect(screen.getByRole('button', { name: '打开出价面板' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '打开商品橱窗' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看我的订单' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '点赞' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '分享' })).toBeInTheDocument();
  });

  it('deduplicates leaderboard rows by bidder before rendering the top three', () => {
    seedRoom({
      rankings: [
        {
          rank: 1,
          user_id: 3,
          display_name: '小林',
          avatar_url: '',
          amount: 160,
          status: 'winning',
          bid_time: '2026-05-28T10:00:03.000Z',
        },
        {
          rank: 2,
          user_id: 4,
          display_name: '阿辰',
          avatar_url: '',
          amount: 150,
          status: 'outbid',
          bid_time: '2026-05-28T10:00:02.000Z',
        },
        {
          rank: 3,
          user_id: 3,
          display_name: '小林',
          avatar_url: '',
          amount: 140,
          status: 'outbid',
          bid_time: '2026-05-28T10:00:01.000Z',
        },
      ],
    });

    renderRoom();

    expect(screen.getAllByText('小林')).toHaveLength(1);
    expect(screen.getByText('阿辰')).toBeInTheDocument();
  });

  it('renders a scrollable live message feed with historical notifications', () => {
    seedRoom({
      notifications: Array.from({ length: 8 }, (_, index) => ({
        id: `history-${index}`,
        type: index === 0 ? 'outbid' : 'bid',
        message: `历史消息 ${index + 1}`,
      })),
    });

    renderRoom();

    const feed = screen.getByTestId('live-room-message-feed');
    expect(feed).toHaveClass('overflow-y-auto');
    expect(screen.getByText('历史消息 1')).toBeInTheDocument();
    expect(screen.getByText('历史消息 8')).toBeInTheDocument();
  });

  it('refreshes the room snapshot on demand after merchant-side updates', async () => {
    renderRoom();

    fireEvent.click(screen.getByRole('button', { name: '刷新直播状态' }));

    expect(FakeWebSocket.instances).toHaveLength(2);

    act(() => {
      FakeWebSocket.instances[1].onmessage?.(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'snapshot',
          auction_id: 7,
          version: 5,
          server_time: '2026-05-28T10:00:02.000Z',
          payload: {
            product: {
              id: 22,
              title: '更新后的复古牛仔夹克',
              description: '商家刚更新的介绍',
              image_urls: ['https://img.test/jacket-updated.jpg'],
            },
            status: 'active',
            current_price: 120,
            highest_bidder_id: 3,
            started_at: '2026-05-28T09:00:00.000Z',
            ended_at: '2026-05-28T10:10:00.000Z',
            current_extend_count: 0,
            bid_increment_type: 'fixed',
            bid_increment_value: 10,
            next_bid_amount: 130,
            rankings: [],
          },
        }),
      }));
    });

    expect(screen.getByRole('heading', { name: '更新后的复古牛仔夹克' })).toBeInTheDocument();
    expect(screen.getByAltText('更新后的复古牛仔夹克')).toHaveAttribute('src', 'https://img.test/jacket-updated.jpg');
  });

  it('updates the room stage background from snapshot live media', () => {
    seedRoom({ notifications: [] });
    renderRoom();

    act(() => {
      useLiveRoomStore.getState().applyMessage({
        type: 'snapshot',
        auction_id: 7,
        version: 6,
        server_time: '2026-05-28T10:00:03.000Z',
        payload: {
          product: {
            id: 22,
            title: '更新后的复古牛仔夹克',
            description: '商家上传了直播间图',
            image_urls: ['https://img.test/jacket-updated.jpg'],
            live_media: {
              type: 'image',
              url: 'https://media.test/live-room.webp',
              poster_url: null,
            },
          },
          status: 'active',
          current_price: 120,
          highest_bidder_id: 3,
          started_at: '2026-05-28T09:00:00.000Z',
          ended_at: '2026-05-28T10:10:00.000Z',
          current_extend_count: 0,
          bid_increment_type: 'fixed',
          bid_increment_value: 10,
          next_bid_amount: 130,
          rankings: [],
        },
      });
    });

    expect(screen.getByTestId('live-room-media-image')).toHaveAttribute('src', 'https://media.test/live-room.webp');
    expect(screen.getByRole('heading', { name: '更新后的复古牛仔夹克' })).toBeInTheDocument();
  });

  it('submits a custom amount through REST', async () => {
    renderRoom();

    fireEvent.click(screen.getByRole('button', { name: '打开出价面板' }));
    fireEvent.change(screen.getByLabelText('自定义出价金额'), { target: { value: '188.5' } });
    fireEvent.click(screen.getByRole('button', { name: '确认自定义出价' }));

    await waitFor(() => expect(mockedPlaceBid).toHaveBeenCalledWith(7, 188.5));
  });

  it('shows a visible error after REST bid failure and allows retry', async () => {
    mockedPlaceBid.mockRejectedValueOnce({ response: { data: { message: '出价必须高于当前价' } } });
    renderRoom();

    fireEvent.click(screen.getByRole('button', { name: '打开出价面板' }));
    fireEvent.click(screen.getByRole('button', { name: '立即追回 ¥130.00' }));

    expect(await screen.findByText('出价必须高于当前价')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '立即追回 ¥130.00' })).toBeEnabled();
  });

  it('disables bidding in terminal auction states', () => {
    seedRoom({ status: 'ended_sold', winnerId: buyerUser.id, finalPrice: 120, terminalMessage: '竞拍已成交' });

    renderRoom();

    expect(screen.getByRole('button', { name: '打开出价面板' })).toBeDisabled();
    expect(screen.getByRole('dialog', { name: '竞拍结果' })).toBeInTheDocument();
    expect(screen.getByText('恭喜竞拍成功，请前往订单确认并完成模拟支付。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看中标订单' })).toHaveAttribute('href', '/app/orders');
    expect(screen.getByText('竞拍已成交')).toBeInTheDocument();
  });

  it('renders terminal floating card as an auction result instead of a zero countdown', () => {
    seedRoom({ status: 'ended_sold', winnerId: 3, finalPrice: 120, terminalMessage: '竞拍已成交' });

    renderRoom();

    const card = screen.getByTestId('live-room-auction-card');
    expect(card).toHaveTextContent('落槌成交');
    expect(card).toHaveTextContent('成交价');
    expect(card).toHaveTextContent('¥120.00');
    expect(card).not.toHaveTextContent('倒计时');
    expect(card).not.toHaveTextContent('00:00');
  });

  it('opens the product shelf shell without implying multi-item realtime bidding', () => {
    renderRoom();

    fireEvent.click(screen.getByRole('button', { name: '打开商品橱窗' }));

    expect(screen.getByRole('dialog', { name: '商品橱窗' })).toBeInTheDocument();
    expect(screen.getByText('当前拍品实时竞拍，其他为演示货架')).toBeInTheDocument();
    expect(screen.getAllByText('直播竞拍中').length).toBeGreaterThan(0);
    expect(screen.getByText('即将开拍')).toBeInTheDocument();
    expect(screen.getByText('竞拍未成交')).toBeInTheDocument();
    expect(screen.getByText('竞拍结束')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /复古牛仔夹克/ }));
    expect(screen.getByRole('dialog', { name: '竞拍出价' })).toBeInTheDocument();
  });

  it('shows the authenticated buyer leading state in the bid sheet', () => {
    seedRoom({
      highestBidderId: buyerUser.id,
      notifications: [],
      rankings: [
        {
          rank: 1,
          user_id: buyerUser.id,
          display_name: 'Buyer',
          avatar_url: '',
          amount: 120,
          status: 'winning',
          bid_time: '2026-05-28T10:00:00.000Z',
        },
      ],
    });

    renderRoom();
    fireEvent.click(screen.getByRole('button', { name: '打开出价面板' }));

    expect(screen.getAllByText('当前您是最高价').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '当前您是最高价' })).toBeDisabled();
  });

  it('neutralizes stale room state while route auction and store auction differ', () => {
    const originalConnect = useLiveRoomStore.getState().connect;
    const originalDisconnect = useLiveRoomStore.getState().disconnect;
    useLiveRoomStore.setState({
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as Partial<LiveRoomState>);

    renderRoom('/app/auctions/8');

    expect(screen.queryByRole('heading', { name: '复古牛仔夹克' })).not.toBeInTheDocument();
    expect(screen.queryByText('小林')).not.toBeInTheDocument();
    const primaryBid = screen.getByRole('button', { name: '打开出价面板' });
    expect(primaryBid).toBeDisabled();

    fireEvent.click(primaryBid);

    expect(mockedPlaceBid).not.toHaveBeenCalledWith(8, 130);
    expect(mockedPlaceBid).not.toHaveBeenCalled();
    useLiveRoomStore.setState({ connect: originalConnect, disconnect: originalDisconnect } as Partial<LiveRoomState>);
  });
});

describe('ProtectedRoute access token hydration', () => {
  beforeEach(() => {
    mockedGetMe.mockReset();
    localStorage.setItem('refresh_token', 'refresh-token');
    localStorage.setItem('auth_user', JSON.stringify(buyerUser));
    useAuthStore.setState({
      user: buyerUser,
      accessToken: null,
      isAuthenticated: true,
      isHydrating: false,
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('hydrates an access token before rendering protected content after reload', async () => {
    mockedGetMe.mockImplementation(async () => {
      useAuthStore.getState().setAccessToken('hydrated-access-token');
      return buyerUser;
    });

    render(
      <MemoryRouter>
        <ProtectedRoute requiredRole="user">
          <div>protected room</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    await waitFor(() => expect(mockedGetMe).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('protected room')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe('hydrated-access-token');
  });
});
