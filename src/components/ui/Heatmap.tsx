export function Heatmap({ rows }: { rows: { label: string; size: number; values: (number | null)[] }[] }) {
  const maxLen = Math.max(0, ...rows.map((r) => r.values.length))
  const bg = (v: number | null) => (v == null ? '#f8fafc' : `hsl(222 70% ${92 - Math.min(1, v) * 45}%)`)
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
      <table className="text-xs">
        <thead><tr><th className="p-1 text-left">Cohort</th><th className="p-1">Size</th>
          {Array.from({ length: maxLen }, (_, i) => <th key={i} className="p-1">M{i}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="whitespace-nowrap p-1 font-medium">{r.label}</td>
              <td className="p-1 text-center text-slate-500">{r.size}</td>
              {r.values.map((v, i) => (
                <td key={i} className="p-1 text-center" style={{ background: bg(v) }}>
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
