export const fmtMoney = (n: number | null, ccy = '$') =>
  n == null ? '—' : `${ccy}${Math.round(n).toLocaleString('en-US')}`
/** Compact for large headline values: $1.34M, $948K; exact below 10K. */
export const fmtMoneyShort = (n: number | null, ccy = '$') => {
  if (n == null) return '—'
  const a = Math.abs(n)
  if (a >= 1e6) return `${ccy}${(n / 1e6).toFixed(2)}M`
  if (a >= 1e4) return `${ccy}${Math.round(n / 1e3)}K`
  return `${ccy}${Math.round(n).toLocaleString('en-US')}`
}
export const fmtPct = (x: number | null, digits = 1) =>
  x == null ? '—' : `${(x * 100).toFixed(digits)}%`
export const fmtNum = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-US'))
