import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useParams } from 'react-router-dom';
import { cancelAuction } from '../../api/auction';
import PageBackButton from '../../components/PageBackButton';
import { usePageRefresh } from '../../hooks/usePageRefresh';
import { useAuthStore } from '../../store/authStore';
import { useLiveRoomStore } from '../../store/liveRoomStore';
import type { AuctionStatus, RankingItem } from '../../types/auction';
import { remainingMs } from '../app/liveRoomUtils';

const TERMINAL_STATUSES: AuctionStatus[] = ['ended_sold', 'ended_no_bid', 'cancelled'];

const STATUS_TEXT: Record<AuctionStatus, string> = {
  pending: '待开拍',
  active: '竞拍中',
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

function extractApiError(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return fallback;
}

function RankingRow({ item }: { item: RankingItem }) {
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/10 bg-slate-950/55 px-3 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-300 text-sm font-black text-slate-950">
        {item.rank}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{item.display_name || `用户 ${item.user_id}`}</div>
        <div className="text-xs text-white/45">{item.status || '领先'} · {item.bid_time ? new Date(item.bid_time).toLocaleTimeString() : '刚刚'}</div>
      </div>
      <div className="text-sm font-bold text-emerald-200">{formatPrice(item.amount)}</div>
    </li>
  );
}

export default function AuctionMonitor() {
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
    rankings,
    finalPrice,
    terminalMessage,
    notifications,
    connectionState,
    serverTimeOffsetMs,
    connect,
    disconnect,
  } = useLiveRoomStore();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelState, setCancelState] = useState<'idle' | 'submitting'>('idle');
  const [message, setMessage] = useState('');
  const nowTick = useClockTick();

  const isValidAuctionId = Number.isFinite(auctionId) && auctionId > 0;
  const isCurrentRoom = isValidAuctionId && storeAuctionId === auctionId;
  const roomProduct = isCurrentRoom ? product : undefined;
  const roomStatus = isCurrentRoom ? status : undefined;
  const roomCurrentPrice = isCurrentRoom ? currentPrice : 0;
  const roomEndedAt = isCurrentRoom ? endedAt : undefined;
  const roomCurrentExtendCount = isCurrentRoom ? currentExtendCount : 0;
  const roomRankings = isCurrentRoom ? rankings : [];
  const roomFinalPrice = isCurrentRoom ? finalPrice : undefined;
  const roomTerminalMessage = isCurrentRoom ? terminalMessage : undefined;
  const roomNotifications = isCurrentRoom ? notifications : [];
  const terminal = roomStatus ? TERMINAL_STATUSES.includes(roomStatus) : false;
  const canCancel = roomStatus === 'pending' || roomStatus === 'active';
  const countdownMs = remainingMs(roomEndedAt, serverTimeOffsetMs, nowTick);
  const displayStatus = roomStatus ? STATUS_TEXT[roomStatus] : '等待快照';
  const heroImage = roomProduct?.image_urls?.[0];
  const latestEvent = roomNotifications[0]?.message || '等待实时出价';

  const refreshRoom = useCallback(() => {
    if (!isValidAuctionId || !accessToken) return;
    connect(auctionId, accessToken);
  }, [accessToken, auctionId, connect, isValidAuctionId]);

  usePageRefresh(refreshRoom, { disabled: !isValidAuctionId || !accessToken });

  useEffect(() => {
    refreshRoom();
    return () => disconnect();
  }, [disconnect, refreshRoom]);

  const terminalLine = useMemo(() => {
    if (!terminal) return '';
    if (roomStatus === 'ended_sold') return `成交价 ${formatPrice(roomFinalPrice ?? roomCurrentPrice)}`;
    if (roomStatus === 'ended_no_bid') return '竞拍流拍，无成交订单';
    return '竞拍已取消';
  }, [roomCurrentPrice, roomFinalPrice, roomStatus, terminal]);

  async function submitCancellation() {
    const reason = cancelReason.trim();
    if (!reason) {
      setMessage('请输入取消原因');
      return;
    }

    setCancelState('submitting');
    setMessage('');
    try {
      await cancelAuction(auctionId, reason);
      setCancelReason('');
      setShowCancelForm(false);
      setMessage('取消请求已提交，正在刷新状态');
      refreshRoom();
    } catch (error) {
      setMessage(extractApiError(error, '取消失败，请稍后重试'));
    } finally {
      setCancelState('idle');
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_34%),linear-gradient(135deg,#020617,#111827_52%,#172554)] text-white">
      <main className="mx-auto grid min-h-screen max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:py-6">
        <section className="min-w-0 space-y-4">
          <div className="relative overflow-hidden rounded-lg border border-white/12 bg-slate-950/70 shadow-2xl shadow-black/30">
            <div className="relative min-h-[360px] bg-slate-900 sm:min-h-[460px]">
              {heroImage ? (
                <img src={heroImage} alt={roomProduct?.title || '竞拍商品'} className="h-full min-h-[360px] w-full object-cover sm:min-h-[460px]" />
              ) : (
                <div className="flex min-h-[360px] w-full items-center justify-center bg-[linear-gradient(135deg,#0f172a,#064e3b,#1e293b)] text-sm text-white/55 sm:min-h-[460px]">
                  {isHydrating ? '正在恢复登录状态...' : '等待实时快照'}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/25" />
              <div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
                <span className="rounded border border-emerald-300/40 bg-emerald-300/15 px-2 py-1 text-xs font-semibold text-emerald-100">
                  {CONNECTION_TEXT[connectionState]}
                </span>
                <span className="rounded border border-amber-300/40 bg-amber-300/15 px-2 py-1 text-xs font-semibold text-amber-100">
                  {displayStatus}
                </span>
                {roomCurrentExtendCount > 0 ? (
                  <span className="rounded border border-sky-300/35 bg-sky-300/12 px-2 py-1 text-xs text-sky-100">
                    已延时 {roomCurrentExtendCount} 次
                  </span>
                ) : null}
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap gap-2">
                  <PageBackButton fallback="/merchant/products" className="bg-black/25" />
                  <button
                    type="button"
                    onClick={refreshRoom}
                    disabled={!isValidAuctionId || !accessToken}
                    className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white/75 transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    刷新状态
                  </button>
                </div>
                <h1 className="break-words text-2xl font-bold leading-tight sm:text-3xl">
                  {roomProduct?.title || '商家实时监控'}
                </h1>
                <p className="mt-2 line-clamp-2 max-w-3xl break-words text-sm text-white/62">
                  {roomProduct?.description || '复用直播间实时通道，等待商品和拍卖快照同步'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/12 bg-white/10 p-4 backdrop-blur">
              <div className="text-xs text-white/50">当前价</div>
              <div className="mt-1 break-words text-3xl font-black text-emerald-200">{formatPrice(roomCurrentPrice)}</div>
            </div>
            <div className="rounded-lg border border-white/12 bg-white/10 p-4 backdrop-blur">
              <div className="text-xs text-white/50">倒计时</div>
              <div className="mt-1 font-mono text-3xl font-black text-amber-200">{formatCountdown(countdownMs)}</div>
            </div>
            <div className="rounded-lg border border-white/12 bg-white/10 p-4 backdrop-blur">
              <div className="text-xs text-white/50">最新事件</div>
              <div className="mt-2 line-clamp-2 text-sm font-semibold text-white">{latestEvent}</div>
            </div>
          </div>

          {terminal ? (
            <div className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-50">
              <span className="font-semibold">{roomTerminalMessage || displayStatus}</span>
              {terminalLine ? <span className="ml-3">{terminalLine}</span> : null}
            </div>
          ) : null}
        </section>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-lg border border-white/12 bg-white/10 p-4 shadow-xl shadow-black/20 backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold">排行榜</h2>
              <span className="text-xs text-white/45">{roomRankings.length} 人出价</span>
            </div>
            {roomRankings.length > 0 ? (
              <ol className="space-y-2">
                {roomRankings.slice(0, 8).map((item) => <RankingRow key={`${item.rank}-${item.user_id}-${item.amount}`} item={item} />)}
              </ol>
            ) : (
              <div className="rounded-lg border border-dashed border-white/15 p-5 text-center text-sm text-white/50">
                暂无出价
              </div>
            )}
          </section>

          <section className="rounded-lg border border-white/12 bg-white/10 p-4 shadow-xl shadow-black/20 backdrop-blur">
            <h2 className="mb-3 text-base font-bold">出价事件</h2>
            {roomNotifications.length > 0 ? (
              <ul className="space-y-2">
                {roomNotifications.slice(0, 6).map((item) => (
                  <li key={item.id} className="rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-white/76">
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

          <section className="rounded-lg border border-white/12 bg-white/10 p-4 shadow-xl shadow-black/20 backdrop-blur">
            <div className="mb-3">
              <h2 className="text-base font-bold">竞拍控制</h2>
              <p className="mt-1 text-xs text-white/55">最后出价后 30 秒内不可取消</p>
            </div>
            {message ? (
              <div className="mb-3 rounded border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/82">
                {message}
              </div>
            ) : null}
            {canCancel && !showCancelForm ? (
              <button
                type="button"
                onClick={() => {
                  setMessage('');
                  setShowCancelForm(true);
                }}
                className="w-full rounded-lg bg-rose-500 py-3 text-sm font-semibold text-white transition hover:bg-rose-400"
              >
                取消竞拍
              </button>
            ) : null}
            {canCancel && showCancelForm ? (
              <div className="space-y-3">
                <label htmlFor="monitor-cancel-reason" className="block text-sm font-medium text-rose-100">
                  取消原因
                </label>
                <textarea
                  id="monitor-cancel-reason"
                  aria-label="取消原因"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="例如：库存异常、直播中断、商品信息有误"
                  className="w-full resize-none rounded-lg border border-white/15 bg-slate-950/55 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-rose-200"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitCancellation}
                    disabled={cancelState === 'submitting'}
                    className="flex-1 rounded-lg bg-rose-500 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cancelState === 'submitting' ? '取消中...' : '确认取消'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCancelForm(false);
                      setCancelReason('');
                    }}
                    disabled={cancelState === 'submitting'}
                    className="flex-1 rounded-lg border border-white/15 bg-white/8 py-3 text-sm font-semibold text-white/75 transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    放弃取消
                  </button>
                </div>
              </div>
            ) : null}
            {!canCancel ? (
              <div className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-white/55">
                当前状态不支持取消操作
              </div>
            ) : null}
          </section>
        </aside>
      </main>
    </div>
  );
}
