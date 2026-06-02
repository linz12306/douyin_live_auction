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
  { title: '限定彩妆套组', state: '即将开拍', price: '预估 ¥168.00', note: '演示货架' },
  { title: '复古银饰手链', state: '竞拍未成交', price: '等待重拍', note: '演示货架' },
  { title: '潮流球鞋挂件', state: '竞拍结束', price: '落槌 ¥299.00', note: '演示货架' },
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

  const bidStateText = useMemo(() => {
    if (terminal) return roomTerminalMessage || '本场竞拍已结束';
    if (pending) return '竞拍尚未开始，先看规则和拍品';
    if (!active) return '等待实时快照同步';
    if (isLeading) return '当前您是最高价';
    if (isOutbid) return latestOutbid?.message || '您已被超过，请及时追回';
    if (ownRanking) return `我的排名 第 ${ownRanking.rank}`;
    return '尚未出价，抢先举牌';
  }, [active, isLeading, isOutbid, latestOutbid, ownRanking, pending, roomTerminalMessage, terminal]);

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

        <section className="absolute bottom-28 right-3 z-30 w-[46%] min-w-[178px]">
          <div className={`rounded-lg border p-3 shadow-xl backdrop-blur ${
            isOutbid
              ? 'border-rose-300/60 bg-rose-950/76'
              : urgent
                ? 'border-amber-200/70 bg-amber-950/72'
                : 'border-white/15 bg-zinc-950/76'
          }`}>
            <div className="flex items-center justify-between gap-2 text-[11px] text-white/65">
              <span className="truncate">当前拍品</span>
              <span className="shrink-0">{bidCount > 0 ? `${bidCount} 人出价` : '等待首拍'}</span>
            </div>
            <h1 className="mt-1 line-clamp-2 break-words text-sm font-black leading-snug">
              {roomProduct?.title || (isHydrating ? '恢复登录中...' : '直播竞拍间')}
            </h1>
            <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
              <div>
                <div className="text-[11px] text-white/55">当前价</div>
                <div className="break-words text-xl font-black text-emerald-200">{formatPrice(roomCurrentPrice)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-white/55">倒计时</div>
                <div className={`font-mono text-lg font-black ${urgent ? 'text-rose-100' : 'text-amber-200'}`}>
                  {formatCountdown(countdownMs)}
                </div>
              </div>
            </div>
            {roomCurrentExtendCount > 0 ? (
              <div className="mt-2 rounded border border-amber-200/35 bg-amber-300/12 px-2 py-1 text-[11px] text-amber-100">
                已延时 {roomCurrentExtendCount} 次
              </div>
            ) : null}
            <button
              type="button"
              aria-label="打开出价面板"
              disabled={!isCurrentRoom || terminal}
              onClick={openBidSheet}
              className="mt-3 h-10 w-full rounded-lg bg-emerald-300 px-3 text-sm font-black text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-white/18 disabled:text-white/45"
            >
              {floatingActionText}
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
              className="absolute bottom-0 left-0 right-0 max-h-[68vh] rounded-t-lg bg-zinc-950 px-4 pb-5 pt-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 id="shelf-title" className="text-lg font-black">商品橱窗</h2>
                  <p className="text-xs text-white/50">当前拍品实时竞拍，其他为演示货架</p>
                </div>
                <button
                  type="button"
                  aria-label="关闭商品橱窗"
                  onClick={() => setShelfOpen(false)}
                  className="h-9 w-9 rounded-lg border border-white/12 bg-white/8 text-sm font-black"
                >
                  X
                </button>
              </div>
              <div className="space-y-2 overflow-y-auto">
                <button
                  type="button"
                  onClick={openBidSheet}
                  className="flex w-full items-center gap-3 rounded-lg border border-emerald-300/45 bg-emerald-300/10 p-3 text-left"
                >
                  <img src={heroImage} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-emerald-200">{roomStatus ? STATUS_TEXT[roomStatus] : '竞拍中'}</span>
                    <span className="mt-1 block truncate text-sm font-bold text-white">{roomProduct?.title || '当前竞拍商品'}</span>
                    <span className="mt-1 block text-xs text-white/55">实时竞拍 · {formatPrice(roomCurrentPrice)}</span>
                  </span>
                  <span className="shrink-0 rounded bg-emerald-300 px-2 py-1 text-xs font-black text-zinc-950">去出价</span>
                </button>
                {SHELF_DEMO_ITEMS.map((item) => (
                  <div key={item.title} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/6 p-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-white/10 text-xs font-black text-white/65">
                      预览
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-amber-100">{item.state}</div>
                      <div className="mt-1 truncate text-sm font-semibold text-white">{item.title}</div>
                      <div className="mt-1 text-xs text-white/45">{item.price} · {item.note}</div>
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
              className="absolute bottom-0 left-0 right-0 max-h-[78vh] rounded-t-lg bg-zinc-950 px-4 pb-5 pt-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="bid-sheet-title" className="text-lg font-black">竞拍出价</h2>
                  <p className="mt-1 truncate text-sm text-white/55">{roomProduct?.title || '等待商品快照'}</p>
                </div>
                <button
                  type="button"
                  aria-label="关闭出价面板"
                  onClick={() => setBidSheetOpen(false)}
                  className="h-9 w-9 shrink-0 rounded-lg border border-white/12 bg-white/8 text-sm font-black"
                >
                  X
                </button>
              </div>

              <div className="flex gap-3">
                <img src={heroImage} alt={roomProduct?.title || '竞拍商品'} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1">
                    <span className="rounded bg-white/10 px-2 py-1 text-xs text-white/70">{displayStatus}</span>
                    <span className="rounded bg-white/10 px-2 py-1 text-xs text-white/70">
                      加价 {formatIncrement(roomBidIncrementType, roomBidIncrementValue, stepAmount)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-white/50">当前最高价</div>
                      <div className="mt-1 text-2xl font-black text-emerald-200">{formatPrice(roomCurrentPrice)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/50">剩余时间</div>
                      <div className={`mt-1 font-mono text-2xl font-black ${urgent ? 'text-rose-200' : 'text-amber-200'}`}>
                        {formatCountdown(countdownMs)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`mt-4 rounded-lg border px-3 py-3 text-sm ${
                isOutbid
                  ? 'border-rose-300/45 bg-rose-500/14 text-rose-50'
                  : isLeading
                    ? 'border-emerald-300/45 bg-emerald-300/12 text-emerald-50'
                    : 'border-white/10 bg-white/8 text-white/75'
              }`}>
                {bidStateText}
              </div>

              {roomCurrentExtendCount > 0 ? (
                <div className="mt-3 rounded border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                  Soft Close 已触发 {roomCurrentExtendCount} 次延时
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
                <button
                  type="button"
                  aria-label="减少出价金额"
                  disabled={bidDisabled || isLeading}
                  onClick={() => adjustCustomAmount(-1)}
                  className="h-11 rounded-lg border border-white/12 bg-white/8 text-xl font-black disabled:cursor-not-allowed disabled:opacity-35"
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
                    placeholder={`最低 ${formatPrice(roomNextBidAmount)}`}
                    className="h-11 w-full rounded-lg border border-white/12 bg-black/35 px-3 text-center text-base font-bold text-white outline-none transition placeholder:text-white/35 focus:border-emerald-300/70"
                  />
                </label>
                <button
                  type="button"
                  aria-label="增加出价金额"
                  disabled={bidDisabled || isLeading}
                  onClick={() => adjustCustomAmount(1)}
                  className="h-11 rounded-lg border border-white/12 bg-white/8 text-xl font-black disabled:cursor-not-allowed disabled:opacity-35"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={bidDisabled || isLeading}
                onClick={() => submitBid(primaryBidAmount)}
                className="mt-3 h-12 w-full rounded-lg bg-emerald-300 px-4 text-base font-black text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-white/18 disabled:text-white/45"
              >
                {sheetPrimaryText}
              </button>

              <button
                type="button"
                disabled={bidDisabled || isLeading || !hasCustomAmount}
                onClick={() => submitBid(customBidAmount)}
                className="mt-2 h-11 w-full rounded-lg border border-amber-300/45 bg-amber-300/12 px-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/8 disabled:text-white/35"
              >
                确认自定义出价
              </button>

              {bidError ? (
                <div className="mt-3 rounded border border-rose-300/35 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
                  {bidError}
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        {showResultModal ? (
          <div className="absolute inset-0 z-[60] flex items-end bg-black/62 px-4 pb-5">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="result-title"
              className="w-full rounded-lg border border-white/12 bg-zinc-950 p-4 shadow-2xl"
            >
              <div className="text-xs font-bold text-amber-100">{displayStatus}</div>
              <h2 id="result-title" className="mt-2 text-2xl font-black">竞拍结果</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                {isWinner
                  ? '恭喜竞拍成功，请前往订单确认并完成模拟支付。'
                  : roomStatus === 'ended_sold'
                    ? '本场拍品已落槌，您未中标，可以继续关注其他拍品。'
                    : roomStatus === 'ended_no_bid'
                      ? '本场暂无有效出价，拍品已流拍。'
                      : '本场竞拍已取消，相关冻结金额会按规则释放。'}
              </p>
              <div className="mt-4 rounded-lg bg-white/8 p-3">
                <div className="line-clamp-2 text-sm font-bold">{roomProduct?.title || '竞拍商品'}</div>
                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-white/55">落槌价</span>
                  <span className="font-black text-emerald-200">{formatPrice(roomFinalPrice ?? roomCurrentPrice)}</span>
                </div>
                {roomTerminalMessage ? (
                  <div className="mt-2 text-xs text-white/55">{roomTerminalMessage}</div>
                ) : null}
              </div>
              <div className="mt-4 flex gap-2">
                {isWinner ? (
                  <Link
                    to="/app/orders"
                    className="flex h-11 flex-1 items-center justify-center rounded-lg bg-emerald-300 px-3 text-sm font-black text-zinc-950"
                  >
                    查看中标订单
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => setResultDismissed(true)}
                  className="h-11 flex-1 rounded-lg border border-white/12 bg-white/8 px-3 text-sm font-bold text-white"
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
