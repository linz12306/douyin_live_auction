import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMerchantDashboard } from '../../api/dashboard';
import PageBackButton from '../../components/PageBackButton';
import type { MerchantDashboard } from '../../types/dashboard';
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

function countByStatus<TStatus extends string>(items: Array<{ status: TStatus; count: number }>) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = item.count;
    return acc;
  }, {});
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 px-4 py-10 text-center text-white/65">
        加载中...
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
        <main className="mx-auto max-w-6xl px-4 py-8">
          <PageBackButton fallback="/profile" className="mb-3" />
          <div className="rounded-lg border border-red-400/50 bg-red-500/20 px-4 py-3 text-sm text-red-100">
            {error || '看板加载失败'}
          </div>
        </main>
      </div>
    );
  }

  const summary = dashboard.transaction_summary;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      <main className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <PageBackButton fallback="/profile" className="mb-3" />
            <h1 className="text-2xl font-bold text-white">运营看板</h1>
            <p className="mt-1 text-sm text-white/55">当前商家的商品、订单与成交概览</p>
          </div>
          <div className="flex gap-2">
            <Link to="/merchant/products" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/75 hover:border-white/40">
              商品管理
            </Link>
            <Link to="/merchant/orders" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/75 hover:border-white/40">
              订单管理
            </Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-5">
          <div className="rounded-lg border border-white/15 bg-white/10 p-4">
            <div className="text-sm text-white/55">成交金额</div>
            <div className="mt-2 text-2xl font-bold text-emerald-200">{formatPrice(summary.total_paid_amount)}</div>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 p-4">
            <div className="text-sm text-white/55">成交订单</div>
            <div className="mt-2 text-2xl font-bold text-white">{summary.paid_order_count} 单</div>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 p-4">
            <div className="text-sm text-white/55">平均成交价</div>
            <div className="mt-2 text-2xl font-bold text-cyan-200">{formatPrice(summary.average_paid_price)}</div>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 p-4">
            <div className="text-sm text-white/55">进行中竞拍</div>
            <div className="mt-2 text-2xl font-bold text-amber-200">{dashboard.active_auctions.length} 场</div>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 p-4">
            <div className="text-sm text-white/55">最近订单</div>
            <div className="mt-2 text-2xl font-bold text-white">{dashboard.recent_orders.length} 单</div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-white/15 bg-white/10 p-4">
            <h2 className="font-semibold text-white">商品状态</h2>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(PRODUCT_STATUS_TEXT) as ProductStatus[]).map((status) => (
                <div key={status} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                  <div className="text-xs text-white/50">{PRODUCT_STATUS_TEXT[status]}</div>
                  <div className="mt-1 text-xl font-bold text-white">{productCounts[status] ?? 0}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/15 bg-white/10 p-4">
            <h2 className="font-semibold text-white">订单状态</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(Object.keys(ORDER_STATUS_TEXT) as OrderStatus[]).map((status) => (
                <div key={status} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                  <div className="text-xs text-white/50">{ORDER_STATUS_TEXT[status]}</div>
                  <div className="mt-1 text-xl font-bold text-white">{orderCounts[status] ?? 0}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-white/15 bg-white/10 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold text-white">进行中竞拍</h2>
              <Link to="/merchant/products" className="text-sm text-cyan-200 hover:text-cyan-100">查看商品</Link>
            </div>
            {dashboard.active_auctions.length === 0 ? (
              <p className="py-8 text-center text-white/55">暂无进行中竞拍</p>
            ) : (
              <div className="space-y-3">
                {dashboard.active_auctions.map((auction) => (
                  <article key={auction.auction_id} className="rounded-lg border border-white/10 bg-black/10 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold text-white">{auction.product_title}</h3>
                        <p className="mt-1 text-sm text-white/50">结束：{formatTime(auction.ended_at)}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-200">{formatPrice(auction.current_price)}</div>
                        <div className="mt-1 text-xs text-white/50">{auction.bid_count} 次出价</div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-white/15 bg-white/10 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold text-white">最近订单</h2>
              <Link to="/merchant/orders" className="text-sm text-cyan-200 hover:text-cyan-100">查看订单</Link>
            </div>
            {dashboard.recent_orders.length === 0 ? (
              <p className="py-8 text-center text-white/55">暂无订单</p>
            ) : (
              <div className="space-y-3">
                {dashboard.recent_orders.map((order) => (
                  <article key={order.id} className="rounded-lg border border-white/10 bg-black/10 p-3">
                    <div className="flex gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/5">
                        {order.product_image_url ? (
                          <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-white/40">无图</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="break-words font-semibold text-white">{order.product_title}</h3>
                            <p className="mt-1 text-sm text-white/50">买家：{order.buyer_name || `用户 ${order.buyer_id}`}</p>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-emerald-200">{formatPrice(order.amount)}</div>
                            <div className="mt-1 text-xs text-white/50">{ORDER_STATUS_TEXT[order.status] || order.status}</div>
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
