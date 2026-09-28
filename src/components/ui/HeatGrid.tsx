'use client'
import { useState } from 'react'

export type Cell = { bg: string; fg: string }

/** Sequential accent ramp; t in [0,1]. Text flips to white on dark cells. */
export const seqCell = (t: number | null): Cell =>
  t == null ? { bg: 'var(--paper-2)', fg: 'var(--ink-faint)' }
    : { bg: `color-mix(in srgb, var(--accent) ${8 + Math.max(0, Math.min(1, t)) * 82}%, var(--paper))`, fg: t > 0.55 ? '#fff' : 'var(--ink)' }

/** Diverging pos/neg ramp around 0; `scale` = the magnitude that saturates. */
export const divCell = (v: number | null, scale: number): Cell => {
  if (v == null) return { bg: 'var(--paper-2)', fg: 'var(--ink-faint)' }
  const k = Math.min(1, Math.abs(v) / (scale || 1))
  if (k < 0.02) return { bg: 'color-mix(in srgb, var(--ink-faint) 10%, var(--paper))', fg: 'var(--ink-soft)' }
  return { bg: `color-mix(in srgb, var(${v >= 0 ? '--pos' : '--neg'}) ${10 + k * 75}%, var(--paper))`, fg: k > 0.6 ? '#fff' : 'var(--ink)' }
}

/**
 * Labeled matrix heatmap (rows × columns) with hover crosshair and readout.
 * `cell` returns the value, its colours and display text — null for an empty cell.
 */
export function HeatGrid({ rows, cols, cell, rowLabel = (r) => r, colLabel = (c) => c, corner = '', minCol = 48, detail }: {
  rows: string[]; cols: string[]
  cell: (row: string, col: string) => ({ text: string; color: Cell } | null)
  rowLabel?: (r: string) => React.ReactNode; colLabel?: (c: string) => string
  corner?: string; minCol?: number
  detail?: (row: string, col: string) => string
}) {
  const [hov, setHov] = useState<{ r: string; c: string } | null>(null)
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <table className="border-separate text-[12px] tabular-nums" style={{ borderSpacing: 3 }} onMouseLeave={() => setHov(null)}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-paper pr-2 text-left text-[11.5px] font-medium text-ink-faint">{corner}</th>
              {cols.map((c) => (
                <th key={c} className={`px-1 pb-1 text-center text-[11px] font-medium transition-colors ${hov?.c === c ? 'text-ink' : 'text-ink-faint'}`} style={{ minWidth: minCol }}>{colLabel(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                <th className={`sticky left-0 z-10 whitespace-nowrap bg-paper pr-3 text-left text-[12.5px] font-medium transition-colors ${hov?.r === r ? 'text-ink' : 'text-ink-soft'}`}>{rowLabel(r)}</th>
                {cols.map((c) => {
                  const v = cell(r, c)
                  const on = hov?.r === r && hov?.c === c
                  const dim = hov && hov.r !== r && hov.c !== c
                  return (
                    <td key={c} onMouseEnter={() => setHov({ r, c })}
                      className="h-8 rounded-md px-1 text-center font-medium transition-all duration-150"
                      style={{ background: v?.color.bg ?? 'var(--paper-2)', color: v?.color.fg ?? 'var(--ink-faint)', opacity: dim ? 0.55 : 1,
                        boxShadow: on ? 'inset 0 0 0 1.5px var(--ink)' : undefined }}>
                      {v?.text ?? ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail && (
        <p className="mt-2 min-h-[18px] text-[12.5px] text-ink-soft">{hov ? detail(hov.r, hov.c) : <span className="text-ink-faint">Hover a cell for details</span>}</p>
      )}
    </div>
  )
}
