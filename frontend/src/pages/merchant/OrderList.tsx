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
  pending_confirm: 'bg-yellow-500/20 text-yellow-200 border-yellow-500',
  pending_payment: 'bg-blue-500/20 text-blue-200 border-blue-500',
  paid: 'bg-green-500/20 text-green-200 border-green-500',
  cancelled: 'bg-red-500/20 text-red-200 border-red-500',
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">订单管理</h1>
            <p className="mt-1 text-sm text-white/55">查看成交订单与买家信息</p>
          </div>
          <Link to="/merchant/products" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/75 hover:border-white/40">
            商品管理
          </Link>
        </header>

        {loading ? (
          <p className="py-12 text-center text-white/60">加载中...</p>
        ) : error ? (
          <div className="rounded-lg border border-red-400/50 bg-red-500/20 px-4 py-3 text-sm text-red-100">{error}</div>
        ) : orders.length === 0 ? (
          <p className="py-12 text-center text-white/60">暂无订单</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <article key={order.id} className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur-lg">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5">
                    {order.product_image_url ? (
                      <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-white/40">无图</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="break-words font-semibold text-white">{order.product_title}</h2>
                        <p className="mt-1 text-sm text-white/55">买家：{order.buyer_name || `用户 ${order.buyer_id}`}</p>
                      </div>
                      <span className={`shrink-0 rounded border px-2 py-1 text-xs ${statusBadge(order.status)}`}>
                        {statusText(order.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="text-xl font-bold text-green-200">{formatPrice(order.amount)}</div>
                      <Link to={`/merchant/orders/${order.id}`} className="rounded-lg bg-purple-500 px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
                        查看订单
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
