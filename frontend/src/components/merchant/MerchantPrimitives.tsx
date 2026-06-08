import type { ReactNode } from 'react';
import { TONE_CLASS } from './merchantStatus';
import type { Tone } from './merchantStatus';

export type { Tone } from './merchantStatus';

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-black ${TONE_CLASS[tone]}`}>
      {label}
    </span>
  );
}

export function MetricCell({ label, value, tone = 'neutral' }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold text-[#596575]">{label}</div>
      <div
        className={`mt-1 truncate text-sm font-black tabular-nums ${
          tone === 'active' ? 'text-[#76F2CD]' : tone === 'sold' ? 'text-[#D9F99D]' : 'text-[#F5F7FA]'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function ConsolePanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-[#263241] bg-[#0F151C] ${className}`}>{children}</section>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#263241] bg-[#0F151C] px-4 py-12 text-center">
      <div className="text-sm font-bold text-[#F5F7FA]">{title}</div>
      {description ? <div className="mt-1 text-sm text-[#8B97A7]">{description}</div> : null}
    </div>
  );
}
