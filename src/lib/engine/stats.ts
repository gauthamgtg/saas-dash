// Small statistical helpers shared across engine modules. Pure, null-safe.

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Sample standard deviation (n-1). null if fewer than 2 points. */
export function stdev(xs: number[]): number | null {
  const m = mean(xs)
  if (m == null || xs.length < 2) return null
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}

/** Coefficient of variation = stdev / mean. null if mean is 0/undefined. */
export function cv(xs: number[]): number | null {
  const m = mean(xs)
  const sd = stdev(xs)
  return m && sd != null ? sd / m : null
}

/** Quintile 1..5 of a value within a population (1 = lowest fifth, 5 = highest). */
export function quintile(value: number, population: number[]): number {
  if (!population.length) return 1
  const sorted = [...population].sort((a, b) => a - b)
  const below = sorted.filter((x) => x < value).length
  const q = Math.floor((below / sorted.length) * 5) + 1
  return Math.min(5, Math.max(1, q))
}
