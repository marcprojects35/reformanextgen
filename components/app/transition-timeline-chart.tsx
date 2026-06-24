'use client'

import { motion } from 'motion/react'

import type { YearlyProjection } from '@/lib/tax-engine/types'
import { formatPercent } from '@/lib/labels'

const WIDTH = 600
const HEIGHT = 220
const PADDING = 28

interface Series {
  label: string
  color: string
  anos: YearlyProjection[]
}

export function TransitionTimelineChart({ series }: { series: Series[] }) {
  if (series.length === 0 || series[0].anos.length === 0) return null

  const years = series[0].anos.map((a) => a.ano)
  const allValues = series.flatMap((s) => s.anos.map((a) => a.cargaReformaPct))
  const min = Math.min(...allValues, 0)
  const max = Math.max(...allValues)
  const range = max - min || 1

  function x(index: number) {
    return PADDING + (index / (years.length - 1)) * (WIDTH - PADDING * 2)
  }
  function y(value: number) {
    return HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full overflow-visible">
        {years.map((year, index) => (
          <text
            key={year}
            x={x(index)}
            y={HEIGHT - 6}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {year}
          </text>
        ))}

        {series.map((s) => {
          const points = s.anos.map((a, index) => `${x(index)},${y(a.cargaReformaPct)}`).join(' ')
          return (
            <g key={s.label}>
              <motion.polyline
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              />
              {s.anos.map((a, index) => (
                <circle key={a.ano} cx={x(index)} cy={y(a.cargaReformaPct)} r={3} fill={s.color} />
              ))}
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>Carga sobre a receita ao longo da transição</span>
        <span>
          {formatPercent(min)} – {formatPercent(max)}
        </span>
      </div>
    </div>
  )
}
