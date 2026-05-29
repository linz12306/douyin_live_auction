import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAuctionLobby } from '../../api/auction';
import PageBackButton from '../../components/PageBackButton';
import type { AuctionLobbyItem, AuctionStatus } from '../../types/auction';

const STATUS_TEXT: Record<AuctionStatus, string> = {
  pending: '待开拍',
  active: '进行中',
  ended_sold: '已成交',
  ended_no_bid: '流拍',
  cancelled: '已取消',
};

const STATUS_BADGE: Record<AuctionStatus, string> = {
  pending: 'border-amber-400/50 bg-amber-400/15 text-amber-200',
  active: 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200',
  ended_sold: 'border-sky-400/50 bg-sky-400/15 text-sky-200',
  ended_no_bid: 'border-zinc-400/50 bg-zinc-400/15 text-zinc-200',
  cancelled: 'border-rose-400/50 bg-rose-400/15 text-rose-200',
};

const DEFAULT_STATUS_BADGE = 'border-white/30 bg-white/10 text-white/70';
const LOBBY_REFRESH_MS = 10000;

const isAuctionStatus = (status: unknown): status is AuctionStatus => (
  typeof status === 'string' && status in STATUS_TEXT
);

const formatPrice = (price: unknown) => {
  const value = Number(price);
  return `¥${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
};

const getStatusText = (status: unknown) => (isAuctionStatus(status) ? STATUS_TEXT[status] : '进行中');

const getStatusBadge = (status: unknown) => (isAuctionStatus(status) ? STATUS_BADGE[status] : DEFAULT_STATUS_BADGE);

const getErrorMessage = (err: unknown) => {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return '竞拍列表加载失败';
};

const formatEndTime = (endedAt?: string) => {
  if (!endedAt) return '时间待定';
  return new Date(endedAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AuctionLobby() {
  const [items, setItems] = useState<AuctionLobbyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadLobby = useCallback(async () => {
    setRefreshing(true);
    setError('');

    try {
      setItems(await listAuctionLobby());
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadInitialLobby = async () => {
      try {
        const nextItems = await listAuctionLobby();
        if (mounted) setItems(nextItems);
      } catch (err: unknown) {
        if (mounted) setError(getErrorMessage(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadInitialLobby();

    const intervalID = window.setInterval(() => {
      void loadLobby();
    }, LOBBY_REFRESH_MS);

    const handleFocus = () => {
      void loadLobby();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      mounted = false;
      window.clearInterval(intervalID);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadLobby]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-teal-950 to-zinc-950">
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <PageBackButton fallback="/profile" className="mb-3" />
            <h1 className="text-2xl font-bold text-white">竞拍大厅</h1>
            <p className="mt-1 text-sm text-white/55">正在直播的竞拍商品</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadLobby()}
              disabled={refreshing}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/75 transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? '刷新中...' : '刷新'}
            </button>
            <Link
              to="/profile"
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/75 transition hover:border-white/35 hover:text-white"
            >
              我的
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="rounded-lg border border-white/10 bg-white/8 p-8 text-center text-white/65">
            加载中...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-rose-400/40 bg-rose-500/12 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/8 p-8 text-center">
            <p className="font-medium text-white">暂无可参与竞拍</p>
            <p className="mt-2 text-sm text-white/55">稍后回来看看新的直播间。</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.auction_id}
                className="overflow-hidden rounded-lg border border-white/12 bg-white/10 shadow-xl shadow-black/20 backdrop-blur"
              >
                <div className="aspect-[4/3] bg-slate-900">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-white/45">
                      暂无图片
                    </div>
                  )}
                </div>
                <div className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 flex-1 text-base font-semibold leading-6 text-white">
                      {item.title}
                    </h2>
                    <span className={`shrink-0 rounded border px-2 py-1 text-xs ${getStatusBadge(item.status)}`}>
                      {getStatusText(item.status)}
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-xs text-white/50">当前价</div>
                      <div className="text-xl font-bold text-emerald-200">{formatPrice(item.current_price)}</div>
                    </div>
                    <div className="text-right text-xs text-white/50">
                      结束 {formatEndTime(item.ended_at)}
                    </div>
                  </div>

                  <Link
                    to={`/app/auctions/${item.auction_id}`}
                    className="block rounded-lg bg-emerald-400 px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                  >
                    进入直播间
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
