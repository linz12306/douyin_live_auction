import { useCallback, useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getProduct, deleteProduct } from '../../api/product';
import { activateAuction, cancelAuction } from '../../api/auction';
import PageBackButton from '../../components/PageBackButton';
import { usePageRefresh } from '../../hooks/usePageRefresh';
import type { ProductDetail as PD } from '../../types/product';

const STATUS_TEXT: Record<string, string> = {
  draft: '草稿', pending: '待开拍', active: '进行中',
  ended_sold: '已成交', ended_no_bid: '流拍', cancelled: '已取消',
};

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

  const productId = parseInt(id!, 10);

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(productId) || productId <= 0) {
      setError('商品不存在');
      setLoading(false);
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
  }, [productId]);

  useEffect(() => {
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
  }, [productId]);

  usePageRefresh(loadDetail, { disabled: !Number.isFinite(productId) || productId <= 0 });

  const handleDelete = async () => {
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

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center"><p className="text-white/60">加载中...</p></div>;
  if (!detail) return <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center"><p className="text-white/60">商品不存在</p></div>;

  const { product, images, auction } = detail;
  const canEdit = product.status === 'draft' || product.status === 'pending';
  const canDelete = product.status === 'draft';
  const canActivate = Boolean(auction && (product.status === 'pending' || auction.status === 'pending'));
  const canCancel = Boolean(auction && (product.status === 'pending' || product.status === 'active'));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <PageBackButton fallback="/merchant/products" />
          <button
            type="button"
            onClick={() => void loadDetail()}
            disabled={refreshing || activating || cancelling}
            className="rounded-lg border border-white/20 bg-white/8 px-3 py-2 text-sm text-white/75 transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? '刷新中...' : '刷新状态'}
          </button>
          <h1 className="text-2xl font-bold text-white">{product.title}</h1>
          <span className="px-2 py-1 rounded text-xs border border-purple-400 bg-purple-500/20 text-purple-300">
            {STATUS_TEXT[product.status]}
          </span>
        </div>

        {images.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 mb-4">
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <img key={img.id} src={img.image_url} alt="" className="rounded-lg aspect-square object-cover" />
              ))}
            </div>
          </div>
        )}

        {product.description && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-4">
            <p className="text-white/80">{product.description}</p>
          </div>
        )}

        {auction && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-4">
            <h3 className="text-white font-semibold mb-3">竞拍规则</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-white/60">起拍价：</span><span className="text-white">{auction.start_price} 元</span></div>
              <div><span className="text-white/60">加价：</span><span className="text-white">{auction.bid_increment_type === 'fixed' ? `${auction.bid_increment_value} 元` : `${auction.bid_increment_value}%`}</span></div>
              <div><span className="text-white/60">封顶价：</span><span className="text-white">{auction.ceiling_price ? `${auction.ceiling_price} 元` : '不封顶'}</span></div>
              <div><span className="text-white/60">时长：</span><span className="text-white">{auction.duration_seconds >= 60 ? `${auction.duration_seconds / 60} 分钟` : `${auction.duration_seconds} 秒`}</span></div>
              <div><span className="text-white/60">延时：</span><span className="text-white">{auction.auto_extend_seconds}s &times; {auction.max_extend_count}次</span></div>
              <div><span className="text-white/60">当前价：</span><span className="text-white">{auction.current_price} 元</span></div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-400/50 bg-red-500/20 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {showCancelForm && canCancel && (
          <div className="mb-4 rounded-xl border border-red-300/35 bg-red-500/12 p-4">
            <label htmlFor="cancel-reason" className="mb-2 block text-sm font-medium text-red-100">
              取消原因
            </label>
            <textarea
              id="cancel-reason"
              aria-label="取消原因"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="例如：库存异常、直播中断、商品信息有误"
              className="w-full resize-none rounded-lg border border-white/20 bg-white/8 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-red-200"
            />
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={handleCancelAuction}
                disabled={cancelling}
                className="flex-1 rounded-lg bg-red-500 py-3 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelling ? '取消中...' : '确认取消'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCancelForm(false);
                  setCancelReason('');
                }}
                disabled={cancelling}
                className="flex-1 rounded-lg border border-white/20 bg-white/8 py-3 text-white/75 transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                放弃取消
              </button>
            </div>
          </div>
        )}

        {(canEdit || canActivate || canCancel) && (
          <div className="flex gap-3">
            {canActivate && (
              <button onClick={handleActivate} disabled={activating}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-lg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {activating ? '开拍中...' : '开拍'}
              </button>
            )}
            {canEdit && (
              <Link to={`/merchant/products/${product.id}/edit`}
                className="flex-1 py-3 bg-purple-500 text-white text-center rounded-lg hover:opacity-90">
                编辑
              </Link>
            )}
            {canDelete && (
              <button onClick={handleDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-lg hover:opacity-90">
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
                className="flex-1 py-3 bg-red-500 text-white rounded-lg hover:opacity-90"
              >
                取消竞拍
              </button>
            )}
          </div>
        )}
        {auction && (
          <Link
            to={`/merchant/auctions/${auction.id}/monitor`}
            className="mt-3 flex w-full justify-center rounded-lg border border-emerald-300/45 bg-emerald-300/15 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/25"
          >
            实时监控
          </Link>
        )}
      </div>
    </div>
  );
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return fallback;
}
