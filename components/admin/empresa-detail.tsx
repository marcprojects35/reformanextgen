'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Calendar, ArrowLeft, FileBarChart2, ChevronRight,
  History, BarChart3, PlusCircle, ChevronRight as ChevronR, UserPlus, UserCheck, ClipboardEdit, Pencil,
  FileText, Save,
} from 'lucide-react'
import { agruparPorPeriodo, type Granularidade, type ResumoPeriodo } from '@/lib/admin-engine'
import { R$, pct } from '@/lib/admin-format'
import { GAIN, LOSS, CHART_COLORS } from '@/lib/admin-colors'
import { setorLabels, regimeAtualLabels } from '@/lib/labels'
import { DASHBOARD_TEXTO_FIELDS } from '@/lib/dashboard-textos'
import { EmpresaComparisonChart } from '@/components/admin/empresa-comparison-chart'
import { DrillDownProvider } from '@/components/admin/drill-down'
import { ImportForm } from '@/components/admin/import-form'
import { CreateClientLoginModal } from '@/components/admin/create-client-login-modal'
import { EmpresaEditModal } from '@/components/admin/empresa-edit-modal'

interface EmpresaInfo {
  id: number; nome: string; cnpj: string; regime: string; nome_fantasia: string
  telefone: string; responsavel: string; endereco: string; ramo: string
  logo: string | null; created_at: string; origem?: 'admin' | 'cliente'
}
interface ClienteVinculado { id: number; name: string; email: string }
interface ResumoItem { id: number; periodo: string; createdAt: string; resumo: ResumoPeriodo }
interface AnaliseItem {
  lote: string
  reportIdPorAno: Record<number, number>
  createdAt: string
  resultadoAR: number | null
  resultadoDR: number | null
}
interface EdicaoChange { field: string; label: string; before: unknown; after: unknown }
interface EdicaoItem { id: number; user_name: string; motivo: string; changes_json: string; created_at: string }

type View = 'menu' | 'relatorios' | 'comparativos' | 'nova' | 'edicoes' | 'textos'

function traduzValor(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'setor' && typeof value === 'string' && value in setorLabels) return setorLabels[value as keyof typeof setorLabels]
  if (field === 'regimeAtual' && typeof value === 'string' && value in regimeAtualLabels) return regimeAtualLabels[value as keyof typeof regimeAtualLabels]
  if (field === 'faturamentoAnual' && typeof value === 'number') return R$(value, 0)
  if (field === 'margemLucro' && typeof value === 'number') return `${value}%`
  return String(value)
}

const GRANULARIDADES: { value: Granularidade; label: string }[] = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
]

/** "2026-07" → "julho de 2026" — `lote` é o mês/ano real em que a análise foi importada. */
function formatLote(lote: string): string {
  const [ano, mes] = lote.split('-').map(Number)
  if (!ano || !mes) return lote
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

/** Ano-base (2026) primeiro, se disponível — senão o ano mais antigo importado nessa análise. */
function reportIdParaAbrir(reportIdPorAno: Record<number, number>): number | null {
  if (reportIdPorAno[2026] !== undefined) return reportIdPorAno[2026]
  const anos = Object.keys(reportIdPorAno).map(Number).sort((a, b) => a - b)
  return anos.length ? reportIdPorAno[anos[0]] : null
}

function DeltaTag({ value, invert = false }: { value: number; invert?: boolean }) {
  const good = invert ? value <= 0 : value >= 0
  return (
    <span className="text-xs font-semibold font-tabular" style={{ color: good ? GAIN : LOSS }}>
      {good ? '▼' : '▲'} {pct(Math.abs(value))}
    </span>
  )
}

export function EmpresaDetail({ empresaId }: { empresaId: number }) {
  const router = useRouter()
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null)
  const [clienteVinculado, setClienteVinculado] = useState<ClienteVinculado | null>(null)
  const [resumos, setResumos] = useState<ResumoItem[]>([])
  const [analises, setAnalises] = useState<AnaliseItem[]>([])
  const [historicoEdicoes, setHistoricoEdicoes] = useState<EdicaoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('menu')
  const [granularidade, setGranularidade] = useState<Granularidade>('mensal')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [showClientModal, setShowClientModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/empresas/${empresaId}`)
      const data = await res.json()
      setEmpresa(data.empresa ?? null)
      setClienteVinculado(data.clienteVinculado ?? null)
      setResumos(data.resumos ?? [])
      setAnalises(data.analises ?? [])
      setHistoricoEdicoes(data.historicoEdicoes ?? [])
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => { load() }, [load])

  const agrupados = useMemo(
    () => agruparPorPeriodo(resumos.map(r => ({ periodo: r.periodo, resumo: r.resumo })), granularidade),
    [resumos, granularidade],
  )

  // Ao trocar granularidade, mantém apenas seleções que ainda existem no novo agrupamento
  useEffect(() => {
    setSelecionados(prev => {
      const validas = new Set(agrupados.map(a => a.chave))
      return new Set([...prev].filter(c => validas.has(c)))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularidade])

  function toggleSelecao(chave: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(chave)) next.delete(chave)
      else next.add(chave)
      return next
    })
  }

  const selecionadosArr = agrupados.filter(a => selecionados.has(a.chave))

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!empresa) {
    return <p className="text-sm text-foreground/40">Empresa não encontrada.</p>
  }

  return (
    <DrillDownProvider>
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => view === 'menu' ? router.push('/admin/empresas') : setView('menu')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground/40 hover:border-foreground/20 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {empresa.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.logo} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </span>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{empresa.nome}</h1>
            <p className="text-xs text-foreground/40 font-tabular">
              {empresa.cnpj || 'CNPJ não informado'}{empresa.regime ? ` · ${empresa.regime}` : ''}
            </p>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/70 transition hover:border-primary/40 hover:text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        </div>

        {view === 'menu' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-foreground/[0.02] px-5 py-3.5">
            {clienteVinculado ? (
              <div className="flex items-center gap-2 text-sm">
                <UserCheck className="h-4 w-4 text-primary" />
                <span className="text-foreground/70">Cliente com acesso:</span>
                <span className="font-semibold text-foreground">{clienteVinculado.name}</span>
                <span className="text-foreground/30">·</span>
                <span className="text-foreground/50">{clienteVinculado.email}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-foreground/40">
                <UserPlus className="h-4 w-4" />
                Sem login de cliente vinculado — ele não vê nada desta empresa ainda.
              </div>
            )}
            {!clienteVinculado && (
              <button
                onClick={() => setShowClientModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/70 transition hover:border-primary/40 hover:text-primary"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Criar acesso do cliente
              </button>
            )}
          </div>
        )}

        {showClientModal && empresa && (
          <CreateClientLoginModal
            empresaId={empresa.id}
            empresaNome={empresa.nome}
            onClose={() => setShowClientModal(false)}
            onLinked={(user) => setClienteVinculado(user)}
          />
        )}

        {showEditModal && empresa && (
          <EmpresaEditModal
            empresa={empresa}
            onClose={() => setShowEditModal(false)}
            onSaved={(updated) => { setEmpresa((prev) => prev ? { ...prev, ...updated } : prev); setShowEditModal(false) }}
          />
        )}

        {view === 'menu' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MenuCard
              icon={<History className="h-5 w-5" />}
              title="Relatórios Anteriores"
              desc={`${analises.length} análise${analises.length !== 1 ? 's' : ''} importada${analises.length !== 1 ? 's' : ''}`}
              onClick={() => setView('relatorios')}
            />
            <MenuCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Comparativos"
              desc="Compare períodos mensais, trimestrais, semestrais ou anuais"
              onClick={() => setView('comparativos')}
            />
            <MenuCard
              icon={<ClipboardEdit className="h-5 w-5" />}
              title="Alterações Cadastrais"
              desc={`${historicoEdicoes.length} alteraç${historicoEdicoes.length !== 1 ? 'ões' : 'ão'} feita${historicoEdicoes.length !== 1 ? 's' : ''} pelo cliente`}
              onClick={() => setView('edicoes')}
            />
            <MenuCard
              icon={<PlusCircle className="h-5 w-5" />}
              title="Nova Análise desta Empresa"
              desc="Informe o período e importe as planilhas"
              onClick={() => setView('nova')}
              accent
            />
            <MenuCard
              icon={<FileText className="h-5 w-5" />}
              title="Textos do Dashboard"
              desc="Personalize títulos e descrições do relatório desta empresa"
              onClick={() => setView('textos')}
            />
          </div>
        )}

        {view === 'relatorios' && (
          analises.length === 0 ? (
            <EmptyState onNova={() => setView('nova')} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="flex items-center gap-4 border-b border-border bg-foreground/[0.02] px-5 py-2 text-[10px] font-medium uppercase tracking-widest text-foreground/25">
                <span className="w-6" />
                <span className="flex-1">Análise</span>
                <span className="hidden md:block w-32">Resultado AR → DR</span>
                <span className="hidden lg:block w-40">Gerado em</span>
                <span className="w-[80px] text-right">Ação</span>
              </div>
              <div className="divide-y divide-white/5">
                {analises.map((a, i) => {
                  const idParaAbrir = reportIdParaAbrir(a.reportIdPorAno)
                  return (
                  <div key={a.lote} className="group flex items-center gap-4 bg-popover px-5 py-3 transition hover:bg-foreground/[0.03]">
                    <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="flex-1 flex items-center gap-2 text-sm font-semibold text-foreground font-tabular capitalize">
                      <Calendar className="h-3.5 w-3.5 text-foreground/25" />
                      {formatLote(a.lote)}
                    </span>
                    <span className="hidden md:block w-32 shrink-0 text-xs text-foreground/50 font-tabular">
                      {a.resultadoAR !== null ? R$(a.resultadoAR, 0) : '—'} → {a.resultadoDR !== null ? R$(a.resultadoDR, 0) : '—'}
                    </span>
                    <span className="hidden lg:block w-40 shrink-0 text-xs text-foreground/25 font-tabular">
                      {new Date(a.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="flex w-[80px] shrink-0 justify-end">
                      <button
                        onClick={() => idParaAbrir && router.push(`/admin/relatorio?id=${idParaAbrir}`)}
                        disabled={!idParaAbrir}
                        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground/50 transition hover:border-primary/30 hover:text-primary disabled:opacity-40"
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
          )
        )}

        {view === 'comparativos' && (
          resumos.length === 0 ? (
            <EmptyState onNova={() => setView('nova')} />
          ) : (
            <>
              {/* Granularidade */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-foreground/40">Visão:</span>
                <div className="flex items-center gap-1">
                  {GRANULARIDADES.map(g => (
                    <button
                      key={g.value}
                      onClick={() => setGranularidade(g.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs transition ${
                        granularidade === g.value
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'border border-border text-foreground/50 hover:border-foreground/20 hover:text-foreground'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-foreground/25">· clique em um período para selecionar para o comparativo (2+)</span>
              </div>

              {/* Timeline de períodos */}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {agrupados.map((a, i) => {
                  const ativo = selecionados.has(a.chave)
                  return (
                    <button
                      key={a.chave}
                      onClick={() => toggleSelecao(a.chave)}
                      className={`text-left rounded-xl border p-3 transition ${
                        ativo ? 'border-primary/50 bg-primary/5' : 'border-border bg-foreground/[0.02] hover:border-foreground/15'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground font-tabular">
                          <Calendar className="h-3 w-3 text-foreground/30" />
                          {a.label}
                        </span>
                        <DeltaTag
                          value={
                            a.resumo.resultadoAR !== 0
                              ? ((a.resumo.resultadoDR - a.resumo.resultadoAR) / Math.abs(a.resumo.resultadoAR)) * 100
                              : 0
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <p className="text-foreground/30">Custo</p>
                          <p className="text-foreground/70 font-tabular">{R$(a.resumo.custoDR, 0)}</p>
                        </div>
                        <div>
                          <p className="text-foreground/30">Receita</p>
                          <p className="text-foreground/70 font-tabular">{R$(a.resumo.receitaDR, 0)}</p>
                        </div>
                      </div>
                      {i === 0 && agrupados.length === 1 && (
                        <p className="mt-2 text-[10px] text-foreground/20">{a.qtdRelatorios} relatório{a.qtdRelatorios !== 1 ? 's' : ''}</p>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Gráfico comparativo */}
              <EmpresaComparisonChart periodos={selecionadosArr} />
            </>
          )
        )}

        {view === 'edicoes' && (
          historicoEdicoes.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-center">
              <ClipboardEdit className="h-7 w-7 text-foreground/20" />
              <p className="text-sm text-foreground/40">O cliente ainda não fez nenhuma alteração cadastral.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historicoEdicoes.map((ed) => {
                const changes = JSON.parse(ed.changes_json) as EdicaoChange[]
                return (
                  <div key={ed.id} className="rounded-2xl border border-border bg-popover p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{ed.user_name}</span>
                      <span className="text-xs text-foreground/25 font-tabular">
                        {new Date(ed.created_at.replace(' ', 'T') + 'Z').toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-foreground/70">
                      <span className="text-foreground/40">Motivo: </span>{ed.motivo}
                    </p>
                    <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                      {changes.map((c) => (
                        <div key={c.field} className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-medium text-foreground/60">{c.label}:</span>
                          <span className="text-foreground/40 line-through">{traduzValor(c.field, c.before)}</span>
                          <ChevronRight className="h-3 w-3 text-foreground/20" />
                          <span className="font-medium text-foreground">{traduzValor(c.field, c.after)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {view === 'nova' && (
          <div className="rounded-2xl border border-border bg-foreground/2 p-5">
            <ImportForm
              mode="fixed"
              empresaId={empresa.id}
              empresaNome={empresa.nome}
              onImported={() => load()}
            />
          </div>
        )}

        {view === 'textos' && <DashboardTextosView empresaId={empresa.id} />}
      </div>
    </DrillDownProvider>
  )
}

function DashboardTextosView({ empresaId }: { empresaId: number }) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/empresas/${empresaId}/textos`)
      .then(r => r.json())
      .then(data => setValores(data.textos ?? {}))
      .finally(() => setLoading(false))
  }, [empresaId])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/empresas/${empresaId}/textos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valores),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-foreground/2 p-5">
      <div>
        <p className="text-sm font-semibold text-foreground">Textos do Dashboard</p>
        <p className="mt-1 text-xs text-foreground/40">
          Sobrescreve os textos padrão do relatório só para esta empresa. Deixe em branco pra
          voltar a usar o texto padrão.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {DASHBOARD_TEXTO_FIELDS.map(field => (
          <div key={field.chave} className={field.multiline ? 'sm:col-span-2' : ''}>
            <label className="mb-1.5 block text-xs font-medium text-foreground/60">{field.label}</label>
            {field.multiline ? (
              <textarea
                value={valores[field.chave] ?? ''}
                onChange={e => setValores(v => ({ ...v, [field.chave]: e.target.value }))}
                placeholder={field.padrao}
                rows={2}
                className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
              />
            ) : (
              <input
                value={valores[field.chave] ?? ''}
                onChange={e => setValores(v => ({ ...v, [field.chave]: e.target.value }))}
                placeholder={field.padrao}
                className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Salvando...' : 'Salvar textos'}
        </button>
        {saved && <span className="text-xs text-success">Salvo ✓</span>}
      </div>
    </div>
  )
}

function MenuCard({ icon, title, desc, onClick, accent }: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void; accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition ${
        accent
          ? 'border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/8'
          : 'border-border bg-popover hover:border-foreground/20 hover:bg-foreground/[0.03]'
      }`}
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent ? 'bg-primary/15 text-primary' : 'bg-foreground/5 text-foreground/70'}`}>
        {icon}
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-foreground/40">{desc}</p>
      </div>
      <span className={`flex items-center gap-1 text-xs font-semibold ${accent ? 'text-primary' : 'text-foreground/40'} transition group-hover:gap-1.5`}>
        Abrir
        <ChevronR className="h-3.5 w-3.5" />
      </span>
    </button>
  )
}

function EmptyState({ onNova }: { onNova: () => void }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-center">
      <FileBarChart2 className="h-7 w-7 text-foreground/20" />
      <p className="text-sm text-foreground/40">Nenhum relatório importado ainda para esta empresa.</p>
      <button
        onClick={onNova}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Fazer primeira análise
      </button>
    </div>
  )
}
