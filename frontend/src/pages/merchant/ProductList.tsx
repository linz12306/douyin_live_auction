import { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listProducts } from '../../api/product';
import PageBackButton from '../../components/PageBackButton';
import { usePageRefresh } from '../../hooks/usePageRefresh';
import type { Product, ProductStatus } from '../../types/product';

const TABS: { key: ProductStatus | ''; label: string }[] = [
  { key: '', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'pending', label: '待开拍' },
  { key: 'active', label: '进行中' },
  { key: 'ended_sold', label: '已成交' },
  { key: 'ended_no_bid', label: '流拍' },
  { key: 'cancelled', label: '已取消' },
];

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  pending: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  active: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  ended_sold: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  ended_no_bid: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  cancelled: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
};

const STATUS_TEXT: Record<string, string> = {
  draft: '草稿', pending: '待开拍', active: '进行中',
  ended_sold: '已成交', ended_no_bid: '流拍', cancelled: '已取消',
};

export default function ProductList() {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['key']>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadProducts = useCallback(async () => {
    setRefreshing(true);
    setError('');

    try {
      const res = await listProducts(activeTab || undefined);
      setProducts(res.items);
    } catch {
      setError('商品列表加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    let mounted = true;

    listProducts(activeTab || undefined)
      .then((res) => {
        if (mounted) setProducts(res.items);
      })
      .catch(() => {
        if (mounted) setError('商品列表加载失败');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeTab]);

  usePageRefresh(loadProducts);

  return (
    <div className="min-h-screen bg-[#080b11] relative overflow-hidden text-white">
      {/* 背景光效 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/3 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8">
          <div>
            <PageBackButton fallback="/profile" className="mb-3 border-white/10 bg-white/5 hover:bg-white/10" />
            <h1 className="text-3xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">商品管理</h1>
            <p className="text-slate-400/80 text-sm mt-1">管理和创建您发布的所有竞拍品及状态</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadProducts()}
              disabled={refreshing}
              className="px-4 py-2 border border-white/10 bg-white/5 text-white/90 rounded-xl hover:border-white/25 hover:bg-white/10 transition duration-200 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? '刷新中...' : '刷新'}
            </button>
            <Link to="/merchant/orders" className="px-4 py-2 border border-white/10 bg-white/5 text-white/90 rounded-xl hover:border-white/25 hover:bg-white/10 transition duration-200 text-sm font-semibold flex items-center">
              订单管理
            </Link>
            <Link to="/merchant/dashboard" className="px-4 py-2 border border-white/10 bg-white/5 text-white/90 rounded-xl hover:border-white/25 hover:bg-white/10 transition duration-200 text-sm font-semibold flex items-center">
              运营看板
            </Link>
            <Link to="/merchant/products/new" className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-purple-500/20 transition duration-200 text-sm font-bold flex items-center">
              + 新建竞拍
            </Link>
          </div>
        </div>

        {/* 标签栏 */}
        <div className="flex flex-wrap gap-1.5 mb-6 bg-slate-950/40 p-1.5 rounded-xl border border-white/5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (activeTab !== tab.key) setLoading(true);
                setActiveTab(tab.key);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTab === tab.key
                  ? 'border-purple-500/20 bg-purple-500/15 text-purple-200 font-bold shadow shadow-purple-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-slate-400/80 text-center py-20 bg-[#111422]/30 rounded-2xl border border-white/5 backdrop-blur-xl">
            <p className="text-sm font-medium">加载列表中...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 backdrop-blur-lg">
            {error}
          </div>
        ) : products.length === 0 ? (
          <div className="text-slate-400/80 text-center py-20 bg-[#111422]/30 rounded-2xl border border-white/5 backdrop-blur-xl">
            <div className="text-3xl mb-2">📦</div>
            <p className="text-sm font-medium">该状态下暂无商品</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {products.map((p) => (
              <article
                key={p.id}
                className="group rounded-2xl border border-white/8 bg-[#111422]/60 p-5 backdrop-blur-xl transition-all duration-200 hover:border-purple-500/40 hover:-translate-y-0.5 shadow-lg shadow-black/20 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-3">
                    <h3 className="text-white font-bold text-lg leading-snug group-hover:text-purple-300 transition-colors duration-200">{p.title}</h3>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide border uppercase ${STATUS_BADGE[p.status]}`}>
                      {STATUS_TEXT[p.status]}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mt-2 line-clamp-2 leading-relaxed">{p.description || '暂无介绍'}</p>
                </div>
                <div className="mt-5 pt-4 border-t border-white/5 flex gap-2">
                  <Link
                    to={`/merchant/products/${p.id}`}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-xs font-semibold text-white/90 transition hover:border-white/20 hover:bg-white/10"
                  >
                    查看详情
                  </Link>
                  {p.auction_id ? (
                    <Link
                      to={`/merchant/auctions/${p.auction_id}/monitor`}
                      className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2.5 text-center text-xs font-bold text-slate-950 transition hover:from-emerald-400 hover:to-teal-400 shadow-md shadow-emerald-500/10"
                    >
                      实时监控
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
