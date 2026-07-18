import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

import { DiagnosticWizard } from '@/components/landing/diagnostic-wizard'

export const metadata: Metadata = {
  title: 'Diagnóstico Gratuito da Reforma Tributária — Reforma NextGen',
  description: 'Responda 4 perguntas rápidas e descubra uma estimativa do impacto da reforma tributária na sua empresa.',
}

export default function DiagnosticoPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Reforma NextGen" width={32} height={32} className="h-8 w-8" />
            <span className="text-sm font-semibold tracking-tight">
              Reforma<span className="text-primary">NextGen</span>
            </span>
          </Link>
          <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Voltar ao início
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-16 md:px-6">
        <div className="mb-10 text-center">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            Diagnóstico gratuito
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            Descubra o impacto da reforma na sua empresa
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            4 perguntas rápidas, sem compromisso.
          </p>
        </div>

        <DiagnosticWizard />
      </div>
    </main>
  )
}
