'use client'
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts'
import type { SankeyGraph } from '@/src/lib/engine'

const defaultNodeColor = (name: string) => (name === 'Churned' ? 'var(--neg)' : name === 'Newly active' || name === 'New' ? 'var(--pos)' : 'var(--accent)')

function SankeyNode({ x, y, width, height, payload, color }: any) {
  const left = payload.depth === 0
  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill={color(payload.name, payload.depth)} fillOpacity={0.9} radius={3} />
      <text x={left ? x - 8 : x + width + 8} y={y + height / 2} textAnchor={left ? 'end' : 'start'} dominantBaseline="middle"
        fontSize={12} fontWeight={500} fill="var(--ink)">
        {payload.name}<tspan fill="var(--ink-faint)" fontWeight={400}> {payload.value}</tspan>
      </text>
    </Layer>
  )
}

function SankeyLink({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, color }: any) {
  return (
    <path d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none" stroke={color(index)} strokeOpacity={0.32} strokeWidth={Math.max(1, linkWidth)}
      className="transition-[stroke-opacity] hover:[stroke-opacity:0.6]" />
  )
}

/** Sankey flow diagram. Optional colour hooks for nodes (by name/side) and links (by index). */
export function SankeyChart({ graph, height = 340, nodeColor = defaultNodeColor, linkColor }: {
  graph: SankeyGraph; height?: number
  nodeColor?: (name: string, depth: number) => string
  linkColor?: (index: number) => string
}) {
  if (!graph.links.length) return <p className="py-12 text-center text-xs text-ink-faint tabular-nums">Need two months of data</p>
  return (
    <div className="w-full tabular-nums" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey data={graph} nodeWidth={12} nodePadding={22} margin={{ top: 8, right: 130, bottom: 8, left: 110 }}
          node={<SankeyNode color={nodeColor} />}
          link={linkColor ? <SankeyLink color={linkColor} /> : { stroke: 'var(--ink-faint)', strokeOpacity: 0.18 }}>
          <Tooltip />
        </Sankey>
      </ResponsiveContainer>
    </div>
  )
}
