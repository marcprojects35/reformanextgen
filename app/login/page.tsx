import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { AuthShell } from '@/components/app/auth-shell'
import { LoginForm } from '@/components/app/auth-forms'

export const metadata: Metadata = {
  title: 'Entrar — Reforma NextGen',
}

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')

  return (
    <AuthShell
      title="Entrar na sua conta"
      subtitle="Acesse suas simulações e continue de onde parou."
      footer={
        <div className="flex flex-col items-center gap-2">
          <Link href="/esqueci-senha" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Esqueci minha senha
          </Link>
          <span>
            Ainda não tem conta?{' '}
            <Link href="/cadastro" className="font-medium text-primary hover:underline">
              Criar conta gratuita
            </Link>
          </span>
        </div>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
