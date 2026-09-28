'use client'
import { useEffect, useMemo, useState } from 'react'
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { Feature, Geometry } from 'geojson'

export type MapDatum = { label: string; fill: string; title: string }
type Shape = Feature<Geometry, { name: string }>

const W = 960, H = 470

/**
 * Choropleth world map (Natural Earth 110m via world-atlas, projected with d3-geo).
 * The ~100 KB atlas is lazy-loaded so it never weighs on views that don't show a map.
 */
export function WorldMap({ values, points = [], hovered, onHover }: {
  values: Map<string, MapDatum>   // keyed by lowercased atlas name
  points?: { key: string; lat: number; lon: number; fill: string; title: string }[]
  hovered?: string | null
  onHover?: (key: string | null) => void
}) {
  const [shapes, setShapes] = useState<Shape[] | null>(null)
  useEffect(() => {
    let live = true
    import('world-atlas/countries-110m.json').then((mod) => {
      const topo = (mod.default ?? mod) as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>
      const fc = feature(topo, topo.objects.countries)
      if (live) setShapes(fc.features.filter((f) => f.properties.name !== 'Antarctica') as Shape[])
    })
    return () => { live = false }
  }, [])

  const { path, project, graticule, outline } = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], { type: 'Sphere' })
    const path = geoPath(projection)
    return { path, project: projection, graticule: path(geoGraticule10()) ?? '', outline: path({ type: 'Sphere' }) ?? '' }
  }, [])

  const missing = shapes ? [...values].filter(([k]) => !shapes.some((f) => f.properties.name.toLowerCase() === k) && !points.some((p) => p.key === k)).map(([, v]) => v.label) : []

  return (
    <>
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="World map" onMouseLeave={() => onHover?.(null)}>
      <path d={outline} fill="var(--paper-2)" stroke="var(--line)" />
      <path d={graticule} fill="none" stroke="var(--line)" strokeWidth={0.5} />
      {!shapes && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="var(--ink-faint)">Loading map…</text>}
      {shapes?.map((f) => {
        const key = f.properties.name.toLowerCase()
        const v = values.get(key)
        const on = hovered === key
        return (
          <path key={key} d={path(f) ?? ''} onMouseEnter={() => onHover?.(v ? key : null)}
            fill={v ? v.fill : 'color-mix(in srgb, var(--ink-faint) 16%, var(--paper))'}
            stroke={on ? 'var(--ink)' : 'var(--paper)'} strokeWidth={on ? 1.4 : 0.5}
            className={v ? 'cursor-pointer transition-[fill] duration-200' : ''}>
            <title>{v ? v.title : f.properties.name}</title>
          </path>
        )
      })}
      {points.map((p) => {
        const xy = project([p.lon, p.lat])
        if (!xy) return null
        return (
          <circle key={p.key} cx={xy[0]} cy={xy[1]} r={hovered === p.key ? 6 : 4.5} fill={p.fill} stroke="var(--paper)" strokeWidth={1.5}
            onMouseEnter={() => onHover?.(p.key)} className="cursor-pointer">
            <title>{p.title}</title>
          </circle>
        )
      })}
    </svg>
    {missing.length > 0 && <p className="mt-2 text-[11.5px] text-ink-faint">Not on map: {missing.join(', ')}</p>}
    </>
  )
}
