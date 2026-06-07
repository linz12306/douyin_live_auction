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
  pending_confirm: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  pending_payment: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  cancelled: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
};

function formatPrice(value: number) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function statusText(status: string) {
  return STATUS_TEXT[status as OrderStatus] || status;
}

function statusBadge(status: string) {
  return STATUS_BADGE[status as OrderStatus] || 'bg-white/10 text-white/70 border-white/20';
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
    <div className="min-h-screen bg-[#080b11] relative overflow-hidden text-white">
      {/* 背景光效 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/3 blur-[120px] pointer-events-none" />

      <main className="mx-auto max-w-5xl px-4 py-8 relative z-10">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
          <div>
            <PageBackButton fallback="/merchant/products" className="mb-3 border-white/10 bg-white/5 hover:bg-white/10" />
            <h1 className="text-3xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">订单管理</h1>
            <p className="mt-1 text-sm text-slate-400/80">查看买家中立竞拍成交后生成的订单与支付状态</p>
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
            <Link to="/merchant/products" className="px-4 py-2 border border-white/10 bg-white/5 text-white/90 rounded-xl hover:border-white/25 hover:bg-white/10 transition duration-200 text-sm font-semibold flex items-center">
              商品管理
            </Link>
            <Link to="/merchant/dashboard" className="px-4 py-2 border border-white/10 bg-white/5 text-white/90 rounded-xl hover:border-white/25 hover:bg-white/10 transition duration-200 text-sm font-semibold flex items-center">
              运营看板
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="text-slate-400/80 text-center py-20 bg-[#111422]/30 rounded-2xl border border-white/5 backdrop-blur-xl">
            <p className="text-sm font-medium">加载订单中...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 backdrop-blur-lg">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-slate-400/80 text-center py-20 bg-[#111422]/30 rounded-2xl border border-white/5 backdrop-blur-xl">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm font-medium">暂无成交订单</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {orders.map((order) => (
              <article
                key={order.id}
                className="group rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl transition-all duration-200 hover:border-purple-500/40 hover:-translate-y-0.5 shadow-lg shadow-black/20"
              >
                <div className="flex gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-900 border border-white/5">
                    {order.product_image_url ? (
                      <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] font-semibold text-slate-500">暂无图</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-3">
                        <h2 className="break-words font-bold text-slate-200 text-sm leading-snug group-hover:text-purple-300 transition-colors duration-200 line-clamp-1">{order.product_title}</h2>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black tracking-wide uppercase ${statusBadge(order.status)}`}>
                          {statusText(order.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">买家：{order.buyer_name || `用户 ${order.buyer_id}`}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                      <div className="text-lg font-black text-transparent bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text tabular-nums">{formatPrice(order.amount)}</div>
                      <Link
                        to={`/merchant/orders/${order.id}`}
                        className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-purple-500/15 hover:from-violet-500 hover:to-purple-500 transition duration-200"
                      >
                        详情大区 ›
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
