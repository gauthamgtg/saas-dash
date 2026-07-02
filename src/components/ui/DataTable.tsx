export type Column<T> = { key: string; header: string; render: (row: T) => React.ReactNode; align?: 'right' | 'left' }

export function DataTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>{columns.map((c) => <th key={c.key} className={`p-2 ${c.align === 'right' ? 'text-right' : ''}`}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              {columns.map((c) => <td key={c.key} className={`p-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
