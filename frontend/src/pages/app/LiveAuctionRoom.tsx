import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
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

function ActionRailButton({
  label,
  value,
  children,
  onClick,
}: {
  label: string;
  value: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex w-10 flex-col items-center gap-1 text-white drop-shadow"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/35 text-xs font-black backdrop-blur">
        {children}
      </span>
      <span className="max-w-10 truncate text-[10px] font-semibold">{value}</span>
    </button>
  );
}

function RankingPill({ item }: { item: RankingItem }) {
  return (
    <li className="flex h-8 min-w-0 items-center gap-2 rounded bg-black/35 px-2 backdrop-blur">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-300 text-[11px] font-black text-zinc-950">
        {item.rank}
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
  const nowTick = useClockTick();

  const isValidAuctionId = Number.isFinite(auctionId) && auctionId > 0;
  const isCurrentRoom = isValidAuctionId && storeAuctionId === auctionId;
  const roomProduct = isCurrentRoom ? product : undefined;
  const roomStatus = isCurrentRoom ? status : undefined;
  const roomCurrentPrice = isCurrentRoom ? currentPrice : 0;
  const roomHighestBidderId = isCurrentRoom ? highestBidderId : undefined;
  const roomEndedAt = isCurrentRoom ? endedAt : undefined;
  const roomCurrentExtendCount = isCurrentRoom ? currentExtendCount : 0;
  const roomBidIncrementType = isCurrentRoom ? bidIncrementType : undefined;
  const roomBidIncrementValue = isCurrentRoom ? bidIncrementValue : 0;
  const roomNextBidAmount = isCurrentRoom ? nextBidAmount : 0;
  const roomRankings = isCurrentRoom ? rankings : [];
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
    const realtimeMessages = roomNotifications.slice(0, 4).map((item) => ({
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
    setShelfOpen(false);
    setBidSheetOpen(true);
  }

  const showResultModal = isCurrentRoom && terminal && !resultDismissed;

  return (
    <div className="min-h-screen bg-neutral-950 text-white lg:grid lg:place-items-center lg:px-6 lg:py-6">
      <main className="relative mx-auto h-[100svh] min-h-[640px] w-full max-w-[430px] overflow-hidden bg-black shadow-2xl shadow-black/50 lg:h-[860px] lg:min-h-0 lg:rounded-lg lg:border lg:border-white/10">
        <img
          src={heroImage}
          alt={roomProduct?.title || '直播间模拟场景'}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/10 to-black/88" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.55),transparent_34%,rgba(0,0,0,0.28))]" />

        <header className="absolute left-0 right-0 top-0 z-20 px-3 pt-3">
          <div className="flex items-center gap-2">
            <PageBackButton fallback="/app/auctions" className="h-9 shrink-0 border-white/10 bg-black/30 px-2 py-1 text-xs" />
            <div className="min-w-0 flex-1 rounded-lg bg-black/30 px-2 py-2 backdrop-blur">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 via-amber-300 to-emerald-300 text-xs font-black text-zinc-950">
                  拍
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">拍场主理人</div>
                  <div className="truncate text-[11px] text-white/60">在线 {Math.max(128, bidCount * 23 + 128)} 人 · {CONNECTION_TEXT[connectionState]}</div>
                </div>
                <button
                  type="button"
                  aria-label="刷新直播状态"
                  onClick={refreshRoom}
                  disabled={!isValidAuctionId || !accessToken}
                  className="h-7 w-7 shrink-0 rounded border border-white/12 bg-white/10 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  刷
                </button>
                <button
                  type="button"
                  className="h-7 shrink-0 rounded bg-white px-2 text-xs font-bold text-zinc-950"
                >
                  关注
                </button>
              </div>
            </div>
          </div>

          <div className="mt-2 flex gap-1 overflow-hidden">
            <span className="shrink-0 rounded bg-rose-500 px-2 py-1 text-[11px] font-black">LIVE</span>
            <span className="shrink-0 rounded bg-black/35 px-2 py-1 text-[11px] text-amber-100 backdrop-blur">小时榜 Top 8</span>
            <span className="shrink-0 rounded bg-black/35 px-2 py-1 text-[11px] text-emerald-100 backdrop-blur">好物热拍</span>
            <span className="min-w-0 truncate rounded bg-black/35 px-2 py-1 text-[11px] text-white/85 backdrop-blur">{displayStatus}</span>
          </div>
        </header>

        <section className="absolute left-3 right-16 top-28 z-10">
          <div className="flex max-w-full flex-col gap-1">
            {roomRankings.slice(0, 3).map((item) => <RankingPill key={`${item.rank}-${item.user_id}-${item.amount}`} item={item} />)}
          </div>
        </section>

        <section className="absolute bottom-28 left-3 z-20 w-[44%] max-w-[180px]" aria-live="polite">
          <h2 className="sr-only">实时消息</h2>
          <ul className="space-y-1">
            {roomMessages.map((item) => (
              <li
                key={item.id}
                className={`rounded px-2 py-1 text-xs leading-relaxed shadow backdrop-blur ${
                  item.type === 'outbid'
                    ? 'border border-rose-300/50 bg-rose-500/28 text-rose-50'
                    : 'bg-black/32 text-white/82'
                }`}
              >
                {item.message}
              </li>
            ))}
          </ul>
        </section>

        <aside className="absolute right-3 top-40 z-20 flex flex-col items-center gap-2">
          <ActionRailButton label="点赞" value="12.8w">赞</ActionRailButton>
          <ActionRailButton label="礼物" value="礼物">礼</ActionRailButton>
          <ActionRailButton label="分享" value="分享">享</ActionRailButton>
          <ActionRailButton label="热度榜" value="榜单">榜</ActionRailButton>
          <ActionRailButton label="优惠券" value="领券">券</ActionRailButton>
        </aside>

        <section className="absolute bottom-28 right-3 z-30 w-[48%] min-w-[184px] max-w-[206px]">
          <div className={`overflow-hidden rounded-lg bg-white text-zinc-950 shadow-2xl shadow-black/45 ${
            isOutbid
              ? 'ring-2 ring-rose-300/80'
              : urgent
                ? 'ring-2 ring-rose-400/75'
                : 'ring-1 ring-white/35'
          }`}>
            <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-2">
              <span className="text-sm font-black">{roomStatus === 'active' ? '正在竞拍' : displayStatus}</span>
              <span className="shrink-0 rounded-full bg-rose-500 px-2 py-1 text-[11px] font-black text-white">
                {bidCount > 0 ? `${bidCount}次出价` : '等待首拍'}
              </span>
            </div>
            <div className="px-3 text-[11px] font-medium text-zinc-500">拍品编号：{lotId}</div>
            <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2 px-3 py-2">
              <img src={heroImage} alt="" className="h-[52px] w-[52px] rounded-lg border border-zinc-200 object-cover" />
              <div className="min-w-0">
                <h1 className="line-clamp-2 break-words text-sm font-black leading-snug">
                  {roomProduct?.title || (isHydrating ? '恢复登录中...' : '直播竞拍间')}
                </h1>
                <div className="mt-1 text-[11px] font-medium text-zinc-500">
                  加价 {formatIncrement(roomBidIncrementType, roomBidIncrementValue, stepAmount)}
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 px-3 py-3 text-white">
              <div className="text-[12px] font-semibold text-white/80">{shelfPriceLabel(roomStatus, bidCount)}</div>
              <div className="mt-1 whitespace-nowrap text-[30px] font-black leading-none tabular-nums">{formatPrice(roomCurrentPrice)}</div>
              <button type="button" className="mt-2 rounded-full border border-white/20 px-2 py-1 text-[11px] font-bold text-white/90">
                出价记录 ›
              </button>
            </div>
            <div className="bg-white px-3 py-2">
              <div className="flex items-end justify-between gap-2">
                <span className="text-[12px] font-semibold text-zinc-500">倒计时</span>
                <span className={`font-mono text-[30px] font-black leading-none tabular-nums ${urgent ? 'text-rose-500' : 'text-rose-400'}`}>
                  {formatCountdown(countdownMs)}
                </span>
              </div>
              {roomCurrentExtendCount > 0 ? (
                <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                  Soft Close 已延时 {roomCurrentExtendCount} 次
                </div>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="打开出价面板"
              disabled={!isCurrentRoom || terminal}
              onClick={openBidSheet}
              className="h-12 w-full bg-rose-500 px-3 text-xl font-black text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
            >
              {floatingActionText === '立即出价' ? '出价' : floatingActionText}
            </button>
          </div>
        </section>

        <footer className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-black/82 to-transparent px-3 pb-3 pt-10">
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
                setShelfOpen(true);
              }}
              className="h-10 w-12 rounded-lg border border-white/12 bg-white/12 text-sm font-bold text-white"
            >
              商品
            </button>
            <button
              type="button"
              aria-label="底部竞拍入口"
              disabled={!isCurrentRoom || terminal}
              onClick={openBidSheet}
              className="h-10 w-12 rounded-lg bg-amber-300 text-sm font-black text-zinc-950 disabled:cursor-not-allowed disabled:bg-white/18 disabled:text-white/45"
            >
              竞拍
            </button>
            <Link
              to="/app/orders"
              aria-label="查看我的订单"
              className="flex h-10 w-12 items-center justify-center rounded-lg border border-white/12 bg-white/12 text-sm font-bold text-white"
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
              className="absolute bottom-0 left-0 right-0 max-h-[72vh] rounded-t-xl bg-white px-3 pb-5 pt-3 text-zinc-950 shadow-2xl"
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
              className="absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-y-auto rounded-t-xl bg-gradient-to-br from-rose-50 via-white to-sky-50 px-4 pb-5 pt-4 text-zinc-950 shadow-2xl"
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
                  className="h-12 rounded-md border border-zinc-200 bg-white text-2xl font-black text-zinc-500 shadow-sm disabled:cursor-not-allowed disabled:opacity-35"
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
                  className="h-12 rounded-md border border-zinc-200 bg-white text-2xl font-black text-zinc-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-35"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={bidDisabled || isLeading}
                onClick={() => submitBid(primaryBidAmount)}
                className="mt-4 h-14 w-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600 px-4 text-lg font-black text-white shadow-lg shadow-rose-500/25 transition hover:from-rose-300 hover:to-rose-500 disabled:cursor-not-allowed disabled:from-zinc-200 disabled:to-zinc-200 disabled:text-zinc-500 disabled:shadow-none"
              >
                {sheetPrimaryText}
              </button>

              <button
                type="button"
                disabled={bidDisabled || isLeading || !hasCustomAmount}
                onClick={() => submitBid(customBidAmount)}
                className="mt-2 h-11 w-full rounded-full border border-rose-200 bg-white px-3 text-sm font-bold text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
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
              className="relative w-full rounded-xl bg-gradient-to-br from-rose-50 via-white to-sky-50 p-5 text-center text-zinc-950 shadow-2xl"
            >
              <div className="absolute -top-12 left-0 right-0 text-center text-3xl font-black text-white drop-shadow-lg">
                {isWinner ? '恭喜竞拍成功' : roomStatus === 'ended_sold' ? '落槌定音' : displayStatus}
              </div>
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
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
