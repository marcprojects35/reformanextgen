import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth'
import { listCompaniesByUser } from '@/lib/db'
import { getEmpresaByAppUserId } from '@/lib/db-admin'
import { getSelectedCompany } from '@/lib/active-company'
import { AppShell } from '@/components/app/app-shell'
import { DashboardClient } from '@/components/app/dashboard-client'
import { Reveal } from '@/components/landing/reveal'

export const metadata: Metadata = {
  title: 'Dashboard — Reforma NextGen',
}

export default async function DashboardPage() {
  const user = await requireUser('/dashboard')

  const companies = listCompaniesByUser(user.id)
  const empresa = companies.length === 0 ? getEmpresaByAppUserId(user.id) : null

  if (companies.length === 0 && !empresa) {
    redirect('/cadastro/empresa')
  }

  const selected = await getSelectedCompany(user.id, companies)
  const nomeEmpresa = selected?.razao_social ?? empresa?.nome ?? ''

  return (
    <AppShell user={user}>
      <Reveal y={16}>
        <div>
          <p className="text-sm font-medium text-primary">Bem-vindo de volta</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            {user.name.split(' ')[0]}{' '}
            <span className="text-gradient-gold">&amp; Reforma Tributária</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Análises da consultoria para {nomeEmpresa || 'sua empresa'}.
          </p>
        </div>
      </Reveal>

      <DashboardClient />
    </AppShell>
  )
}
