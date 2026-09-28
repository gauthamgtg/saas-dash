'use client'
import type { Mapping, ColumnField } from '@/src/lib/mapping'
import { REQUIRED_FIELDS } from '@/src/lib/mapping'
import { Select } from '@/src/components/ui/Select'

const FIELDS: { field: ColumnField; label: string }[] = [
  { field: 'date', label: 'Date *' }, { field: 'customerId', label: 'Customer ID *' },
  { field: 'amount', label: 'Overall Revenue *' }, { field: 'paymentId', label: 'Payment ID' },
  { field: 'invoiceNumber', label: 'Invoice Number' }, { field: 'name', label: 'Name' },
  { field: 'country', label: 'Country' }, { field: 'region', label: 'Region' },
  { field: 'businessModel', label: 'Business Model' }, { field: 'plan', label: 'Plan' },
  { field: 'salesRep', label: 'Sales Rep' }, { field: 'currency', label: 'Currency' },
  { field: 'customerFlag', label: 'Customer Flag' }, { field: 'refundFlag', label: 'Refund Flag' },
]

export function MappingForm({ headers, mapping, onChange }: {
  headers: string[]; mapping: Mapping; onChange: (m: Mapping) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {FIELDS.map(({ field, label }) => (
        <label key={field} className="flex flex-col text-sm">
          <span className={`text-[12.5px] ${REQUIRED_FIELDS.includes(field) ? 'text-ink' : 'text-ink-soft'} font-medium`}>{label}</span>
          <Select className="mt-1" value={mapping[field] ?? ''} placeholder="— none —"
            options={[{ value: '', label: '— none —' }, ...headers.map((h) => ({ value: h, label: h }))]}
            onChange={(v) => onChange({ ...mapping, [field]: v || null })} />
        </label>
      ))}
    </div>
  )
}
