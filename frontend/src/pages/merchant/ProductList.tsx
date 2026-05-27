import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listProducts } from '../../api/product';
import type { Product, ProductStatus } from '../../types/product';

const TABS: { key: ProductStatus | ''; label: string }[] = [
  { key: '', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'pending', label: '进行中' },
  { key: 'ended_sold', label: '已结束' },
  { key: 'cancelled', label: '已取消' },
];

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-300 border-gray-500',
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
  active: 'bg-green-500/20 text-green-300 border-green-500',
  ended_sold: 'bg-blue-500/20 text-blue-300 border-blue-500',
  ended_no_bid: 'bg-purple-500/20 text-purple-300 border-purple-500',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500',
};

const STATUS_TEXT: Record<string, string> = {
  draft: '草稿', pending: '待开拍', active: '进行中',
  ended_sold: '已成交', ended_no_bid: '流拍', cancelled: '已取消',
};

export default function ProductList() {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['key']>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listProducts(activeTab || undefined)
      .then((res) => setProducts(res.items))
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">商品管理</h1>
          <Link to="/merchant/products/new" className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:opacity-90">
            + 新建竞拍
          </Link>
        </div>

        <div className="flex gap-2 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm border transition ${
                activeTab === tab.key
                  ? 'border-purple-400 bg-purple-500/20 text-white'
                  : 'border-white/20 text-white/60 hover:border-white/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-white/60 text-center py-12">加载中...</p>
        ) : products.length === 0 ? (
          <p className="text-white/60 text-center py-12">暂无商品</p>
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <Link
                key={p.id}
                to={`/merchant/products/${p.id}`}
                className="block bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 hover:border-purple-400 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-semibold">{p.title}</h3>
                    <p className="text-white/50 text-sm mt-1">{p.description?.slice(0, 80) || '暂无介绍'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs border ${STATUS_BADGE[p.status]}`}>
                    {STATUS_TEXT[p.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
