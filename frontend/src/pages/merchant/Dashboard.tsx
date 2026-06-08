import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMerchantDashboard } from '../../api/dashboard';
import MerchantConsole from '../../components/merchant/MerchantConsole';
import {
  ConsolePanel,
  EmptyState,
  MetricCell,
  StatusBadge,
} from '../../components/merchant/MerchantPrimitives';
import {
  ORDER_STATUS_TEXT,
  PRODUCT_STATUS_TEXT,
  orderStatusTone,
  productStatusTone,
} from '../../components/merchant/merchantStatus';
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
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-[#263241] bg-[#0B1016] px-3 text-center text-sm font-semibold text-[#8B97A7]">
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
      <div className="flex h-36 items-end gap-2 border-b border-[#263241] pb-2">
        {points.map((point) => {
          const height = Math.max(8, (point.paid_amount / maxAmount) * 100);
          return (
            <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-24 w-full items-end rounded-t bg-[#0B1016]">
                <div
                  className="w-full rounded-t bg-[#21D19F]"
                  style={{ height: `${height}%` }}
                  aria-label={`${formatDateLabel(point.date)} 成交 ${formatPrice(point.paid_amount)}，${point.paid_order_count} 单`}
                  title={`${formatDateLabel(point.date)} ${formatPrice(point.paid_amount)} / ${point.paid_order_count} 单`}
                />
              </div>
              <div className="text-[11px] text-[#8B97A7]">{formatDateLabel(point.date)}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#8B97A7]">
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
            <div className="truncate text-sm font-black text-white">{bucket.bucket}</div>
            <div className="h-3 rounded bg-[#0B1016]">
              <div className="h-full rounded bg-[#4BA3FF]" style={{ width: `${width}%` }} />
            </div>
            <div className="text-right text-sm font-semibold text-[#8B97A7]">{bucket.bid_count} 次</div>
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
      <div className="flex h-36 items-end gap-2 border-b border-[#263241] pb-2">
        {points.map((point) => {
          const height = Math.max(8, (point.bid_count / maxBidCount) * 100);
          return (
            <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-24 w-full items-end rounded-t bg-[#0B1016]">
                <div
                  className="w-full rounded-t bg-[#F4B740]"
                  style={{ height: `${height}%` }}
                  aria-label={`${formatDateLabel(point.date)} ${point.bid_count} 次出价，${point.active_user_count} 位活跃用户`}
                  title={`${formatDateLabel(point.date)} ${point.bid_count} 次出价 / ${point.active_user_count} 位用户`}
                />
              </div>
              <div className="text-[11px] text-[#8B97A7]">{formatDateLabel(point.date)}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#8B97A7]">
        <span>最高 {maxUsers} 位活跃用户</span>
        <span>合计 {points.reduce((sum, point) => sum + point.bid_count, 0)} 次出价</span>
      </div>
    </div>
  );
}

function DashboardActions() {
  return (
    <>
      <PageBackButton fallback="/profile" className="border-[#384553] bg-[#0F151C] hover:bg-[#182331]" />
      <Link
        to="/merchant/products"
        className="rounded-md border border-[#384553] bg-[#0F151C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#182331]"
      >
        商品管理
      </Link>
      <Link
        to="/merchant/orders"
        className="rounded-md border border-[#384553] bg-[#0F151C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#182331]"
      >
        订单管理
      </Link>
    </>
  );
}

function PanelHeader({ title, description, badge }: { title: string; description?: string; badge?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-black text-white">{title}</h2>
        {description ? <p className="mt-1 text-xs font-medium text-[#8B97A7]">{description}</p> : null}
      </div>
      {badge ? (
        <span className="rounded-md border border-[#384553] bg-[#182331] px-2.5 py-1 text-[10px] font-black text-[#B2BECC]">
          {badge}
        </span>
      ) : null}
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
      <MerchantConsole
        title="运营总览"
        eyebrow="商家控盘台"
        description="当前商家的拍品、成交额、订单及核心业务数据综合概览"
        actions={<DashboardActions />}
      >
        <div className="mx-auto max-w-7xl">
          <ConsolePanel className="py-20 text-center text-[#8B97A7]">
            <p className="text-sm font-medium">加载看板数据中...</p>
          </ConsolePanel>
        </div>
      </MerchantConsole>
    );
  }

  if (error || !dashboard) {
    return (
      <MerchantConsole
        title="运营总览"
        eyebrow="商家控盘台"
        description="当前商家的拍品、成交额、订单及核心业务数据综合概览"
        actions={<DashboardActions />}
      >
        <div className="mx-auto max-w-7xl">
          <div className="rounded-lg border border-[#F05268]/35 bg-[#F05268]/10 p-4 text-sm font-semibold text-[#FF8A9A]">
            {error || '看板加载失败'}
          </div>
        </div>
      </MerchantConsole>
    );
  }

  const summary = dashboard.transaction_summary;
  const analytics = analyticsOrEmpty(dashboard.analytics);

  return (
    <MerchantConsole
      title="运营总览"
      eyebrow="商家控盘台"
      description="当前商家的拍品、成交额、订单及核心业务数据综合概览"
      actions={<DashboardActions />}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ConsolePanel className="p-4">
            <MetricCell label="成交金额" value={formatPrice(summary.total_paid_amount)} tone="sold" />
          </ConsolePanel>
          <ConsolePanel className="p-4">
            <MetricCell label="成交订单" value={`${summary.paid_order_count} 单`} />
          </ConsolePanel>
          <ConsolePanel className="p-4">
            <MetricCell label="平均成交单价" value={formatPrice(summary.average_paid_price)} tone="info" />
          </ConsolePanel>
          <ConsolePanel className="p-4">
            <MetricCell label="进行中竞拍" value={`${dashboard.active_auctions.length} 场`} tone="pending" />
          </ConsolePanel>
          <ConsolePanel className="p-4">
            <MetricCell label="本周新增订单" value={`${dashboard.recent_orders.length} 单`} />
          </ConsolePanel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <ConsolePanel className="p-5">
            <PanelHeader title="成交趋势" description="近 7 天已支付订单成交额" badge="已支付统计" />
            <TransactionTrendChart points={analytics.transaction_trend} />
          </ConsolePanel>

          <ConsolePanel className="p-5">
            <PanelHeader title="出价分布区间" description="商户所有发布拍品的历史出价频次分布" />
            <BidDistributionChart buckets={analytics.bid_distribution} />
          </ConsolePanel>
        </section>

        <ConsolePanel className="p-5">
          <PanelHeader title="买家用户活跃度" description="近 7 天买家竞标出价次数与实际独立出价人数" badge="参与行为趋势" />
          <UserActivityChart points={analytics.user_activity} />
        </ConsolePanel>

        <section className="grid gap-6 lg:grid-cols-2">
          <ConsolePanel className="p-5">
            <PanelHeader title="商品各状态分类" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(Object.keys(PRODUCT_STATUS_TEXT) as ProductStatus[]).map((status) => (
                <div key={status} className="rounded-lg border border-[#263241] bg-[#131B24] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge label={PRODUCT_STATUS_TEXT[status]} tone={productStatusTone(status)} />
                    <div className="text-xl font-black tabular-nums text-white">{productCounts[status] ?? 0}</div>
                  </div>
                </div>
              ))}
            </div>
          </ConsolePanel>

          <ConsolePanel className="p-5">
            <PanelHeader title="订单状态分类汇总" />
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(ORDER_STATUS_TEXT) as OrderStatus[]).map((status) => (
                <div key={status} className="rounded-lg border border-[#263241] bg-[#131B24] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge label={ORDER_STATUS_TEXT[status]} tone={orderStatusTone(status)} />
                    <div className="text-xl font-black tabular-nums text-white">{orderCounts[status] ?? 0}</div>
                  </div>
                </div>
              ))}
            </div>
          </ConsolePanel>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <ConsolePanel className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-black text-white">进行中竞拍</h2>
              <Link to="/merchant/products" className="text-xs font-bold text-[#4BA3FF] transition hover:text-[#9CCBFF]">
                查看全部商品
              </Link>
            </div>
            {dashboard.active_auctions.length === 0 ? (
              <EmptyState title="暂无进行中竞拍" description="开拍后的商品会出现在这里。" />
            ) : (
              <div className="space-y-3">
                {dashboard.active_auctions.map((auction) => (
                  <article
                    key={auction.auction_id}
                    className="grid gap-3 rounded-lg border border-[#263241] bg-[#131B24] p-3 transition hover:border-[#3B4B5D] hover:bg-[#182331] sm:grid-cols-[minmax(0,1fr)_8rem_7rem] sm:items-center"
                  >
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-white">{auction.product_title}</h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-md border border-[#263241] px-2 py-1 text-[11px] font-bold text-[#8B97A7]">
                          竞拍ID {auction.auction_id}
                        </span>
                        <span className="rounded-md border border-[#263241] px-2 py-1 text-[11px] font-bold text-[#8B97A7]">
                          结束 {formatTime(auction.ended_at)}
                        </span>
                      </div>
                    </div>
                    <MetricCell label="当前价" value={formatPrice(auction.current_price)} tone="sold" />
                    <MetricCell label="出价次数" value={`${auction.bid_count} 次出价`} tone="active" />
                  </article>
                ))}
              </div>
            )}
          </ConsolePanel>

          <ConsolePanel className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-black text-white">本周新增订单</h2>
              <Link to="/merchant/orders" className="text-xs font-bold text-[#4BA3FF] transition hover:text-[#9CCBFF]">
                查看全部订单
              </Link>
            </div>
            {dashboard.recent_orders.length === 0 ? (
              <EmptyState title="暂无订单" description="竞拍成交后的新订单会出现在这里。" />
            ) : (
              <div className="space-y-3">
                {dashboard.recent_orders.map((order) => (
                  <article
                    key={order.id}
                    className="grid gap-3 rounded-lg border border-[#263241] bg-[#131B24] p-3 transition hover:border-[#3B4B5D] hover:bg-[#182331] sm:grid-cols-[minmax(0,1fr)_8rem_5rem] sm:items-center"
                  >
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#263241] bg-[#0B1016] text-[10px] font-black text-[#384553]">
                        {order.product_image_url ? (
                          <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover" />
                        ) : (
                          '无图'
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-black text-white">{order.product_title}</h3>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-md border border-[#263241] px-2 py-1 text-[11px] font-bold text-[#8B97A7]">
                            买家：{order.buyer_name || `用户 ${order.buyer_id}`}
                          </span>
                          <span className="rounded-md border border-[#263241] px-2 py-1 text-[11px] font-bold text-[#8B97A7]">
                            {formatTime(order.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <MetricCell label="成交金额" value={formatPrice(order.amount)} tone="sold" />
                    <div className="min-w-0">
                      <StatusBadge label={ORDER_STATUS_TEXT[order.status] || order.status} tone={orderStatusTone(order.status)} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </ConsolePanel>
        </section>
      </div>
    </MerchantConsole>
  );
}
