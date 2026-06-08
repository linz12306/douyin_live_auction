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
      <div className="mb-4">
        <h2 className="text-sm font-black text-white">竞拍规则配置</h2>
        <p className="mt-1 text-xs font-medium text-[#8B97A7]">控制起拍、加价、封顶和延时参数</p>
      </div>

      <div>
        <label htmlFor="auction-start-price" className="mb-1.5 block text-xs font-semibold text-[#B2BECC]">
          起拍价（元）
        </label>
        <input
          id="auction-start-price"
          type="number" min={0} step={0.01}
          value={value.start_price}
          onChange={(e) => onChange({ ...value, start_price: parseFloat(e.target.value) || 0 })}
          className="w-full rounded-md border border-[#384553] bg-[#0B1016] px-4 py-3 text-sm text-white outline-none placeholder:text-[#596575] focus:border-[#4BA3FF] focus:ring-2 focus:ring-[#4BA3FF]/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#B2BECC]">加价模式</label>
        <div className="flex gap-2" aria-label="加价模式">
          {(['fixed', 'percent'] as BidIncrementType[]).map((t) => (
            <button
              key={t} type="button"
              aria-pressed={value.bid_increment_type === t}
              onClick={() => onChange({ ...value, bid_increment_type: t })}
              className={`flex-1 rounded-md border px-3 py-2.5 text-xs font-black transition ${
                value.bid_increment_type === t
                  ? 'border-[#21D19F]/40 bg-[#21D19F]/10 text-[#76F2CD]'
                  : 'border-[#384553] bg-[#0B1016] text-[#8B97A7] hover:bg-[#182331] hover:text-white'
              }`}
            >
              {t === 'fixed' ? '固定金额' : '百分比'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="auction-bid-increment" className="mb-1.5 block text-xs font-semibold text-[#B2BECC]">
          {value.bid_increment_type === 'fixed' ? '加价金额（元，≥1）' : '加价比例（%，1-20）'}
        </label>
        <input
          id="auction-bid-increment"
          type="number"
          min={value.bid_increment_type === 'fixed' ? 1 : 1}
          max={value.bid_increment_type === 'percent' ? 20 : undefined}
          step={value.bid_increment_type === 'fixed' ? 0.01 : 1}
          value={value.bid_increment_value}
          onChange={(e) => onChange({ ...value, bid_increment_value: parseFloat(e.target.value) || 0 })}
          className="w-full rounded-md border border-[#384553] bg-[#0B1016] px-4 py-3 text-sm text-white outline-none placeholder:text-[#596575] focus:border-[#4BA3FF] focus:ring-2 focus:ring-[#4BA3FF]/20"
        />
      </div>

      <div>
        <label htmlFor="auction-ceiling-price" className="mb-1.5 block text-xs font-semibold text-[#B2BECC]">
          封顶价（可选，留空表示不封顶）
        </label>
        <input
          id="auction-ceiling-price"
          type="number" min={0} step={0.01}
          value={value.ceiling_price ?? ''}
          onChange={(e) => onChange({ ...value, ceiling_price: e.target.value ? parseFloat(e.target.value) : null })}
          placeholder="不封顶"
          className="w-full rounded-md border border-[#384553] bg-[#0B1016] px-4 py-3 text-sm text-white outline-none placeholder:text-[#596575] focus:border-[#4BA3FF] focus:ring-2 focus:ring-[#4BA3FF]/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#B2BECC]">竞拍时长</label>
        <div className="grid grid-cols-3 gap-2" aria-label="竞拍时长">
          {DURATIONS.map((d) => (
            <button
              key={d.value} type="button"
              aria-pressed={value.duration_seconds === d.value}
              onClick={() => onChange({ ...value, duration_seconds: d.value })}
              className={`rounded-md border px-2 py-2.5 text-xs font-black transition ${
                value.duration_seconds === d.value
                  ? 'border-[#4BA3FF]/35 bg-[#4BA3FF]/10 text-[#9CCBFF]'
                  : 'border-[#384553] bg-[#0B1016] text-[#8B97A7] hover:bg-[#182331] hover:text-white'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="auction-auto-extend" className="mb-1.5 block text-xs font-semibold text-[#B2BECC]">
            延时时间（10-30s）
          </label>
          <input
            id="auction-auto-extend"
            type="number" min={10} max={30}
            value={value.auto_extend_seconds ?? 15}
            onChange={(e) => onChange({ ...value, auto_extend_seconds: parseInt(e.target.value) || 15 })}
            className="w-full rounded-md border border-[#384553] bg-[#0B1016] px-4 py-3 text-sm text-white outline-none focus:border-[#4BA3FF] focus:ring-2 focus:ring-[#4BA3FF]/20"
          />
        </div>
        <div>
          <label htmlFor="auction-max-extend" className="mb-1.5 block text-xs font-semibold text-[#B2BECC]">
            最大延时次数（1-10）
          </label>
          <input
            id="auction-max-extend"
            type="number" min={1} max={10}
            value={value.max_extend_count ?? 5}
            onChange={(e) => onChange({ ...value, max_extend_count: parseInt(e.target.value) || 5 })}
            className="w-full rounded-md border border-[#384553] bg-[#0B1016] px-4 py-3 text-sm text-white outline-none focus:border-[#4BA3FF] focus:ring-2 focus:ring-[#4BA3FF]/20"
          />
        </div>
      </div>
    </div>
  );
}
