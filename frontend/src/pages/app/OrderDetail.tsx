import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cancelOrder, confirmOrder, getOrder, payOrder } from '../../api/order';
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

function errorMessage(err: unknown) {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return '订单操作失败';
}

export default function OrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);
  const [order, setOrder] = useState<OrderDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  async function runAction(action: 'confirm' | 'pay' | 'cancel') {
    if (!order || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const nextOrder = action === 'confirm'
        ? await confirmOrder(order.id)
        : action === 'pay'
          ? await payOrder(order.id)
          : await cancelOrder(order.id);
      setOrder(nextOrder);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-950 px-4 py-10 text-center text-white/65">加载中...</div>;
  }

  if (!order) {
    return <div className="min-h-screen bg-slate-950 px-4 py-10 text-center text-white/65">{error || '订单不存在'}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-teal-950 to-zinc-950 text-white">
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/app/orders" className="mb-4 inline-flex text-sm text-white/65 hover:text-white">
          返回订单
        </Link>

        <section className="overflow-hidden rounded-lg border border-white/12 bg-white/10 shadow-xl shadow-black/20">
          <div className="grid gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
            <div className="aspect-[4/3] bg-zinc-900 md:aspect-auto">
              {order.product_image_url ? (
                <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full min-h-64 items-center justify-center text-sm text-white/45">暂无图片</div>
              )}
            </div>
            <div className="min-w-0 p-5">
              <div className="flex items-start justify-between gap-3">
                <h1 className="break-words text-2xl font-bold">{order.product_title}</h1>
                <span className="shrink-0 rounded border border-emerald-300/40 bg-emerald-300/15 px-2 py-1 text-xs text-emerald-100">
                  {statusText(order.status)}
                </span>
              </div>
              <p className="mt-3 text-sm text-white/60">{order.product_description || '暂无商品介绍'}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-zinc-950/45 p-3">
                  <div className="text-xs text-white/45">成交金额</div>
                  <div className="mt-1 text-2xl font-black text-emerald-200">{formatPrice(order.amount)}</div>
                </div>
                <div className="rounded-lg bg-zinc-950/45 p-3">
                  <div className="text-xs text-white/45">确认截止</div>
                  <div className="mt-1 text-sm text-white/85">{formatTime(order.confirm_deadline)}</div>
                </div>
                <div className="rounded-lg bg-zinc-950/45 p-3">
                  <div className="text-xs text-white/45">确认时间</div>
                  <div className="mt-1 text-sm text-white/85">{formatTime(order.confirmed_at)}</div>
                </div>
                <div className="rounded-lg bg-zinc-950/45 p-3">
                  <div className="text-xs text-white/45">支付时间</div>
                  <div className="mt-1 text-sm text-white/85">{formatTime(order.paid_at)}</div>
                </div>
              </div>

              {order.cancel_reason ? (
                <div className="mt-4 rounded border border-rose-300/35 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
                  取消原因：{order.cancel_reason}
                </div>
              ) : null}
              {error ? (
                <div className="mt-4 rounded border border-rose-300/35 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                {order.actions.can_confirm ? (
                  <button type="button" disabled={submitting} onClick={() => runAction('confirm')} className="rounded-lg bg-emerald-300 px-4 py-3 text-sm font-bold text-zinc-950 hover:bg-emerald-200 disabled:opacity-60">
                    确认订单
                  </button>
                ) : null}
                {order.actions.can_pay ? (
                  <button type="button" disabled={submitting} onClick={() => runAction('pay')} className="rounded-lg bg-sky-300 px-4 py-3 text-sm font-bold text-zinc-950 hover:bg-sky-200 disabled:opacity-60">
                    模拟支付
                  </button>
                ) : null}
                {order.actions.can_cancel ? (
                  <button type="button" disabled={submitting} onClick={() => runAction('cancel')} className="rounded-lg border border-rose-300/45 bg-rose-500/15 px-4 py-3 text-sm font-bold text-rose-100 hover:bg-rose-500/25 disabled:opacity-60">
                    取消订单
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
