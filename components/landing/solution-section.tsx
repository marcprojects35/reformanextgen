'use client'

import {
  FileSpreadsheet,
  GitCompareArrows,
  LayoutDashboard,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import { Reveal } from './reveal'
import { SpotlightCard } from './spotlight-card'

export function SolutionSection() {
  return (
    <section
      id="solucao"
      className="relative bg-surface/40 px-4 py-24 md:py-32"
    >
      <div className="divider-fade absolute inset-x-0 top-0" aria-hidden />
      <div className="divider-fade absolute inset-x-0 bottom-0" aria-hidden />
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            A Solução
          </span>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            Uma plataforma inteira pensada para a nova tributação.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
            Importe seus dados, simule cenários e tome decisões com clareza —
            tudo em um só lugar.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-6">
          {/* Big card */}
          <Reveal className="md:col-span-4" delay={0.05}>
            <SpotlightCard className="h-full rounded-3xl border border-border bg-card p-8 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary/40">
              <div
                className="absolute right-0 top-0 h-64 w-64 rounded-full blur-[100px]"
                style={{ background: 'rgba(255,180,0,0.12)' }}
                aria-hidden
              />
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight">
                  Dashboards financeiros dinâmicos
                </h3>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  Gráficos animados de impacto, DRE projetada, fluxo de caixa,
                  heatmaps e waterfall. Filtros interativos com drill-down por
                  NCM, produto, cliente e fornecedor.
                </p>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    { k: 'Tempo real', v: 'Recálculo' },
                    { k: 'Drill-down', v: 'Multinível' },
                    { k: 'Exportação', v: 'PDF · XLSX' },
                  ].map((s) => (
                    <div
                      key={s.k}
                      className="rounded-xl border border-border bg-secondary/40 p-3"
                    >
                      <p className="text-sm font-semibold">{s.v}</p>
                      <p className="text-xs text-muted-foreground">{s.k}</p>
                    </div>
                  ))}
                </div>
              </div>
            </SpotlightCard>
          </Reveal>

          <Reveal className="md:col-span-2" delay={0.1}>
            <SpotlightCard className="h-full rounded-3xl border border-border bg-card p-8 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">
                Importação inteligente
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Upload de XML, EFD, JSON e XLSX com validação e extração
                automática de dados fiscais.
              </p>
            </SpotlightCard>
          </Reveal>

          <Reveal className="md:col-span-3" delay={0.1}>
            <SpotlightCard className="h-full rounded-3xl border border-border bg-card p-8 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                <GitCompareArrows className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">
                Comparação de regimes
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Lucro Real, Presumido, Simples e o novo IVA Dual lado a lado,
                com indicação do regime ideal.
              </p>
            </SpotlightCard>
          </Reveal>

          <Reveal className="md:col-span-3" delay={0.15}>
            <SpotlightCard className="h-full rounded-3xl border border-border bg-card p-8 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                <Workflow className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">
                Cenários ilimitados
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Crie projeções, salve cenários e acompanhe a transição ano a ano
                até 2033.
              </p>
            </SpotlightCard>
          </Reveal>

          <Reveal className="md:col-span-6" delay={0.05}>
            <SpotlightCard className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-border bg-card p-8 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary/40 md:flex-row md:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">
                    Segurança de nível enterprise
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Criptografia ponta a ponta, controle de acesso por perfil,
                    auditoria completa e conformidade com a LGPD.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {['LGPD', 'Auditoria', 'SSO', 'Logs'].map((b) => (
                  <span
                    key={b}
                    className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </SpotlightCard>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
