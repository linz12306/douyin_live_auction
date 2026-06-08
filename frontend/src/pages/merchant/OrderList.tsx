import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listOrders } from '../../api/order';
import MerchantConsole from '../../components/merchant/MerchantConsole';
import {
  ConsolePanel,
  EmptyState,
  MetricCell,
  StatusBadge,
} from '../../components/merchant/MerchantPrimitives';
import { ORDER_STATUS_TEXT, orderStatusTone } from '../../components/merchant/merchantStatus';
import PageBackButton from '../../components/PageBackButton';
import { usePageRefresh } from '../../hooks/usePageRefresh';
import type { OrderListItem } from '../../types/order';

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

function secondaryTime(order: OrderListItem) {
  if (order.status === 'paid') return { label: '支付时间', value: order.paid_at };
  if (order.status === 'pending_payment') return { label: '确认时间', value: order.confirmed_at };
  if (order.status === 'cancelled') return { label: '取消时间', value: order.cancelled_at };
  if (order.confirm_deadline) return { label: '待确认截止', value: order.confirm_deadline };
  return { label: '更新时间', value: order.updated_at };
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
    <MerchantConsole
      title="成交订单"
      eyebrow="商家控盘台"
      description="按商品、买家、金额、状态和时间扫描成交后的订单流转"
      actions={
        <>
          <PageBackButton fallback="/merchant/products" className="border-[#384553] bg-[#0F151C] hover:bg-[#182331]" />
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={refreshing}
            className="rounded-md border border-[#384553] bg-[#0F151C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#182331] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? '刷新中...' : '刷新'}
          </button>
          <Link
            to="/merchant/products"
            className="rounded-md border border-[#384553] bg-[#0F151C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#182331]"
          >
            商品管理
          </Link>
          <Link
            to="/merchant/dashboard"
            className="rounded-md border border-[#384553] bg-[#0F151C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#182331]"
          >
            运营看板
          </Link>
        </>
      }
    >
      <div className="mx-auto max-w-7xl">
        {loading ? (
          <ConsolePanel className="py-20 text-center text-[#8B97A7]">
            <p className="text-sm font-medium">加载订单中...</p>
          </ConsolePanel>
        ) : error ? (
          <div className="rounded-lg border border-[#F05268]/35 bg-[#F05268]/10 p-4 text-sm text-[#FF8A9A]">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState title="暂无成交订单" description="竞拍成交后生成的订单会展示在这里。" />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const time = secondaryTime(order);

              return (
                <article
                  key={order.id}
                  aria-label={`订单 ${order.id}`}
                  className="grid gap-4 rounded-lg border border-[#263241] bg-[#131B24] p-3 transition hover:border-[#3B4B5D] hover:bg-[#182331] xl:grid-cols-[minmax(0,1fr)_minmax(8rem,11rem)_8rem_7rem_9rem_9rem_5rem] xl:items-center"
                >
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#263241] bg-[#0B1016] text-[10px] font-black text-[#384553]">
                      {order.product_image_url ? <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover" /> : '无图'}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-black text-white">{order.product_title}</h2>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-md border border-[#263241] px-2 py-1 text-[11px] font-bold text-[#8B97A7]">
                          订单ID {order.id}
                        </span>
                        <span className="rounded-md border border-[#263241] px-2 py-1 text-[11px] font-bold text-[#8B97A7]">
                          商品ID {order.product_id}
                        </span>
                        <span className="rounded-md border border-[#263241] px-2 py-1 text-[11px] font-bold text-[#8B97A7]">
                          竞拍ID {order.auction_id}
                        </span>
                      </div>
                    </div>
                  </div>
                  <MetricCell label="买家" value={order.buyer_name || `用户 ${order.buyer_id}`} />
                  <MetricCell label="成交金额" value={formatPrice(order.amount)} tone="sold" />
                  <div className="min-w-0">
                    <StatusBadge label={ORDER_STATUS_TEXT[order.status]} tone={orderStatusTone(order.status)} />
                  </div>
                  <MetricCell label="创建时间" value={formatTime(order.created_at)} />
                  <MetricCell label={time.label} value={formatTime(time.value)} />
                  <Link
                    to={`/merchant/orders/${order.id}`}
                    aria-label={`查看订单 ${order.id} 详情`}
                    className="rounded-md border border-[#384553] bg-[#0F151C] px-3 py-2 text-center text-xs font-bold text-white transition hover:bg-[#182331]"
                  >
                    详情
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </MerchantConsole>
  );
}
