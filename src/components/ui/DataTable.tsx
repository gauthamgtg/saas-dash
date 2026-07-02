export type Column<T> = { key: string; header: string; render: (row: T) => React.ReactNode; align?: 'right' | 'left' }

export function DataTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <div className="overflow-x-auto border border-line bg-paper">
      <table className="w-full text-sm">
        <thead className="border-b border-line-strong">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line hover:bg-bone">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right tnum' : ''}`}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
