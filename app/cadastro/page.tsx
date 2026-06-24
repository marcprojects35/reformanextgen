import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { AuthShell } from '@/components/app/auth-shell'
import { SignupForm } from '@/components/app/auth-forms'

export const metadata: Metadata = {
  title: 'Criar conta — Reforma NextGen',
}

export default async function CadastroPage() {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')

  return (
    <AuthShell
      wide
      title="Crie sua conta gratuita"
      subtitle="Acesse gratuitamente as calculadoras, ferramentas e a IA da Reforma Tributária"
      footer={
        <>
          Já tem uma conta?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  )
}
