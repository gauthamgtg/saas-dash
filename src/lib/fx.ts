export type FxRates = Record<string, number> // currency code -> multiplier to base

export function detectCurrencies(values: (string | null)[]): string[] {
  const set = new Set<string>()
  for (const v of values) {
    const c = (v ?? '').trim()
    if (c) set.add(c)
  }
  return [...set]
}

/** amount in native currency -> base. null currency counts as base. Unknown code -> null. */
export function convert(amount: number, currency: string | null, rates: FxRates): number | null {
  const c = (currency ?? '').trim()
  if (!c) return amount
  const rate = rates[c]
  if (rate === undefined) return null
  return amount * rate
}
