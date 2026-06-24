'use client'

import { Quote } from 'lucide-react'
import { Reveal } from './reveal'
import { SpotlightCard } from './spotlight-card'

const cases = [
  {
    quote:
      'Em uma tarde simulamos toda a operação e descobrimos que o Lucro Presumido deixaria de ser vantajoso. A plataforma pagou o ano de assinatura no primeiro relatório.',
    name: 'Mariana Lopes',
    role: 'CFO · Nexus Indústria',
  },
  {
    quote:
      'Atendo 120 clientes e finalmente tenho uma ferramenta que fala a língua da reforma. Os dashboards convencem o cliente em segundos.',
    name: 'Ricardo Almeida',
    role: 'Sócio · Contabilidade Prime',
  },
  {
    quote:
      'A importação de EFD e a análise por NCM eliminaram semanas de planilha. Os relatórios automáticos explicam cada número para a diretoria.',
    name: 'Júlia Tavares',
    role: 'Controladoria · Grupo Vanguarda',
  },
]

export function CasesSection() {
  return (
    <section id="cases" className="relative px-4 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Cases
          </span>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            Quem já se antecipou, decide melhor.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {cases.map((item, i) => (
            <Reveal key={item.name} delay={i * 0.1}>
              <SpotlightCard className="rounded-2xl border border-border bg-card p-7 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary/40">
                <figure className="flex h-full flex-col">
                  <Quote className="h-7 w-7 text-primary" />
                  <blockquote className="mt-5 flex-1 text-pretty text-sm leading-relaxed text-foreground/90">
                    {item.quote}
                  </blockquote>
                  <figcaption className="mt-6 border-t border-border pt-5">
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.role}</p>
                  </figcaption>
                </figure>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
