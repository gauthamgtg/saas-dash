export function Heatmap({ rows }: { rows: { label: string; size: number; values: (number | null)[] }[] }) {
  const maxLen = Math.max(0, ...rows.map((r) => r.values.length))
  // emerald ramp over the dark panel; brighter = higher retention
  const bg = (v: number | null) =>
    v == null ? 'transparent' : `color-mix(in srgb, var(--accent) ${Math.round(Math.min(1, v) * 92)}%, var(--paper-2))`
  const fg = (v: number | null) => (v != null && v > 0.45 ? 'var(--bone)' : 'var(--ink)')
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs tnum">
        <thead>
          <tr className="text-ink-soft">
            <th className="p-1 text-left font-mono font-medium uppercase tracking-wider">Cohort</th>
            <th className="p-1 font-mono font-medium uppercase tracking-wider">n</th>
            {Array.from({ length: maxLen }, (_, i) => <th key={i} className="p-1 font-mono font-medium">M{i}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="whitespace-nowrap p-1 font-mono font-medium text-ink">{r.label}</td>
              <td className="p-1 text-center text-ink-soft">{r.size}</td>
              {r.values.map((v, i) => (
                <td key={i} className="border border-line p-1 text-center" style={{ background: bg(v), color: fg(v) }}>
                  {v == null ? '' : `${Math.round(v * 100)}%`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
