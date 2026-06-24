'use client'

import { useRef } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react'
import {
  Upload,
  Cpu,
  BarChart3,
  FileCheck,
  type LucideIcon,
} from 'lucide-react'

type StepData = {
  icon: LucideIcon
  title: string
  description: string
}

const steps = [
  {
    icon: Upload,
    title: 'Importe seus dados',
    description:
      'Arraste arquivos XML, EFD, JSON ou XLSX. A plataforma valida e extrai automaticamente produtos, NCM, CFOP, CST, créditos e débitos.',
  },
  {
    icon: Cpu,
    title: 'O motor calcula',
    description:
      'Nosso engine aplica as regras de CBS, IBS e Imposto Seletivo sobre suas operações de compra e venda em segundos.',
  },
  {
    icon: BarChart3,
    title: 'Visualize o impacto',
    description:
      'Dashboards mostram o efeito por produto, cliente e fornecedor, com DRE projetada e fluxo de caixa ano a ano.',
  },
  {
    icon: FileCheck,
    title: 'Decida e exporte',
    description:
      'Compare regimes, identifique o cenário ideal e gere relatórios executivos em PDF, Excel e PowerPoint.',
  },
]

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  return (
    <section id="como-funciona" ref={ref} className="relative px-4">
      <div className="mx-auto grid max-w-6xl gap-12 py-24 md:grid-cols-2 md:gap-16 md:py-32">
        {/* Sticky intro */}
        <div className="md:sticky md:top-32 md:h-fit md:self-start">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Como Funciona
          </span>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            Do arquivo bruto à decisão estratégica em 4 passos.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
            Um fluxo guiado que transforma dados fiscais complexos em insights
            claros sobre o futuro tributário da sua empresa.
          </p>

          <div className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-primary"
              style={{ scaleX: scrollYProgress, transformOrigin: 'left' }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-6">
          {steps.map((step, i) => {
            const start = i / steps.length
            const end = (i + 1) / steps.length
            return (
              <Step
                key={step.title}
                step={step}
                index={i}
                progress={scrollYProgress}
                range={[start, end]}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Step({
  step,
  index,
  progress,
  range,
}: {
  step: StepData
  index: number
  progress: MotionValue<number>
  range: [number, number]
}) {
  const opacity = useTransform(
    progress,
    [Math.max(range[0] - 0.15, 0), range[0], range[1]],
    [0.4, 1, 1],
  )

  return (
    <motion.div
      style={{ opacity }}
      className="rounded-2xl border border-border bg-card p-7"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <step.icon className="h-5 w-5" />
        </div>
        <span className="font-mono text-sm text-muted-foreground">
          0{index + 1}
        </span>
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight">
        {step.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {step.description}
      </p>
    </motion.div>
  )
}
