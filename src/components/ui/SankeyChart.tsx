'use client'
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts'
import type { SankeyGraph } from '@/src/lib/engine'

const nodeColor = (name: string) => (name === 'Churned' ? 'var(--neg)' : name === 'Newly active' ? 'var(--pos)' : 'var(--accent)')

function SankeyNode({ x, y, width, height, payload }: any) {
  const left = payload.depth === 0
  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill={nodeColor(payload.name)} fillOpacity={0.85} radius={2} />
      <text x={left ? x - 6 : x + width + 6} y={y + height / 2} textAnchor={left ? 'end' : 'start'} dominantBaseline="middle"
        fontSize={11} fontFamily="var(--font-mono)" fill="var(--ink)">{payload.name}</text>
    </Layer>
  )
}

/** Sankey flow diagram (customers moving between revenue bins month-over-month). */
export function SankeyChart({ graph, height = 340 }: { graph: SankeyGraph; height?: number }) {
  if (!graph.links.length) return <p className="py-12 text-center font-mono text-xs text-ink-faint">Need two months of data</p>
  return (
    <div className="w-full font-mono" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey data={graph} nodeWidth={12} nodePadding={22} margin={{ top: 8, right: 120, bottom: 8, left: 90 }}
          node={<SankeyNode />} link={{ stroke: 'var(--ink-faint)', strokeOpacity: 0.18 }}>
          <Tooltip />
        </Sankey>
      </ResponsiveContainer>
    </div>
  )
}
