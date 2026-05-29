import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrder } from '../../api/order';
import type { OrderDetail as OrderDetailType, OrderStatus } from '../../types/order';

const STATUS_TEXT: Record<OrderStatus, string> = {
  pending_confirm: '待确认',
  pending_payment: '待支付',
  paid: '已支付',
  cancelled: '已取消',
};

function formatPrice(value: number) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function statusText(status?: string) {
  return status ? STATUS_TEXT[status as OrderStatus] || status : '加载中';
}

function formatTime(value?: string) {
  if (!value) return '未记录';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);
  const [order, setOrder] = useState<OrderDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Number.isFinite(orderId) || orderId <= 0) return;
    let mounted = true;
    getOrder(orderId)
      .then((nextOrder) => {
        if (mounted) setOrder(nextOrder);
      })
      .catch(() => {
        if (mounted) setError('订单详情加载失败');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [orderId]);

  if (loading) {
    return <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 px-4 py-10 text-center text-white/60">加载中...</div>;
  }
  if (!order) {
    return <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 px-4 py-10 text-center text-white/60">{error || '订单不存在'}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/merchant/orders" className="mb-4 inline-flex text-sm text-white/65 hover:text-white">
          返回订单
        </Link>

        <section className="rounded-lg border border-white/20 bg-white/10 p-5 backdrop-blur-lg">
          <div className="flex items-start gap-5">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-white/5">
              {order.product_image_url ? (
                <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-white/40">无图</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h1 className="break-words text-2xl font-bold text-white">{order.product_title}</h1>
                <span className="shrink-0 rounded border border-white/20 bg-white/10 px-2 py-1 text-xs text-white/80">
                  {statusText(order.status)}
                </span>
              </div>
              <p className="mt-2 text-sm text-white/60">{order.product_description || '暂无商品介绍'}</p>
              <p className="mt-3 text-sm text-white/75">买家：{order.buyer_name || `用户 ${order.buyer_id}`}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white/8 p-3">
              <div className="text-xs text-white/45">成交金额</div>
              <div className="mt-1 text-2xl font-bold text-green-200">{formatPrice(order.amount)}</div>
            </div>
            <div className="rounded-lg bg-white/8 p-3">
              <div className="text-xs text-white/45">创建时间</div>
              <div className="mt-1 text-sm text-white/85">{formatTime(order.created_at)}</div>
            </div>
            <div className="rounded-lg bg-white/8 p-3">
              <div className="text-xs text-white/45">确认时间</div>
              <div className="mt-1 text-sm text-white/85">{formatTime(order.confirmed_at)}</div>
            </div>
            <div className="rounded-lg bg-white/8 p-3">
              <div className="text-xs text-white/45">支付时间</div>
              <div className="mt-1 text-sm text-white/85">{formatTime(order.paid_at)}</div>
            </div>
          </div>

          {order.cancel_reason ? (
            <div className="mt-4 rounded border border-red-400/40 bg-red-500/20 px-3 py-2 text-sm text-red-100">
              取消原因：{order.cancel_reason}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
