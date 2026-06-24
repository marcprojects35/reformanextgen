import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { AppShell } from '@/components/app/app-shell'
import { AnaliseWizard } from '@/components/app/analise-wizard'

export const metadata: Metadata = {
  title: 'Análise da empresa — Reforma NextGen',
}

export default async function AnaliseNovaPage() {
  const user = await requireUser('/analise/nova')

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-5xl">
        <AnaliseWizard />
      </div>
    </AppShell>
  )
}
