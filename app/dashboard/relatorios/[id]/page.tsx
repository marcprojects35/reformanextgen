import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth'
import { AppShell } from '@/components/app/app-shell'
import { ClientReportWrapper } from '@/components/client-report-wrapper'

export const metadata: Metadata = {
  title: 'Relatório — Reforma NextGen',
}

export default async function ClientReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser('/dashboard')
  const { id } = await params

  return (
    <AppShell user={user}>
      <ClientReportWrapper reportId={Number(id)} />
    </AppShell>
  )
}
