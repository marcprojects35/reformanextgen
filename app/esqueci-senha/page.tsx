import type { Metadata } from 'next'
import Link from 'next/link'

import { AuthShell } from '@/components/app/auth-shell'
import { ForgotPasswordForm } from '@/components/app/forgot-password-form'

export const metadata: Metadata = {
  title: 'Esqueci a senha — Reforma NextGen',
}

export default function EsqueciSenhaPage() {
  return (
    <AuthShell
      title="Recuperar acesso"
      subtitle="Informe seu e-mail e enviaremos as instruções de recuperação."
      footer={
        <>
          Lembrou a senha?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
