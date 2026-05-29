import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useParams } from 'react-router-dom';
import { placeBid } from '../../api/auction';
import PageBackButton from '../../components/PageBackButton';
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

function RankingRow({ item }: { item: RankingItem }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/8 px-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-300 text-sm font-bold text-stone-950">
        {item.rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-white">{item.display_name || `用户 ${item.user_id}`}</div>
        <div className="text-xs text-white/45">{item.status || '领先'}</div>
      </div>
      <div className="shrink-0 text-sm font-semibold text-emerald-200">{formatPrice(item.amount)}</div>
    </li>
  );
}

export default function LiveAuctionRoom() {
  const { id } = useParams();
  const auctionId = Number(id);
  const { accessToken, isHydrating } = useAuthStore();
  const {
    auctionId: storeAuctionId,
    product,
    status,
    currentPrice,
    endedAt,
    currentExtendCount,
    nextBidAmount,
    rankings,
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
  const nowTick = useClockTick();

  const isValidAuctionId = Number.isFinite(auctionId) && auctionId > 0;
  const isCurrentRoom = isValidAuctionId && storeAuctionId === auctionId;
  const roomProduct = isCurrentRoom ? product : undefined;
  const roomStatus = isCurrentRoom ? status : undefined;
  const roomCurrentPrice = isCurrentRoom ? currentPrice : 0;
  const roomEndedAt = isCurrentRoom ? endedAt : undefined;
  const roomCurrentExtendCount = isCurrentRoom ? currentExtendCount : 0;
  const roomNextBidAmount = isCurrentRoom ? nextBidAmount : 0;
  const roomRankings = isCurrentRoom ? rankings : [];
  const roomTerminalMessage = isCurrentRoom ? terminalMessage : undefined;
  const roomNotifications = isCurrentRoom ? notifications : [];
  const terminal = roomStatus ? TERMINAL_STATUSES.includes(roomStatus) : false;
  const active = roomStatus === 'active';
  const countdownMs = remainingMs(roomEndedAt, serverTimeOffsetMs, nowTick);
  const displayStatus = roomStatus ? STATUS_TEXT[roomStatus] : '等待快照';
  const bidDisabled = !isCurrentRoom || submitState === 'submitting' || terminal || !active || !isValidAuctionId;
  const customBidAmount = Number(customAmount);
  const hasCustomAmount = customAmount.trim().length > 0 && Number.isFinite(customBidAmount) && customBidAmount > 0;
  const heroImage = roomProduct?.image_urls?.[0];

  const buttonText = useMemo(() => {
    if (terminal) return '竞拍已结束';
    if (!active) return roomStatus === 'pending' ? '尚未开始' : '等待快照';
    if (submitState === 'submitting') return '提交中...';
    return `出价 ${formatPrice(roomNextBidAmount)}`;
  }, [active, roomNextBidAmount, roomStatus, submitState, terminal]);

  useEffect(() => {
    if (!isValidAuctionId || !accessToken) return;
    connect(auctionId, accessToken);
    return () => disconnect();
  }, [accessToken, auctionId, connect, disconnect, isValidAuctionId]);

  async function submitBid(amount: number) {
    if (bidDisabled || !Number.isFinite(amount) || amount <= 0) return;
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.26),transparent_32%),linear-gradient(135deg,#09090b,#1c1917_46%,#052e2b)] text-white">
      <main className="mx-auto grid min-h-screen max-w-6xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:py-6">
        <section className="min-w-0 overflow-hidden rounded-lg border border-white/12 bg-zinc-950/70 shadow-2xl shadow-black/30">
          <div className="relative aspect-[4/3] min-h-[320px] bg-zinc-900 sm:aspect-[16/10] lg:min-h-[540px]">
            {heroImage ? (
              <img src={heroImage} alt={roomProduct?.title || '竞拍商品'} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#27272a,#134e4a,#451a03)] text-sm text-white/55">
                等待直播画面
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/20" />
            <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
              <span className="rounded bg-rose-500 px-2 py-1 text-xs font-bold text-white">LIVE</span>
              <span className="rounded border border-emerald-300/40 bg-emerald-300/15 px-2 py-1 text-xs text-emerald-100">
                {CONNECTION_TEXT[connectionState]}
              </span>
              <span className="rounded border border-amber-300/40 bg-amber-300/15 px-2 py-1 text-xs text-amber-100">
                {displayStatus}
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
              <PageBackButton fallback="/app/auctions" className="mb-3 bg-black/25" />
              <h1 className="break-words text-2xl font-bold leading-tight sm:text-3xl">
                {roomProduct?.title || '直播竞拍间'}
              </h1>
              <p className="mt-2 line-clamp-2 max-w-2xl break-words text-sm text-white/62">
                {roomProduct?.description || (isHydrating ? '正在恢复登录状态...' : '等待实时快照同步商品信息')}
              </p>
            </div>
          </div>
        </section>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-lg border border-white/12 bg-white/10 p-4 shadow-xl shadow-black/20 backdrop-blur">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-zinc-950/55 p-3">
                <div className="text-xs text-white/50">当前价</div>
                <div className="mt-1 break-words text-3xl font-black text-emerald-200">{formatPrice(roomCurrentPrice)}</div>
              </div>
              <div className="rounded-lg bg-zinc-950/55 p-3">
                <div className="text-xs text-white/50">倒计时</div>
                <div className="mt-1 font-mono text-3xl font-black text-amber-200">{formatCountdown(countdownMs)}</div>
              </div>
            </div>
            {roomCurrentExtendCount > 0 ? (
              <div className="mt-3 rounded border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                已触发 {roomCurrentExtendCount} 次延时
              </div>
            ) : null}
            {roomTerminalMessage ? (
              <div className="mt-3 rounded border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/85">
                {roomTerminalMessage}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-white/12 bg-white/10 p-4 shadow-xl shadow-black/20 backdrop-blur">
            <button
              type="button"
              disabled={bidDisabled}
              onClick={() => submitBid(roomNextBidAmount)}
              className="w-full rounded-lg bg-emerald-300 px-4 py-4 text-base font-black text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-white/18 disabled:text-white/45"
            >
              {buttonText}
            </button>
            <div className="mt-3 flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">自定义出价</span>
                <input
                  aria-label="自定义出价"
                  inputMode="decimal"
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  placeholder={`最低 ${formatPrice(roomNextBidAmount)}`}
                  className="h-12 w-full rounded-lg border border-white/12 bg-zinc-950/60 px-3 text-base text-white outline-none transition placeholder:text-white/35 focus:border-emerald-300/70"
                />
              </label>
              <button
                type="button"
                disabled={bidDisabled || !hasCustomAmount}
                onClick={() => submitBid(customBidAmount)}
                className="h-12 shrink-0 rounded-lg border border-amber-300/45 bg-amber-300/15 px-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/8 disabled:text-white/35"
              >
                确认自定义出价
              </button>
            </div>
            {bidError ? (
              <div className="mt-3 rounded border border-rose-300/35 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
                {bidError}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-white/12 bg-white/10 p-4 shadow-xl shadow-black/20 backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold">排行榜</h2>
              <span className="text-xs text-white/45">{roomRankings.length} 人出价</span>
            </div>
            {roomRankings.length > 0 ? (
              <ol className="space-y-2">
                {roomRankings.slice(0, 5).map((item) => <RankingRow key={`${item.rank}-${item.user_id}-${item.amount}`} item={item} />)}
              </ol>
            ) : (
              <div className="rounded-lg border border-dashed border-white/15 p-5 text-center text-sm text-white/50">
                暂无出价，抢先举牌
              </div>
            )}
          </section>

          <section className="rounded-lg border border-white/12 bg-white/10 p-4 shadow-xl shadow-black/20 backdrop-blur">
            <h2 className="mb-3 text-base font-bold">实时消息</h2>
            {roomNotifications.length > 0 ? (
              <ul className="space-y-2">
                {roomNotifications.slice(0, 4).map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-white/10 bg-zinc-950/45 px-3 py-2 text-sm text-white/76"
                  >
                    {item.message}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-white/15 p-5 text-center text-sm text-white/50">
                等待实时更新
              </div>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
