import type { BidIncrementType, PublishRequest } from '../types/product';

interface Props {
  value: PublishRequest;
  onChange: (v: PublishRequest) => void;
}

const DURATIONS = [
  { value: 60, label: '1 分钟' },
  { value: 300, label: '5 分钟' },
  { value: 1800, label: '30 分钟' },
];

export default function AuctionRuleForm({ value, onChange }: Props) {
  return (
    <div className="space-y-4 text-white">
      <h3 className="text-base font-bold text-slate-200 flex items-center gap-2 mb-4">
        <span className="text-purple-400">⚖️</span> 竞拍规则配置
      </h3>

      <div>
        <label className="text-xs text-slate-300 font-semibold mb-1.5 block">起拍价（元）</label>
        <input
          type="number" min={0} step={0.01}
          value={value.start_price}
          onChange={(e) => onChange({ ...value, start_price: parseFloat(e.target.value) || 0 })}
          className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 text-sm shadow-inner shadow-black/10"
        />
      </div>

      <div>
        <label className="text-xs text-slate-300 font-semibold mb-1.5 block">加价模式</label>
        <div className="flex gap-2">
          {(['fixed', 'percent'] as BidIncrementType[]).map((t) => (
            <button
              key={t} type="button"
              onClick={() => onChange({ ...value, bid_increment_type: t })}
              className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                value.bid_increment_type === t
                  ? 'border-purple-500/20 bg-purple-500/15 text-purple-200 font-bold'
                  : 'border-slate-800 bg-slate-950/20 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              {t === 'fixed' ? '固定金额' : '百分比'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-300 font-semibold mb-1.5 block">
          {value.bid_increment_type === 'fixed' ? '加价金额（元，≥1）' : '加价比例（%，1-20）'}
        </label>
        <input
          type="number"
          min={value.bid_increment_type === 'fixed' ? 1 : 1}
          max={value.bid_increment_type === 'percent' ? 20 : undefined}
          step={value.bid_increment_type === 'fixed' ? 0.01 : 1}
          value={value.bid_increment_value}
          onChange={(e) => onChange({ ...value, bid_increment_value: parseFloat(e.target.value) || 0 })}
          className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 text-sm shadow-inner shadow-black/10"
        />
      </div>

      <div>
        <label className="text-xs text-slate-300 font-semibold mb-1.5 block">封顶价（可选，留空表示不封顶）</label>
        <input
          type="number" min={0} step={0.01}
          value={value.ceiling_price ?? ''}
          onChange={(e) => onChange({ ...value, ceiling_price: e.target.value ? parseFloat(e.target.value) : null })}
          placeholder="不封顶"
          className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 text-sm shadow-inner shadow-black/10"
        />
      </div>

      <div>
        <label className="text-xs text-slate-300 font-semibold mb-1.5 block">竞拍时长</label>
        <div className="grid grid-cols-3 gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.value} type="button"
              onClick={() => onChange({ ...value, duration_seconds: d.value })}
              className={`py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                value.duration_seconds === d.value
                  ? 'border-purple-500/20 bg-purple-500/15 text-purple-200 font-bold'
                  : 'border-slate-800 bg-slate-950/20 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-300 font-semibold mb-1.5 block">延时时间（10-30s）</label>
          <input
            type="number" min={10} max={30}
            value={value.auto_extend_seconds ?? 15}
            onChange={(e) => onChange({ ...value, auto_extend_seconds: parseInt(e.target.value) || 15 })}
            className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 text-sm shadow-inner shadow-black/10"
          />
        </div>
        <div>
          <label className="text-xs text-slate-300 font-semibold mb-1.5 block">最大延时次数（1-10）</label>
          <input
            type="number" min={1} max={10}
            value={value.max_extend_count ?? 5}
            onChange={(e) => onChange({ ...value, max_extend_count: parseInt(e.target.value) || 5 })}
            className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 text-sm shadow-inner shadow-black/10"
          />
        </div>
      </div>
    </div>
  );
}
