export type ColumnField =
  | 'paymentId' | 'invoiceNumber' | 'date' | 'customerId' | 'name'
  | 'country' | 'region' | 'businessModel' | 'currency' | 'amount'
  | 'customerFlag' | 'refundFlag'

export type Mapping = Record<ColumnField, string | null>

export const REQUIRED_FIELDS: ColumnField[] = ['date', 'customerId', 'amount']

/** Header synonyms per field, normalized (lowercase, alnum only). */
const SYNONYMS: Record<ColumnField, string[]> = {
  paymentId: ['paymentid', 'payment', 'txnid', 'transactionid'],
  invoiceNumber: ['invoicenumber', 'invoice', 'invoiceno', 'invoiceid'],
  date: ['date', 'paymentdate', 'transactiondate', 'createdat', 'timestamp'],
  customerId: ['customerid', 'custid', 'accountid', 'userid', 'customer'],
  name: ['name', 'customername', 'accountname', 'company'],
  country: ['country'],
  region: ['region', 'geo', 'territory'],
  businessModel: ['businessmodel', 'model', 'plan', 'producttype'],
  currency: ['currency', 'curr', 'ccy'],
  amount: ['overallrevenue', 'revenue', 'amount', 'total', 'grossrevenue', 'netrevenue', 'mrr'],
  customerFlag: ['customerflag', 'newrepeat', 'customertype'],
  refundFlag: ['refundflag', 'isrefund', 'refund', 'refunded'],
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function autoDetect(headers: string[]): Mapping {
  const normed = headers.map((h) => ({ raw: h, n: norm(h) }))
  const out = {} as Mapping
  for (const field of Object.keys(SYNONYMS) as ColumnField[]) {
    const syns = SYNONYMS[field]
    // exact-normalized match first, then contains
    const hit =
      normed.find((h) => syns.includes(h.n)) ??
      normed.find((h) => syns.some((s) => h.n.includes(s)))
    out[field] = hit ? hit.raw : null
  }
  return out
}

export function missingRequired(m: Mapping): ColumnField[] {
  return REQUIRED_FIELDS.filter((f) => !m[f])
}
