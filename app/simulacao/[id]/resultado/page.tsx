import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

import { requireUser } from '@/lib/auth'
import { getResults, getSimulationWithCompany } from '@/lib/db'
import { fromResultRows } from '@/lib/tax-engine/persistence'
import { AppShell } from '@/components/app/app-shell'
import { ResultsDashboard } from '@/components/app/results-dashboard'
import { SimulationStatusPoller } from '@/components/app/simulation-status-poller'
import { SpotlightCard } from '@/components/landing/spotlight-card'
import { Reveal } from '@/components/landing/reveal'

export const metadata: Metadata = {
  title: 'Resultado da simulação — Reforma NextGen',
}

export default async function ResultadoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const simulationId = Number(id)
  const user = await requireUser(`/simulacao/${id}/resultado`)

  const simulation = getSimulationWithCompany(simulationId, user.id)
  if (!simulation) notFound()

  /* ── ainda processando → poller animado com auto-refresh ─────── */
  if (simulation.status === 'processando' || simulation.status === 'rascunho') {
    return (
      <AppShell user={user}>
        <div className="mx-auto max-w-2xl">
          <SimulationStatusPoller simulationId={simulationId} initialStatus={simulation.status} />
        </div>
      </AppShell>
    )
  }

  /* ── erro ──────────────────────────────────────────────────────── */
  if (simulation.status === 'erro') {
    return (
      <AppShell user={user}>
        <div className="mx-auto max-w-2xl">
          <Reveal y={16}>
            <SpotlightCard className="rounded-2xl border border-destructive/30 bg-card/70 p-8 text-center backdrop-blur-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h1 className="mt-5 text-lg font-semibold tracking-tight">
                Houve um erro ao calcular
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                {simulation.error_message ?? 'Ocorreu um erro inesperado. Tente criar uma nova simulação.'}
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/simulacao/novo"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Nova simulação
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-5 text-sm font-medium hover:bg-secondary"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Link>
              </div>
            </SpotlightCard>
          </Reveal>
        </div>
      </AppShell>
    )
  }

  /* ── concluída ─────────────────────────────────────────────────── */
  const output = fromResultRows(getResults(simulationId))
  if (!output) notFound()

  return (
    <AppShell user={user}>
      <ResultsDashboard simulation={simulation} output={output} />
    </AppShell>
  )
}
