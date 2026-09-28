'use client'
import type { FxRates } from '@/src/lib/fx'
import { Select } from '@/src/components/ui/Select'

export function FxForm({ currencies, base, rates, onBase, onRate }: {
  currencies: string[]; base: string; rates: FxRates
  onBase: (c: string) => void; onRate: (c: string, r: number) => void
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-[12.5px] text-ink font-medium">Base currency</span>
        <Select value={base} onChange={onBase} options={currencies.map((c) => ({ value: c, label: c }))} />
      </label>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {currencies.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <span className="w-14 text-ink-soft tabular-nums">{c} →</span>
            <input type="number" step="0.0001" className="w-24 p-1 tnum"
              value={c === base ? 1 : rates[c] ?? ''} disabled={c === base}
              onChange={(e) => onRate(c, Number(e.target.value))} />
          </label>
        ))}
      </div>
    </div>
  )
}
