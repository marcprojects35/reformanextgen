'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Mail, Phone } from 'lucide-react'
import { setorLabels, regimeAtualLabels } from '@/lib/labels'
import type { RegimeAtual, Setor } from '@/lib/db'

interface LeadRow {
  id: number
  nome: string | null
  email: string | null
  telefone: string | null
  setor: Setor
  regime_atual: RegimeAtual
  faturamento_anual: number
  margem_lucro: number | null
  resultado_json: string
  created_at: string
}

export function LeadsView() {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/leads')
      const data = await res.json()
      setLeads(data.leads ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Leads do diagnóstico gratuito</h1>
        <p className="mt-1 text-sm text-foreground/50">Visitantes que responderam o diagnóstico na página inicial.</p>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : leads.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-center">
          <Users className="h-7 w-7 text-foreground/20" />
          <p className="text-sm text-foreground/40">Nenhum lead ainda.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="flex items-center gap-4 border-b border-border bg-foreground/[0.02] px-5 py-2 text-[10px] font-medium uppercase tracking-widest text-foreground/25">
            <span className="flex-1">Contato</span>
            <span className="hidden w-32 md:block">Setor</span>
            <span className="hidden w-32 lg:block">Regime</span>
            <span className="hidden w-32 lg:block">Faturamento</span>
            <span className="w-32 text-right">Recebido em</span>
          </div>
          <div className="divide-y divide-white/5">
            {leads.map((lead) => (
              <div key={lead.id} className="flex items-center gap-4 bg-popover px-5 py-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="truncate font-semibold text-foreground">{lead.nome || 'Sem nome'}</p>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-foreground/40">
                    {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
                    {lead.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.telefone}</span>}
                  </div>
                </div>
                <span className="hidden w-32 shrink-0 text-xs text-foreground/50 md:block">{setorLabels[lead.setor] ?? lead.setor}</span>
                <span className="hidden w-32 shrink-0 text-xs text-foreground/50 lg:block">{regimeAtualLabels[lead.regime_atual] ?? lead.regime_atual}</span>
                <span className="hidden w-32 shrink-0 text-xs text-foreground/50 font-tabular lg:block">
                  {lead.faturamento_anual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                </span>
                <span className="w-32 shrink-0 text-right text-xs text-foreground/25 font-tabular">
                  {new Date(lead.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
