import { describe, expect, it } from 'vitest'
import { parsePipelineRows, summarizePipeline, PIPELINE_TEMPLATE } from './pipeline'
import type { ParsedFile } from './parse'

function asParsed(rows: Record<string, string | number>[]): ParsedFile {
  const headers = Object.keys(rows[0])
  return {
    headers,
    rows: rows.map((r) => Object.fromEntries(headers.map((h) => [h, String(r[h] ?? '')]))),
  }
}

describe('pipeline', () => {
  it('parses the template and summarizes win rate', () => {
    const { rows, errors } = parsePipelineRows(asParsed(PIPELINE_TEMPLATE))
    expect(errors).toHaveLength(0)
    expect(rows.length).toBe(PIPELINE_TEMPLATE.length)
    const s = summarizePipeline(rows)
    expect(s.wonAmount).toBe(36000)
    expect(s.lostAmount).toBe(18000)
    expect(s.winRate).toBeCloseTo(0.5)
    expect(s.weightedPipeline).toBeGreaterThan(0)
    expect(s.byStage.find((x) => x.stage === 'negotiation')?.count).toBe(1)
  })

  it('rejects files missing required columns', () => {
    const { rows, errors } = parsePipelineRows({ headers: ['foo'], rows: [{ foo: '1' }] })
    expect(rows).toHaveLength(0)
    expect(errors[0]).toMatch(/Missing required/)
  })
})
