'use client'
import type { FxRates } from '@/src/lib/fx'

export function FxForm({ currencies, base, rates, onBase, onRate }: {
  currencies: string[]; base: string; rates: FxRates
  onBase: (c: string) => void; onRate: (c: string, r: number) => void
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink">Base currency</span>
        <select className="p-2" value={base} onChange={(e) => onBase(e.target.value)}>
          {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {currencies.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <span className="w-14 font-mono text-ink-soft">{c} →</span>
            <input type="number" step="0.0001" className="w-24 p-1 tnum"
              value={c === base ? 1 : rates[c] ?? ''} disabled={c === base}
              onChange={(e) => onRate(c, Number(e.target.value))} />
          </label>
        ))}
      </div>
    </div>
  )
}
