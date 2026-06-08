import { useCallback, useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getProduct, deleteProduct } from '../../api/product';
import { activateAuction, cancelAuction } from '../../api/auction';
import MerchantConsole from '../../components/merchant/MerchantConsole';
import { ConsolePanel, MetricCell, StatusBadge } from '../../components/merchant/MerchantPrimitives';
import { PRODUCT_STATUS_TEXT, productStatusTone } from '../../components/merchant/merchantStatus';
import PageBackButton from '../../components/PageBackButton';
import { usePageRefresh } from '../../hooks/usePageRefresh';
import type { ProductDetail as PD } from '../../types/product';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<PD | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activating, setActivating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');

  const productId = Number(id);
  const isValidProductId = Number.isInteger(productId) && productId > 0;

  const loadDetail = useCallback(async () => {
    if (!isValidProductId) {
      return;
    }

    setRefreshing(true);
    setError('');

    try {
      setDetail(await getProduct(productId));
    } catch {
      setError('商品详情加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isValidProductId, productId]);

  useEffect(() => {
    if (!isValidProductId) return;

    let ignore = false;

    getProduct(productId)
      .then((nextDetail) => {
        if (!ignore) setDetail(nextDetail);
      })
      .catch(() => {
        if (!ignore) setError('商品详情加载失败');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [isValidProductId, productId]);

  usePageRefresh(loadDetail, { disabled: !isValidProductId });

  const handleDelete = async () => {
    if (!isValidProductId) return;
    if (!confirm('确定删除？')) return;
    await deleteProduct(productId);
    navigate('/merchant/products');
  };

  const handleActivate = async () => {
    if (!detail?.auction) return;

    setError('');
    setActivating(true);
    try {
      await activateAuction(detail.auction.id);
      await loadDetail();
    } catch (activateError) {
      const message = getApiErrorMessage(activateError, '开拍失败，请稍后重试');
      setError(message);
    } finally {
      setActivating(false);
    }
  };

  const handleCancelAuction = async () => {
    if (!detail?.auction) return;

    const reason = cancelReason.trim();
    if (!reason) {
      setError('请输入取消原因');
      return;
    }

    setError('');
    setCancelling(true);
    try {
      await cancelAuction(detail.auction.id, reason);
      await loadDetail();
      setShowCancelForm(false);
      setCancelReason('');
    } catch (cancelError) {
      setError(getApiErrorMessage(cancelError, '取消失败，请稍后重试'));
    } finally {
      setCancelling(false);
    }
  };

  if (!isValidProductId) {
    return (
      <MerchantConsole title="商品详情" eyebrow="直播商品" description="未找到可展示的商品记录">
        <ConsolePanel className="py-20 text-center text-[#8B97A7]">
          <p className="text-sm font-medium">商品不存在</p>
        </ConsolePanel>
      </MerchantConsole>
    );
  }

  if (loading) {
    return (
      <MerchantConsole title="商品详情" eyebrow="直播商品" description="正在读取商品与竞拍状态">
        <ConsolePanel className="py-20 text-center text-[#8B97A7]">
          <p className="text-sm font-medium">加载中...</p>
        </ConsolePanel>
      </MerchantConsole>
    );
  }
  if (!detail) {
    return (
      <MerchantConsole title="商品详情" eyebrow="直播商品" description="未找到可展示的商品记录">
        <ConsolePanel className="py-20 text-center text-[#8B97A7]">
          <p className="text-sm font-medium">商品不存在</p>
        </ConsolePanel>
      </MerchantConsole>
    );
  }

  const { product, images, auction, live_media: liveMedia } = detail;
  const canEdit = product.status === 'draft' || product.status === 'pending';
  const canDelete = product.status === 'draft';
  const canActivate = Boolean(auction && (product.status === 'pending' || auction.status === 'pending'));
  const canCancel = Boolean(auction && (product.status === 'pending' || product.status === 'active'));

  return (
    <MerchantConsole
      title={product.title}
      eyebrow="商品详情"
      description={`商品ID ${product.id}${auction ? ` / 竞拍ID ${auction.id}` : ''}`}
      actions={
        <>
          <PageBackButton fallback="/merchant/products" className="border-[#384553] bg-[#0F151C] hover:bg-[#182331]" />
          <button
            type="button"
            onClick={() => void loadDetail()}
            disabled={refreshing || activating || cancelling}
            className="rounded-md border border-[#384553] bg-[#0F151C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#182331] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? '刷新中...' : '刷新状态'}
          </button>
        </>
      }
    >
      <div className="mx-auto grid max-w-7xl gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
        <div className="space-y-4">
          <ConsolePanel className="overflow-hidden">
            <div className="border-b border-[#263241] px-4 py-3">
              <h2 className="text-sm font-black text-white">商品媒体</h2>
              <p className="mt-1 text-xs font-medium text-[#8B97A7]">商品图片与直播间素材预览</p>
            </div>
            {images.length > 0 ? (
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                {images.map((img) => (
                  <div key={img.id} className="aspect-square overflow-hidden rounded-md border border-[#263241] bg-[#0B1016]">
                    <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-[#263241] bg-[#0B1016] text-sm font-semibold text-[#596575]">
                  暂无商品图片
                </div>
              </div>
            )}
            {liveMedia ? (
              <div className="border-t border-[#263241] p-4">
                <div className="mb-2 text-xs font-black text-[#B2BECC]">直播间素材</div>
                <div className="aspect-video max-w-2xl overflow-hidden rounded-md border border-[#263241] bg-[#0B1016]">
                  {liveMedia.type === 'video' ? (
                    <video src={liveMedia.url} poster={liveMedia.poster_url ?? undefined} className="h-full w-full object-cover" controls muted />
                  ) : (
                    <img src={liveMedia.url} alt="直播间素材预览" className="h-full w-full object-cover" />
                  )}
                </div>
              </div>
            ) : null}
          </ConsolePanel>

          <ConsolePanel className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-black text-white">商品介绍</h2>
              <StatusBadge label={PRODUCT_STATUS_TEXT[product.status]} tone={productStatusTone(product.status)} />
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#D5DCE5]">
              {product.description || '暂无商品详情介绍'}
            </p>
          </ConsolePanel>
        </div>

        <div className="space-y-4">
          {auction ? (
            <ConsolePanel className="p-4">
              <div className="mb-4">
                <div>
                  <h2 className="text-sm font-black text-white">竞拍规则</h2>
                  <p className="mt-1 text-xs font-medium text-[#8B97A7]">价格、时长与延时参数</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-2">
                <MetricCell label="起拍价" value={`${auction.start_price} 元`} tone="info" />
                <MetricCell
                  label="加价幅度"
                  value={auction.bid_increment_type === 'fixed' ? `${auction.bid_increment_value} 元` : `${auction.bid_increment_value}%`}
                />
                <MetricCell label="封顶价格" value={auction.ceiling_price ? `${auction.ceiling_price} 元` : '不封顶'} />
                <MetricCell
                  label="默认时长"
                  value={auction.duration_seconds >= 60 ? `${auction.duration_seconds / 60} 分钟` : `${auction.duration_seconds} 秒`}
                />
                <MetricCell label="延时机制" value={`${auction.auto_extend_seconds}s x ${auction.max_extend_count}次`} tone="pending" />
                <MetricCell label="当前最高价" value={`${auction.current_price} 元`} tone="active" />
              </div>
            </ConsolePanel>
          ) : (
            <ConsolePanel className="p-4">
              <h2 className="text-sm font-black text-white">竞拍规则</h2>
              <p className="mt-2 text-sm text-[#8B97A7]">该商品尚未配置竞拍规则。</p>
            </ConsolePanel>
          )}

          {error && (
            <div className="rounded-lg border border-[#F05268]/35 bg-[#F05268]/10 p-4 text-sm font-semibold text-[#FF8A9A]">
              {error}
            </div>
          )}

          {showCancelForm && canCancel && (
            <ConsolePanel className="border-[#F05268]/35 bg-[#F05268]/10 p-4">
              <label htmlFor="cancel-reason" className="mb-2 block text-sm font-black text-[#FFB4BE]">
                取消原因说明
              </label>
              <textarea
                id="cancel-reason"
                aria-label="取消原因"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="例如：库存异常、直播中断、商品信息有误"
                className="w-full resize-none rounded-md border border-[#384553] bg-[#0B1016] px-4 py-3 text-sm text-white outline-none placeholder:text-[#596575] focus:border-[#F05268] focus:ring-2 focus:ring-[#F05268]/20"
              />
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleCancelAuction}
                  disabled={cancelling}
                  className="flex-1 rounded-md bg-[#F05268] px-4 py-3 text-sm font-black text-white transition hover:bg-[#FF6B7D] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelling ? '取消中...' : '确认取消竞拍'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelForm(false);
                    setCancelReason('');
                  }}
                  disabled={cancelling}
                  className="flex-1 rounded-md border border-[#384553] bg-[#0F151C] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#182331] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  放弃
                </button>
              </div>
            </ConsolePanel>
          )}

          <ConsolePanel className="p-4">
            <div className="mb-3">
              <h2 className="text-sm font-black text-white">操作</h2>
              <p className="mt-1 text-xs font-medium text-[#8B97A7]">按当前状态开放可用动作</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {canActivate && (
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating}
                  className="rounded-md bg-[#21D19F] px-4 py-3 text-sm font-black text-[#07100D] transition hover:bg-[#76F2CD] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activating ? '开拍中...' : '开拍'}
                </button>
              )}
              {canEdit && (
                <Link
                  to={`/merchant/products/${product.id}/edit`}
                  className="rounded-md border border-[#4BA3FF]/35 bg-[#4BA3FF]/10 px-4 py-3 text-center text-sm font-black text-[#9CCBFF] transition hover:bg-[#4BA3FF]/20"
                >
                  编辑商品与规则
                </Link>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-md border border-[#F05268]/35 bg-[#F05268]/10 px-4 py-3 text-sm font-black text-[#FF8A9A] transition hover:bg-[#F05268]/20"
                >
                  删除
                </button>
              )}
              {canCancel && !showCancelForm && (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setShowCancelForm(true);
                  }}
                  className="rounded-md border border-[#F05268]/35 bg-[#F05268]/10 px-4 py-3 text-sm font-black text-[#FF8A9A] transition hover:bg-[#F05268]/20"
                >
                  取消竞拍
                </button>
              )}
              {auction && (
                <Link
                  to={`/merchant/auctions/${auction.id}/monitor`}
                  className="rounded-md border border-[#21D19F]/40 bg-[#21D19F]/10 px-4 py-3 text-center text-sm font-black text-[#76F2CD] transition hover:bg-[#21D19F]/20 sm:col-span-2"
                >
                  进入实时竞拍监控台
                </Link>
              )}
            </div>
          </ConsolePanel>
        </div>
      </div>
    </MerchantConsole>
  );
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return fallback;
}
