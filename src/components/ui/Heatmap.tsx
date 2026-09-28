export function Heatmap({ rows }: { rows: { label: string; size: number; values: (number | null)[] }[] }) {
  const maxLen = Math.max(0, ...rows.map((r) => r.values.length))
  // emerald ramp over the dark panel; brighter = higher retention
  const bg = (v: number | null) =>
    v == null ? 'transparent' : `color-mix(in srgb, var(--accent) ${Math.round(Math.min(1, v) * 92)}%, var(--paper-2))`
  const fg = (v: number | null) => (v != null && v > 0.45 ? 'var(--bone)' : 'var(--ink)')
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs tnum">
        <thead>
          <tr className="text-ink-soft">
            <th className="w-20 whitespace-nowrap p-1 text-left font-medium">Cohort</th>
            <th className="w-10 p-1 font-medium">n</th>
            {Array.from({ length: maxLen }, (_, i) => <th key={i} className="min-w-[42px] p-1 font-medium tabular-nums">M{i}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="whitespace-nowrap p-1 font-medium text-ink tabular-nums">{r.label}</td>
              <td className="p-1 text-center text-ink-soft">{r.size}</td>
              {Array.from({ length: maxLen }, (_, i) => r.values[i] ?? null).map((v, i) => (
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
