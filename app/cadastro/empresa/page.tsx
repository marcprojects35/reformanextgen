import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth'
import { listCompaniesByUser } from '@/lib/db'
import { getEmpresaByAppUserId } from '@/lib/db-admin'
import { AppShell } from '@/components/app/app-shell'
import { CompanyOnboardingForm } from '@/components/app/company-onboarding-form'

export const metadata: Metadata = {
  title: 'Cadastre sua empresa — Reforma NextGen',
}

export default async function CadastroEmpresaPage() {
  const user = await requireUser('/cadastro/empresa')

  const jaTemAcesso = listCompaniesByUser(user.id).length > 0 || !!getEmpresaByAppUserId(user.id)
  if (jaTemAcesso) {
    redirect('/dashboard')
  }

  return (
    <AppShell user={user}>
      <CompanyOnboardingForm />
    </AppShell>
  )
}
