import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useParams } from 'react-router-dom';
import { cancelAuction } from '../../api/auction';
import { generateAuctionAIReport, getAuctionAIReport } from '../../api/ai';
import MerchantConsole from '../../components/merchant/MerchantConsole';
import { ConsolePanel, MetricCell, StatusBadge } from '../../components/merchant/MerchantPrimitives';
import type { Tone } from '../../components/merchant/MerchantPrimitives';
import PageBackButton from '../../components/PageBackButton';
import { usePageRefresh } from '../../hooks/usePageRefresh';
import { useAuthStore } from '../../store/authStore';
import { useLiveRoomStore } from '../../store/liveRoomStore';
import type { AuctionStatus, RankingItem } from '../../types/auction';
import type { AuctionAIReport } from '../../types/ai';
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

const AUCTION_STATUS_TONE: Record<AuctionStatus, Tone> = {
  pending: 'pending',
  active: 'active',
  ended_sold: 'sold',
  ended_no_bid: 'noBid',
  cancelled: 'danger',
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

function connectionTone(connectionState: keyof typeof CONNECTION_TEXT): Tone {
  if (connectionState === 'open') return 'active';
  if (connectionState === 'error' || connectionState === 'closed') return 'danger';
  if (connectionState === 'connecting' || connectionState === 'reconnecting') return 'pending';
  return 'neutral';
}

function RankingRow({ item }: { item: RankingItem }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-[#263241] bg-[#0B1016] px-3 py-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#384553] bg-[#182331] text-xs font-black text-[#F4B740]">
        {item.rank}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-white">{item.display_name || `用户 ${item.user_id}`}</div>
        <div className="text-[11px] font-medium text-[#8B97A7]">{item.status || '领先'} · {item.bid_time ? new Date(item.bid_time).toLocaleTimeString() : '刚刚'}</div>
      </div>
      <div className="text-sm font-black tabular-nums text-[#76F2CD]">{formatPrice(item.amount)}</div>
    </li>
  );
}

function MonitorActions({
  refreshRoom,
  disabled,
}: {
  refreshRoom: () => void;
  disabled: boolean;
}) {
  return (
    <>
      <PageBackButton fallback="/merchant/products" className="border-[#384553] bg-[#0F151C] hover:bg-[#182331]" />
      <button
        type="button"
        onClick={refreshRoom}
        disabled={disabled}
        className="rounded-md border border-[#384553] bg-[#0F151C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#182331] disabled:cursor-not-allowed disabled:opacity-50"
      >
        刷新状态
      </button>
    </>
  );
}

function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <h2 className="text-base font-black text-white">{title}</h2>
      {meta ? (
        <span className="rounded-md border border-[#384553] bg-[#182331] px-2.5 py-1 text-[10px] font-black text-[#B2BECC]">
          {meta}
        </span>
      ) : null}
    </div>
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
  const [aiReport, setAIReport] = useState<AuctionAIReport | null>(null);
  const [aiReportState, setAIReportState] = useState<'idle' | 'loading' | 'generating'>('idle');
  const [aiReportError, setAIReportError] = useState('');
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

  useEffect(() => {
    if (!terminal || !isValidAuctionId || !accessToken) return;
    let mounted = true;
    setAIReportState('loading');
    setAIReportError('');
    getAuctionAIReport(auctionId)
      .then((report) => {
        if (mounted) setAIReport(report);
      })
      .catch(() => {
        if (mounted) setAIReport(null);
      })
      .finally(() => {
        if (mounted) setAIReportState('idle');
      });
    return () => {
      mounted = false;
    };
  }, [accessToken, auctionId, isValidAuctionId, terminal]);

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

  async function generateAIReport() {
    if (!isValidAuctionId) return;
    setAIReportState('generating');
    setAIReportError('');
    try {
      const report = await generateAuctionAIReport(auctionId);
      setAIReport(report);
    } catch (error) {
      setAIReportError(extractApiError(error, 'AI竞拍分析生成失败，请检查模型配置后重试'));
    } finally {
      setAIReportState('idle');
    }
  }

  return (
    <MerchantConsole
      title="实时竞拍监控"
      eyebrow="商家控盘台"
      description="复用实时直播间数据通道，监控价格、倒计时、排名与竞拍事件。"
      actions={
        <MonitorActions refreshRoom={refreshRoom} disabled={!isValidAuctionId || !accessToken} />
      }
    >
      <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-5">
          <ConsolePanel className="overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.1fr)]">
              <div className="relative min-h-64 bg-[#0B1016] sm:min-h-80 lg:min-h-full">
                {heroImage ? (
                  <img
                    src={heroImage}
                    alt={roomProduct?.title || '竞拍商品'}
                    className="h-full min-h-64 w-full object-cover sm:min-h-80 lg:min-h-full"
                  />
                ) : (
                  <div className="flex min-h-64 w-full flex-col items-center justify-center bg-[#0B1016] px-6 text-center sm:min-h-80">
                    <span className="text-sm font-black text-[#596575]">{isHydrating ? '正在恢复登录状态' : '等待实时竞拍快照'}</span>
                    <span className="mt-2 text-xs text-[#8B97A7]">商品图片同步后将在这里展示</span>
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-col justify-between gap-6 p-4 sm:p-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label={CONNECTION_TEXT[connectionState]} tone={connectionTone(connectionState)} />
                    {roomStatus ? (
                      <StatusBadge label={displayStatus} tone={AUCTION_STATUS_TONE[roomStatus]} />
                    ) : (
                      <StatusBadge label={displayStatus} tone="neutral" />
                    )}
                    {roomCurrentExtendCount > 0 ? (
                      <StatusBadge label={`延时 ${roomCurrentExtendCount} 次`} tone="info" />
                    ) : null}
                  </div>
                  <div>
                    <h2 className="break-words text-2xl font-black text-white">{roomProduct?.title || '等待竞拍商品'}</h2>
                    <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-[#8B97A7]">
                      {roomProduct?.description || '正在同步最新拍品与出价快照。'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#263241] bg-[#0B1016] p-4">
                    <div className="text-[11px] font-semibold text-[#596575]">当前实时价</div>
                    <div className="mt-2 break-words text-3xl font-black tabular-nums text-[#76F2CD]">{formatPrice(roomCurrentPrice)}</div>
                  </div>
                  <div className="rounded-lg border border-[#263241] bg-[#0B1016] p-4">
                    <div className="text-[11px] font-semibold text-[#596575]">竞拍倒计时</div>
                    <div className="mt-2 font-mono text-3xl font-black tabular-nums text-[#FFD47A]">{formatCountdown(countdownMs)}</div>
                  </div>
                </div>
              </div>
            </div>
          </ConsolePanel>

          <ConsolePanel className="p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCell label="当前状态" value={displayStatus} tone={roomStatus ? AUCTION_STATUS_TONE[roomStatus] : 'neutral'} />
              <MetricCell label="连接状态" value={CONNECTION_TEXT[connectionState]} tone={connectionTone(connectionState)} />
              <MetricCell label="最新事件" value={latestEvent} tone="active" />
            </div>
          </ConsolePanel>

          {terminal ? (
            <ConsolePanel className="border-[#21D19F]/35 bg-[#21D19F]/10 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#76F2CD]">
                <span>{roomTerminalMessage || displayStatus}</span>
                {terminalLine ? <span>({terminalLine})</span> : null}
              </div>
            </ConsolePanel>
          ) : null}

          {terminal ? (
            <ConsolePanel className="p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-white">AI竞拍分析报告</h2>
                  <p className="mt-1 text-xs font-medium text-[#8B97A7]">基于本场竞拍数据生成赛后复盘，内容来自已配置的大模型</p>
                </div>
                <button
                  type="button"
                  onClick={() => void generateAIReport()}
                  disabled={aiReportState === 'loading' || aiReportState === 'generating'}
                  className="rounded-md border border-[#4BA3FF]/35 bg-[#4BA3FF]/10 px-3 py-2 text-xs font-black text-[#9CCBFF] transition hover:bg-[#4BA3FF]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiReportState === 'generating' ? '生成中...' : aiReport ? '重新生成' : '生成分析'}
                </button>
              </div>
              {aiReportState === 'loading' ? (
                <div className="rounded-md border border-[#263241] bg-[#0B1016] px-4 py-5 text-sm font-semibold text-[#8B97A7]">
                  正在读取AI报告...
                </div>
              ) : null}
              {aiReportError ? (
                <div className="mb-3 rounded-md border border-[#F05268]/35 bg-[#F05268]/10 px-3 py-2 text-xs font-semibold text-[#FF8A9A]">
                  {aiReportError}
                </div>
              ) : null}
              {aiReport ? (
                <div className="space-y-3 rounded-lg border border-[#263241] bg-[#0B1016] p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#D5DCE5]">{aiReport.report}</p>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <MetricCell label="参与人数" value={aiReport.metrics.participant_count} />
                    <MetricCell label="出价次数" value={aiReport.metrics.bid_count} />
                    <MetricCell label="成交/终态价" value={formatPrice(aiReport.metrics.final_price)} />
                    <MetricCell label="最后30秒占比" value={`${Math.round(aiReport.metrics.last_30_second_bid_share * 100)}%`} />
                  </div>
                </div>
              ) : aiReportState !== 'loading' ? (
                <div className="rounded-md border border-dashed border-[#263241] bg-[#0B1016] px-4 py-5 text-xs leading-relaxed text-[#8B97A7]">
                  暂无AI分析报告，竞拍结束后可手动生成。
                </div>
              ) : null}
            </ConsolePanel>
          ) : null}
        </section>

        <aside className="min-w-0 space-y-5">
          <ConsolePanel className="p-4">
            <PanelHeader title="出价排行榜" meta={`${roomRankings.length} 次有效出价`} />
            {roomRankings.length > 0 ? (
              <ol className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {roomRankings.slice(0, 8).map((item) => <RankingRow key={`${item.rank}-${item.user_id}-${item.amount}`} item={item} />)}
              </ol>
            ) : (
              <div className="rounded-lg border border-dashed border-[#263241] bg-[#0B1016] py-10 text-center text-xs text-[#8B97A7]">
                暂无出价记录，等待买家开价
              </div>
            )}
          </ConsolePanel>

          <ConsolePanel className="p-4">
            <PanelHeader title="事件流" meta="实时监控日志" />
            {roomNotifications.length > 0 ? (
              <ul className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {roomNotifications.slice(0, 6).map((item) => (
                  <li key={item.id} className={`rounded-md border px-3 py-2 text-xs font-medium ${
                    item.type === 'ai'
                      ? 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100'
                      : 'border-[#263241] bg-[#0B1016] text-[#B2BECC]'
                  }`}>
                    {item.message}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-[#263241] bg-[#0B1016] py-8 text-center text-xs text-[#8B97A7]">
                等待实时活动推送...
              </div>
            )}
          </ConsolePanel>

          <ConsolePanel className="border-[#F05268]/25 p-4">
            <div className="mb-4">
              <h2 className="text-base font-black text-white">竞拍运营控制</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-[#8B97A7]">提示：为防买家误操作和技术纠纷，最后出价后 30 秒内不支持中止或取消竞拍操作。</p>
            </div>
            {message ? (
              <div className="mb-4 rounded-md border border-[#384553] bg-[#182331] px-3 py-2.5 text-xs font-bold text-[#F5F7FA]">
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
                className="w-full rounded-md bg-[#F05268] py-3 text-sm font-black text-white transition hover:bg-[#FF6F82]"
              >
                取消竞拍
              </button>
            ) : null}
            {canCancel && showCancelForm ? (
              <div className="space-y-4 border-t border-[#263241] pt-4">
                <label htmlFor="monitor-cancel-reason" className="block text-xs font-bold text-[#FF8A9A]">
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
                  className="w-full resize-none rounded-md border border-[#384553] bg-[#0B1016] px-3 py-2.5 text-xs text-white outline-none placeholder:text-[#596575] transition focus:border-[#F05268] focus:ring-2 focus:ring-[#F05268]/20"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitCancellation}
                    disabled={cancelState === 'submitting'}
                    className="flex-1 rounded-md bg-[#F05268] py-2.5 text-xs font-black text-white transition hover:bg-[#FF6F82] disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="flex-1 rounded-md border border-[#384553] bg-[#0F151C] py-2.5 text-xs font-bold text-white transition hover:bg-[#182331] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    放弃
                  </button>
                </div>
              </div>
            ) : null}
            {!canCancel ? (
              <div className="rounded-lg border border-dashed border-[#263241] bg-[#0B1016] py-4 text-center text-xs text-[#8B97A7]">
                当前状态不支持中止取消
              </div>
            ) : null}
          </ConsolePanel>
        </aside>
      </div>
    </MerchantConsole>
  );
}
