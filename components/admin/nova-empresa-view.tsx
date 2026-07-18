'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2 } from 'lucide-react'
import { EmpresaCreateForm } from '@/components/admin/empresa-create-form'

export function NovaEmpresaView() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/admin/empresas')}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground/40 hover:border-foreground/20 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <Building2 className="h-5 w-5 text-primary" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Cadastrar Nova Empresa</h1>
          <p className="text-xs text-foreground/40">Cadastre os dados e a logo da empresa. Você pode importar planilhas e gerar a primeira análise depois, quando quiser.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-foreground/2 p-5">
        <EmpresaCreateForm />
      </div>
    </div>
  )
}
