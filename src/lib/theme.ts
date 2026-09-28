// Chart palette (hex — Recharts needs literal colors). Emerald primary,
// cobalt/bronze/violet support. Chosen to read well on BOTH light and dark.
export const CHART = {
  navy: '#0ea371',   // primary series (emerald)
  accent: '#0ea371',
  ink: '#44554c',
  pos: '#15a34a',    // positive / expansion
  neg: '#dc4a34',    // churn / negative (warm red)
  warn: '#d97706',   // bronze — contraction / caution
  steel: '#2563eb',  // cobalt — secondary
  violet: '#8b5cf6',
  cyan: '#0891b2',
  pink: '#db2777',
  sand: '#c68a3f',
  grid: 'var(--line)',
  // ordered series palette for multi-category charts (donut, stacked bars, deciles)
  series: ['#0ea371', '#2563eb', '#d97706', '#8b5cf6', '#0891b2', '#dc4a34', '#db2777', '#65a30d', '#c68a3f', '#14b8a6'],
}
