import type { ParsedFile } from './parse'

export const PIPELINE_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

/** One CRM / sales-pipeline opportunity row (CSV upload). */
export type PipelineDeal = {
  dealId: string
  name: string
  stage: PipelineStage
  amount: number // ACV or expected booking, base currency
  closeMonth: string // YYYY-MM
  owner: string
  source: string
  probability: number // 0..1
}

const HEADER_ALIASES: Record<keyof Omit<PipelineDeal, 'probability'> | 'probability', string[]> = {
  dealId: ['deal_id', 'dealid', 'opportunity_id', 'id', 'opportunity'],
  name: ['name', 'account', 'company', 'customer', 'deal_name'],
  stage: ['stage', 'status', 'pipeline_stage'],
  amount: ['amount', 'acv', 'value', 'arr', 'mrr', 'deal_size'],
  closeMonth: ['close_month', 'close_date', 'expected_close', 'date', 'month'],
  owner: ['owner', 'rep', 'sales_rep', 'ae'],
  source: ['source', 'channel', 'origin'],
  probability: ['probability', 'prob', 'likelihood', 'confidence'],
}

function findHeader(headers: string[], field: keyof typeof HEADER_ALIASES): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim().replace(/\s+/g, '_'))
  for (const alias of HEADER_ALIASES[field]) {
    const i = lower.indexOf(alias)
    if (i >= 0) return headers[i]
  }
  return null
}

function toMonth(raw: string): string | null {
  const s = raw.trim()
  const m = s.match(/^(\d{4})[-/](\d{1,2})/)
  if (m) {
    const mo = Number(m[2])
    if (mo >= 1 && mo <= 12) return `${m[1]}-${String(mo).padStart(2, '0')}`
  }
  const d = new Date(s)
  if (!isNaN(d.getTime())) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  return null
}

function toAmount(raw: string): number | null {
  const n = Number(raw.replace(/[$,\s]/g, ''))
  return isFinite(n) ? n : null
}

function toStage(raw: string): PipelineStage {
  const s = raw.toLowerCase().trim()
  if ((PIPELINE_STAGES as readonly string[]).includes(s)) return s as PipelineStage
  if (s.includes('won') || s === 'closed won') return 'won'
  if (s.includes('lost') || s === 'closed lost') return 'lost'
  if (s.includes('negot')) return 'negotiation'
  if (s.includes('propos') || s.includes('demo')) return 'proposal'
  if (s.includes('qual')) return 'qualified'
  return 'lead'
}

const STAGE_DEFAULT_PROB: Record<PipelineStage, number> = {
  lead: 0.1, qualified: 0.25, proposal: 0.45, negotiation: 0.65, won: 1, lost: 0,
}

/**
 * Parse a CRM/pipeline opportunity CSV.
 * Required: deal id (or name), stage, amount, close date/month.
 */
export function parsePipelineRows(parsed: ParsedFile): { rows: PipelineDeal[]; errors: string[] } {
  const errors: string[] = []
  const hId = findHeader(parsed.headers, 'dealId')
  const hName = findHeader(parsed.headers, 'name')
  const hStage = findHeader(parsed.headers, 'stage')
  const hAmount = findHeader(parsed.headers, 'amount')
  const hClose = findHeader(parsed.headers, 'closeMonth')
  const hOwner = findHeader(parsed.headers, 'owner')
  const hSource = findHeader(parsed.headers, 'source')
  const hProb = findHeader(parsed.headers, 'probability')

  if (!hStage || !hAmount || !hClose || (!hId && !hName)) {
    return {
      rows: [],
      errors: [`Missing required columns. Need stage, amount, close_date/month, and deal_id or name. Found: ${parsed.headers.join(', ') || '(none)'}`],
    }
  }

  const rows: PipelineDeal[] = []
  parsed.rows.forEach((r, i) => {
    const amount = toAmount(r[hAmount] ?? '')
    const closeMonth = toMonth(r[hClose] ?? '')
    const stage = toStage(r[hStage] ?? '')
    const name = (hName ? r[hName] : '').trim() || (hId ? r[hId] : '').trim() || `Deal ${i + 1}`
    const dealId = (hId ? r[hId] : '').trim() || `row-${i + 2}`
    if (amount == null || !closeMonth) {
      errors.push(`Row ${i + 2}: ${amount == null ? `bad amount "${r[hAmount]}"` : `bad close date "${r[hClose]}"`}`)
      return
    }
    let probability = STAGE_DEFAULT_PROB[stage]
    if (hProb) {
      const raw = (r[hProb] ?? '').replace('%', '').trim()
      const p = Number(raw)
      if (isFinite(p)) probability = p > 1 ? p / 100 : p
    }
    rows.push({
      dealId, name, stage, amount, closeMonth,
      owner: (hOwner ? r[hOwner] : '').trim() || 'Unassigned',
      source: (hSource ? r[hSource] : '').trim() || 'Unknown',
      probability,
    })
  })
  return { rows, errors }
}

export const PIPELINE_TEMPLATE: Record<string, string | number>[] = [
  { deal_id: 'D-1001', name: 'Acme Corp', stage: 'negotiation', amount: 48000, close_date: '2026-08-15', owner: 'Priya', source: 'Inbound', probability: 0.7 },
  { deal_id: 'D-1002', name: 'Northwind', stage: 'proposal', amount: 24000, close_date: '2026-09-01', owner: 'Alex', source: 'Outbound', probability: 0.4 },
  { deal_id: 'D-1003', name: 'Globex', stage: 'qualified', amount: 72000, close_date: '2026-10-01', owner: 'Priya', source: 'Partner', probability: 0.25 },
  { deal_id: 'D-1004', name: 'Initech', stage: 'won', amount: 36000, close_date: '2026-06-20', owner: 'Sam', source: 'Inbound', probability: 1 },
  { deal_id: 'D-1005', name: 'Umbrella', stage: 'lost', amount: 18000, close_date: '2026-05-10', owner: 'Alex', source: 'Outbound', probability: 0 },
  { deal_id: 'D-1006', name: 'Stark Industries', stage: 'lead', amount: 96000, close_date: '2026-11-01', owner: 'Sam', source: 'Event', probability: 0.1 },
]

export type PipelineSummary = {
  openCount: number
  openAmount: number
  weightedPipeline: number
  wonAmount: number
  lostAmount: number
  winRate: number | null
  byStage: { stage: PipelineStage; count: number; amount: number }[]
  byOwner: { owner: string; open: number; weighted: number; won: number }[]
  byMonth: { month: string; weighted: number; won: number }[]
}

export function summarizePipeline(deals: PipelineDeal[]): PipelineSummary {
  const open = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost')
  const won = deals.filter((d) => d.stage === 'won')
  const lost = deals.filter((d) => d.stage === 'lost')
  const closed = won.length + lost.length

  const byStage = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: deals.filter((d) => d.stage === stage).length,
    amount: deals.filter((d) => d.stage === stage).reduce((s, d) => s + d.amount, 0),
  }))

  const owners = [...new Set(deals.map((d) => d.owner))].sort()
  const byOwner = owners.map((owner) => {
    const mine = deals.filter((d) => d.owner === owner)
    return {
      owner,
      open: mine.filter((d) => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + d.amount, 0),
      weighted: mine.filter((d) => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + d.amount * d.probability, 0),
      won: mine.filter((d) => d.stage === 'won').reduce((s, d) => s + d.amount, 0),
    }
  }).sort((a, b) => b.weighted - a.weighted)

  const months = [...new Set(deals.map((d) => d.closeMonth))].sort()
  const byMonth = months.map((month) => ({
    month,
    weighted: open.filter((d) => d.closeMonth === month).reduce((s, d) => s + d.amount * d.probability, 0),
    won: won.filter((d) => d.closeMonth === month).reduce((s, d) => s + d.amount, 0),
  }))

  return {
    openCount: open.length,
    openAmount: open.reduce((s, d) => s + d.amount, 0),
    weightedPipeline: open.reduce((s, d) => s + d.amount * d.probability, 0),
    wonAmount: won.reduce((s, d) => s + d.amount, 0),
    lostAmount: lost.reduce((s, d) => s + d.amount, 0),
    winRate: closed ? won.length / closed : null,
    byStage, byOwner, byMonth,
  }
}
