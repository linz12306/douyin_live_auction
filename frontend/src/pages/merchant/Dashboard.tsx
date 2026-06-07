import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMerchantDashboard } from '../../api/dashboard';
import PageBackButton from '../../components/PageBackButton';
import type {
  DashboardAnalytics,
  DashboardBidDistributionBucket,
  DashboardTransactionTrendPoint,
  DashboardUserActivityPoint,
  MerchantDashboard,
} from '../../types/dashboard';
import type { OrderStatus } from '../../types/order';
import type { ProductStatus } from '../../types/product';

const PRODUCT_STATUS_TEXT: Record<ProductStatus, string> = {
  draft: '草稿',
  pending: '待开拍',
  active: '进行中',
  ended_sold: '已成交',
  ended_no_bid: '流拍',
  cancelled: '已取消',
};

const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  pending_confirm: '待确认',
  pending_payment: '待支付',
  paid: '已支付',
  cancelled: '已取消',
};

function formatPrice(value: number) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function formatTime(value?: string) {
  if (!value) return '未设置';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateLabel(value: string) {
  if (!value) return '--';
  const parts = value.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return value;
}

function countByStatus<TStatus extends string>(items: Array<{ status: TStatus; count: number }>) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = item.count;
    return acc;
  }, {});
}

function maxNumber(values: number[]) {
  return Math.max(1, ...values.map((value) => Number(value) || 0));
}

function analyticsOrEmpty(analytics?: DashboardAnalytics): DashboardAnalytics {
  return {
    transaction_trend: analytics?.transaction_trend ?? [],
    bid_distribution: analytics?.bid_distribution ?? [],
    user_activity: analytics?.user_activity ?? [],
  };
}

function EmptyChart({ children }: { children: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded border border-dashed border-white/12 bg-black/10 px-3 text-center text-sm text-white/45">
      {children}
    </div>
  );
}

function TransactionTrendChart({ points }: { points: DashboardTransactionTrendPoint[] }) {
  const hasData = points.some((point) => point.paid_amount > 0 || point.paid_order_count > 0);
  if (!points.length || !hasData) return <EmptyChart>暂无成交趋势</EmptyChart>;

  const maxAmount = maxNumber(points.map((point) => point.paid_amount));
  return (
    <div className="min-h-40">
      <div className="flex h-36 items-end gap-2 border-b border-white/10 pb-2">
        {points.map((point) => {
          const height = Math.max(8, (point.paid_amount / maxAmount) * 100);
          return (
            <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-24 w-full items-end">
                <div
                  className="w-full rounded-t bg-emerald-300/80"
                  style={{ height: `${height}%` }}
                  aria-label={`${formatDateLabel(point.date)} 成交 ${formatPrice(point.paid_amount)}，${point.paid_order_count} 单`}
                  title={`${formatDateLabel(point.date)} ${formatPrice(point.paid_amount)} / ${point.paid_order_count} 单`}
                />
              </div>
              <div className="text-[11px] text-white/45">{formatDateLabel(point.date)}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
        <span>峰值 {formatPrice(maxAmount)}</span>
        <span>合计 {formatPrice(points.reduce((sum, point) => sum + point.paid_amount, 0))}</span>
      </div>
    </div>
  );
}

function BidDistributionChart({ buckets }: { buckets: DashboardBidDistributionBucket[] }) {
  const hasData = buckets.some((bucket) => bucket.bid_count > 0);
  if (!buckets.length || !hasData) return <EmptyChart>暂无出价分布</EmptyChart>;

  const maxCount = maxNumber(buckets.map((bucket) => bucket.bid_count));
  return (
    <div className="space-y-3">
      {buckets.map((bucket) => {
        const width = Math.max(8, (bucket.bid_count / maxCount) * 100);
        return (
          <div key={bucket.bucket} className="grid grid-cols-[88px_minmax(0,1fr)_48px] items-center gap-3">
            <div className="truncate text-sm font-semibold text-white">{bucket.bucket}</div>
            <div className="h-3 rounded bg-black/30">
              <div className="h-full rounded bg-cyan-300/80" style={{ width: `${width}%` }} />
            </div>
            <div className="text-right text-sm text-white/65">{bucket.bid_count} 次</div>
          </div>
        );
      })}
    </div>
  );
}

function UserActivityChart({ points }: { points: DashboardUserActivityPoint[] }) {
  const hasData = points.some((point) => point.bid_count > 0 || point.active_user_count > 0);
  if (!points.length || !hasData) return <EmptyChart>暂无用户活跃数据</EmptyChart>;

  const maxBidCount = maxNumber(points.map((point) => point.bid_count));
  const maxUsers = Math.max(...points.map((point) => point.active_user_count));
  return (
    <div className="min-h-40">
      <div className="flex h-36 items-end gap-2 border-b border-white/10 pb-2">
        {points.map((point) => {
          const height = Math.max(8, (point.bid_count / maxBidCount) * 100);
          return (
            <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-24 w-full items-end">
                <div
                  className="w-full rounded-t bg-amber-300/80"
                  style={{ height: `${height}%` }}
                  aria-label={`${formatDateLabel(point.date)} ${point.bid_count} 次出价，${point.active_user_count} 位活跃用户`}
                  title={`${formatDateLabel(point.date)} ${point.bid_count} 次出价 / ${point.active_user_count} 位用户`}
                />
              </div>
              <div className="text-[11px] text-white/45">{formatDateLabel(point.date)}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
        <span>最高 {maxUsers} 位活跃用户</span>
        <span>合计 {points.reduce((sum, point) => sum + point.bid_count, 0)} 次出价</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState<MerchantDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getMerchantDashboard()
      .then((result) => {
        if (mounted) setDashboard(result);
      })
      .catch(() => {
        if (mounted) setError('看板加载失败');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const productCounts = useMemo(
    () => countByStatus(dashboard?.product_status_counts ?? []),
    [dashboard?.product_status_counts],
  );
  const orderCounts = useMemo(
    () => countByStatus(dashboard?.order_status_counts ?? []),
    [dashboard?.order_status_counts],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080b11] flex items-center justify-center text-slate-400/80">
        <div className="text-center">
          <p className="text-sm font-semibold">加载看板数据中...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-[#080b11] text-white">
        <main className="mx-auto max-w-6xl px-4 py-8">
          <PageBackButton fallback="/profile" className="mb-4 border-white/10 bg-white/5 hover:bg-white/10" />
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 backdrop-blur-lg flex items-center gap-2">
            <span className="shrink-0">⚠️</span>
            <span>{error || '看板加载失败'}</span>
          </div>
        </main>
      </div>
    );
  }

  const summary = dashboard.transaction_summary;
  const analytics = analyticsOrEmpty(dashboard.analytics);

  return (
    <div className="min-h-screen bg-[#080b11] relative overflow-hidden text-white">
      {/* 背景光效 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/3 blur-[120px] pointer-events-none" />

      <main className="mx-auto max-w-6xl px-4 py-8 relative z-10">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
          <div>
            <PageBackButton fallback="/profile" className="mb-3 border-white/10 bg-white/5 hover:bg-white/10" />
            <h1 className="text-3xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">运营看板</h1>
            <p className="mt-1 text-sm text-slate-400/80">当前商家的拍品、成交额、订单及核心业务数据综合概览</p>
          </div>
          <div className="flex gap-2">
            <Link to="/merchant/products" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:border-white/25 hover:bg-white/10 transition-all duration-200">
              商品管理
            </Link>
            <Link to="/merchant/orders" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:border-white/25 hover:bg-white/10 transition-all duration-200">
              订单管理
            </Link>
          </div>
        </header>

        {/* 五大成交核心指标 */}
        <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
          <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10 hover:border-purple-500/20 transition-all duration-200">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">成交金额</div>
            <div className="mt-2 text-2xl font-black text-transparent bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text tabular-nums">{formatPrice(summary.total_paid_amount)}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10 hover:border-purple-500/20 transition-all duration-200">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">成交订单</div>
            <div className="mt-2 text-2xl font-black text-slate-100 tabular-nums">{summary.paid_order_count} <span className="text-xs font-medium text-slate-400">单</span></div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10 hover:border-purple-500/20 transition-all duration-200">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">平均成交单价</div>
            <div className="mt-2 text-2xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-blue-300 bg-clip-text tabular-nums">{formatPrice(summary.average_paid_price)}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10 hover:border-purple-500/20 transition-all duration-200">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">进行中竞拍</div>
            <div className="mt-2 text-2xl font-black text-amber-400 tabular-nums">{dashboard.active_auctions.length} <span className="text-xs font-medium text-slate-400">场</span></div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10 hover:border-purple-500/20 transition-all duration-200">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">本周新增订单</div>
            <div className="mt-2 text-2xl font-black text-slate-100 tabular-nums">{dashboard.recent_orders.length} <span className="text-xs font-medium text-slate-400">单</span></div>
          </div>
        </section>

        {/* 数据图表卡片 */}
        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-200">成交趋势</h2>
                <p className="mt-1 text-xs text-slate-400/80">近 7 天已支付订单成交额</p>
              </div>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-300 uppercase tracking-wide">
                已支付统计
              </span>
            </div>
            <TransactionTrendChart points={analytics.transaction_trend} />
          </div>

          <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-200">出价分布区间</h2>
              <p className="mt-1 text-xs text-slate-400/80">商户所有发布拍品的历史出价频次分布</p>
            </div>
            <BidDistributionChart buckets={analytics.bid_distribution} />
          </div>
        </section>

        {/* 活跃度数据 */}
        <section className="mt-6 rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-200">买家用户活跃度</h2>
              <p className="mt-1 text-xs text-slate-400/80">近 7 天买家竞标出价次数与实际独立出价人数</p>
            </div>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black text-amber-300 uppercase tracking-wide">
              参与行为趋势
            </span>
          </div>
          <UserActivityChart points={analytics.user_activity} />
        </section>

        {/* 商品与订单状态桶 */}
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10">
            <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
              <span className="text-purple-400">📦</span> 商品各状态分类
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(Object.keys(PRODUCT_STATUS_TEXT) as ProductStatus[]).map((status) => (
                <div key={status} className="rounded-xl border border-white/5 bg-slate-950/40 p-3 shadow-inner">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{PRODUCT_STATUS_TEXT[status]}</div>
                  <div className="mt-1 text-2xl font-black text-slate-100 tabular-nums">{productCounts[status] ?? 0}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10">
            <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
              <span className="text-pink-400">📋</span> 订单状态分类汇总
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(ORDER_STATUS_TEXT) as OrderStatus[]).map((status) => (
                <div key={status} className="rounded-xl border border-white/5 bg-slate-950/40 p-3 shadow-inner">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{ORDER_STATUS_TEXT[status]}</div>
                  <div className="mt-1 text-2xl font-black text-slate-100 tabular-nums">{orderCounts[status] ?? 0}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 实时列表 & 最近订单 */}
        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-200">进行中竞拍</h2>
              <Link to="/merchant/products" className="text-xs font-bold text-purple-400 hover:text-purple-300 transition duration-200">查看全部商品 ›</Link>
            </div>
            {dashboard.active_auctions.length === 0 ? (
              <p className="py-12 text-center text-slate-500 text-sm">暂无进行中竞拍</p>
            ) : (
              <div className="space-y-3">
                {dashboard.active_auctions.map((auction) => (
                  <article key={auction.auction_id} className="rounded-xl border border-white/5 bg-slate-950/40 p-4 hover:border-purple-500/10 transition duration-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words font-bold text-slate-200 text-sm leading-snug">{auction.product_title}</h3>
                        <p className="mt-1.5 text-xs text-slate-400">结束：{formatTime(auction.ended_at)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-transparent bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-base tabular-nums">{formatPrice(auction.current_price)}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">{auction.bid_count} 次出价</div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl shadow-xl shadow-black/10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-200">本周新增订单</h2>
              <Link to="/merchant/orders" className="text-xs font-bold text-purple-400 hover:text-purple-300 transition duration-200">查看全部订单 ›</Link>
            </div>
            {dashboard.recent_orders.length === 0 ? (
              <p className="py-12 text-center text-slate-500 text-sm">暂无订单</p>
            ) : (
              <div className="space-y-3">
                {dashboard.recent_orders.map((order) => (
                  <article key={order.id} className="rounded-xl border border-white/5 bg-slate-950/40 p-4 hover:border-purple-500/10 transition duration-200">
                    <div className="flex gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-900 border border-white/5">
                        {order.product_image_url ? (
                          <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] font-semibold text-slate-500">暂无图</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="break-words font-bold text-slate-200 text-xs leading-snug line-clamp-1">{order.product_title}</h3>
                            <p className="mt-1 text-[11px] text-slate-400">买家：{order.buyer_name || `用户 ${order.buyer_id}`}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-transparent bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-sm tabular-nums">{formatPrice(order.amount)}</div>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-800 text-slate-300 border border-white/5">
                              {ORDER_STATUS_TEXT[order.status] || order.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
