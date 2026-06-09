import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeServerOffset, remainingMs } from '../pages/app/liveRoomUtils';
import { useLiveRoomStore, type LiveRoomState } from './liveRoomStore';
import type { RealtimeEnvelope, SnapshotPayload } from '../types/auction';

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
    this.readyState = WebSocket.CLOSED;
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(message: RealtimeEnvelope) {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent<string>);
  }

  closeFromServer() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.();
  }
}

function snapshot(version = 3): RealtimeEnvelope<SnapshotPayload> {
  return {
    type: 'snapshot',
    auction_id: 7,
    version,
    server_time: '2026-05-28T10:00:00.000Z',
    payload: {
      product: { id: 4, title: 'Vintage jacket', description: 'Denim', image_urls: ['a.jpg'] },
      status: 'active',
      current_price: 120,
      highest_bidder_id: 11,
      started_at: '2026-05-28T09:00:00.000Z',
      ended_at: '2026-05-28T10:05:00.000Z',
      current_extend_count: 1,
      bid_increment_type: 'fixed',
      bid_increment_value: 10,
      next_bid_amount: 130,
      rankings: [
        {
          rank: 1,
          user_id: 11,
          display_name: 'A',
          avatar_url: '',
          amount: 120,
          status: 'winning',
          bid_time: '2026-05-28T09:59:00.000Z',
        },
      ],
    },
  };
}

function resetStore() {
  useLiveRoomStore.getState().disconnect();
  useLiveRoomStore.setState({
    auctionId: undefined,
    product: undefined,
    status: undefined,
    currentPrice: 0,
    highestBidderId: undefined,
    startedAt: undefined,
    endedAt: undefined,
    currentExtendCount: 0,
    bidIncrementType: undefined,
    bidIncrementValue: 0,
    nextBidAmount: 0,
    rankings: [],
    winnerId: undefined,
    finalPrice: undefined,
    terminalMessage: undefined,
    submitState: 'idle',
    version: 0,
    notifications: [],
    connectionState: 'idle',
    reconnectAttempt: 0,
    serverTimeOffsetMs: 0,
    error: undefined,
  } as Partial<LiveRoomState>);
}

describe('live room countdown helpers', () => {
  it('computes server offset and remaining milliseconds', () => {
    const clientNow = Date.parse('2026-05-28T09:59:58.000Z');
    const offset = computeServerOffset('2026-05-28T10:00:00.000Z', clientNow);

    expect(offset).toBe(2000);
    expect(remainingMs('2026-05-28T10:00:05.000Z', offset, clientNow)).toBe(5000);
    expect(remainingMs(undefined, offset, clientNow)).toBe(0);
  });
});

describe('useLiveRoomStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal('window', {
      location: { protocol: 'https:', host: 'auction.test' },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    vi.stubGlobal('WebSocket', FakeWebSocket);
    resetStore();
  });

  afterEach(() => {
    useLiveRoomStore.getState().disconnect();
    vi.clearAllTimers();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('connects to the room websocket with a token query and tracks server time offset', () => {
    useLiveRoomStore.getState().connect(7, 'token with space');
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.receive(snapshot());

    const url = new URL(socket.url);
    expect(url.protocol).toBe('wss:');
    expect(url.pathname).toBe('/ws/auctions/7');
    expect(url.searchParams.get('token')).toBe('token with space');
    expect(useLiveRoomStore.getState().connectionState).toBe('open');
    expect(useLiveRoomStore.getState().serverTimeOffsetMs).toBe(Date.parse('2026-05-28T10:00:00.000Z') - Date.now());
  });

  it('applies snapshot room state', () => {
    useLiveRoomStore.getState().applyMessage(snapshot());

    const state = useLiveRoomStore.getState();
    expect(state.version).toBe(3);
    expect(state.product?.title).toBe('Vintage jacket');
    expect(state.currentPrice).toBe(120);
    expect(state.nextBidAmount).toBe(130);
    expect(state.rankings).toHaveLength(1);
  });

  it('applies price_update messages and ignores stale non-outbid messages', () => {
    useLiveRoomStore.getState().applyMessage(snapshot(3));
    useLiveRoomStore.getState().applyMessage({
      type: 'price_update',
      auction_id: 7,
      version: 4,
      server_time: '2026-05-28T10:00:01.000Z',
      payload: {
        current_price: 140,
        highest_bidder_id: 12,
        rankings: [{ ...snapshot().payload.rankings![0], rank: 1, user_id: 12, display_name: '阿辰', amount: 140 }],
      },
    });
    const offsetAfterFreshMessage = useLiveRoomStore.getState().serverTimeOffsetMs;
    useLiveRoomStore.getState().applyMessage({
      type: 'price_update',
      auction_id: 7,
      version: 2,
      server_time: '2026-05-28T09:00:00.000Z',
      payload: { current_price: 999, highest_bidder_id: 99, rankings: [] },
    });

    const state = useLiveRoomStore.getState();
    expect(state.version).toBe(4);
    expect(state.currentPrice).toBe(140);
    expect(state.highestBidderId).toBe(12);
    expect(state.rankings[0]?.user_id).toBe(12);
    expect(state.notifications[0]?.message).toBe('阿辰 出价 ¥140.00');
    expect(state.serverTimeOffsetMs).toBe(offsetAfterFreshMessage);
  });

  it('recomputes next bid for fixed and percent increments after price_update messages', () => {
    useLiveRoomStore.getState().applyMessage(snapshot(3));
    useLiveRoomStore.getState().applyMessage({
      type: 'price_update',
      auction_id: 7,
      version: 4,
      server_time: '2026-05-28T10:00:01.000Z',
      payload: { current_price: 140, highest_bidder_id: 12, rankings: [] },
    });

    expect(useLiveRoomStore.getState().nextBidAmount).toBe(150);

    useLiveRoomStore.setState({ bidIncrementType: 'percent', bidIncrementValue: 12.5 });
    useLiveRoomStore.getState().applyMessage({
      type: 'price_update',
      auction_id: 7,
      version: 5,
      server_time: '2026-05-28T10:00:02.000Z',
      payload: { current_price: 99.99, highest_bidder_id: 13, rankings: [] },
    });

    expect(useLiveRoomStore.getState().nextBidAmount).toBe(112.49);
  });

  it('normalizes null price_update rankings to an empty array', () => {
    useLiveRoomStore.getState().applyMessage(snapshot(3));
    useLiveRoomStore.getState().applyMessage({
      type: 'price_update',
      auction_id: 7,
      version: 4,
      server_time: '2026-05-28T10:00:01.000Z',
      payload: {
        current_price: 140,
        highest_bidder_id: 12,
        rankings: null,
      },
    });

    const state = useLiveRoomStore.getState();
    expect(state.version).toBe(4);
    expect(state.currentPrice).toBe(140);
    expect(state.rankings).toEqual([]);
  });

  it('applies extended messages', () => {
    useLiveRoomStore.getState().applyMessage(snapshot(3));
    useLiveRoomStore.getState().applyMessage({
      type: 'extended',
      auction_id: 7,
      version: 4,
      server_time: '2026-05-28T10:00:01.000Z',
      payload: {
        ended_at: '2026-05-28T10:07:00.000Z',
        current_extend_count: 2,
      },
    });

    const state = useLiveRoomStore.getState();
    expect(state.endedAt).toBe('2026-05-28T10:07:00.000Z');
    expect(state.currentExtendCount).toBe(2);
    expect(state.notifications[0]?.type).toBe('status');
  });

  it('applies ai_commentary messages as non-authoritative notifications', () => {
    useLiveRoomStore.getState().applyMessage(snapshot(3));
    useLiveRoomStore.getState().applyMessage({
      type: 'ai_commentary',
      auction_id: 7,
      version: 3,
      server_time: '2026-05-28T10:00:02.000Z',
      payload: {
        event: 'first_bid',
        commentary: '第一口出价来了，拍场开始升温！',
      },
    });

    const state = useLiveRoomStore.getState();
    expect(state.version).toBe(3);
    expect(state.currentPrice).toBe(120);
    expect(state.notifications[0]).toMatchObject({
      type: 'ai',
      message: 'AI解说：第一口出价来了，拍场开始升温！',
    });
  });

  it('applies same-version auction_end terminal messages', () => {
    useLiveRoomStore.getState().applyMessage(snapshot(3));
    useLiveRoomStore.getState().applyMessage({
      type: 'auction_end',
      auction_id: 7,
      version: 3,
      server_time: '2026-05-28T10:00:01.000Z',
      payload: {
        status: 'ended_sold',
        winner_id: 11,
        final_price: 120,
        terminal_message: '竞拍已结束',
      },
    });

    const state = useLiveRoomStore.getState();
    expect(state.version).toBe(3);
    expect(state.status).toBe('ended_sold');
    expect(state.finalPrice).toBe(120);
    expect(state.terminalMessage).toBe('竞拍已结束');
  });

  it('clears previous room and terminal fields when connecting to a different auction', () => {
    useLiveRoomStore.getState().applyMessage(snapshot(3));
    useLiveRoomStore.getState().applyMessage({
      type: 'auction_end',
      auction_id: 7,
      version: 4,
      server_time: '2026-05-28T10:00:01.000Z',
      payload: {
        status: 'ended_sold',
        winner_id: 11,
        final_price: 120,
        terminal_message: '竞拍已结束',
      },
    });

    useLiveRoomStore.getState().connect(8, 'next');

    const state = useLiveRoomStore.getState();
    expect(state.auctionId).toBe(8);
    expect(state.product).toBeUndefined();
    expect(state.status).toBeUndefined();
    expect(state.highestBidderId).toBeUndefined();
    expect(state.endedAt).toBeUndefined();
    expect(state.winnerId).toBeUndefined();
    expect(state.finalPrice).toBeUndefined();
    expect(state.terminalMessage).toBeUndefined();
    expect(state.currentPrice).toBe(0);
    expect(state.version).toBe(0);
  });

  it('clears room and terminal fields on disconnect', () => {
    useLiveRoomStore.getState().applyMessage(snapshot(3));
    useLiveRoomStore.getState().applyMessage({
      type: 'auction_end',
      auction_id: 7,
      version: 4,
      server_time: '2026-05-28T10:00:01.000Z',
      payload: {
        status: 'ended_sold',
        winner_id: 11,
        final_price: 120,
        terminal_message: '竞拍已结束',
      },
    });

    useLiveRoomStore.getState().disconnect();

    const state = useLiveRoomStore.getState();
    expect(state.auctionId).toBeUndefined();
    expect(state.product).toBeUndefined();
    expect(state.status).toBeUndefined();
    expect(state.winnerId).toBeUndefined();
    expect(state.finalPrice).toBeUndefined();
    expect(state.terminalMessage).toBeUndefined();
    expect(state.currentPrice).toBe(0);
    expect(state.connectionState).toBe('closed');
  });

  it('clears terminal metadata when a fresh active snapshot arrives', () => {
    useLiveRoomStore.getState().applyMessage(snapshot(3));
    useLiveRoomStore.getState().applyMessage({
      type: 'auction_end',
      auction_id: 7,
      version: 4,
      server_time: '2026-05-28T10:00:01.000Z',
      payload: {
        status: 'ended_sold',
        winner_id: 11,
        final_price: 120,
        terminal_message: '竞拍已结束',
      },
    });

    useLiveRoomStore.getState().applyMessage(snapshot(5));

    const state = useLiveRoomStore.getState();
    expect(state.status).toBe('active');
    expect(state.winnerId).toBeUndefined();
    expect(state.finalPrice).toBeUndefined();
    expect(state.terminalMessage).toBeUndefined();
  });

  it('always accepts outbid as a notification even when its version is old', () => {
    useLiveRoomStore.getState().applyMessage(snapshot(3));
    useLiveRoomStore.getState().applyMessage({
      type: 'outbid',
      auction_id: 7,
      version: 1,
      server_time: '2026-05-28T09:59:00.000Z',
      payload: { previous_amount: 100, new_amount: 120, new_bidder_id: 11 },
    });

    const state = useLiveRoomStore.getState();
    expect(state.version).toBe(3);
    expect(state.notifications[0]?.type).toBe('outbid');
  });

  it('reconnects once after an unexpected close and replaces stale sockets', () => {
    useLiveRoomStore.getState().connect(7, 'first');
    const firstSocket = FakeWebSocket.instances[0];
    useLiveRoomStore.getState().connect(8, 'second');
    const secondSocket = FakeWebSocket.instances[1];

    expect(firstSocket.closed).toBe(true);
    secondSocket.closeFromServer();
    secondSocket.closeFromServer();

    expect(useLiveRoomStore.getState().connectionState).toBe('reconnecting');
    expect(useLiveRoomStore.getState().reconnectAttempt).toBe(1);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(1600);
    expect(FakeWebSocket.instances).toHaveLength(3);
    expect(new URL(FakeWebSocket.instances[2].url).pathname).toBe('/ws/auctions/8');
  });
});
