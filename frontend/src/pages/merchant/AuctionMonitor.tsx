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
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/5 bg-slate-950/40 px-3.5 py-3 shadow-inner">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-200 to-orange-400 text-xs font-black text-slate-950 shadow-md">
        {item.rank}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-slate-100">{item.display_name || `用户 ${item.user_id}`}</div>
        <div className="text-[10px] text-slate-400/80 font-medium">{item.status || '领先'} · {item.bid_time ? new Date(item.bid_time).toLocaleTimeString() : '刚刚'}</div>
      </div>
      <div className="text-sm font-bold text-emerald-300 tabular-nums">{formatPrice(item.amount)}</div>
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
    <div className="min-h-screen bg-[#080b11] relative overflow-hidden text-white">
      {/* 背景光效 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/3 blur-[120px] pointer-events-none" />

      <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] relative z-10">
        <section className="min-w-0 space-y-5">
          {/* 商品监控舞台主卡 */}
          <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-[#111422]/60 shadow-2xl backdrop-blur-xl">
            <div className="relative min-h-[360px] bg-slate-950 sm:min-h-[460px]">
              {heroImage ? (
                <img src={heroImage} alt={roomProduct?.title || '竞拍商品'} className="h-full min-h-[360px] w-full object-cover sm:min-h-[460px]" />
              ) : (
                <div className="flex min-h-[360px] w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#1e293b,transparent_60%),linear-gradient(135deg,#090b11,#042f2e_70%,#090b11)] text-slate-500 sm:min-h-[460px]">
                  <span className="text-4xl mb-3">📡</span>
                  <span className="text-sm font-semibold">{isHydrating ? '正在恢复登录状态...' : '等待实时竞拍快照...'}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#090b11] via-black/30 to-black/30" />

              <div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap gap-1.5">
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                  ▮ {CONNECTION_TEXT[connectionState]}
                </span>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
                  {displayStatus}
                </span>
                {roomCurrentExtendCount > 0 ? (
                  <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-200">
                    Auto-Extend 延时 {roomCurrentExtendCount} 次
                  </span>
                ) : null}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap gap-2">
                  <PageBackButton fallback="/merchant/products" className="border-white/10 bg-black/40 hover:bg-black/60" />
                  <button
                    type="button"
                    onClick={refreshRoom}
                    disabled={!isValidAuctionId || !accessToken}
                    className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm font-semibold text-white/95 transition duration-200 hover:border-white/20 hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    刷新状态
                  </button>
                </div>
                <h1 className="break-words text-2xl font-black leading-tight sm:text-3xl bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  {roomProduct?.title || '商家实时监控大盘'}
                </h1>
                <p className="mt-2 line-clamp-2 max-w-3xl break-words text-sm text-slate-400/80 leading-relaxed">
                  {roomProduct?.description || '本控制台复用高并发实时数据通道。正在同步最新拍品与出价快照...'}
                </p>
              </div>
            </div>
          </div>

          {/* 指标监控大卡 */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10 hover:border-purple-500/20 transition duration-200">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">当前实时价</div>
              <div className="mt-2 break-words text-3xl font-black text-transparent bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text tabular-nums">{formatPrice(roomCurrentPrice)}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10 hover:border-purple-500/20 transition duration-200">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">竞拍倒计时</div>
              <div className="mt-2 font-mono text-3xl font-black text-amber-400 tabular-nums">{formatCountdown(countdownMs)}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10 hover:border-purple-500/20 transition duration-200">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">最新出价动态</div>
              <div className="mt-2 line-clamp-2 text-xs font-bold text-slate-100 leading-snug">{latestEvent}</div>
            </div>
          </div>

          {terminal ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 text-sm text-emerald-200 backdrop-blur flex items-center gap-3">
              <span className="shrink-0">🏆</span>
              <div className="flex-1 font-semibold flex flex-wrap gap-2 items-center">
                <span>{roomTerminalMessage || displayStatus}</span>
                {terminalLine ? <span className="text-emerald-400">({terminalLine})</span> : null}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="min-w-0 space-y-5">
          {/* 排行榜卡片 */}
          <section className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 shadow-2xl backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/5 pb-3">
              <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <span className="text-amber-400">👑</span> 出价排行榜
              </h2>
              <span className="rounded-full bg-slate-950/40 border border-white/5 px-2.5 py-0.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                {roomRankings.length} 次有效出价
              </span>
            </div>
            {roomRankings.length > 0 ? (
              <ol className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {roomRankings.slice(0, 8).map((item) => <RankingRow key={`${item.rank}-${item.user_id}-${item.amount}`} item={item} />)}
              </ol>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 py-10 text-center text-xs text-slate-500">
                暂无出价记录，等待买家开价
              </div>
            )}
          </section>

          {/* 出价事件日志 */}
          <section className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 shadow-2xl backdrop-blur-xl">
            <h2 className="mb-4 text-base font-bold text-slate-200 flex items-center gap-2 border-b border-white/5 pb-3">
              <span className="text-purple-400">⚡</span> 实时监控日志
            </h2>
            {roomNotifications.length > 0 ? (
              <ul className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {roomNotifications.slice(0, 6).map((item) => (
                  <li key={item.id} className="rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 text-xs text-slate-300 shadow-inner">
                    {item.message}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 py-8 text-center text-xs text-slate-500">
                等待实时活动推送...
              </div>
            )}
          </section>

          {/* 控制控制台 */}
          <section className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 shadow-2xl backdrop-blur-xl">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <span className="text-pink-400">⚙️</span> 竞拍运营控制
              </h2>
              <p className="mt-1 text-[11px] text-slate-400/80 leading-relaxed">提示：为防买家误操作和技术纠纷，最后出价后 30 秒内不支持中止或取消竞拍操作。</p>
            </div>
            {message ? (
              <div className="mb-4 rounded-xl border border-purple-500/20 bg-purple-500/10 px-3.5 py-3 text-xs text-purple-200 font-bold backdrop-blur-sm">
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
                className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-[0.98] py-3 text-sm font-bold text-white transition-all duration-200 shadow-lg shadow-red-500/10"
              >
                取消竞拍
              </button>
            ) : null}
            {canCancel && showCancelForm ? (
              <div className="space-y-4 border-t border-white/5 pt-4">
                <label htmlFor="monitor-cancel-reason" className="block text-xs font-bold text-red-200">
                  取消原因说明
                </label>
                <textarea
                  id="monitor-cancel-reason"
                  aria-label="取消原因"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="例如：库存异常、直播中断、商品信息有误..."
                  className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-red-500 focus:ring-4 focus:ring-red-500/15 transition-all duration-200 shadow-inner"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitCancellation}
                    disabled={cancelState === 'submitting'}
                    className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-2.5 text-xs font-bold text-white transition hover:from-red-500 hover:to-rose-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:scale-100"
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
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-white/80 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    放弃
                  </button>
                </div>
              </div>
            ) : null}
            {!canCancel ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 py-4 text-center text-xs text-slate-500">
                当前状态不支持中止取消
              </div>
            ) : null}
          </section>
        </aside>
      </main>
    </div>
  );
}
