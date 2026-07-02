export const fmtMoney = (n: number | null, ccy = '$') =>
  n == null ? '—' : `${ccy}${Math.round(n).toLocaleString('en-US')}`
export const fmtPct = (x: number | null, digits = 1) =>
  x == null ? '—' : `${(x * 100).toFixed(digits)}%`
export const fmtNum = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-US'))
