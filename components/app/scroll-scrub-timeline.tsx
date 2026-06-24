'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring, type MotionValue } from 'motion/react'

import type { YearlyProjection } from '@/lib/tax-engine/types'
import { formatPercent } from '@/lib/labels'

const WIDTH = 600
const HEIGHT = 200
const PAD = 32

interface Series {
  label: string
  color: string
  anos: YearlyProjection[]
}

/* Each dot is its own component so useTransform is called at top level */
function Dot({
  cx,
  cy,
  color,
  progress,
  threshold,
}: {
  cx: number
  cy: number
  color: string
  progress: MotionValue<number>
  threshold: [number, number]
}) {
  const scale = useTransform(progress, threshold, [0, 1])
  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={4}
      fill={color}
      style={{ scale, transformOrigin: `${cx}px ${cy}px` }}
    />
  )
}

export function ScrollScrubTimeline({ series }: { series: Series[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'end 0.55'],
  })
  const rawProgress = useTransform(scrollYProgress, [0, 1], [0, 1])
  const progress = useSpring(rawProgress, { stiffness: 60, damping: 18 })

  if (!series.length || !series[0].anos.length) return null

  const years = series[0].anos.map((a) => a.ano)
  const allValues = series.flatMap((s) => s.anos.map((a) => a.cargaReformaPct))
  const min = Math.min(...allValues, 0)
  const max = Math.max(...allValues)
  const range = max - min || 1

  function px(index: number) {
    return PAD + (index / (years.length - 1)) * (WIDTH - PAD * 2)
  }
  function py(value: number) {
    return HEIGHT - PAD - ((value - min) / range) * (HEIGHT - PAD * 2)
  }

  return (
    <div ref={ref}>
      {/* legend */}
      <div className="mb-5 flex flex-wrap items-center gap-5 text-xs">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2.5 w-6 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full overflow-visible">
        {/* grid lines */}
        {[0.25, 0.5, 0.75, 1].map((f) => {
          const v = min + f * range
          return (
            <line
              key={f}
              x1={PAD}
              y1={py(v)}
              x2={WIDTH - PAD}
              y2={py(v)}
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-border"
              strokeDasharray="4 4"
            />
          )
        })}

        {/* year labels */}
        {years.map((year, i) => (
          <text
            key={year}
            x={px(i)}
            y={HEIGHT - 6}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={10}
          >
            {year}
          </text>
        ))}

        {/* series lines — scroll-scrubbed pathLength */}
        {series.map((s) => {
          const pointsArr = s.anos.map((a, i) => [px(i), py(a.cargaReformaPct)] as [number, number])
          const d = pointsArr
            .map((p, i) => (i === 0 ? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`))
            .join(' ')
          return (
            <g key={s.label}>
              {/* glow copy */}
              <motion.path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={8}
                strokeOpacity={0.12}
                strokeLinecap="round"
                style={{ pathLength: progress }}
              />
              {/* main line */}
              <motion.path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                style={{ pathLength: progress }}
              />
              {/* dots — each in its own component to respect hooks rules */}
              {pointsArr.map(([cx, cy], i) => (
                <Dot
                  key={`${s.label}-${i}`}
                  cx={cx}
                  cy={cy}
                  color={s.color}
                  progress={progress}
                  threshold={[
                    i / years.length,
                    Math.min((i + 0.5) / years.length, 1),
                  ]}
                />
              ))}
            </g>
          )
        })}
      </svg>

      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>Carga tributária sobre a receita · transição 2026→2033</span>
        <span>{formatPercent(min)} – {formatPercent(max)}</span>
      </div>
    </div>
  )
}
