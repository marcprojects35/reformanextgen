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
          <Link
            href="/admin"
            className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/50 transition hover:text-muted-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Acesso Administrativo
          </Link>
        </div>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
