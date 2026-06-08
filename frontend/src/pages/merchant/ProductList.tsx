import { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listProducts } from '../../api/product';
import MerchantConsole from '../../components/merchant/MerchantConsole';
import {
  ConsolePanel,
  EmptyState,
  MetricCell,
  StatusBadge,
} from '../../components/merchant/MerchantPrimitives';
import { PRODUCT_STATUS_TEXT, productStatusTone } from '../../components/merchant/merchantStatus';
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
    <MerchantConsole
      title="直播商品"
      eyebrow="商家控盘台"
      description="管理和创建您发布的所有竞拍品及状态"
      actions={
        <>
          <PageBackButton fallback="/profile" className="border-[#384553] bg-[#0F151C] hover:bg-[#182331]" />
          <button
            type="button"
            onClick={() => void loadProducts()}
            disabled={refreshing}
            className="rounded-md border border-[#384553] bg-[#0F151C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#182331] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? '刷新中...' : '刷新'}
          </button>
          <Link
            to="/merchant/dashboard"
            className="rounded-md border border-[#384553] bg-[#0F151C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#182331]"
          >
            运营看板
          </Link>
          <Link
            to="/merchant/products/new"
            className="rounded-md bg-[#21D19F] px-4 py-2 text-sm font-black text-[#07100D] transition hover:bg-[#76F2CD]"
          >
            新建竞拍
          </Link>
        </>
      }
    >
      <div className="mx-auto max-w-7xl">
        {/* 标签栏 */}
        <ConsolePanel className="mb-6 p-1.5">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  if (activeTab !== tab.key) setLoading(true);
                  setActiveTab(tab.key);
                }}
                className={`rounded-md px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-[#182331] text-white ring-1 ring-[#263241]'
                    : 'border-transparent text-[#8B97A7] hover:bg-[#131B24] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </ConsolePanel>

        {loading ? (
          <ConsolePanel className="py-20 text-center text-[#8B97A7]">
            <p className="text-sm font-medium">加载列表中...</p>
          </ConsolePanel>
        ) : error ? (
          <div className="rounded-lg border border-[#F05268]/35 bg-[#F05268]/10 p-4 text-sm text-[#FF8A9A]">
            {error}
          </div>
        ) : products.length === 0 ? (
          <EmptyState title="该状态下暂无商品" description="发布竞拍后，商品会按状态展示在这里。" />
        ) : (
          <div className="space-y-3">
            {products.map((p, index) => (
              <article
                key={p.id}
                aria-label={`商品 ${p.title}`}
                className="grid gap-4 rounded-lg border border-[#263241] bg-[#131B24] p-3 transition hover:border-[#3B4B5D] hover:bg-[#182331] xl:grid-cols-[3rem_minmax(0,1fr)_minmax(22rem,30rem)_minmax(12rem,14rem)] xl:items-center"
              >
                <div className="text-sm font-black tabular-nums text-[#596575]">{String(index + 1).padStart(2, '0')}</div>

                <div className="flex min-w-0 gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#263241] bg-[#0B1016] text-[10px] font-black text-[#384553]">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.title} className="h-full w-full object-cover" />
                    ) : (
                      '无图'
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-black text-white">{p.title}</h2>
                    <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-[#8B97A7]">{p.description || '暂无介绍'}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge label={PRODUCT_STATUS_TEXT[p.status]} tone={productStatusTone(p.status)} />
                      <span className="rounded-md border border-[#263241] px-2 py-1 text-[11px] font-bold text-[#8B97A7]">
                        商品ID {p.id}
                      </span>
                      {p.auction_id ? (
                        <span className="rounded-md border border-[#263241] px-2 py-1 text-[11px] font-bold text-[#8B97A7]">
                          竞拍ID {p.auction_id}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricCell label="起拍价" value="详情查看" />
                  <MetricCell label="加价规则" value="详情查看" />
                  <MetricCell label="封顶价" value="详情查看" />
                  <MetricCell
                    label={p.status === 'ended_sold' ? '成交结果' : '当前状态'}
                    value={PRODUCT_STATUS_TEXT[p.status]}
                    tone={productStatusTone(p.status)}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
                  <Link
                    to={`/merchant/products/${p.id}`}
                    className="rounded-md border border-[#384553] bg-[#0F151C] px-3 py-2 text-center text-xs font-bold text-white transition hover:bg-[#182331]"
                  >
                    详情
                  </Link>
                  {p.auction_id ? (
                    <Link
                      to={`/merchant/auctions/${p.auction_id}/monitor`}
                      className="rounded-md bg-[#21D19F] px-3 py-2 text-center text-xs font-black text-[#07100D] transition hover:bg-[#76F2CD]"
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
    </MerchantConsole>
  );
}
