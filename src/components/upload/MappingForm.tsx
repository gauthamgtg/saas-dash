'use client'
import type { Mapping, ColumnField } from '@/src/lib/mapping'
import { REQUIRED_FIELDS } from '@/src/lib/mapping'

const FIELDS: { field: ColumnField; label: string }[] = [
  { field: 'date', label: 'Date *' }, { field: 'customerId', label: 'Customer ID *' },
  { field: 'amount', label: 'Overall Revenue *' }, { field: 'paymentId', label: 'Payment ID' },
  { field: 'invoiceNumber', label: 'Invoice Number' }, { field: 'name', label: 'Name' },
  { field: 'country', label: 'Country' }, { field: 'region', label: 'Region' },
  { field: 'businessModel', label: 'Business Model' }, { field: 'currency', label: 'Currency' },
  { field: 'customerFlag', label: 'Customer Flag' }, { field: 'refundFlag', label: 'Refund Flag' },
]

export function MappingForm({ headers, mapping, onChange }: {
  headers: string[]; mapping: Mapping; onChange: (m: Mapping) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {FIELDS.map(({ field, label }) => (
        <label key={field} className="flex flex-col text-sm">
          <span className={REQUIRED_FIELDS.includes(field) ? 'font-semibold' : ''}>{label}</span>
          <select
            className="mt-1 rounded border border-slate-300 bg-white p-2"
            value={mapping[field] ?? ''}
            onChange={(e) => onChange({ ...mapping, [field]: e.target.value || null })}
          >
            <option value="">— none —</option>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
      ))}
    </div>
  )
}
