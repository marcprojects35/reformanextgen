'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { Reveal } from './reveal'
import { AnimatedCounter } from './animated-counter'
import { SpotlightCard } from './spotlight-card'

const stats = [
  {
    value: 27.5,
    suffix: '%',
    decimals: 1,
    label: 'Alíquota de referência estimada do IVA Dual',
  },
  { value: 2033, label: 'Ano de conclusão da transição', decimals: 0 },
  {
    value: 1.4,
    prefix: 'R$ ',
    suffix: ' mi',
    decimals: 1,
    label: 'Economia média identificada por simulação',
  },
  {
    value: 92,
    suffix: '%',
    label: 'Das empresas mudam de cenário ideal após análise',
  },
]

const bars = [
  { label: 'Lucro Real', current: 72, future: 58 },
  { label: 'Lucro Presumido', current: 64, future: 81 },
  { label: 'Simples Nacional', current: 48, future: 53 },
  { label: 'IVA Dual', current: 0, future: 67 },
]

export function ImpactSection() {
  const chartRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: chartProgress } = useScroll({
    target: chartRef,
    offset: ['start 0.85', 'start 0.35'],
  })

  return (
    <section
      id="impactos"
      className="relative bg-surface/40 px-4 py-24 md:py-32"
    >
      <div className="divider-fade absolute inset-x-0 top-0" aria-hidden />
      <div className="divider-fade absolute inset-x-0 bottom-0" aria-hidden />
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Impactos da Reforma
          </span>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            Números que mudam o jogo do seu planejamento.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 0.08}>
              <SpotlightCard className="h-full rounded-2xl border border-border bg-card p-7 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary/40">
                <p className="text-4xl font-semibold tracking-tight text-gradient-gold md:text-5xl">
                  <AnimatedCounter
                    value={stat.value}
                    decimals={stat.decimals ?? 0}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                  />
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {stat.label}
                </p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>

        {/* Comparative chart */}
        <Reveal className="mt-6">
          <div className="rounded-3xl border border-border bg-card p-8 md:p-10">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h3 className="text-xl font-semibold tracking-tight">
                  Atratividade do regime: hoje vs. pós-reforma
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Índice simulado de eficiência tributária por regime (0–100).
                </p>
              </div>
              <div className="flex items-center gap-5 text-xs">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-secondary-foreground/40" />
                  Hoje
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  Pós-reforma
                </span>
              </div>
            </div>

            <div
              ref={chartRef}
              className="mt-10 flex h-64 items-end justify-around gap-4 md:gap-10"
            >
              {bars.map((bar, i) => {
                const start = i * 0.08
                return (
                  <div
                    key={bar.label}
                    className="flex h-full flex-1 flex-col items-center justify-end"
                  >
                    <div className="flex h-full w-full items-end justify-center gap-2 md:gap-3">
                      <Bar
                        height={bar.current}
                        progress={chartProgress}
                        range={[start, 1]}
                        variant="muted"
                      />
                      <Bar
                        height={bar.future}
                        progress={chartProgress}
                        range={[start + 0.05, 1]}
                        variant="gold"
                      />
                    </div>
                    <span className="mt-4 text-center text-xs font-medium text-muted-foreground">
                      {bar.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Bar({
  height,
  progress,
  range,
  variant,
}: {
  height: number
  progress: MotionValue<number>
  range: [number, number]
  variant: 'gold' | 'muted'
}) {
  const barHeight = useTransform(progress, range, ['0%', `${height}%`])
  return (
    <motion.div
      className={
        variant === 'gold'
          ? 'w-6 rounded-t-md bg-primary md:w-10'
          : 'w-6 rounded-t-md bg-secondary-foreground/20 md:w-10'
      }
      style={{ height: barHeight }}
    />
  )
}
