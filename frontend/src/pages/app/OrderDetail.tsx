import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { cancelOrder, confirmOrder, getOrder, payOrder } from '../../api/order';
import PageBackButton from '../../components/PageBackButton';
import { usePageRefresh } from '../../hooks/usePageRefresh';
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
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadOrder = useCallback(async () => {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setError('订单不存在');
      setLoading(false);
      return;
    }

    setRefreshing(true);
    setError('');

    try {
      setOrder(await getOrder(orderId));
    } catch {
      setError('订单详情加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

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

  usePageRefresh(loadOrder, { disabled: !Number.isFinite(orderId) || orderId <= 0 });

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
    return (
      <div className="min-h-screen bg-[#050708] flex items-center justify-center text-slate-400/80">
        <p className="text-sm font-semibold">加载中...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#050708] flex items-center justify-center text-slate-400/80">
        <p className="text-sm font-semibold">{error || '订单不存在'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050708] relative overflow-hidden text-white">
      {/* 极光背景微光 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-600/5 blur-[120px] pointer-events-none" />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 relative z-10">
        <div className="mb-6 flex flex-wrap gap-2">
          <PageBackButton fallback="/app/orders" className="border-white/10 bg-white/5 hover:bg-white/10" />
          <button
            type="button"
            onClick={() => void loadOrder()}
            disabled={refreshing || submitting}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? '刷新中...' : '刷新状态'}
          </button>
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/8 bg-[#111422]/60 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="grid gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
            <div className="aspect-[4/3] bg-zinc-950 border-b md:border-b-0 md:border-r border-white/5">
              {order.product_image_url ? (
                <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-slate-500">暂无商品大图</div>
              )}
            </div>
            <div className="min-w-0 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h1 className="break-words text-2xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight leading-snug">{order.product_title}</h1>
                  <span className="shrink-0 inline-block px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide border uppercase border-rose-500/25 bg-rose-500/10 text-rose-300">
                    {statusText(order.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">{order.product_description || '暂无商品介绍'}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-950/40 p-4 border border-white/5 shadow-inner">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">成交结算价</div>
                    <div className="mt-1 text-2xl font-black text-rose-300 tabular-nums">{formatPrice(order.amount)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-950/40 p-4 border border-white/5 shadow-inner">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">确认截止时间</div>
                    <div className="mt-1 text-sm font-bold text-slate-200">{formatTime(order.confirm_deadline)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-950/40 p-4 border border-white/5 shadow-inner">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">确认成立时间</div>
                    <div className="mt-1 text-sm font-bold text-slate-200">{formatTime(order.confirmed_at)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-950/40 p-4 border border-white/5 shadow-inner">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">实际完成支付</div>
                    <div className="mt-1 text-sm font-bold text-slate-200">{formatTime(order.paid_at)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                {order.cancel_reason ? (
                  <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200 flex items-center gap-2">
                    <span className="shrink-0">⚠️</span>
                    <span className="font-semibold">取消原因：{order.cancel_reason}</span>
                  </div>
                ) : null}

                {error ? (
                  <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200 flex items-center gap-2">
                    <span className="shrink-0">⚠️</span>
                    <span>{error}</span>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  {order.actions.can_confirm ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => runAction('confirm')}
                      className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 text-sm active:scale-[0.98] transition shadow-lg shadow-emerald-500/15 disabled:opacity-50 disabled:scale-100"
                    >
                      确认中标订单
                    </button>
                  ) : null}
                  {order.actions.can_pay ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => runAction('pay')}
                      className="rounded-xl bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-400 hover:to-red-400 text-white font-black px-6 py-3 text-sm active:scale-[0.98] transition shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:scale-100"
                    >
                      立即模拟支付
                    </button>
                  ) : null}
                  {order.actions.can_cancel ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => runAction('cancel')}
                      className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-bold px-6 py-3 text-sm transition"
                    >
                      申请取消订单
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
