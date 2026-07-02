// Chart palette (hex — Recharts needs literal colors). Chosen to read well on BOTH light and dark.
export const CHART = {
  navy: '#6366f1',   // primary series (indigo)
  accent: '#6366f1',
  ink: '#334155',
  pos: '#10b981',    // emerald — positive / expansion
  neg: '#ef4444',    // red — churn / negative
  warn: '#f59e0b',   // amber — contraction / caution
  steel: '#3b82f6',  // blue — secondary
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  sand: '#d6a75c',
  grid: 'var(--line)',
  // ordered series palette for multi-category charts (donut, stacked bars, deciles)
  series: ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#ec4899', '#3b82f6', '#d6a75c', '#14b8a6'],
}
