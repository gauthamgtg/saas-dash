import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export type ParsedFile = { headers: string[]; rows: Record<string, string>[] }

export function parseCsv(text: string): ParsedFile {
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })
  const rows = (res.data || []).filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''))
  const headers = res.meta.fields ? res.meta.fields.map((h) => h.trim()) : []
  return { headers, rows }
}

/** Excel: read the first sheet, coerce every cell to string, header = first row. */
export function parseExcel(data: ArrayBuffer): ParsedFile {
  const wb = XLSX.read(data, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
  const headers = json.length ? Object.keys(json[0]).map((h) => h.trim()) : []
  const rows = json
    .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), String(v ?? '')])))
    .filter((r) => Object.values(r).some((v) => v.trim() !== ''))
  return { headers, rows }
}

export async function parseFile(file: File): Promise<ParsedFile> {
  if (/\.(xlsx|xls)$/i.test(file.name)) return parseExcel(await file.arrayBuffer())
  return parseCsv(await file.text())
}
