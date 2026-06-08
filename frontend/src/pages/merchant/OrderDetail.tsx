import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getOrder } from '../../api/order';
import MerchantConsole from '../../components/merchant/MerchantConsole';
import {
  ConsolePanel,
  MetricCell,
  StatusBadge,
} from '../../components/merchant/MerchantPrimitives';
import { ORDER_STATUS_TEXT, orderStatusTone } from '../../components/merchant/merchantStatus';
import PageBackButton from '../../components/PageBackButton';
import { usePageRefresh } from '../../hooks/usePageRefresh';
import type { OrderDetail as OrderDetailType } from '../../types/order';

function formatPrice(value: number) {
  return `¥${Number(value || 0).toFixed(2)}`;
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
  const isValidOrderId = Number.isFinite(orderId) && orderId > 0;
  const [order, setOrder] = useState<OrderDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadOrder = useCallback(async () => {
    if (!isValidOrderId) return;

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
  }, [isValidOrderId, orderId]);

  useEffect(() => {
    if (!isValidOrderId) return;
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
  }, [isValidOrderId, orderId]);

  usePageRefresh(loadOrder, { disabled: !isValidOrderId });

  if (!isValidOrderId) {
    return (
      <MerchantConsole title="成交详情" eyebrow="商家控盘台" description="查看订单金额、状态和关键流转时间">
        <div className="rounded-lg border border-[#F05268]/35 bg-[#F05268]/10 p-4 text-sm text-[#FF8A9A]">
          订单不存在
        </div>
      </MerchantConsole>
    );
  }
  if (loading) {
    return (
      <MerchantConsole title="成交详情" eyebrow="商家控盘台" description="查看订单金额、状态和关键流转时间">
        <ConsolePanel className="py-20 text-center text-[#8B97A7]">
          <p className="text-sm font-semibold">加载中...</p>
        </ConsolePanel>
      </MerchantConsole>
    );
  }
  if (!order) {
    return (
      <MerchantConsole title="成交详情" eyebrow="商家控盘台" description="查看订单金额、状态和关键流转时间">
        <div className="rounded-lg border border-[#F05268]/35 bg-[#F05268]/10 p-4 text-sm text-[#FF8A9A]">
          {error || '订单不存在'}
        </div>
      </MerchantConsole>
    );
  }

  const timeline = [
    { label: '创建时间', value: order.created_at },
    { label: '确认时间', value: order.confirmed_at },
    { label: '支付时间', value: order.paid_at },
    { label: '取消时间', value: order.cancelled_at },
  ];

  return (
    <MerchantConsole
      title="成交详情"
      eyebrow="商家控盘台"
      description="只读查看成交订单的商品、买家、金额、状态和关键流转时间"
      actions={
        <>
          <PageBackButton fallback="/merchant/orders" className="border-[#384553] bg-[#0F151C] hover:bg-[#182331]" />
          <button
            type="button"
            onClick={() => void loadOrder()}
            disabled={refreshing}
            className="rounded-md border border-[#384553] bg-[#0F151C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#182331] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? '刷新中...' : '刷新状态'}
          </button>
        </>
      }
    >
      <div className="mx-auto max-w-5xl space-y-4">
        <ConsolePanel className="p-4">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#263241] bg-[#0B1016] text-xs font-black text-[#384553]">
                {order.product_image_url ? (
                  <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover" />
                ) : (
                  '无图'
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-xl font-black text-white">{order.product_title}</h2>
                  <StatusBadge label={ORDER_STATUS_TEXT[order.status]} tone={orderStatusTone(order.status)} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#8B97A7]">{order.product_description || '暂无商品详情介绍'}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MetricCell label="买家" value={order.buyer_name || `用户 ${order.buyer_id}`} />
                  <MetricCell label="买家ID" value={order.buyer_id} />
                  <MetricCell label="订单ID" value={order.id} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#263241] bg-[#0B1016] p-4">
              <div className="text-[11px] font-semibold text-[#596575]">成交金额</div>
              <div className="mt-2 text-3xl font-black tabular-nums text-[#D9F99D]">{formatPrice(order.amount)}</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MetricCell label="商品ID" value={order.product_id} />
                <MetricCell label="竞拍ID" value={order.auction_id} />
              </div>
            </div>
          </div>
        </ConsolePanel>

        <ConsolePanel className="p-4">
          <h2 className="text-sm font-black text-white">订单时间线</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {timeline.map((item) => (
              <div key={item.label} className="rounded-md border border-[#263241] bg-[#131B24] p-3">
                <div className="text-[11px] font-semibold text-[#596575]">{item.label}</div>
                <div className="mt-1 text-sm font-black tabular-nums text-[#F5F7FA]">{formatTime(item.value)}</div>
              </div>
            ))}
          </div>

          {order.cancel_reason ? (
            <div className="mt-4 rounded-md border border-[#F05268]/35 bg-[#F05268]/10 px-4 py-3 text-sm text-[#FF8A9A]">
              <span className="font-semibold">取消原因：{order.cancel_reason}</span>
            </div>
          ) : null}
        </ConsolePanel>
      </div>
    </MerchantConsole>
  );
}
