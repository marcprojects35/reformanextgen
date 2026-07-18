'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Plus, ChevronRight, FileBarChart2, Calendar, MoreVertical, Pencil } from 'lucide-react'
import { chartColor } from '@/lib/admin-colors'
import { EmpresaEditModal, type EmpresaEditData } from '@/components/admin/empresa-edit-modal'

interface EmpresaComStats {
  id: number
  nome: string
  cnpj: string
  regime: string
  nome_fantasia: string
  telefone: string
  responsavel: string
  endereco: string
  ramo: string
  logo: string | null
  created_at: string
  totalRelatorios: number
  ultimoPeriodo: string | null
  origem?: 'admin' | 'cliente'
  app_user_id?: number | null
}

function EmpresaMenu({ onEdit }: { onEdit: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/30 hover:bg-foreground/8 hover:text-foreground"
        title="Opções"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-10 w-36 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); onEdit() }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        </div>
      )}
    </div>
  )
}

type FiltroOrigem = 'todas' | 'cliente' | 'admin'

const FILTROS: { value: FiltroOrigem; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'cliente', label: 'Cadastradas por clientes' },
  { value: 'admin', label: 'Cadastradas manualmente' },
]

export function EmpresasView() {
  const router = useRouter()
  const [empresas, setEmpresas] = useState<EmpresaComStats[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<EmpresaComStats | null>(null)
  const [filtro, setFiltro] = useState<FiltroOrigem>('todas')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/empresas')
      const data = await res.json()
      setEmpresas(data.empresas ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleSaved(updated: EmpresaEditData) {
    setEmpresas(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
  }

  const empresasFiltradas = useMemo(
    () => filtro === 'todas' ? empresas : empresas.filter((e) => (e.origem ?? 'admin') === filtro),
    [empresas, filtro],
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Empresas</h1>
        <p className="mt-1 text-sm text-foreground/50">Cadastre empresas e acompanhe o histórico de análises de cada uma.</p>
      </div>

      {/* Cadastrar Nova Empresa */}
      <button
        onClick={() => router.push('/admin/empresas/nova')}
        className="group flex w-full items-center gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5 text-left transition hover:border-primary/50 hover:bg-primary/8"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Plus className="h-5 w-5 text-primary" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Cadastrar Nova Empresa</p>
          <p className="text-xs text-foreground/40">Informe os dados e a logo da empresa. A primeira análise pode ser feita depois.</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-primary/50 transition group-hover:text-primary" />
      </button>

      {/* Empresas Cadastradas */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">EMPRESAS CADASTRADAS</span>
          <p className="text-xs text-foreground/30">{empresasFiltradas.length} empresa{empresasFiltradas.length !== 1 ? 's' : ''}</p>
          <div className="ml-auto flex items-center gap-1">
            {FILTROS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${
                  filtro === f.value
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'border border-border text-foreground/50 hover:border-foreground/20 hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : empresasFiltradas.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-center">
            <Building2 className="h-7 w-7 text-foreground/20" />
            <p className="text-sm text-foreground/40">
              {empresas.length === 0 ? 'Nenhuma empresa cadastrada ainda.' : 'Nenhuma empresa encontrada com esse filtro.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {empresasFiltradas.map((emp, i) => (
              <div
                key={emp.id}
                onClick={() => router.push(`/admin/empresas/${emp.id}`)}
                className="group cursor-pointer text-left rounded-2xl border border-border bg-popover p-4 transition hover:border-foreground/20 hover:bg-foreground/[0.03]"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {emp.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={emp.logo} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-foreground"
                        style={{ background: `${chartColor(i)}22`, color: chartColor(i) }}
                      >
                        {emp.nome.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{emp.nome}</p>
                      {(emp.nome_fantasia || emp.cnpj) && (
                        <p className="truncate text-[11px] text-foreground/35 font-tabular">{emp.nome_fantasia || emp.cnpj}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <EmpresaMenu onEdit={() => setEditando(emp)} />
                    <ChevronRight className="h-4 w-4 text-foreground/20 transition group-hover:text-foreground/50" />
                  </div>
                </div>
                <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-foreground/40">
                  <span className="flex items-center gap-1.5">
                    <FileBarChart2 className="h-3.5 w-3.5" />
                    {emp.totalRelatorios} relatório{emp.totalRelatorios !== 1 ? 's' : ''}
                  </span>
                  {emp.ultimoPeriodo && (
                    <span className="flex items-center gap-1.5 font-tabular">
                      <Calendar className="h-3.5 w-3.5" />
                      {emp.ultimoPeriodo}
                    </span>
                  )}
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      emp.origem === 'cliente' ? 'bg-primary/10 text-primary' : 'bg-foreground/5 text-foreground/40'
                    }`}
                  >
                    {emp.origem === 'cliente' ? 'Auto-cadastro' : 'Manual'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editando && (
        <EmpresaEditModal
          empresa={editando}
          onClose={() => setEditando(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
