import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listOrders } from '../../api/order';
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
  const [error, setError] = useState('');

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-teal-950 to-zinc-950 text-white">
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">我的订单</h1>
            <p className="mt-1 text-sm text-white/55">中标确认与支付进度</p>
          </div>
          <Link to="/app/auctions" className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/75 hover:border-white/35">
            竞拍大厅
          </Link>
        </header>

        {loading ? (
          <div className="rounded-lg border border-white/10 bg-white/8 p-8 text-center text-white/65">加载中...</div>
        ) : error ? (
          <div className="rounded-lg border border-rose-400/40 bg-rose-500/12 p-4 text-sm text-rose-100">{error}</div>
        ) : orders.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/8 p-8 text-center">
            <p className="font-medium">暂无订单</p>
            <p className="mt-2 text-sm text-white/55">中标后订单会出现在这里。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <article key={order.id} className="rounded-lg border border-white/12 bg-white/10 p-4 shadow-xl shadow-black/20">
                <div className="flex gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                    {order.product_image_url ? (
                      <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-white/40">暂无图片</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="break-words text-base font-semibold">{order.product_title}</h2>
                      <span className={`shrink-0 rounded border px-2 py-1 text-xs ${statusBadge(order.status)}`}>
                        {statusText(order.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-xs text-white/45">成交金额</div>
                        <div className="text-xl font-bold text-emerald-200">{formatPrice(order.amount)}</div>
                        {formatDeadline(order) ? <div className="mt-1 text-xs text-amber-100">{formatDeadline(order)}</div> : null}
                      </div>
                      <Link to={`/app/orders/${order.id}`} className="rounded-lg bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-200">
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
