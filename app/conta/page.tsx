import type { Metadata } from 'next'
import { Mail, ShieldCheck } from 'lucide-react'

import { requireUser } from '@/lib/auth'
import { AppShell } from '@/components/app/app-shell'
import { UpdateProfileForm, ChangePasswordForm } from '@/components/app/account-form'
import { Reveal } from '@/components/landing/reveal'
import { WordReveal } from '@/components/landing/word-reveal'
import { SpotlightCard } from '@/components/landing/spotlight-card'

export const metadata: Metadata = {
  title: 'Minha conta — Reforma NextGen',
}

export default async function ContaPage() {
  const user = await requireUser('/conta')

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

        <div className="mt-8 flex flex-col gap-5">
          {/* e-mail readonly */}
          <Reveal delay={0.06} y={14}>
            <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    E-mail
                  </p>
                  <p className="mt-0.5 text-sm font-semibold">{user.email}</p>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                O e-mail não pode ser alterado após o cadastro.
              </p>
            </SpotlightCard>
          </Reveal>

          {/* update profile (name, phone, UF, business area) */}
          <Reveal delay={0.1} y={14}>
            <UpdateProfileForm user={user} />
          </Reveal>

          {/* change password */}
          <Reveal delay={0.14} y={14}>
            <ChangePasswordForm />
          </Reveal>
        </div>
      </div>
    </AppShell>
  )
}
