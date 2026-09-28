import { NextRequest } from 'next/server'
import { networkBandStats } from '@/src/server/repo'
import { arrBandKey, DIMENSIONS } from '@/src/lib/benchmarks'
import { err, json } from '@/src/server/http'

/** GET ?arr=1234567 or ?band=$1–3M — returns static survey cohort + live network medians. */
export async function GET(req: NextRequest) {
  const arrParam = req.nextUrl.searchParams.get('arr')
  const bandParam = req.nextUrl.searchParams.get('band')
  let band = bandParam || ''
  if (!band && arrParam) {
    const arr = Number(arrParam)
    if (!Number.isFinite(arr)) return err('Invalid arr')
    band = arrBandKey(arr)
  }
  if (!band) return err('Provide ?arr= or ?band=')

  const staticCohort = DIMENSIONS.find((d) => d.id === 'arr')?.cohorts.find((c) => c.key === band) ?? null
  const network = await networkBandStats(band)

  return json({
    band,
    static: staticCohort ? {
      label: staticCohort.label,
      vals: staticCohort.vals,
      confidence: 'survey-anchored',
      source: 'SaaS Capital / KeyBanc / ChartMogul / OpenView (synthesized)',
    } : null,
    network: {
      n: network.n,
      enough: network.n >= 5,
      medians: {
        mrr: network.mrrMedian,
        arr: network.arrMedian,
        growth: network.growthMedian,
        nrr: network.nrrMedian,
        logoChurn: network.logoChurnMedian,
        quick: network.quickMedian,
      },
      note: network.n < 5
        ? 'Network percentiles unlock at 5+ public Trust pages in this ARR band. Survey medians are shown until then.'
        : 'Live peer medians from public MRRmark Trust pages in this ARR band (anonymized).',
    },
  })
}
