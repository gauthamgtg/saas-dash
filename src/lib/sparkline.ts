/** Client-safe sparkline helpers (no Stripe / Node deps). */

export function sparklineFromSeries(mrrByMonth: { month: string; mrr: number }[], n = 12): number[] {
  const sorted = [...mrrByMonth].sort((a, b) => a.month.localeCompare(b.month))
  return sorted.slice(-n).map((x) => Math.round(x.mrr))
}
