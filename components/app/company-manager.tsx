'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, Plus } from 'lucide-react'

import type { CompanyRow } from '@/lib/db'
import { regimeAtualLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { CompanyEditForm } from '@/components/app/company-edit-form'
import { AddCompanyModal } from '@/components/app/add-company-modal'

function CompanyCard({
  company,
  selected,
  onSelect,
}: {
  company: CompanyRow
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-48 shrink-0 flex-col gap-2 rounded-2xl border p-4 text-left transition-colors',
        selected
          ? 'border-primary bg-accent/50'
          : 'border-border bg-card/60 hover:border-foreground/20',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-accent/60 text-primary">
          {company.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
        </div>
        {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{company.razao_social}</p>
        <p className="truncate text-xs text-muted-foreground">
          {company.cnpj || 'CNPJ não informado'}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{regimeAtualLabels[company.regime_atual]}</p>
      </div>
    </button>
  )
}

export function CompanyManager({
  initialCompanies,
  initialSelectedId,
}: {
  initialCompanies: CompanyRow[]
  initialSelectedId: number | null
}) {
  const router = useRouter()
  const [companies, setCompanies] = useState(initialCompanies)
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [showAddModal, setShowAddModal] = useState(false)

  const selected = companies.find((c) => c.id === selectedId) ?? companies[0] ?? null

  async function selectCompany(companyId: number) {
    if (companyId === selectedId) return
    setSelectedId(companyId)
    try {
      await fetch('/api/companies/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
    } finally {
      router.refresh()
    }
  }

  function handleCreated(company: CompanyRow) {
    setCompanies((prev) => [company, ...prev])
    setSelectedId(company.id)
    setShowAddModal(false)
    router.refresh()
  }

  function handleSaved(updated: CompanyRow) {
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {companies.map((company) => (
          <CompanyCard
            key={company.id}
            company={company}
            selected={company.id === selected?.id}
            onSelect={() => selectCompany(company.id)}
          />
        ))}

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex w-48 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <Plus className="h-5 w-5" />
          Adicionar empresa
        </button>
      </div>

      {selected && <CompanyEditForm company={selected} onSaved={handleSaved} />}

      {showAddModal && (
        <AddCompanyModal onClose={() => setShowAddModal(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
