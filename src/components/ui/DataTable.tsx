export type Column<T> = { key: string; header: string; render: (row: T) => React.ReactNode; align?: 'right' | 'left' }

export function DataTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-paper shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-paper-2">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3.5 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line transition-colors hover:bg-paper-2">
              {columns.map((c) => (
                <td key={c.key} className={`px-3.5 py-2.5 ${c.align === 'right' ? 'text-right tnum' : ''}`}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
