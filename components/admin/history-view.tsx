'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Building2, ChevronRight, Trash2, Filter, RefreshCw } from 'lucide-react'
import { CHART_COLORS } from '@/lib/admin-colors'

interface ReportMeta {
  id: number
  empresa: string
  cnpj: string
  regime: string
  periodo: string
  created_at: string
}

const PERIOD_FILTERS = [
  { label: '1 mês', months: 1 },
  { label: '3 meses', months: 3 },
  { label: '6 meses', months: 6 },
  { label: '1 ano', months: 12 },
]

function monthsAgoISO(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 7)
}

export function HistoryView() {
  const router = useRouter()
  const [reports, setReports] = useState<ReportMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [searchEmpresa, setSearchEmpresa] = useState('')
  const [periodMonths, setPeriodMonths] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchEmpresa) params.set('empresa', searchEmpresa)
      if (periodMonths) params.set('inicio', monthsAgoISO(periodMonths))
      const res = await fetch(`/api/admin/reports?${params}`)
      const data = await res.json()
      setReports(data.reports ?? [])
    } catch {
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [searchEmpresa, periodMonths])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: number) {
    if (!confirm('Excluir este relatório? Esta ação não pode ser desfeita.')) return
    setDeleting(id)
    await fetch(`/api/admin/reports?id=${id}`, { method: 'DELETE' })
    setReports(prev => prev.filter(r => r.id !== id))
    setDeleting(null)
  }

  function viewReport(id: number) {
    router.push(`/admin/relatorio?id=${id}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Histórico de Relatórios</h1>
        <p className="mt-1 text-sm text-foreground/50">
          Acompanhe o impacto da reforma por empresa e período.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" />
          <input
            type="text"
            value={searchEmpresa}
            onChange={e => setSearchEmpresa(e.target.value)}
            placeholder="Filtrar por empresa..."
            className="w-full rounded-xl border border-border bg-foreground/4 py-2 pl-9 pr-4 text-sm text-foreground placeholder-white/30 outline-none transition focus:border-primary/50"
          />
        </div>

        <div className="flex items-center gap-1.5 font-tabular">
          <button
            onClick={() => setPeriodMonths(null)}
            className={`rounded-lg px-3 py-2 text-xs transition ${periodMonths === null ? 'bg-primary text-primary-foreground font-semibold' : 'border border-border text-foreground/50 hover:border-foreground/20 hover:text-foreground'}`}
          >
            Tudo
          </button>
          {PERIOD_FILTERS.map(({ label, months }) => (
            <button
              key={months}
              onClick={() => setPeriodMonths(months)}
              className={`rounded-lg px-3 py-2 text-xs transition ${periodMonths === months ? 'bg-primary text-primary-foreground font-semibold' : 'border border-border text-foreground/50 hover:border-foreground/20 hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs text-foreground/50 transition hover:border-foreground/20 hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-center">
          <Calendar className="h-8 w-8 text-foreground/20" />
          <p className="text-sm text-foreground/40">Nenhum relatório encontrado.</p>
          <button
            onClick={() => router.push('/admin/importar')}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Importar planilha
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="flex items-center gap-4 border-b border-border bg-foreground/[0.02] px-5 py-2 text-[10px] font-medium uppercase tracking-widest text-foreground/25">
            <span className="w-6" />
            <span className="flex-1">Empresa</span>
            <span className="hidden sm:block w-32">Regime</span>
            <span className="hidden md:block w-28">Período</span>
            <span className="hidden lg:block w-40">Gerado em</span>
            <span className="w-[132px] text-right">{reports.length} relatório{reports.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-white/5">
            {reports.map((r, i) => {
              const accent = CHART_COLORS[i % CHART_COLORS.length]
              return (
                <div
                  key={r.id}
                  className="group flex items-center gap-4 bg-popover px-5 py-3 transition hover:bg-foreground/[0.03]"
                >
                  <span
                    className="h-6 w-1 shrink-0 rounded-full"
                    style={{ background: accent }}
                  />

                  <div className="flex-1 min-w-0 flex items-center gap-2.5">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-foreground/25" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{r.empresa}</p>
                      {r.cnpj && <p className="truncate text-[11px] text-foreground/35 font-tabular">{r.cnpj}</p>}
                    </div>
                  </div>

                  <span className="hidden sm:block w-32 shrink-0 text-xs text-foreground/50 truncate">{r.regime || '—'}</span>

                  <span className="hidden md:flex w-28 shrink-0 items-center gap-1 text-xs text-foreground/50 font-tabular">
                    <Calendar className="h-3 w-3 text-foreground/25" />
                    {r.periodo}
                  </span>

                  <span className="hidden lg:block w-40 shrink-0 text-xs text-foreground/25 font-tabular">
                    {new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div className="flex w-[132px] shrink-0 items-center justify-end gap-2">
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deleting === r.id}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground/30 opacity-0 transition hover:border-loss/40 hover:text-loss group-hover:opacity-100 disabled:opacity-50"
                      title="Excluir relatório"
                    >
                      {deleting === r.id
                        ? <span className="h-3.5 w-3.5 animate-spin rounded-full border border-border border-t-transparent" />
                        : <Trash2 className="h-3.5 w-3.5" />
                      }
                    </button>
                    <button
                      onClick={() => viewReport(r.id)}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground/50 transition hover:border-primary/30 hover:text-primary"
                    >
                      Ver
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
