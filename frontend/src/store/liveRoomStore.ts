import { create, type StoreApi } from 'zustand';
import { computeServerOffset } from '../pages/app/liveRoomUtils';
import type {
  AuctionEndPayload,
  AuctionStatus,
  AICommentaryPayload,
  ExtendedPayload,
  OutbidPayload,
  PriceUpdatePayload,
  ProductSummary,
  RankingItem,
  RealtimeEnvelope,
  SnapshotPayload,
} from '../types/auction';

export type LiveRoomConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';
export type BidSubmitState = 'idle' | 'submitting' | 'error';
export type LiveRoomNotificationType = 'bid' | 'outbid' | 'error' | 'status' | 'ai';

export interface LiveRoomNotification {
  id: string;
  type: LiveRoomNotificationType;
  message: string;
  server_time?: string;
}

export interface LiveRoomState {
  auctionId?: number;
  product?: ProductSummary;
  status?: AuctionStatus;
  currentPrice: number;
  highestBidderId?: number | null;
  startedAt?: string;
  endedAt?: string;
  currentExtendCount: number;
  bidIncrementType?: string;
  bidIncrementValue: number;
  nextBidAmount: number;
  rankings: RankingItem[];
  winnerId?: number | null;
  finalPrice?: number;
  terminalMessage?: string;
  submitState: BidSubmitState;
  version: number;
  notifications: LiveRoomNotification[];
  connectionState: LiveRoomConnectionState;
  reconnectAttempt: number;
  serverTimeOffsetMs: number;
  error?: string;

  connect: (auctionId: number, token: string) => void;
  disconnect: () => void;
  applyMessage: (message: RealtimeEnvelope) => void;
  setSubmitState: (submitState: BidSubmitState) => void;
}

type StoreSet = StoreApi<LiveRoomState>['setState'];
type StoreGet = StoreApi<LiveRoomState>['getState'];

const reconnectDelayMs = 1600;
const maxNotifications = 20;

let activeSocket: WebSocket | null = null;
let reconnectTimer: number | undefined;
let manualDisconnect = false;
let notificationSequence = 0;

function clearReconnectTimer() {
  if (reconnectTimer === undefined) return;
  window.clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
}

function closeActiveSocket() {
  if (!activeSocket) return;
  const socket = activeSocket;
  activeSocket = null;
  socket.onopen = null;
  socket.onmessage = null;
  socket.onerror = null;
  socket.onclose = null;
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    socket.close();
  }
}

function websocketUrl(auctionId: number, token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = new URL(`${protocol}//${window.location.host}/ws/auctions/${auctionId}`);
  url.searchParams.set('token', token);
  return url.toString();
}

function notification(type: LiveRoomNotificationType, message: string, serverTime?: string): LiveRoomNotification {
  notificationSequence += 1;
  return {
    id: `${Date.now()}-${notificationSequence}`,
    type,
    message,
    server_time: serverTime,
  };
}

function withNotification(state: LiveRoomState, item: LiveRoomNotification): LiveRoomNotification[] {
  return [item, ...state.notifications].slice(0, maxNotifications);
}

function asPayload<T>(message: RealtimeEnvelope): T {
  return message.payload as T;
}

function normalizeRankings(rankings: RankingItem[] | null): RankingItem[] {
  return rankings ?? [];
}

function formatPrice(value: number): string {
  return `¥${value.toFixed(2)}`;
}

function calculateNextBidAmount(currentPrice: number, incrementType: string | undefined, incrementValue: number): number {
  const increment = incrementType === 'percent'
    ? Math.ceil(currentPrice * incrementValue) / 100
    : incrementValue;
  return Number((currentPrice + increment).toFixed(2));
}

function startSocket(auctionId: number, token: string, set: StoreSet, get: StoreGet, reconnecting = false) {
  clearReconnectTimer();
  closeActiveSocket();
  manualDisconnect = false;

  set({
    auctionId,
    connectionState: reconnecting ? 'reconnecting' : 'connecting',
    error: undefined,
  });

  const socket = new WebSocket(websocketUrl(auctionId, token));
  activeSocket = socket;

  socket.onopen = () => {
    if (activeSocket !== socket) return;
    set({ connectionState: 'open', reconnectAttempt: 0, error: undefined });
  };

  socket.onmessage = (event) => {
    if (activeSocket !== socket) return;
    try {
      get().applyMessage(JSON.parse(event.data) as RealtimeEnvelope);
    } catch {
      const item = notification('error', '实时消息解析失败');
      set((state: LiveRoomState) => ({
        notifications: withNotification(state, item),
        error: item.message,
      }));
    }
  };

  socket.onerror = () => {
    if (activeSocket !== socket) return;
    const item = notification('error', '实时连接异常，正在尝试恢复');
    set((state: LiveRoomState) => ({
      connectionState: 'error',
      notifications: withNotification(state, item),
      error: item.message,
    }));
  };

  socket.onclose = () => {
    if (activeSocket !== socket) return;
    activeSocket = null;
    if (manualDisconnect) {
      set({ connectionState: 'closed' });
      return;
    }
    scheduleReconnect(set, get);
  };
}

function scheduleReconnect(set: StoreSet, get: StoreGet) {
  const { auctionId } = get() as LiveRoomState;
  const token = currentToken;
  if (!auctionId || !token || reconnectTimer !== undefined) return;

  const nextAttempt = ((get() as LiveRoomState).reconnectAttempt || 0) + 1;
  set({ connectionState: 'reconnecting', reconnectAttempt: nextAttempt });
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = undefined;
    const state = get() as LiveRoomState;
    if (!state.auctionId || !currentToken) return;
    startSocket(state.auctionId, currentToken, set, get, true);
  }, reconnectDelayMs);
}

let currentToken: string | undefined;

type ResettableLiveRoomState = Omit<LiveRoomState, 'connect' | 'disconnect' | 'applyMessage' | 'setSubmitState'>;

function resetRoomState(overrides: Partial<ResettableLiveRoomState> = {}): ResettableLiveRoomState {
  return {
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
    ...overrides,
  };
}

const initialState = resetRoomState();

const terminalReset = {
  winnerId: undefined,
  finalPrice: undefined,
  terminalMessage: undefined,
};

export const useLiveRoomStore = create<LiveRoomState>((set, get) => ({
  ...initialState,

  connect: (auctionId, token) => {
    if (get().auctionId !== auctionId) {
      set(resetRoomState({ auctionId }));
    }
    currentToken = token;
    startSocket(auctionId, token, set, get);
  },

  disconnect: () => {
    manualDisconnect = true;
    currentToken = undefined;
    clearReconnectTimer();
    closeActiveSocket();
    set(resetRoomState({ connectionState: 'closed' }));
  },

  applyMessage: (message) => {
    const state = get();
    const serverTimeOffsetMs = computeServerOffset(message.server_time);

    if (state.auctionId && message.auction_id !== state.auctionId) {
      return;
    }

    if (message.type !== 'outbid' && message.type !== 'ai_commentary' && message.version < state.version) {
      return;
    }

    switch (message.type) {
      case 'snapshot': {
        const payload = asPayload<SnapshotPayload>(message);
        set({
          auctionId: message.auction_id,
          product: payload.product,
          status: payload.status,
          currentPrice: payload.current_price,
          highestBidderId: payload.highest_bidder_id,
          startedAt: payload.started_at || undefined,
          endedAt: payload.ended_at || undefined,
          currentExtendCount: payload.current_extend_count,
          bidIncrementType: payload.bid_increment_type,
          bidIncrementValue: payload.bid_increment_value,
          nextBidAmount: payload.next_bid_amount,
          rankings: normalizeRankings(payload.rankings),
          ...terminalReset,
          version: message.version,
          serverTimeOffsetMs,
          error: undefined,
        });
        return;
      }
      case 'price_update': {
        const payload = asPayload<PriceUpdatePayload>(message);
        const rankings = normalizeRankings(payload.rankings);
        const topBid = rankings.find((item) => item.user_id === payload.highest_bidder_id) ?? rankings[0];
        const bidder = topBid?.display_name?.trim() || (topBid ? `用户 ${topBid.user_id}` : '新出价');
        const item = notification('bid', `${bidder} 出价 ${formatPrice(payload.current_price)}`, message.server_time);
        set((current: LiveRoomState) => ({
          currentPrice: payload.current_price,
          highestBidderId: payload.highest_bidder_id,
          nextBidAmount: calculateNextBidAmount(payload.current_price, current.bidIncrementType, current.bidIncrementValue),
          rankings,
          version: message.version,
          serverTimeOffsetMs,
          notifications: withNotification(current, item),
          error: undefined,
        }));
        return;
      }
      case 'extended': {
        const payload = asPayload<ExtendedPayload>(message);
        const item = notification('status', '竞拍时间已延长', message.server_time);
        set((current: LiveRoomState) => ({
          endedAt: payload.ended_at,
          currentExtendCount: payload.current_extend_count,
          version: message.version,
          serverTimeOffsetMs,
          notifications: withNotification(current, item),
          error: undefined,
        }));
        return;
      }
      case 'auction_end': {
        const payload = asPayload<AuctionEndPayload>(message);
        const item = notification('status', payload.terminal_message || '竞拍已结束', message.server_time);
        set((current: LiveRoomState) => ({
          status: payload.status,
          winnerId: payload.winner_id,
          finalPrice: payload.final_price,
          terminalMessage: payload.terminal_message,
          version: message.version,
          serverTimeOffsetMs,
          notifications: withNotification(current, item),
          error: undefined,
        }));
        return;
      }
      case 'outbid': {
        const payload = asPayload<OutbidPayload>(message);
        const item = notification(
          'outbid',
          `您已被超过，当前最高出价为 ${payload.new_amount}`,
          message.server_time,
        );
        set((current: LiveRoomState) => ({
          serverTimeOffsetMs,
          notifications: withNotification(current, item),
        }));
        return;
      }
      case 'ai_commentary': {
        const payload = asPayload<AICommentaryPayload>(message);
        const trimmed = payload.commentary.trim();
        if (!trimmed) return;
        const item = notification('ai', `AI解说：${trimmed}`, message.server_time);
        set((current: LiveRoomState) => ({
          serverTimeOffsetMs,
          notifications: withNotification(current, item),
        }));
        return;
      }
    }
  },

  setSubmitState: (submitState) => {
    set({ submitState });
  },
}));
