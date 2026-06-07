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

  if (loading) return <div className="min-h-screen bg-[#080b11] flex items-center justify-center text-slate-400/80"><p className="text-sm font-semibold">加载中...</p></div>;
  if (!detail) return <div className="min-h-screen bg-[#080b11] flex items-center justify-center text-slate-400/80"><p className="text-sm font-semibold">商品不存在</p></div>;

  const { product, images, auction } = detail;
  const canEdit = product.status === 'draft' || product.status === 'pending';
  const canDelete = product.status === 'draft';
  const canActivate = Boolean(auction && (product.status === 'pending' || auction.status === 'pending'));
  const canCancel = Boolean(auction && (product.status === 'pending' || product.status === 'active'));

  return (
    <div className="min-h-screen bg-[#080b11] relative overflow-hidden text-white">
      {/* 背景光效 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/3 blur-[120px] pointer-events-none" />

      <div className="max-w-2xl mx-auto px-4 py-8 relative z-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3">
            <PageBackButton fallback="/merchant/products" className="border-white/10 bg-white/5 hover:bg-white/10" />
            <button
              type="button"
              onClick={() => void loadDetail()}
              disabled={refreshing || activating || cancelling}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? '刷新中...' : '刷新状态'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight">{product.title}</h1>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide border uppercase border-purple-500/25 bg-purple-500/10 text-purple-300">
              {STATUS_TEXT[product.status]}
            </span>
          </div>
        </div>

        {images.length > 0 && (
          <div className="bg-[#111422]/60 backdrop-blur-xl rounded-2xl p-4 border border-white/8 shadow-xl shadow-black/30 mb-5">
            <div className="grid grid-cols-3 gap-3">
              {images.map((img) => (
                <div key={img.id} className="relative overflow-hidden rounded-xl bg-slate-950 aspect-square shadow border border-white/5 group">
                  <img src={img.image_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
              ))}
            </div>
          </div>
        )}

        {product.description && (
          <div className="bg-[#111422]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/8 shadow-xl shadow-black/30 mb-5">
            <h3 className="text-sm font-bold text-slate-400 mb-2">商品介绍</h3>
            <p className="text-slate-200 text-sm leading-relaxed">{product.description}</p>
          </div>
        )}

        {auction && (
          <div className="bg-[#111422]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/8 shadow-xl shadow-black/30 mb-5">
            <h3 className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
              <span className="text-purple-400 text-lg">📊</span> 竞拍规则与状态
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm border-t border-white/5 pt-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">起拍价</span>
                <span className="text-white font-bold">{auction.start_price} 元</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">加价幅度</span>
                <span className="text-white font-bold">{auction.bid_increment_type === 'fixed' ? `${auction.bid_increment_value} 元` : `${auction.bid_increment_value}%`}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">封顶价格</span>
                <span className="text-white font-bold">{auction.ceiling_price ? `${auction.ceiling_price} 元` : '不封顶'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">默认时长</span>
                <span className="text-white font-bold">{auction.duration_seconds >= 60 ? `${auction.duration_seconds / 60} 分钟` : `${auction.duration_seconds} 秒`}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">延时机制</span>
                <span className="text-amber-300 font-semibold">{auction.auto_extend_seconds}s &times; {auction.max_extend_count}次</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">当前最高价</span>
                <span className="text-emerald-400 font-bold tabular-nums">{auction.current_price} 元</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 backdrop-blur-lg flex items-center gap-2">
            <span className="shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {showCancelForm && canCancel && (
          <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 backdrop-blur-xl">
            <label htmlFor="cancel-reason" className="mb-2 block text-sm font-bold text-red-200">
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
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-red-500 focus:ring-4 focus:ring-red-500/15 transition-all duration-200 shadow-inner"
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleCancelAuction}
                disabled={cancelling}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3 text-white font-bold transition hover:from-red-500 hover:to-rose-500 active:scale-[0.98] shadow-lg shadow-red-500/10 disabled:cursor-not-allowed disabled:opacity-60 disabled:scale-100 text-sm"
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
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-white/80 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 text-sm"
              >
                放弃
              </button>
            </div>
          </div>
        )}

        {(canEdit || canActivate || canCancel) && (
          <div className="flex gap-3">
            {canActivate && (
              <button onClick={handleActivate} disabled={activating}
                className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-950 font-black rounded-xl hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] transition-all duration-200 text-sm disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-emerald-500/15">
                {activating ? '开拍中...' : '开拍'}
              </button>
            )}
            {canEdit && (
              <Link to={`/merchant/products/${product.id}/edit`}
                className="flex-1 py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-center rounded-xl hover:from-violet-500 hover:to-purple-500 active:scale-[0.98] transition-all duration-200 text-sm shadow-lg shadow-purple-500/15 flex items-center justify-center">
                编辑商品与规则
              </Link>
            )}
            {canDelete && (
              <button onClick={handleDelete}
                className="flex-1 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold rounded-xl hover:from-red-500 hover:to-rose-500 active:scale-[0.98] transition-all duration-200 text-sm shadow-lg shadow-red-500/15">
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
                className="flex-1 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold rounded-xl hover:from-red-500 hover:to-rose-500 active:scale-[0.98] transition-all duration-200 text-sm shadow-lg shadow-red-500/15"
              >
                取消竞拍
              </button>
            )}
          </div>
        )}
        {auction && (
          <Link
            to={`/merchant/auctions/${auction.id}/monitor`}
            className="mt-4 flex w-full justify-center rounded-xl border border-emerald-300/30 bg-emerald-500/10 py-3.5 text-sm font-bold text-emerald-300 transition duration-200 hover:bg-emerald-500/20 shadow-lg shadow-emerald-500/5 hover:border-emerald-300/50"
          >
            进入实时竞拍监控台 ›
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
