import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAuctionLobby } from '../../api/auction';
import PageBackButton from '../../components/PageBackButton';
import { usePageRefresh } from '../../hooks/usePageRefresh';
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
const ENDING_SOON_MS = 10 * 60 * 1000;

const FILTERS = [
  { key: 'recommended', label: '推荐' },
  { key: 'active', label: '正在竞拍' },
  { key: 'ending', label: '快结束' },
  { key: 'pending', label: '待开拍' },
] as const;

type LobbyFilter = (typeof FILTERS)[number]['key'];

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

const getTimingText = (item: AuctionLobbyItem) => {
  if (!item.ended_at) return '时间待定';
  if (item.status !== 'active') return `结束 ${formatEndTime(item.ended_at)}`;

  const remainingMs = new Date(item.ended_at).getTime() - Date.now();
  if (remainingMs <= 0) return '即将落槌';
  if (remainingMs <= 60 * 1000) return `${Math.max(1, Math.ceil(remainingMs / 1000))} 秒`;
  if (remainingMs <= ENDING_SOON_MS) return `${Math.ceil(remainingMs / 60000)} 分钟`;
  return `结束 ${formatEndTime(item.ended_at)}`;
};

const getHeroSubtitle = (item: AuctionLobbyItem) => {
  if (item.status === 'active') return '正在竞拍';
  if (item.status === 'pending') return '即将开拍';
  return getStatusText(item.status);
};

export default function AuctionLobby() {
  const [items, setItems] = useState<AuctionLobbyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<LobbyFilter>('recommended');

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

  usePageRefresh(loadLobby, { intervalMs: LOBBY_REFRESH_MS });

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

    return () => {
      mounted = false;
    };
  }, []);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    const now = Date.now();

    return items.filter((item) => {
      const matchesSearch = normalizedSearch.length === 0 || item.title.toLowerCase().includes(normalizedSearch);
      if (!matchesSearch) return false;

      if (activeFilter === 'active') return item.status === 'active';
      if (activeFilter === 'pending') return item.status === 'pending';
      if (activeFilter === 'ending') {
        if (!item.ended_at) return false;
        const remainingMs = new Date(item.ended_at).getTime() - now;
        return item.status === 'active' && remainingMs > 0 && remainingMs <= ENDING_SOON_MS;
      }

      return true;
    });
  }, [activeFilter, items, normalizedSearch]);

  const prioritizedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return a.auction_id - b.auction_id;
    });
  }, [filteredItems]);

  const [heroItem, ...feedItems] = prioritizedItems;
  const hasLocalFilter = normalizedSearch.length > 0 || activeFilter !== 'recommended';
  const searchResultSummary = normalizedSearch.length > 0
    ? `本地筛选 · ${filteredItems.length} 个结果`
    : `${FILTERS.find((filter) => filter.key === activeFilter)?.label ?? '推荐'} · ${filteredItems.length} 场`;

  const renderImage = (item: AuctionLobbyItem, className = '') => (
    <div className={`relative overflow-hidden bg-zinc-950 ${className}`}>
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.title}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_35%_20%,rgba(248,113,113,0.35),transparent_28%),linear-gradient(135deg,#18181b,#0f766e_55%,#111827)] px-4 text-center">
          <span className="text-3xl font-black text-white/85">LIVE</span>
          <span className="mt-2 text-xs font-medium text-white/60">拍品图片待上新</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050708] text-white">
      <main className="mx-auto min-h-screen max-w-5xl bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.26),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(244,63,94,0.22),transparent_32%),linear-gradient(180deg,#0b1014,#050708_52%,#09090b)] px-4 pb-8 pt-5 sm:px-6 sm:pt-7">
        <header className="mb-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <PageBackButton fallback="/profile" className="mb-3 border-white/10 bg-white/8" />
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-200/75">Live auction</p>
              <h1 className="mt-1 text-2xl font-black text-white">发现竞拍</h1>
            </div>
            <nav className="flex shrink-0 items-center gap-2" aria-label="买家导航">
              <button
                type="button"
                onClick={() => void loadLobby()}
                disabled={refreshing}
                className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-sm font-medium text-white/75 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing ? '刷新中...' : '刷新'}
              </button>
              <Link
                to="/app/orders"
                className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-sm font-medium text-white/75 transition hover:border-white/30 hover:text-white"
              >
                订单
              </Link>
              <Link
                to="/profile"
                className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-sm font-medium text-white/75 transition hover:border-white/30 hover:text-white"
              >
                我的
              </Link>
            </nav>
          </div>

          <div className="rounded-[8px] border border-white/10 bg-white/10 p-3 shadow-2xl shadow-black/25 backdrop-blur">
            <label className="sr-only" htmlFor="auction-lobby-search">搜索直播、拍品或商家</label>
            <input
              id="auction-lobby-search"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="搜索直播 / 拍品 / 商家"
              className="h-11 w-full rounded-[8px] border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-white/38 focus:border-rose-300/70 focus:bg-black/45"
            />
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  aria-pressed={filter.key === activeFilter}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    filter.key === activeFilter
                      ? 'border-rose-300 bg-rose-400 text-zinc-950 shadow-lg shadow-rose-950/30'
                      : 'border-white/10 bg-white/8 text-white/68 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-[8px] border border-white/10 bg-white/8 p-8 text-center text-white/65">
            加载中...
          </div>
        ) : error ? (
          <div className="rounded-[8px] border border-rose-400/40 bg-rose-500/12 p-5 text-sm text-rose-100">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadLobby()}
              className="mt-4 rounded-full bg-rose-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-rose-200"
            >
              重新加载
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[8px] border border-white/10 bg-white/8 p-8 text-center">
            <p className="font-semibold text-white">暂无可参与竞拍</p>
            <p className="mt-2 text-sm text-white/55">稍后回来看看新的直播间。</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-[8px] border border-white/10 bg-white/8 p-8 text-center">
            <p className="font-semibold text-white">当前列表没有匹配内容</p>
            <p className="mt-2 text-sm text-white/55">这是本地筛选结果，可以换个关键词或回到推荐。</p>
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3 text-xs text-white/55">
              <span>{searchResultSummary}</span>
              {hasLocalFilter ? <span>仅筛选当前加载列表</span> : <span>正在展示当前列表</span>}
            </div>

            {heroItem ? (
              <article
                className="overflow-hidden rounded-[8px] border border-white/12 bg-white/10 shadow-2xl shadow-black/35 backdrop-blur"
              >
                {renderImage(heroItem, 'aspect-[16/11] sm:aspect-[16/7]')}
                <div className="space-y-4 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-rose-200">{getHeroSubtitle(heroItem)}</p>
                      <h2 className="mt-1 text-xl font-black leading-7 text-white sm:text-2xl">
                        {heroItem.title}
                      </h2>
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadge(heroItem.status)}`}>
                      {getStatusText(heroItem.status)}
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-xs text-white/50">当前价</div>
                      <div className="text-3xl font-black text-rose-200">{formatPrice(heroItem.current_price)}</div>
                    </div>
                    <div className="text-right text-sm font-semibold text-white/65">
                      {getTimingText(heroItem)}
                    </div>
                  </div>

                  <Link
                    to={`/app/auctions/${heroItem.auction_id}`}
                    aria-label={`进入直播：${heroItem.title}`}
                    className="block rounded-full bg-rose-400 px-4 py-3 text-center text-sm font-black text-zinc-950 transition hover:bg-rose-300"
                  >
                    进入直播
                  </Link>
                </div>
              </article>
            ) : null}

            {feedItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {feedItems.map((item) => (
                  <article
                    key={item.auction_id}
                    className="overflow-hidden rounded-[8px] border border-white/10 bg-white/8 shadow-xl shadow-black/20 backdrop-blur"
                  >
                    {renderImage(item, 'aspect-[4/3]')}
                    <div className="space-y-3 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getStatusBadge(item.status)}`}>
                          {getStatusText(item.status)}
                        </span>
                        <span className="truncate text-[11px] text-white/45">{getTimingText(item)}</span>
                      </div>
                      <h2 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-white">
                        {item.title}
                      </h2>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-black text-rose-200">{formatPrice(item.current_price)}</span>
                        <Link
                          to={`/app/auctions/${item.auction_id}`}
                          aria-label={`进入直播：${item.title}`}
                          className="shrink-0 rounded-full border border-rose-300/60 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-400 hover:text-zinc-950"
                        >
                          进入直播
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
