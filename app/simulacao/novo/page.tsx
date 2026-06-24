import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth'
import { AppShell } from '@/components/app/app-shell'
import { SimulationWizard } from '@/components/app/simulation-wizard'

export const metadata: Metadata = {
  title: 'Nova simulação — Reforma NextGen',
}

export default async function NovaSimulacaoPage() {
  const user = await requireUser('/simulacao/novo')

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-2xl">
        <SimulationWizard />
      </div>
    </AppShell>
  )
}
