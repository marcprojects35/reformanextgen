import type { Metadata } from 'next'
import Link from 'next/link'
import { FileSpreadsheet, Plus, BarChart3 } from 'lucide-react'

import { requireUser } from '@/lib/auth'
import { listSimulationsByUser } from '@/lib/db'
import { AppShell } from '@/components/app/app-shell'
import { DashboardClient } from '@/components/app/dashboard-client'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/landing/reveal'
import { SpotlightCard } from '@/components/landing/spotlight-card'
import { AnimatedCounter } from '@/components/landing/animated-counter'

export const metadata: Metadata = {
  title: 'Dashboard — Reforma NextGen',
}

export default async function DashboardPage() {
  const user = await requireUser('/dashboard')
  const simulations = listSimulationsByUser(user.id)

  const concluidas = simulations.filter((s) => s.status === 'concluida').length
  const emAndamento = simulations.filter((s) => s.status === 'processando' || s.status === 'rascunho').length
  const total = simulations.length

  return (
    <AppShell user={user}>
      {/* header */}
      <Reveal y={16}>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-primary">Bem-vindo de volta</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
              {user.name.split(' ')[0]}{' '}
              <span className="text-gradient-gold">&amp; Reforma Tributária</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe suas simulações e descubra o caminho tributário ideal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/analise/nova"
              className="btn-shine glow-gold flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              <BarChart3 className="h-4 w-4" />
              Fazer análise da empresa
            </Link>
            <Button
              nativeButton={false}
              render={
                <Link href="/simulacao/novo">
                  <Plus className="h-4 w-4" />
                  Nova simulação
                </Link>
              }
              className="h-10 gap-2 rounded-xl border border-border bg-secondary/60 px-5 text-sm font-medium text-foreground hover:bg-secondary flex items-center"
            />
          </div>
        </div>
      </Reveal>

      {/* stats bar */}
      {total > 0 && (
        <Reveal delay={0.05} y={12}>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Simulações', value: total },
              { label: 'Concluídas', value: concluidas },
              { label: 'Em andamento', value: emAndamento },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border bg-card/60 px-5 py-4 backdrop-blur-sm"
              >
                <p className="text-2xl font-semibold tracking-tight text-gradient-gold">
                  <AnimatedCounter value={stat.value} decimals={0} />
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      )}

      {/* empty state */}
      {simulations.length === 0 ? (
        <Reveal delay={0.1} className="mt-10">
          <SpotlightCard className="rounded-3xl border border-border bg-card/60 py-16 text-center backdrop-blur-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-accent/60">
              <FileSpreadsheet className="h-7 w-7 text-primary" />
            </div>
            <h2 className="mt-5 text-lg font-semibold tracking-tight">
              Nenhuma simulação ainda
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Cadastre os dados da sua empresa e envie seus arquivos fiscais para
              descobrir o impacto da Reforma Tributária no seu negócio.
            </p>
            <Button
              nativeButton={false}
              render={
                <Link href="/simulacao/novo">
                  Começar agora
                </Link>
              }
              className="btn-shine glow-gold mx-auto mt-7 h-11 gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
            />
          </SpotlightCard>
        </Reveal>
      ) : (
        <DashboardClient simulations={simulations} />
      )}
    </AppShell>
  )
}
