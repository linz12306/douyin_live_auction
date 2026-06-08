import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listOrders } from '../../api/order';
import PageBackButton from '../../components/PageBackButton';
import { usePageRefresh } from '../../hooks/usePageRefresh';
import type { OrderListItem, OrderStatus } from '../../types/order';

const STATUS_TEXT: Record<OrderStatus, string> = {
  pending_confirm: '待确认',
  pending_payment: '待支付',
  paid: '已支付',
  cancelled: '已取消',
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending_confirm: 'border-amber-300/50 bg-amber-300/15 text-amber-100',
  pending_payment: 'border-sky-300/50 bg-sky-300/15 text-sky-100',
  paid: 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100',
  cancelled: 'border-rose-300/50 bg-rose-300/15 text-rose-100',
};

function formatPrice(value: number) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function statusText(status: string) {
  return STATUS_TEXT[status as OrderStatus] || status;
}

function statusBadge(status: string) {
  return STATUS_BADGE[status as OrderStatus] || 'border-white/20 bg-white/10 text-white/70';
}

function formatDeadline(order: OrderListItem) {
  if (order.status !== 'pending_confirm' || !order.confirm_deadline) return '';
  return `确认截止 ${new Date(order.confirm_deadline).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function OrderList() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    setRefreshing(true);
    setError('');

    try {
      const result = await listOrders();
      setOrders(result.items);
    } catch {
      setError('订单列表加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    listOrders()
      .then((result) => {
        if (mounted) setOrders(result.items);
      })
      .catch(() => {
        if (mounted) setError('订单列表加载失败');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  usePageRefresh(loadOrders);

  return (
    <div className="min-h-screen bg-[#050708] text-white relative overflow-hidden">
      {/* 氛围背景微光 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-600/5 blur-[120px] pointer-events-none" />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 relative z-10">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <PageBackButton fallback="/app/auctions" className="mb-3 border-white/10 bg-white/5 hover:bg-white/10" />
            <h1 className="text-3xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">我的订单</h1>
            <p className="mt-1 text-sm text-slate-400/80">实时查看您的中标确认进度与安全结算支付</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadOrders()}
              disabled={refreshing}
              className="px-4 py-2 border border-white/10 bg-white/5 text-white/90 rounded-xl hover:border-white/25 hover:bg-white/10 transition duration-200 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? '刷新中...' : '刷新'}
            </button>
            <Link to="/app/auctions" className="px-4 py-2 bg-rose-500 text-white rounded-xl hover:bg-rose-400 shadow-lg shadow-rose-500/20 transition duration-200 text-sm font-bold flex items-center">
              竞拍大厅
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-white/8 bg-white/5 p-12 text-center text-slate-400/80 backdrop-blur-xl">
            <p className="text-sm font-semibold">加载中...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200 backdrop-blur-lg flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/5 p-12 text-center backdrop-blur-xl">
            <div className="text-4xl mb-3">🛍️</div>
            <p className="font-bold text-slate-200">暂无订单信息</p>
            <p className="mt-2 text-xs text-slate-500">拍得宝贝后，付款确认订单会出现在这里。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <article
                key={order.id}
                className="group rounded-2xl border border-white/8 bg-white/6 p-5 backdrop-blur-xl shadow-2xl shadow-black/30 transition-all duration-200 hover:border-rose-500/30 hover:-translate-y-0.5"
              >
                <div className="flex gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-950 border border-white/5">
                    {order.product_image_url ? (
                      <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">暂无图片</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-3">
                        <h2 className="break-words text-base font-bold text-slate-200 group-hover:text-rose-300 transition-colors duration-200 line-clamp-1">{order.product_title}</h2>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black tracking-wide uppercase ${statusBadge(order.status)}`}>
                          {statusText(order.status)}
                        </span>
                      </div>
                      {formatDeadline(order) ? (
                        <p className="mt-1 text-xs font-semibold text-rose-300 flex items-center gap-1">
                          <span>⏰</span>
                          <span>{formatDeadline(order)}</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">中标价</div>
                        <div className="text-xl font-black text-rose-300 tabular-nums">{formatPrice(order.amount)}</div>
                      </div>
                      <Link
                        to={`/app/orders/${order.id}`}
                        className="rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2 text-xs font-black text-white shadow-md shadow-rose-500/15 transition duration-150 hover:from-rose-400 hover:to-red-400 active:scale-[0.98]"
                      >
                        查看详情
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
