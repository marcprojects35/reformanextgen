'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  ChevronRight, FileDown, ShoppingCart, Wrench, Building2, Plus, Loader2, FolderTree,
} from 'lucide-react'
import type { AdminReportV2 } from '@/lib/admin-engine'

interface EmpresaOption { id: number; nome: string; cnpj: string; regime: string }

const ACCEPTED = '.xlsx,.xls,.csv'
const ACCEPTED_EXTS = ['xlsx', 'xls', 'csv']
// Horizonte da projeção da reforma (mesmo range de lib/admin-engine.ts DRE_ANOS_LIST) — cada
// import representa o "Ano Base" real de um desses anos, usado pra substituir a projeção por
// fórmula por dado real (ver lib/projecao-real.ts).
const ANOS_BASE = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

interface FileZoneProps {
  label: string
  sublabel: string
  icon: React.ReactNode
  accentColor: string
  file: File | null
  onFile: (f: File) => void
  onError: (msg: string) => void
}

function FileZone({ label, sublabel, icon, accentColor, file, onFile, onError }: FileZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ACCEPTED_EXTS.includes(ext)) {
      onError(`Formato inválido em "${label}". Use .xlsx, .xls ou .csv.`)
      return
    }
    onFile(f)
    onError('')
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accentColor}`}>
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        </div>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-8 transition-all ${
          dragging
            ? 'border-primary bg-accent/40'
            : file
            ? 'border-success/50 bg-success/10'
            : 'border-border bg-secondary/20 hover:bg-secondary/40'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {file ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
              <FileSpreadsheet className="h-5 w-5 text-success" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · Clique para trocar</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/60">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/70">Arraste ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground">.xlsx · .xls · .csv</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bloco de ano (produtos/serviços de UM ano base) ───────────────────────────

type BlocoStatus = 'idle' | 'uploading' | 'done' | 'error'

interface AnoBloco {
  id: string
  ano: string // '' | '2026'..'2033'
  fileProdutos: File | null
  fileServicos: File | null
  // Planilha mercadológica (ex.: "LJ 01") — só aparece quando o card "Estrutura Mercadológica"
  // está marcado. Sempre opcional, ano a ano, igual às outras duas.
  fileMercadologica: File | null
  status: BlocoStatus
  error?: string
  debug?: { produtos?: string; servicos?: string }
}

// `crypto.randomUUID()` só existe em contexto seguro do navegador (https:// ou
// localhost) — acessando o app por IP puro em HTTP (ex: servidor na rede local),
// o navegador desativa essa API e quebra o formulário. Aqui não precisa ser
// criptograficamente único, só distinguir os blocos na tela.
function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function makeBloco(ano: string): AnoBloco {
  return { id: makeId(), ano, fileProdutos: null, fileServicos: null, fileMercadologica: null, status: 'idle' }
}

function StatusBadge({ status }: { status: BlocoStatus }) {
  if (status === 'uploading') {
    return (
      <span className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando…
      </span>
    )
  }
  if (status === 'done') {
    return (
      <span className="flex items-center gap-1.5 rounded-lg bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> Importado
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
        <AlertCircle className="h-3.5 w-3.5" /> Erro
      </span>
    )
  }
  return null
}

export interface ImportFormProps {
  /**
   * "existing" (padrão): seletor de empresa cadastrada, comportamento de sempre em
   * `/admin/importar`. "fixed": empresa já conhecida (usado dentro da página da empresa,
   * card "Nova Análise") — esconde o seletor. "new": campo de texto pra nome da empresa —
   * cria a empresa e já importa a primeira análise dela numa tacada só.
   */
  mode?: 'existing' | 'fixed' | 'new'
  empresaId?: number
  empresaNome?: string
  /** Chamado com o id do último relatório salvo antes do redirect padrão — só pra tracking/refresh. */
  onImported?: (savedId: number | null) => void
  /** Destino do redirect após concluir (padrão: `/admin/relatorio?id=X`, aberto no ano de 2033). */
  redirectTo?: (savedId: number | null) => string
}

export function ImportForm({ mode = 'existing', empresaId: fixedEmpresaId, empresaNome: fixedEmpresaNome, onImported, redirectTo }: ImportFormProps) {
  const router = useRouter()

  // Os 8 anos (2026-2033) são obrigatórios de uma vez só — sem isso o dashboard não
  // consegue oferecer o seletor de "ano depois da reforma" com dado real em todo ano.
  const [blocos, setBlocos] = useState<AnoBloco[]>(() => ANOS_BASE.map(ano => makeBloco(String(ano))))
  // Card opcional: só quando marcado é que a Planilha Mercadológica aparece em cada ano —
  // ao desmarcar, os arquivos já selecionados são descartados pra não serem enviados por engano.
  const [usarMercadologica, setUsarMercadologica] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState(false)

  const [empresas, setEmpresas] = useState<EmpresaOption[]>([])
  const [empresaId, setEmpresaId] = useState<string>(mode === 'fixed' && fixedEmpresaId ? String(fixedEmpresaId) : '')
  const [novaEmpresaAberta, setNovaEmpresaAberta] = useState(false)
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('')
  const [criandoEmpresa, setCriandoEmpresa] = useState(false)
  const [nomeEmpresaNova, setNomeEmpresaNova] = useState('') // mode === 'new'

  // Quantos produtos desta empresa já têm classificação mercadológica salva de um import
  // anterior (lib/db-admin.ts produto_categoria_cache) — se > 0, o import reaproveita esse
  // cache automaticamente mesmo sem reenviar a planilha (ver app/api/admin/import/route.ts).
  const [mercCacheCount, setMercCacheCount] = useState<number | null>(null)

  useEffect(() => {
    const idNum = mode === 'fixed' ? fixedEmpresaId : Number(empresaId)
    if (!idNum || !Number.isFinite(idNum)) { setMercCacheCount(null); return }
    let cancelled = false
    fetch(`/api/admin/empresas/${idNum}/mercadologica-status`)
      .then(res => res.json())
      .then(data => { if (!cancelled) setMercCacheCount(typeof data.count === 'number' ? data.count : null) })
      .catch(() => { if (!cancelled) setMercCacheCount(null) })
    return () => { cancelled = true }
  }, [mode, fixedEmpresaId, empresaId])

  const loadEmpresas = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/empresas')
      const data = await res.json()
      setEmpresas(data.empresas ?? [])
    } catch { /* silencioso — usuário ainda pode cadastrar */ }
  }, [])

  useEffect(() => { if (mode === 'existing') loadEmpresas() }, [loadEmpresas, mode])

  async function handleCriarEmpresa() {
    const nome = novaEmpresaNome.trim()
    if (!nome) return
    setCriandoEmpresa(true)
    try {
      const res = await fetch('/api/admin/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome }),
      })
      const data = await res.json()
      if (res.ok && data.id) {
        await loadEmpresas()
        setEmpresaId(String(data.id))
        setNovaEmpresaNome('')
        setNovaEmpresaAberta(false)
      }
    } finally {
      setCriandoEmpresa(false)
    }
  }

  function updateBloco(id: string, patch: Partial<AnoBloco>) {
    setBlocos(bs => bs.map(b => (b.id === id ? { ...b, ...patch } : b)))
  }

  function toggleMercadologica(checked: boolean) {
    setUsarMercadologica(checked)
    if (!checked) {
      setBlocos(bs => bs.map(b => (b.fileMercadologica ? { ...b, fileMercadologica: null } : b)))
    }
  }

  const empresaPronta = mode === 'new' ? !!nomeEmpresaNova.trim() : !!empresaId
  const blocosValidos = blocos.filter(b => b.ano && (b.fileProdutos || b.fileServicos))
  const blocosFaltando = blocos.filter(b => !b.fileProdutos && !b.fileServicos)
  const canSubmit = blocosFaltando.length === 0 && empresaPronta && !loading && !success

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (blocosFaltando.length > 0 || !empresaPronta) {
      if (blocosFaltando.length > 0) {
        setFormError(`Faltam planilhas dos anos: ${blocosFaltando.map(b => b.ano).join(', ')}. Os 8 anos (2026-2033) são obrigatórios de uma vez.`)
      }
      return
    }

    setLoading(true)
    setFormError('')
    setBlocos(bs => bs.map(b => ({ ...b, status: 'idle', error: undefined, debug: undefined })))

    try {
      let resolvedEmpresaId = empresaId

      if (mode === 'new') {
        const resEmp = await fetch('/api/admin/empresas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: nomeEmpresaNova.trim() }),
        })
        const dataEmp = await resEmp.json()
        if (!resEmp.ok || !dataEmp.id) {
          setFormError(dataEmp.error ?? 'Erro ao cadastrar a empresa.')
          setLoading(false)
          return
        }
        resolvedEmpresaId = String(dataEmp.id)
      }

      let lastSavedId: number | null = null
      let lastReport: AdminReportV2 | null = null
      let anyError = false

      // Mês/ano real em que essa análise (os 8 anos de transição) está sendo importada — igual
      // pros 8 blocos, calculado uma única vez antes do loop (não recalcular por bloco, senão o
      // envio atravessando a virada do dia quebraria o agrupamento em "1 análise só").
      const lote = new Date().toISOString().slice(0, 7)

      // Envia um ano de cada vez — node:sqlite é síncrono, então processar tudo em
      // paralelo bloquearia o servidor; sequencial também deixa o status por bloco
      // (idle → uploading → done/error) refletir o progresso real.
      for (const bloco of blocosValidos) {
        updateBloco(bloco.id, { status: 'uploading' })
        try {
          const fd = new FormData()
          if (bloco.fileProdutos) fd.append('fileProdutos', bloco.fileProdutos)
          if (bloco.fileServicos) fd.append('fileServicos', bloco.fileServicos)
          if (bloco.fileMercadologica) fd.append('fileMercadologica', bloco.fileMercadologica)
          fd.append('empresaId', resolvedEmpresaId)
          fd.append('periodo', `${bloco.ano}-01`)
          fd.append('lote', lote)

          const res = await fetch('/api/admin/import', { method: 'POST', body: fd })
          const data = await res.json()

          if (!res.ok) {
            updateBloco(bloco.id, { status: 'error', error: data.error ?? 'Erro ao processar planilhas.', debug: data.debug })
            anyError = true
            continue
          }

          lastSavedId = data.savedId ?? lastSavedId
          lastReport = data.report as AdminReportV2
          updateBloco(bloco.id, { status: 'done' })
        } catch {
          updateBloco(bloco.id, { status: 'error', error: 'Erro de conexão. Tente novamente.' })
          anyError = true
        }
      }

      if (!anyError && lastReport) {
        sessionStorage.setItem('admin_report', JSON.stringify(lastReport))
        sessionStorage.setItem('admin_report_id', lastSavedId ? String(lastSavedId) : '')
        setSuccess(true)
      }
      onImported?.(lastSavedId)

      if (!anyError) {
        // Processamos em ordem crescente de ano (2026→2033), então o último salvo é
        // sempre o de 2033 — abre direto no dashboard já com o seletor de ano disponível.
        const dest = redirectTo
          ? redirectTo(lastSavedId)
          : lastSavedId ? `/admin/relatorio?id=${lastSavedId}` : '/admin/relatorio'
        setTimeout(() => router.push(dest), 800)
      }
    } finally {
      setLoading(false)
    }
  }

  const compact = mode !== 'existing'

  return (
    <div className="space-y-8">
      {/* Header */}
      {!compact && (
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Importar Planilhas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie a planilha de <span className="text-foreground/80">Produtos</span> e/ou{' '}
            <span className="text-foreground/80">Serviços</span> de <span className="text-foreground/80">
            cada um dos 8 anos (2026 a 2033)</span> — os 8 são obrigatórios de uma vez só, pra permitir
            escolher depois qualquer ano como "depois da reforma" no dashboard. Em cada ano, com as duas
            planilhas a análise fica completa; com só uma, cobre apenas aquele domínio.
            Aceita <span className="text-primary/80">.xlsx</span>,{' '}
            <span className="text-primary/80">.xls</span> e{' '}
            <span className="text-primary/80">.csv</span>.
          </p>
        </div>
        <a
          href="/api/admin/template"
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <FileDown className="h-4 w-4" />
          Baixar Template
        </a>
      </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Empresa */}
        <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Empresa</p>
          </div>
          {mode === 'fixed' ? (
            <div className="flex h-10 items-center rounded-lg border border-border bg-secondary/40 px-3 text-sm text-foreground">
              {fixedEmpresaNome}
            </div>
          ) : mode === 'new' ? (
            <input
              autoFocus
              value={nomeEmpresaNova}
              onChange={e => setNomeEmpresaNova(e.target.value)}
              placeholder="Nome da empresa"
              className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
            />
          ) : novaEmpresaAberta ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={novaEmpresaNome}
                onChange={e => setNovaEmpresaNome(e.target.value)}
                placeholder="Nome da nova empresa"
                className="h-10 flex-1 rounded-lg border border-border bg-secondary/40 px-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={handleCriarEmpresa}
                disabled={!novaEmpresaNome.trim() || criandoEmpresa}
                className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {criandoEmpresa ? '...' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={() => setNovaEmpresaAberta(false)}
                className="rounded-lg border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={empresaId}
                onChange={e => setEmpresaId(e.target.value)}
                className="h-10 flex-1 rounded-lg border border-border bg-secondary/40 px-3 text-sm text-foreground outline-none focus:border-primary/50"
              >
                <option value="" className="bg-popover">Selecione a empresa…</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id} className="bg-popover">{emp.nome}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setNovaEmpresaAberta(true)}
                title="Cadastrar nova empresa"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Estrutura Mercadológica — card opcional, some com o card mas não altera a
            obrigatoriedade dos blocos de ano: assim como Produtos/Serviços, essa planilha é
            opcional ano a ano quando habilitada. */}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card/50 p-5 transition hover:border-chart-2/40">
          <input
            type="checkbox"
            checked={usarMercadologica}
            onChange={e => toggleMercadologica(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-primary"
          />
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-chart-2/15">
              <FolderTree className="h-4 w-4 text-chart-2" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Estrutura Mercadológica <span className="font-normal text-muted-foreground">(opcional)</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tenho a planilha com a classificação real de produtos por Seção/Grupo/Subgrupo/Família
                (ex.: "LJ 01"). Marque para habilitar o envio dela em cada ano abaixo — assim como os
                demais anos, é opcional ano a ano.
              </p>
              {mercCacheCount !== null && mercCacheCount > 0 && (
                <p className="mt-2 rounded-lg border border-chart-2/30 bg-chart-2/10 px-3 py-2 text-xs text-chart-2">
                  Já temos a classificação mercadológica de {mercCacheCount} produtos desta empresa,
                  salva de um import anterior. Não precisa reenviar a planilha — ela é reaproveitada
                  automaticamente em todos os anos. Só anexe de novo se quiser corrigir ou atualizar.
                </p>
              )}
            </div>
          </div>
        </label>

        {/* Blocos por ano base — os 8 anos são fixos e obrigatórios */}
        {blocos.map((bloco) => (
          <div key={bloco.id} className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-foreground">Ano Base</p>
                <span className="flex h-9 items-center rounded-lg border border-border bg-secondary/40 px-3 text-sm font-tabular text-foreground">
                  {bloco.ano}
                </span>
              </div>
              <StatusBadge status={bloco.status} />
            </div>

            <div className={`grid gap-6 ${usarMercadologica ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              <FileZone
                label="Planilha de Produtos"
                sublabel="Compras e vendas de produtos · opcional"
                icon={<ShoppingCart className="h-4 w-4 text-chart-1" />}
                accentColor="bg-chart-1/15"
                file={bloco.fileProdutos}
                onFile={f => updateBloco(bloco.id, { fileProdutos: f })}
                onError={setFormError}
              />
              <FileZone
                label="Planilha de Serviços"
                sublabel="Compras e vendas de serviços · opcional"
                icon={<Wrench className="h-4 w-4 text-chart-3" />}
                accentColor="bg-chart-3/15"
                file={bloco.fileServicos}
                onFile={f => updateBloco(bloco.id, { fileServicos: f })}
                onError={setFormError}
              />
              {usarMercadologica && (
                <FileZone
                  label="Estrutura Mercadológica"
                  sublabel="Classificação real por produto (Cod Família) · opcional"
                  icon={<FolderTree className="h-4 w-4 text-chart-2" />}
                  accentColor="bg-chart-2/15"
                  file={bloco.fileMercadologica}
                  onFile={f => updateBloco(bloco.id, { fileMercadologica: f })}
                  onError={setFormError}
                />
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className={`h-1.5 flex-1 rounded-full transition-all ${bloco.fileProdutos ? 'bg-chart-1' : 'bg-secondary'}`} />
              <span className="text-xs text-muted-foreground font-tabular">
                {bloco.fileProdutos && bloco.fileServicos
                  ? 'Prontas para processar — análise completa'
                  : bloco.fileProdutos || bloco.fileServicos
                  ? 'Pronta para processar — análise parcial (só 1 planilha)'
                  : 'Selecione ao menos 1 planilha'}
              </span>
              <div className={`h-1.5 flex-1 rounded-full transition-all ${bloco.fileServicos ? 'bg-chart-3' : 'bg-secondary'}`} />
            </div>

            {bloco.error && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{bloco.ano ? `${bloco.ano}: ` : ''}{bloco.error}</p>
                </div>
                {bloco.debug && (
                  <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Colunas detectadas nos arquivos:</p>
                    {bloco.debug.produtos && (
                      <div>
                        <p className="text-xs text-chart-1 mb-0.5">Produtos:</p>
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">{bloco.debug.produtos}</pre>
                      </div>
                    )}
                    {bloco.debug.servicos && (
                      <div>
                        <p className="text-xs text-chart-3 mb-0.5">Serviços:</p>
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">{bloco.debug.servicos}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {formError && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{formError}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            <p className="text-sm text-success">
              Planilhas dos 8 anos processadas! Redirecionando para o relatório...
            </p>
          </div>
        )}

        {!canSubmit && !loading && !success && blocosFaltando.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Faltam planilhas de: <span className="font-tabular text-foreground/70">{blocosFaltando.map(b => b.ano).join(', ')}</span>
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Processando...
            </>
          ) : (
            <>
              Gerar os 8 Relatórios (2026-2033)
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </div>
  )
}
