/**
 * Robust, locale-aware date parsing. `new Date(str)` is unreliable: it reads "13/4/2024"
 * as month 13 (US M/D/Y) and silently mis-parses ambiguous "3/4/2024". This handles
 * day-first / month-first / ISO / Excel-serial / month-name inputs and builds UTC dates
 * (monthKey uses getUTC*, so we must avoid timezone drift).
 */
export type DateOrder = 'auto' | 'dmy' | 'mdy' | 'ymd'

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}

function mkUTC(y: number, m: number, d: number): Date | null {
  if (m < 0 || m > 11 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m, d))
  // reject rollover (e.g. 31 Feb → 2/3 Mar)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null
  return dt
}

const expandYear = (y: number) => (y >= 100 ? y : y >= 70 ? 1900 + y : 2000 + y)

function fromParts(a: number, b: number, c: number, order: DateOrder): Date | null {
  if (order === 'ymd') return mkUTC(expandYear(a), b - 1, c)
  if (order === 'mdy') return mkUTC(expandYear(c), a - 1, b)
  return mkUTC(expandYear(c), b - 1, a) // dmy
}

export function parseDate(raw: string | null | undefined, order: DateOrder = 'auto'): Date | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null

  // Excel serial number (bare number, no separators) — 25569 = days between 1970 and Excel 1900 epoch
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    if (n > 59 && n < 2958466) {
      const dt = new Date(Math.round((n - 25569) * 86_400_000))
      if (!isNaN(dt.getTime())) return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()))
    }
    return null
  }

  // strip a trailing clock time from any format, e.g. "08-05-2026 05:16" or "13 Apr 2024 10:00:00"
  const core = s.replace(/[T\s]+\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*(?:[AaPp][Mm])?\s*Z?$/, '').trim() || s

  // ISO, optional time: 2024-04-13 / 2024-04-13T10:00:00Z
  const iso = core.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return mkUTC(+iso[1], +iso[2] - 1, +iso[3])

  // delimited numeric: / . - separators
  const parts = core.split(/[/.\-]/).map((p) => p.trim())
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    const n = parts.map(Number)
    if (parts[0].length === 4) return fromParts(n[0], n[1], n[2], 'ymd')
    let ord = order
    if (ord === 'auto' || ord === 'ymd') ord = n[0] > 12 ? 'dmy' : n[1] > 12 ? 'mdy' : 'mdy'
    return fromParts(n[0], n[1], n[2], ord)
  }

  // month-name: "13 Apr 2024" · "Apr 13, 2024" · "April 13 2024" · "13-Apr-2024"
  const tokens = core.replace(/,/g, ' ').split(/[\s/\-]+/).filter(Boolean)
  if (tokens.length === 3) {
    const mi = tokens.findIndex((t) => t.toLowerCase() in MONTHS)
    if (mi >= 0) {
      const month = MONTHS[tokens[mi].toLowerCase()]
      const nums = tokens.filter((_, i) => i !== mi).map(Number).filter((x) => !isNaN(x))
      if (nums.length === 2) {
        const [x, y] = nums
        const year = x > 31 ? x : y
        const day = x > 31 ? y : x
        return mkUTC(expandYear(year), month, day)
      }
    }
  }
  return null
}

/** Infer the dataset's date order from a sample of the mapped date column. Falls back to month-first (US). */
export function detectDateOrder(samples: (string | null | undefined)[]): Exclude<DateOrder, 'auto'> {
  let dmy = 0, mdy = 0, ymd = 0
  for (const s0 of samples) {
    const s = (s0 ?? '').trim()
    if (!s) continue
    if (/^\d{4}[/.\-]\d/.test(s)) { ymd++; continue }
    const p = s.split(/[/.\-]/)
    if (p.length === 3 && p.every((x) => /^\d+$/.test(x))) {
      const a = +p[0], b = +p[1]
      if (a > 12 && b <= 12) dmy++
      else if (b > 12 && a <= 12) mdy++
    }
  }
  if (ymd >= dmy && ymd >= mdy && ymd > 0) return 'ymd'
  if (dmy > mdy) return 'dmy'
  return 'mdy'
}
