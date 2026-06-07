import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getOrder } from '../../api/order';
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

export default function OrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);
  const [order, setOrder] = useState<OrderDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080b11] flex items-center justify-center text-slate-400/80">
        <p className="text-sm font-semibold">加载中...</p>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="min-h-screen bg-[#080b11] flex items-center justify-center text-slate-400/80">
        <p className="text-sm font-semibold">{error || '订单不存在'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b11] relative overflow-hidden text-white">
      {/* 背景光效 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/3 blur-[120px] pointer-events-none" />

      <main className="mx-auto max-w-4xl px-4 py-8 relative z-10">
        <div className="mb-6 flex flex-wrap gap-2">
          <PageBackButton fallback="/merchant/orders" className="border-white/10 bg-white/5 hover:bg-white/10" />
          <button
            type="button"
            onClick={() => void loadOrder()}
            disabled={refreshing}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? '刷新中...' : '刷新状态'}
          </button>
        </div>

        <section className="rounded-2xl border border-white/8 bg-[#111422]/60 p-6 backdrop-blur-xl shadow-2xl shadow-black/40">
          <div className="flex flex-col md:flex-row items-start gap-6 border-b border-white/5 pb-6">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-950 border border-white/5 shadow-inner">
              {order.product_image_url ? (
                <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">暂无图</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <h1 className="break-words text-2xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight leading-snug">{order.product_title}</h1>
                <span className="shrink-0 inline-block px-3 py-1 rounded-full text-xs font-black tracking-wide border uppercase border-purple-500/25 bg-purple-500/10 text-purple-300">
                  {statusText(order.status)}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{order.product_description || '暂无商品详情介绍'}</p>
              <p className="mt-4 text-sm text-slate-400 font-semibold">
                {"买家：" + (order.buyer_name || `用户 ${order.buyer_id}`)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-950/40 p-4 border border-white/5 shadow-inner">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">成交金额</div>
              <div className="mt-1 text-2xl font-black text-transparent bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text tabular-nums">{formatPrice(order.amount)}</div>
            </div>
            <div className="rounded-xl bg-slate-950/40 p-4 border border-white/5 shadow-inner">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">创建时间</div>
              <div className="mt-1 text-sm font-bold text-slate-200">{formatTime(order.created_at)}</div>
            </div>
            <div className="rounded-xl bg-slate-950/40 p-4 border border-white/5 shadow-inner">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">确认时间</div>
              <div className="mt-1 text-sm font-bold text-slate-200">{formatTime(order.confirmed_at)}</div>
            </div>
            <div className="rounded-xl bg-slate-950/40 p-4 border border-white/5 shadow-inner">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">支付时间</div>
              <div className="mt-1 text-sm font-bold text-slate-200">{formatTime(order.paid_at)}</div>
            </div>
          </div>

          {order.cancel_reason ? (
            <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 flex items-center gap-2">
              <span className="shrink-0 text-rose-400 font-bold">⚠️</span>
              <span className="font-semibold">取消原因：{order.cancel_reason}</span>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
