import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router-dom';
import { placeBid } from '../../api/auction';
import heroFallback from '../../assets/hero.png';
import PageBackButton from '../../components/PageBackButton';
import { usePageRefresh } from '../../hooks/usePageRefresh';
import { useAuthStore } from '../../store/authStore';
import { useLiveRoomStore } from '../../store/liveRoomStore';
import type { AuctionStatus, RankingItem } from '../../types/auction';
import { remainingMs } from './liveRoomUtils';

const TERMINAL_STATUSES: AuctionStatus[] = ['ended_sold', 'ended_no_bid', 'cancelled'];

const STATUS_TEXT: Record<AuctionStatus, string> = {
  pending: '待开拍',
  active: '直播竞拍中',
  ended_sold: '已成交',
  ended_no_bid: '已流拍',
  cancelled: '已取消',
};

const CONNECTION_TEXT = {
  idle: '等待连接',
  connecting: '连接中',
  open: '实时在线',
  reconnecting: '重连中',
  closed: '已断开',
  error: '连接异常',
};

const LIVE_ROOM_STAGE_CLASS = 'relative mx-auto h-[100svh] min-h-[640px] w-full max-w-[430px] overflow-hidden bg-black shadow-2xl shadow-black/50 lg:h-[860px] lg:min-h-0 lg:rounded-[8px] lg:border lg:border-white/10';
const LIVE_ROOM_TOP_CLASS = 'absolute left-0 right-0 top-0 z-30 px-3 pt-10 sm:pt-3';
const LIVE_ROOM_MESSAGE_CLASS = 'absolute bottom-[7.25rem] left-3 z-20 w-[54%] max-w-[232px]';
const LIVE_ROOM_FLOATING_CARD_CLASS = 'absolute bottom-[7.15rem] right-3 z-30 w-[45%] min-w-[172px] max-w-[196px]';
const LIVE_ROOM_BOTTOM_CLASS = 'absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-black/82 to-transparent px-3 pb-3 pt-9';
const PRESSABLE_CLASS = 'transition duration-150 active:scale-95 active:brightness-110 disabled:active:scale-100';
const TILE_BUTTON_CLASS = `rounded-[8px] border border-white/12 bg-white/14 shadow-lg shadow-black/20 backdrop-blur ${PRESSABLE_CLASS}`;
const PRIMARY_ACTION_CLASS = 'shadow-lg transition duration-150 active:scale-[0.98] disabled:active:scale-100';

const SHELF_DEMO_ITEMS = [
  { title: '金镶玉平安扣吊坠', state: '即将开拍', priceLabel: '起拍价', price: '¥1200', action: '去看看', note: '演示货架' },
  { title: '复古银饰手链', state: '竞拍未成交', priceLabel: '起拍价', price: '¥9000', action: '已结束', note: '演示货架' },
  { title: '潮流球鞋挂件', state: '竞拍结束', priceLabel: '落槌价', price: '¥299', action: '已结束', note: '演示货架' },
];

let currentTimeMs = Date.now();

function subscribeToClock(onStoreChange: () => void) {
  currentTimeMs = Date.now();
  const timer = window.setInterval(() => {
    currentTimeMs = Date.now();
    onStoreChange();
  }, 1000);
  return () => window.clearInterval(timer);
}

function getClockSnapshot() {
  return currentTimeMs;
}

function useClockTick() {
  return useSyncExternalStore(subscribeToClock, getClockSnapshot, getClockSnapshot);
}

function formatPrice(value: number | undefined) {
  const price = Number(value);
  return `¥${(Number.isFinite(price) ? price : 0).toFixed(2)}`;
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatCountdownLong(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatLotId(auctionId: number) {
  return `NO.${String(auctionId).padStart(4, '0')}`;
}

function extractBidError(err: unknown) {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return '出价失败，请稍后重试';
}

function formatIncrement(type: string | undefined, value: number, stepAmount: number) {
  if (type === 'percent') return `${value}%`;
  return formatPrice(stepAmount);
}

function shelfPriceLabel(status: AuctionStatus | undefined, bidCount: number) {
  if (status === 'ended_sold' || status === 'cancelled') return '落槌价';
  if (status === 'active' && bidCount > 0) return '当前最高价';
  return '起拍价';
}

function safeDisplayName(item: RankingItem) {
  return item.display_name?.trim() || `用户 ${item.user_id}`;
}

function uniqueRankingsByUser(rankings: RankingItem[]) {
  const seen = new Set<number>();
  return rankings.filter((item) => {
    if (seen.has(item.user_id)) return false;
    seen.add(item.user_id);
    return true;
  });
}

type ActionIconName = 'trophy' | 'heart' | 'spark' | 'share';

function ActionIcon({ name }: { name: ActionIconName }) {
  if (name === 'trophy') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
        <path d="M8 6H5a3 3 0 0 0 3 3" />
        <path d="M16 6h3a3 3 0 0 1-3 3" />
        <path d="M12 12v4" />
        <path d="M9 20h6" />
        <path d="M10 16h4l1 4H9l1-4Z" />
      </svg>
    );
  }

  if (name === 'heart') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 21s-7.2-4.3-9.4-8.5C.6 8.5 2.6 4.8 6.4 4.3c2-.2 3.5.7 4.6 2.1 1.1-1.4 2.6-2.3 4.6-2.1 3.8.5 5.8 4.2 3.8 8.2C19.2 16.7 12 21 12 21Z" />
      </svg>
    );
  }

  if (name === 'share') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 5l5 5-5 5" />
        <path d="M19 10h-7a7 7 0 0 0-7 7v1" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 9.7 8.2 4 10.6l5.7 2.3L12 20l2.3-7.1 5.7-2.3-5.7-2.4L12 2Z" />
      <path d="M4 3v4" />
      <path d="M2 5h4" />
      <path d="M20 17v4" />
      <path d="M18 19h4" />
    </svg>
  );
}

function ActionRailButton({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  icon: ActionIconName;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="group flex w-12 flex-col items-center gap-1 text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)] transition duration-150 active:scale-95"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/18 bg-black/34 text-white shadow-lg shadow-black/30 backdrop-blur-xl transition group-hover:border-white/35 group-hover:bg-white/18">
        <ActionIcon name={icon} />
      </span>
      <span className="max-w-12 truncate rounded-full bg-black/34 px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur">{value}</span>
    </button>
  );
}

function RankingPill({ item, displayRank }: { item: RankingItem; displayRank: number }) {
  return (
    <li className="flex h-8 min-w-0 items-center gap-2 rounded-full bg-black/42 px-2 pr-3 shadow-lg shadow-black/20 backdrop-blur-xl">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-orange-400 text-[11px] font-black text-zinc-950">
        {displayRank}
      </span>
      <span className="min-w-0 truncate text-xs font-semibold text-white">{safeDisplayName(item)}</span>
      <span className="shrink-0 text-xs font-bold text-emerald-200">{formatPrice(item.amount)}</span>
    </li>
  );
}

export default function LiveAuctionRoom() {
  const { id } = useParams();
  const auctionId = Number(id);
  const { accessToken, isHydrating, user } = useAuthStore();
  const {
    auctionId: storeAuctionId,
    product,
    status,
    currentPrice,
    highestBidderId,
    endedAt,
    currentExtendCount,
    bidIncrementType,
    bidIncrementValue,
    nextBidAmount,
    rankings,
    winnerId,
    finalPrice,
    terminalMessage,
    submitState,
    notifications,
    connectionState,
    serverTimeOffsetMs,
    connect,
    disconnect,
    setSubmitState,
  } = useLiveRoomStore();
  const [customAmount, setCustomAmount] = useState('');
  const [bidError, setBidError] = useState('');
  const [bidSheetOpen, setBidSheetOpen] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [pricePulse, setPricePulse] = useState(false);
  const [pressedAction, setPressedAction] = useState('');
  const nowTick = useClockTick();

  const isValidAuctionId = Number.isFinite(auctionId) && auctionId > 0;
  const isCurrentRoom = isValidAuctionId && storeAuctionId === auctionId;
  const roomProduct = isCurrentRoom ? product : undefined;
  const roomStatus = isCurrentRoom ? status : undefined;
  const roomCurrentPrice = isCurrentRoom ? currentPrice : 0;
  const lastRoomPriceRef = useRef<number | null>(roomCurrentPrice);
  const pricePulseTimerRef = useRef<ReturnType<typeof window.setTimeout> | undefined>(undefined);
  const pressedActionTimerRef = useRef<ReturnType<typeof window.setTimeout> | undefined>(undefined);
  const messageFeedRef = useRef<HTMLUListElement | null>(null);
  const roomHighestBidderId = isCurrentRoom ? highestBidderId : undefined;
  const roomEndedAt = isCurrentRoom ? endedAt : undefined;
  const roomCurrentExtendCount = isCurrentRoom ? currentExtendCount : 0;
  const roomBidIncrementType = isCurrentRoom ? bidIncrementType : undefined;
  const roomBidIncrementValue = isCurrentRoom ? bidIncrementValue : 0;
  const roomNextBidAmount = isCurrentRoom ? nextBidAmount : 0;
  const roomRankings = isCurrentRoom ? rankings : [];
  const displayedRankings = useMemo(() => uniqueRankingsByUser(roomRankings).slice(0, 3), [roomRankings]);
  const roomWinnerId = isCurrentRoom ? winnerId : undefined;
  const roomFinalPrice = isCurrentRoom ? finalPrice : undefined;
  const roomTerminalMessage = isCurrentRoom ? terminalMessage : undefined;
  const roomNotifications = isCurrentRoom ? notifications : [];
  const terminal = roomStatus ? TERMINAL_STATUSES.includes(roomStatus) : false;
  const active = roomStatus === 'active';
  const pending = roomStatus === 'pending';
  const countdownMs = remainingMs(roomEndedAt, serverTimeOffsetMs, nowTick);
  const urgent = active && countdownMs > 0 && countdownMs <= 10_000;
  const displayStatus = roomStatus ? STATUS_TEXT[roomStatus] : '等待快照';
  const heroImage = roomProduct?.image_urls?.[0] || heroFallback;
  const liveMedia = roomProduct?.live_media;
  const bidCount = roomRankings.length;
  const isLeading = active && Boolean(user?.id && roomHighestBidderId === user.id);
  const latestOutbid = roomNotifications.find((item) => item.type === 'outbid');
  const isOutbid = active && Boolean(latestOutbid) && !isLeading;
  const ownRanking = user?.id ? roomRankings.find((item) => item.user_id === user.id) : undefined;
  const isWinner = roomStatus === 'ended_sold' && Boolean(user?.id && roomWinnerId === user.id);
  const bidDisabled = !isCurrentRoom || submitState === 'submitting' || terminal || !active || !isValidAuctionId;
  const stepAmount = useMemo(() => {
    const nextStep = Number((roomNextBidAmount - roomCurrentPrice).toFixed(2));
    if (Number.isFinite(nextStep) && nextStep > 0) return nextStep;
    if (roomBidIncrementType === 'fixed' && roomBidIncrementValue > 0) return roomBidIncrementValue;
    return 1;
  }, [roomBidIncrementType, roomBidIncrementValue, roomCurrentPrice, roomNextBidAmount]);
  const customBidAmount = Number(customAmount);
  const hasCustomAmount = customAmount.trim().length > 0 && Number.isFinite(customBidAmount) && customBidAmount > 0;
  const primaryBidAmount = hasCustomAmount ? customBidAmount : roomNextBidAmount;
  const lotId = isValidAuctionId ? formatLotId(auctionId) : 'NO.----';
  const bidDeltaAmount = Number((primaryBidAmount - roomCurrentPrice).toFixed(2));
  const sheetTimerText = terminal
    ? '当前拍品竞拍已结束'
    : pending
      ? '即将开拍'
      : `距竞拍结束仅剩 ${formatCountdownLong(countdownMs)}`;
  const stateChipText = useMemo(() => {
    if (bidError) return '出价失败，请检查金额';
    if (terminal) return '当前拍品竞拍已结束';
    if (isLeading) return '当前您已是最高价';
    if (isOutbid) return '已被超过，立即追回';
    if (bidDeltaAmount > 0) return `高于当前价${formatPrice(bidDeltaAmount)}`;
    return '等待实时竞拍状态';
  }, [bidDeltaAmount, bidError, isLeading, isOutbid, terminal]);
  const myBidDisplay = ownRanking ? formatPrice(ownRanking.amount) : '暂无出价';

  const sheetPrimaryText = useMemo(() => {
    if (terminal) return '竞拍已结束';
    if (pending) return '尚未开始';
    if (!active) return '等待快照';
    if (submitState === 'submitting') return '提交中...';
    if (isLeading) return '当前您是最高价';
    if (isOutbid) return `立即追回 ${formatPrice(primaryBidAmount)}`;
    return `立即出价 ${formatPrice(primaryBidAmount)}`;
  }, [active, isLeading, isOutbid, pending, primaryBidAmount, submitState, terminal]);

  const floatingActionText = useMemo(() => {
    if (terminal) return '竞拍已结束';
    if (!isCurrentRoom) return '等待快照';
    if (pending) return '查看规则';
    if (isLeading) return '领先中';
    if (isOutbid) return '立即追回';
    return '立即出价';
  }, [isCurrentRoom, isLeading, isOutbid, pending, terminal]);

  const roomMessages = useMemo(() => {
    const realtimeMessages = [...roomNotifications].reverse().map((item) => ({
      id: item.id,
      type: item.type,
      message: item.message,
    }));
    if (realtimeMessages.length > 0) return realtimeMessages;
    return [
      { id: 'welcome', type: 'status', message: '系统：欢迎进入直播拍场' },
      { id: 'host', type: 'status', message: '主播：看中就开价，最后十秒别犹豫' },
      { id: 'auctioneer', type: 'status', message: active ? '拍卖官：当前拍品正在竞拍' : '拍卖官：等待拍品状态同步' },
    ];
  }, [active, roomNotifications]);

  useEffect(() => {
    const feed = messageFeedRef.current;
    if (!feed) return;
    feed.scrollTop = feed.scrollHeight;
  }, [roomMessages.length]);

  const refreshRoom = useCallback(() => {
    if (!isValidAuctionId || !accessToken) return;
    connect(auctionId, accessToken);
  }, [accessToken, auctionId, connect, isValidAuctionId]);

  usePageRefresh(refreshRoom, { disabled: !isValidAuctionId || !accessToken });

  useEffect(() => {
    refreshRoom();
    return () => disconnect();
  }, [disconnect, refreshRoom]);

  useEffect(() => {
    if (terminal) setResultDismissed(false);
  }, [auctionId, roomStatus, terminal]);

  useEffect(() => {
    if (!isCurrentRoom) {
      lastRoomPriceRef.current = null;
      setPricePulse(false);
      if (pricePulseTimerRef.current) {
        window.clearTimeout(pricePulseTimerRef.current);
        pricePulseTimerRef.current = undefined;
      }
      return;
    }

    if (lastRoomPriceRef.current === null) {
      lastRoomPriceRef.current = roomCurrentPrice;
      return;
    }

    if (lastRoomPriceRef.current === roomCurrentPrice) return;

    lastRoomPriceRef.current = roomCurrentPrice;
    setPricePulse(true);
    if (pricePulseTimerRef.current) window.clearTimeout(pricePulseTimerRef.current);
    pricePulseTimerRef.current = window.setTimeout(() => {
      setPricePulse(false);
      pricePulseTimerRef.current = undefined;
    }, 900);
  }, [isCurrentRoom, roomCurrentPrice]);

  useEffect(() => () => {
    if (pricePulseTimerRef.current) window.clearTimeout(pricePulseTimerRef.current);
    if (pressedActionTimerRef.current) window.clearTimeout(pressedActionTimerRef.current);
  }, []);

  function markPressed(action: string) {
    setPressedAction(action);
    if (pressedActionTimerRef.current) window.clearTimeout(pressedActionTimerRef.current);
    pressedActionTimerRef.current = window.setTimeout(() => {
      setPressedAction((currentAction) => (currentAction === action ? '' : currentAction));
      pressedActionTimerRef.current = undefined;
    }, 220);
  }

  async function submitBid(amount: number) {
    if (bidDisabled || isLeading || !Number.isFinite(amount) || amount <= 0) return;
    setBidError('');
    setSubmitState('submitting');
    try {
      await placeBid(auctionId, amount);
      setSubmitState('idle');
      setCustomAmount('');
    } catch (err) {
      setSubmitState('error');
      setBidError(extractBidError(err));
    }
  }

  function adjustCustomAmount(direction: 1 | -1) {
    const base = hasCustomAmount ? customBidAmount : roomNextBidAmount;
    const nextAmount = Math.max(roomNextBidAmount, Number((base + direction * stepAmount).toFixed(2)));
    setCustomAmount(String(nextAmount));
  }

  function openBidSheet() {
    if (!isCurrentRoom || terminal) return;
    markPressed('bid');
    setShelfOpen(false);
    setBidSheetOpen(true);
  }

  const showResultModal = isCurrentRoom && terminal && !resultDismissed;

  return (
    <div className="min-h-screen bg-[#07080b] text-white lg:grid lg:place-items-center lg:px-6 lg:py-6">
      <main className={LIVE_ROOM_STAGE_CLASS}>
        {liveMedia?.type === 'video' ? (
          <video
            data-testid="live-room-media-video"
            src={liveMedia.url}
            poster={liveMedia.poster_url ?? undefined}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : liveMedia?.type === 'image' ? (
          <img
            data-testid="live-room-media-image"
            src={liveMedia.url}
            alt="直播间背景素材"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className={`absolute inset-0 ${liveMedia ? 'bg-black/16' : 'bg-[radial-gradient(circle_at_18%_24%,rgba(255,204,142,0.32),transparent_22%),radial-gradient(circle_at_82%_46%,rgba(255,47,87,0.18),transparent_26%),linear-gradient(145deg,#80614f_0%,#242730_43%,#07080b_100%)]'}`} />
        {!liveMedia ? (
          <>
            <div className="absolute left-[-58px] top-36 h-56 w-56 rounded-full bg-amber-200/18 blur-xl" />
            <div className="absolute left-0 top-48 h-40 w-28 rounded-r-full bg-[linear-gradient(90deg,rgba(255,230,181,0.44),rgba(255,230,181,0.02))] blur-sm" />
            <div className="absolute left-10 top-48 h-28 w-20 rounded-t-full border border-amber-100/18 bg-amber-100/22 shadow-2xl shadow-amber-200/20" />
            <div className="absolute left-4 top-[46%] h-24 w-28 rounded-[8px] border border-white/10 bg-black/42 p-3 text-center shadow-xl shadow-black/30 backdrop-blur">
              <div className="text-xs font-semibold text-white/55">拍品编号</div>
              <div className="mt-1 font-mono text-lg font-black text-white/88">{lotId}</div>
              <div className="mt-2 text-xs text-white/58">成色 9.5新</div>
            </div>
            <div className="absolute right-5 top-40 h-48 w-24 rounded-[8px] border border-white/10 bg-black/25 shadow-xl shadow-black/20 backdrop-blur-sm">
              <div className="mx-auto mt-5 h-20 w-16 rounded-[8px] bg-white/12" />
              <div className="mx-auto mt-5 h-16 w-16 rounded-[8px] bg-amber-100/18" />
            </div>
            <div className="absolute left-16 top-36 w-64 text-center text-[32px] font-black leading-tight text-white/38 drop-shadow-[0_4px_16px_rgba(0,0,0,0.65)]">
              潮玩拍卖<br />球鞋专场
            </div>
            <div className="absolute left-1/2 top-[25%] h-28 w-24 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_45%_35%,#f0c5aa,#b98268_70%)] shadow-2xl shadow-black/35" />
            <div className="absolute left-1/2 top-[36%] h-64 w-44 -translate-x-1/2 rounded-t-[80px] bg-[#111318] shadow-2xl shadow-black/50" />
            <div className="absolute left-[28%] top-[47%] h-16 w-48 -rotate-6 rounded-full bg-[#17191f] shadow-xl shadow-black/35" />
            <div className="absolute left-[20%] top-[39%] h-24 w-56 rotate-[-8deg] rounded-[28px] border border-white/18 bg-white/86 p-2 shadow-2xl shadow-black/40">
              <img
                src={heroImage}
                alt={roomProduct?.title || '直播间模拟场景'}
                className="h-full w-full rounded-[20px] object-cover"
              />
            </div>
          </>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/76 via-black/6 to-black/92" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.62),transparent_42%,rgba(0,0,0,0.45))]" />
        <div className="absolute inset-x-0 top-0 z-20 flex h-9 items-center justify-between px-5 pt-2 text-sm font-semibold text-white/95 sm:hidden">
          <span>20:15</span>
          <span className="tracking-[0.18em]">▮▮▮  WiFi  73</span>
        </div>

        <header className={LIVE_ROOM_TOP_CLASS}>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 rounded-full bg-black/36 px-2 py-2 shadow-lg shadow-black/20 backdrop-blur-xl">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-rose-400 bg-gradient-to-br from-rose-200 via-amber-200 to-emerald-200 text-xs font-black text-zinc-950 shadow-lg shadow-rose-950/30">
                  拍
                </div>
                <div className="min-w-0 flex-1">
                  <span className="sr-only">拍场主理人</span>
                  <div className="truncate text-base font-black">潮玩拍卖馆</div>
                  <div className="truncate text-xs text-white/68">围观 {Math.max(86_000, bidCount * 2300 + 86_000).toLocaleString('zh-CN')} · {CONNECTION_TEXT[connectionState]}</div>
                </div>
                <button
                  type="button"
                  aria-label="刷新直播状态"
                  onClick={refreshRoom}
                  disabled={!isValidAuctionId || !accessToken}
                  className="h-8 w-8 shrink-0 rounded-full border border-white/12 bg-white/10 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  刷
                </button>
                <button
                  type="button"
                  className="h-9 shrink-0 rounded-full bg-rose-500 px-4 text-sm font-black text-white shadow-lg shadow-rose-950/35"
                >
                  关注
                </button>
              </div>
            </div>
            <div className="hidden shrink-0 items-center -space-x-2 sm:flex">
              <span className="h-8 w-8 rounded-full border border-white/50 bg-white/45" />
              <span className="h-8 w-8 rounded-full border border-white/50 bg-sky-200/55" />
              <span className="h-8 w-8 rounded-full border border-white/50 bg-amber-200/55" />
            </div>
            <span className="hidden rounded-full bg-black/35 px-3 py-2 text-sm font-bold backdrop-blur sm:inline-flex">8.6万</span>
            <PageBackButton
              fallback="/app/auctions"
              ariaLabel="关闭直播间"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/24 text-4xl font-light leading-none text-white/90 backdrop-blur"
            >
              ×
            </PageBackButton>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 overflow-hidden">
            <span className="sr-only">LIVE</span>
            <span className="shrink-0 rounded-full bg-rose-500 px-3 py-1.5 text-xs font-black shadow-lg shadow-rose-950/30">▮ 直播中</span>
            <span className="shrink-0 rounded-full bg-black/38 px-3 py-1.5 text-xs font-semibold text-amber-100 backdrop-blur-xl">古玩榜第 8 名</span>
            <span className="shrink-0 rounded-full bg-black/38 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-xl">更多直播 ›</span>
            <span className="min-w-0 truncate rounded-full bg-black/38 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-xl">{displayStatus}</span>
          </div>
        </header>

        <section className="absolute left-3 right-16 top-32 z-10">
          <div className="flex max-w-full flex-col gap-1">
            {displayedRankings.map((item, index) => (
              <RankingPill key={`${item.user_id}-${item.amount}`} item={item} displayRank={index + 1} />
            ))}
          </div>
        </section>

        <section className={LIVE_ROOM_MESSAGE_CLASS} aria-live="polite">
          <h2 className="sr-only">实时消息</h2>
          <ul
            ref={messageFeedRef}
            data-testid="live-room-message-feed"
            className="max-h-36 space-y-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {roomMessages.map((item) => (
              <li
                key={item.id}
                className={`rounded-full px-3 py-1.5 text-sm leading-relaxed shadow-lg backdrop-blur-xl ${
                  item.type === 'outbid'
                    ? 'border border-rose-300/50 bg-rose-500/28 text-rose-50'
                    : 'bg-black/38 text-white/86'
                }`}
              >
                {item.message}
              </li>
            ))}
          </ul>
        </section>

        <aside className="absolute left-3 top-[38%] z-20 flex -translate-y-1/2 flex-col items-center gap-2">
          <ActionRailButton label="人气榜" value="人气榜" icon="trophy" />
          <ActionRailButton label="点赞" value="12.8w" icon="heart" />
          <ActionRailButton label="礼物" value="礼物" icon="spark" />
          <ActionRailButton label="分享" value="168" icon="share" />
        </aside>

        <section className={LIVE_ROOM_FLOATING_CARD_CLASS}>
          <div
            data-testid="live-room-auction-card"
            className={`overflow-hidden rounded-[20px] border text-white shadow-2xl shadow-black/55 backdrop-blur-2xl ${
              terminal
                ? 'border-amber-200/35 bg-black/66'
                : isOutbid
                  ? 'border-rose-300/70 bg-black/72 ring-2 ring-rose-400/45'
                  : isLeading
                    ? 'border-amber-200/65 bg-black/68 ring-2 ring-amber-200/30'
                    : urgent
                      ? 'border-rose-300/65 bg-black/70 ring-2 ring-rose-500/45'
                      : 'border-white/18 bg-black/62'
            }`}
          >
            <div className="px-3 pb-3 pt-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${
                    terminal
                      ? 'bg-amber-300 text-zinc-950'
                      : isOutbid
                        ? 'bg-rose-500 text-white'
                        : isLeading
                          ? 'bg-amber-300 text-zinc-950'
                          : 'bg-white/14 text-white'
                  }`}>
                    {terminal
                      ? roomStatus === 'ended_sold' ? '落槌成交' : displayStatus
                      : isOutbid
                        ? '你已被超越'
                        : isLeading
                          ? '领先中'
                          : '正在竞拍'}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-white/54">拍品编号 {lotId}</div>
                </div>
                <span className="shrink-0 rounded-full border border-white/12 bg-white/10 px-2 py-1 text-[11px] font-black text-white/90">
                  {bidCount > 0 ? `${bidCount}次` : '首拍'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-[58px_minmax(0,1fr)] gap-2">
                <img src={heroImage} alt="" className="h-[58px] w-[58px] rounded-[14px] border border-white/14 object-cover shadow-lg shadow-black/35" />
                <div className="min-w-0">
                  <h1 className="line-clamp-2 break-words text-sm font-black leading-snug text-white">
                    {roomProduct?.title || (isHydrating ? '恢复登录中...' : '直播竞拍间')}
                  </h1>
                  <div className="mt-1 text-[11px] font-semibold text-white/58">
                    加价 {formatIncrement(roomBidIncrementType, roomBidIncrementValue, stepAmount)}
                  </div>
                </div>
              </div>
            </div>

            <div className={`${terminal ? 'bg-amber-300/14' : 'bg-white/[0.07]'} border-y border-white/10 px-3 py-3`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-black text-white/62">
                  {terminal ? '成交价' : shelfPriceLabel(roomStatus, bidCount)}
                </span>
                {!terminal && urgent ? (
                  <span className="rounded-full bg-rose-500/22 px-2 py-1 text-[10px] font-black text-rose-100">最后冲刺</span>
                ) : null}
              </div>
              <div
                className={`mt-1 whitespace-nowrap font-black leading-none tabular-nums transition duration-300 ${
                  terminal
                    ? 'text-[30px] text-amber-100'
                    : `text-[31px] ${pricePulse ? 'scale-[1.03] text-amber-100 drop-shadow-[0_0_14px_rgba(255,214,128,0.72)] animate-pulse' : 'text-white'}`
                }`}
              >
                {formatPrice(terminal ? (roomFinalPrice ?? roomCurrentPrice) : roomCurrentPrice)}
              </div>
              {pricePulse && !terminal ? (
                <div role="status" aria-live="polite" className="mt-1 text-[11px] font-black text-amber-100">
                  价格已更新
                </div>
              ) : null}
              {isLeading && !terminal ? (
                <div className="mt-2 rounded-md border border-amber-200/18 bg-amber-200/15 px-2 py-1 text-[11px] font-black text-amber-100">
                  保持领先，等待落槌
                </div>
              ) : null}
              {isOutbid && !terminal ? (
                <div className="mt-2 rounded-md border border-rose-200/24 bg-rose-500/26 px-2 py-1 text-[11px] font-black text-rose-50">
                  立即追回，下一口 {formatPrice(roomNextBidAmount)}
                </div>
              ) : null}
              {terminal ? (
                <div className="mt-2 rounded-md border border-white/10 bg-black/24 px-2 py-1 text-[11px] font-bold text-white/70">
                  {isWinner ? '你已中标，前往订单确认' : roomStatus === 'ended_sold' ? '本场已落槌，继续关注下一件' : '本场竞拍已结束'}
                </div>
              ) : (
                <button type="button" className="mt-2 rounded-full border border-white/18 bg-white/8 px-2 py-1 text-[11px] font-bold text-white/86">
                  出价记录 ›
                </button>
              )}
            </div>

            {!terminal ? (
              <div className="px-3 py-2">
                <div className="flex items-end justify-between gap-2">
                  <span className="text-[12px] font-semibold text-white/56">距落槌</span>
                  <span className={`font-mono text-[26px] font-black leading-none tabular-nums ${urgent ? 'text-rose-300 animate-pulse' : 'text-amber-100'}`}>
                    {formatCountdown(countdownMs)}
                  </span>
                </div>
                {roomCurrentExtendCount > 0 ? (
                  <div className="mt-2 rounded-md border border-amber-200/20 bg-amber-200/14 px-2 py-1 text-[11px] font-bold text-amber-100">
                    Soft Close 已延时 {roomCurrentExtendCount} 次
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              aria-label="打开出价面板"
              disabled={!isCurrentRoom || terminal}
              onClick={openBidSheet}
              className={`${PRIMARY_ACTION_CLASS} h-[52px] w-full border-t border-white/10 px-3 py-3 text-lg font-black text-white hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-white/42 ${
                terminal
                  ? 'bg-white/8'
                  : isLeading
                    ? 'bg-gradient-to-r from-amber-300 to-orange-400 text-zinc-950'
                    : isOutbid
                      ? 'bg-gradient-to-r from-rose-500 to-red-500'
                      : 'bg-gradient-to-r from-rose-500 to-orange-400'
              } ${pressedAction === 'bid' ? 'scale-[0.98] brightness-110' : ''}`}
            >
              {terminal ? '竞拍已结束' : floatingActionText === '立即出价' ? '立即出价' : floatingActionText}
            </button>
          </div>
        </section>

        <footer className={LIVE_ROOM_BOTTOM_CLASS}>
          <div className="flex items-center gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">直播间评论</span>
              <input
                aria-label="直播间评论"
                disabled
                placeholder="说点什么..."
                className="h-10 w-full rounded-lg border border-white/10 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/55"
              />
            </label>
            <button
              type="button"
              aria-label="打开商品橱窗"
              onClick={() => {
                setBidSheetOpen(false);
                markPressed('shelf');
                setShelfOpen(true);
              }}
              className={`${TILE_BUTTON_CLASS} relative flex h-12 w-12 flex-col items-center justify-center text-[11px] font-black text-white ${
                pressedAction === 'shelf' ? 'scale-95 ring-2 ring-white/50 brightness-110' : ''
              }`}
            >
              <span className="absolute -right-1 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-black text-white">24</span>
              商品
            </button>
            <button
              type="button"
              aria-label="底部竞拍入口"
              disabled={!isCurrentRoom || terminal}
              onClick={openBidSheet}
              className={`${PRIMARY_ACTION_CLASS} flex h-12 w-12 flex-col items-center justify-center rounded-[8px] bg-gradient-to-br from-amber-200 to-rose-400 text-[11px] font-black text-zinc-950 shadow-lg shadow-black/20 disabled:cursor-not-allowed disabled:from-white/18 disabled:to-white/18 disabled:text-white/45 ${
                pressedAction === 'bid' ? 'scale-95 ring-2 ring-white/60 brightness-110' : ''
              }`}
            >
              竞拍
            </button>
            <Link
              to="/app/orders"
              aria-label="查看我的订单"
              className={`${TILE_BUTTON_CLASS} flex h-12 w-12 flex-col items-center justify-center text-[11px] font-black text-white`}
            >
              订单
            </Link>
          </div>
        </footer>

        {shelfOpen ? (
          <div className="absolute inset-0 z-40 bg-black/45" onClick={() => setShelfOpen(false)}>
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="shelf-title"
              className="absolute bottom-0 left-0 right-0 max-h-[76vh] overflow-y-auto rounded-t-xl bg-white px-3 pb-5 pt-3 text-zinc-950 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 id="shelf-title" className="text-lg font-black">商品橱窗</h2>
                  <p className="text-xs text-zinc-500">
                    <span>进主播橱窗 · </span>
                    <span>当前拍品实时竞拍，其他为演示货架</span>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="关闭商品橱窗"
                  onClick={() => setShelfOpen(false)}
                  className="h-9 w-9 rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-black text-zinc-700"
                >
                  X
                </button>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs text-zinc-500">
                <span className="rounded bg-rose-50 px-2 py-1 font-bold text-rose-500">带货口碑 5.0高</span>
                <span className="rounded bg-amber-50 px-2 py-1 font-bold text-amber-700">安心购</span>
                <span className="rounded bg-sky-50 px-2 py-1 font-bold text-sky-700">拍卖保障</span>
              </div>
              <div className="space-y-2 overflow-y-auto">
                <button
                  type="button"
                  onClick={openBidSheet}
                  className="grid w-full grid-cols-[72px_minmax(0,1fr)_76px] items-center gap-3 rounded-lg border border-rose-100 bg-rose-50/70 p-2 text-left shadow-sm"
                >
                  <img src={heroImage} alt="" className="h-[72px] w-[72px] shrink-0 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="inline-flex rounded bg-rose-500 px-2 py-1 text-xs font-black text-white">{roomStatus ? STATUS_TEXT[roomStatus] : '竞拍中'}</span>
                    <span className="mt-1 block line-clamp-2 text-sm font-black text-zinc-950">{roomProduct?.title || '当前竞拍商品'}</span>
                    <span className="mt-1 block text-xs text-zinc-500">{shelfPriceLabel(roomStatus, bidCount)}</span>
                    <span className="block text-lg font-black text-rose-500">{formatPrice(roomCurrentPrice)}</span>
                  </span>
                  <span className="flex h-10 shrink-0 items-center justify-center rounded bg-rose-500 px-2 text-xs font-black text-white">立即出价</span>
                </button>
                {SHELF_DEMO_ITEMS.map((item) => (
                  <div key={item.title} className="grid grid-cols-[72px_minmax(0,1fr)_76px] items-center gap-3 rounded-lg border border-zinc-100 bg-white p-2 shadow-sm">
                    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-black text-zinc-500">
                      预览
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`inline-flex rounded px-2 py-1 text-xs font-black text-white ${item.action === '已结束' ? 'bg-zinc-300' : 'bg-rose-500'}`}>
                        {item.state}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900">{item.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">{item.priceLabel}</div>
                      <div className="text-lg font-black text-rose-500">{item.price}</div>
                      <div className="text-[11px] text-zinc-400">{item.note}</div>
                    </div>
                    <div className={`flex h-10 items-center justify-center rounded px-2 text-xs font-black text-white ${item.action === '已结束' ? 'bg-rose-300' : 'bg-rose-500'}`}>
                      {item.action}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {bidSheetOpen ? (
          <div className="absolute inset-0 z-50 bg-black/48" onClick={() => setBidSheetOpen(false)}>
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="bid-sheet-title"
              className="absolute bottom-0 left-0 right-0 max-h-[76vh] overflow-y-auto rounded-t-xl bg-gradient-to-br from-rose-50 via-white to-sky-50 px-4 pb-5 pt-4 text-zinc-950 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="w-9" aria-hidden="true" />
                <div className="min-w-0 text-center">
                  <h2 id="bid-sheet-title" className="sr-only">竞拍出价</h2>
                  <div className="text-lg font-black">{sheetTimerText}</div>
                </div>
                <button
                  type="button"
                  aria-label="关闭出价面板"
                  onClick={() => setBidSheetOpen(false)}
                  className="h-9 w-9 shrink-0 rounded-lg border border-zinc-200 bg-white text-sm font-black text-zinc-700"
                >
                  X
                </button>
              </div>

              <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-3">
                <img src={heroImage} alt={roomProduct?.title || '竞拍商品'} className="h-[84px] w-[84px] shrink-0 rounded-lg object-cover shadow" />
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1">
                    <span className="rounded bg-rose-500 px-2 py-1 text-xs font-black text-white">{displayStatus}</span>
                    <span className="rounded bg-white px-2 py-1 text-xs font-bold text-zinc-500 shadow-sm">
                      拍品编号 {lotId}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-base font-black leading-snug">{roomProduct?.title || '等待商品快照'}</p>
                  <div className="mt-3 grid grid-cols-2 divide-x divide-zinc-200 rounded-lg bg-white/70 p-3 shadow-sm">
                    <div className="pr-3">
                      <div className="text-xs text-zinc-500">当前价</div>
                      <div className="mt-1 text-2xl font-black tabular-nums text-zinc-950">{formatPrice(roomCurrentPrice)}</div>
                    </div>
                    <div className="pl-3">
                      <div className="text-xs text-zinc-500">我的出价</div>
                      <div className={`mt-1 text-xl font-black tabular-nums ${ownRanking ? 'text-rose-500' : 'text-zinc-400'}`}>{myBidDisplay}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`mx-auto mt-4 w-fit rounded-md px-3 py-1 text-xs font-black text-white shadow ${
                isOutbid
                  ? 'bg-rose-500'
                  : isLeading
                    ? 'bg-rose-400'
                    : bidError
                      ? 'bg-rose-600'
                      : 'bg-rose-400'
              }`}>
                {stateChipText}
              </div>

              {roomCurrentExtendCount > 0 ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                  Soft Close 已触发 {roomCurrentExtendCount} 次延时
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-3">
                <button
                  type="button"
                  aria-label="减少出价金额"
                  disabled={bidDisabled || isLeading}
                  onClick={() => adjustCustomAmount(-1)}
                  className={`${PRESSABLE_CLASS} h-12 rounded-lg border border-zinc-200 bg-white text-2xl font-black text-zinc-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  -
                </button>
                <label className="min-w-0">
                  <span className="sr-only">自定义出价金额</span>
                  <input
                    aria-label="自定义出价金额"
                    inputMode="decimal"
                    value={customAmount}
                    onChange={(event) => setCustomAmount(event.target.value)}
                    placeholder={formatPrice(primaryBidAmount)}
                    className="h-16 w-full rounded-lg border-0 bg-transparent px-3 text-center text-[42px] font-black leading-none text-zinc-950 outline-none transition placeholder:text-zinc-950 focus:bg-white/75"
                  />
                  <span className="mt-1 block text-center text-sm text-zinc-500">
                    加价幅度 {formatIncrement(roomBidIncrementType, roomBidIncrementValue, stepAmount)}
                  </span>
                </label>
                <button
                  type="button"
                  aria-label="增加出价金额"
                  disabled={bidDisabled || isLeading}
                  onClick={() => adjustCustomAmount(1)}
                  className={`${PRESSABLE_CLASS} h-12 rounded-lg border border-zinc-200 bg-white text-2xl font-black text-zinc-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={bidDisabled || isLeading}
                onClick={() => submitBid(primaryBidAmount)}
                className={`${PRIMARY_ACTION_CLASS} mt-4 h-14 w-full rounded-full bg-gradient-to-r from-rose-500 to-red-500 px-4 text-lg font-black text-white shadow-lg shadow-rose-500/25 hover:from-rose-400 hover:to-red-400 disabled:cursor-not-allowed disabled:from-zinc-200 disabled:to-zinc-200 disabled:text-zinc-500 disabled:shadow-none`}
              >
                {sheetPrimaryText}
              </button>

              <button
                type="button"
                disabled={bidDisabled || isLeading || !hasCustomAmount}
                onClick={() => submitBid(customBidAmount)}
                className={`${PRESSABLE_CLASS} mt-2 h-11 w-full rounded-full border border-rose-200 bg-white px-3 text-sm font-bold text-rose-500 shadow-sm hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400`}
              >
                确认自定义出价
              </button>

              {bidError ? (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600">
                  {bidError}
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        {showResultModal ? (
          <div className="absolute inset-0 z-[60] flex items-center bg-black/68 px-5 py-8 backdrop-blur-sm">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="result-title"
              className="relative w-full rounded-xl bg-gradient-to-br from-rose-50 via-white to-sky-50 text-center text-zinc-950 shadow-2xl"
            >
              <div className="absolute -top-12 left-0 right-0 text-center text-3xl font-black text-white drop-shadow-lg">
                {isWinner ? '恭喜竞拍成功' : roomStatus === 'ended_sold' ? '落槌定音' : displayStatus}
              </div>
              <div className="max-h-[82vh] overflow-y-auto p-5">
                <div className="mx-auto mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
                  {displayStatus}
                </div>
                <h2 id="result-title" className="sr-only">竞拍结果</h2>
                <p className="text-sm leading-relaxed text-zinc-600">
                  {isWinner
                    ? '恭喜竞拍成功，请前往订单确认并完成模拟支付。'
                    : roomStatus === 'ended_sold'
                      ? '本场拍品已落槌，您未中标，可以继续关注其他拍品。'
                      : roomStatus === 'ended_no_bid'
                        ? '本场暂无有效出价，拍品已流拍。'
                        : '本场竞拍已取消，相关冻结金额会按规则释放。'}
                </p>
                <div className="mt-4 rounded-xl bg-white p-4 text-left shadow-sm">
                  <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
                    <img src={heroImage} alt="" className="h-[72px] w-[72px] rounded-lg object-cover" />
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-sm font-black">{roomProduct?.title || '竞拍商品'}</div>
                      <div className="mt-2 text-xs text-zinc-500">{isWinner ? '保证金 · 拍品付款后退回' : '最终成交价'}</div>
                      <div className="mt-1 text-3xl font-black text-amber-700 tabular-nums">
                        {formatPrice(roomFinalPrice ?? roomCurrentPrice)}
                      </div>
                    </div>
                  </div>
                  {roomTerminalMessage ? (
                    <div className="mt-3 rounded bg-zinc-50 px-3 py-2 text-xs text-zinc-500">{roomTerminalMessage}</div>
                  ) : null}
                </div>
                <div className="mt-4 flex gap-2">
                  {isWinner ? (
                    <Link
                      to="/app/orders"
                      className="flex h-12 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-rose-400 to-rose-600 px-3 text-sm font-black text-white shadow-lg shadow-rose-500/25"
                    >
                      查看中标订单
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setResultDismissed(true)}
                    className="h-12 flex-1 rounded-full border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700"
                  >
                    继续看拍品
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
