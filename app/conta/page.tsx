import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth'
import { listCompaniesByUser } from '@/lib/db'
import { getSelectedCompany } from '@/lib/active-company'
import { regimeAtualLabels } from '@/lib/labels'
import { AppShell } from '@/components/app/app-shell'
import { AccountHeader } from '@/components/app/account-header'
import { AccountTabs } from '@/components/app/account-tabs'
import { UpdateProfileForm, ChangePasswordForm } from '@/components/app/account-form'
import { CompanyManager } from '@/components/app/company-manager'
import { Reveal } from '@/components/landing/reveal'
import { WordReveal } from '@/components/landing/word-reveal'

export const metadata: Metadata = {
  title: 'Minha conta — Reforma NextGen',
}

export default async function ContaPage() {
  const user = await requireUser('/conta')
  const companies = listCompaniesByUser(user.id)
  const company = await getSelectedCompany(user.id, companies)

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-2xl">
        {/* header */}
        <Reveal y={16}>
          <p className="text-sm font-medium text-primary">Configurações</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Minha conta</h1>
        </Reveal>

        <Reveal delay={0.04} y={12} className="mt-4">
          <WordReveal
            text="Gerencie suas informações pessoais e mantenha sua conta protegida."
            className="text-sm text-muted-foreground"
          />
        </Reveal>

        <Reveal delay={0.08} y={14} className="mt-8">
          <AccountHeader
            name={user.name}
            email={user.email}
            logo={company?.logo}
            companyName={company?.razao_social}
            regime={company ? regimeAtualLabels[company.regime_atual] : undefined}
          />
        </Reveal>

        <Reveal delay={0.12} y={14} className="mt-6">
          <AccountTabs
            perfil={<UpdateProfileForm user={user} />}
            empresa={<CompanyManager initialCompanies={companies} initialSelectedId={company?.id ?? null} />}
            seguranca={<ChangePasswordForm />}
          />
        </Reveal>
      </div>
    </AppShell>
  )
}
