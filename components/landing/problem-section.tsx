'use client'

import { AlertTriangle, Clock, FileWarning, TrendingDown } from 'lucide-react'
import { Reveal } from './reveal'
import { Parallax } from './parallax'
import { SpotlightCard } from './spotlight-card'

const problems = [
  {
    icon: FileWarning,
    title: 'Legislação em transição',
    description:
      'CBS, IBS e Imposto Seletivo convivem com o sistema atual até 2033. Entender o que muda exige tempo e especialização.',
  },
  {
    icon: TrendingDown,
    title: 'Risco de pagar mais',
    description:
      'Empresas que não recalculam seu regime podem perder competitividade e margem sem nem perceber.',
  },
  {
    icon: Clock,
    title: 'Planilhas não acompanham',
    description:
      'Modelos manuais quebram diante da complexidade de NCM, CFOP, CST, créditos e débitos da reforma.',
  },
  {
    icon: AlertTriangle,
    title: 'Decisões no escuro',
    description:
      'Sem simulação confiável, escolher entre regimes vira aposta — e o custo do erro é alto.',
  },
]

export function ProblemSection() {
  return (
    <section id="problema" className="relative overflow-hidden px-4 py-24 md:py-32">
      <Parallax
        speed={45}
        className="absolute right-0 top-10 h-[360px] w-[360px] rounded-full blur-[120px]"
      >
        <div
          className="h-full w-full rounded-full"
          style={{ background: 'rgba(255,77,77,0.08)' }}
        />
      </Parallax>
      <div className="relative mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            O Problema
          </span>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            A maior mudança tributária em 60 anos já começou.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
            E a maioria das empresas ainda toma decisões com ferramentas que não
            foram feitas para essa nova realidade.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((problem, i) => (
            <Reveal key={problem.title} delay={i * 0.08}>
              <SpotlightCard className="h-full rounded-2xl border border-border bg-card p-6 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary/40">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <problem.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {problem.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {problem.description}
                </p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
