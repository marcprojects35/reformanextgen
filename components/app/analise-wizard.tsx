'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowRight, Plus, Trash2, Loader2, ShieldCheck, Building2,
  X, BarChart3, TrendingDown, TrendingUp, Upload, FileSpreadsheet,
  Sparkles, BookOpen, Save, CheckCircle2, ArrowLeft, Star,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react'
import { SpotlightCard } from '@/components/landing/spotlight-card'
import { Reveal } from '@/components/landing/reveal'
import { AnimatedCounter } from '@/components/landing/animated-counter'
import { WordReveal } from '@/components/landing/word-reveal'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
// Full A2033 rates (bruto — taxa sobre valor_dr)
const REFORMA_FULL = {
  servicos: { ibs: 0.1461, cbs: 0.0727, total: 0.2188 },
  produtos:  { ibs: 0.1750, cbs: 0.0800, total: 0.2550 },
}

// Transition schedule: fraction of full reform rate applied each year
const TRANSITION = [
  { ano: 2026, pct: 0.01 },
  { ano: 2027, pct: 0.03 },
  { ano: 2028, pct: 0.10 },
  { ano: 2029, pct: 0.25 },
  { ano: 2030, pct: 0.40 },
  { ano: 2031, pct: 0.55 },
  { ano: 2032, pct: 0.75 },
  { ano: 2033, pct: 1.00 },
]

// Default PIS/COFINS alíquotas by regime
const REGIME_DEFAULTS: Record<string, { pisCofins: string; iss: string; icms: string }> = {
  'Lucro Real':      { pisCofins: '9.25', iss: '5.00', icms: '0' },
  'Lucro Presumido': { pisCofins: '3.65', iss: '5.00', icms: '0' },
  'Simples Nacional':{ pisCofins: '0',    iss: '0',    icms: '0' },
  'MEI':             { pisCofins: '0',    iss: '0',    icms: '0' },
}

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
type WizardStep = 'empresa' | 'dados' | 'calculando' | 'resultado'
type DataTab = 'importar' | 'servicos_prestados' | 'servicos_tomados' | 'produtos_vendidos' | 'produtos_adquiridos'

interface CompanyForm {
  razaoSocial: string
  cnpj: string
  regime: string
  setor: string
  uf: string
}

interface ServiceRow {
  id: string
  descricao: string
  faturamento: string
  aliqIss: string
  aliqPisCofins: string
  aliqIcms: string
  valIss: number
  valPisCofins: number
  valIcms: number
}

interface ProductRow {
  id: string
  descricao: string
  ncm: string
  valor: string
  aliqIcms: string
  aliqPisCofins: string
  aliqIpi: string
  valIcms: number
  valPisCofins: number
  valIpi: number
}

interface SavedCompany {
  id: string
  razaoSocial: string
  cnpj: string
  date: string
  economia: number
  anoBase: number
  regime: string
}

interface ReformaResult {
  valorDr: number
  impostosDr: number
  ibs: number
  cbs: number
  transitionPct: number
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2)
const pf  = (v: string) => parseFloat(v.replace(',', '.')) || 0
const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`

function emptyService(regime = 'Lucro Real'): ServiceRow {
  const d = REGIME_DEFAULTS[regime] ?? REGIME_DEFAULTS['Lucro Real']
  return { id: uid(), descricao: '', faturamento: '', aliqIss: d.iss, aliqPisCofins: d.pisCofins, aliqIcms: d.icms, valIss: 0, valPisCofins: 0, valIcms: 0 }
}
function emptyProduct(regime = 'Lucro Real'): ProductRow {
  const d = REGIME_DEFAULTS[regime] ?? REGIME_DEFAULTS['Lucro Real']
  return { id: uid(), descricao: '', ncm: '', valor: '', aliqIcms: '', aliqPisCofins: d.pisCofins, aliqIpi: '0', valIcms: 0, valPisCofins: 0, valIpi: 0 }
}

function computeService(row: ServiceRow): ServiceRow {
  const fat = pf(row.faturamento)
  return { ...row, valIss: fat * (pf(row.aliqIss) / 100), valPisCofins: fat * (pf(row.aliqPisCofins) / 100), valIcms: fat * (pf(row.aliqIcms) / 100) }
}
function computeProduct(row: ProductRow): ProductRow {
  const val = pf(row.valor)
  return { ...row, valIcms: val * (pf(row.aliqIcms) / 100), valPisCofins: val * (pf(row.aliqPisCofins) / 100), valIpi: val * (pf(row.aliqIpi) / 100) }
}

/** Core reform calculation — incorporates transition year and old-taxes residual */
function calcReforma(
  valorBruto: number,
  impostoAtual: number,
  rate: { ibs: number; cbs: number; total: number },
  anoBase: number,
): ReformaResult {
  const t = TRANSITION.find(a => a.ano === anoBase)?.pct ?? 1.0
  const desonerado = Math.max(0, valorBruto - impostoAtual)

  // Full-reform (2033) taxes
  const valorDr2033 = desonerado > 0 ? desonerado / (1 - rate.total) : 0
  const impDr2033 = valorDr2033 - desonerado

  // In transition year: weighted blend of old and new taxes
  const impDrAno = impostoAtual * (1 - t) + impDr2033 * t
  const valorDrAno = desonerado + impDrAno

  return {
    valorDr: valorDrAno,
    impostosDr: impDrAno,
    ibs: valorDrAno * rate.ibs * t,
    cbs: valorDrAno * rate.cbs * t,
    transitionPct: t,
  }
}

/* ─────────────────────────────────────────────
   FILE IMPORT PARSER
───────────────────────────────────────────── */
interface ParsedImport {
  servicosPrestados: ServiceRow[]
  servicosTomados:   ServiceRow[]
  produtosVendidos:  ProductRow[]
  produtosAdquiridos: ProductRow[]
  errors: string[]
}

async function parseUploadedFile(file: File): Promise<ParsedImport> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const result: ParsedImport = {
    servicosPrestados: [], servicosTomados: [], produtosVendidos: [], produtosAdquiridos: [], errors: [],
  }

  const ext = file.name.split('.').pop()?.toLowerCase()

  // ── XLSX / XLS ──
  if (ext === 'xlsx' || ext === 'xls') {
    try {
      const wb = XLSX.read(buffer, { type: 'array' })

      const sheetMap: Record<string, keyof Pick<ParsedImport, 'servicosPrestados' | 'servicosTomados' | 'produtosVendidos' | 'produtosAdquiridos'>> = {
        'Serviços Prestados': 'servicosPrestados',
        'Serviços Tomados':   'servicosTomados',
        'Produtos Vendidos':  'produtosVendidos',
        'Produtos Adquiridos':'produtosAdquiridos',
      }

      for (const [sheetName, key] of Object.entries(sheetMap)) {
        const ws = wb.Sheets[sheetName]
        if (!ws) continue
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (key === 'servicosPrestados' || key === 'servicosTomados') {
          result[key] = rows.filter(r => r['faturamentoMensal'] || r['faturamento']).map(r => {
            const fat = String(r['faturamentoMensal'] || r['faturamento'] || '')
            const row: ServiceRow = {
              id: uid(),
              descricao: String(r['descricaoItem'] || r['cnaePrincipal'] || ''),
              faturamento: fat,
              aliqIss: String(r['aliquota.iss'] || '0'),
              aliqPisCofins: String(r['aliquota.pisCo'] || '0'),
              aliqIcms: String(r['aliquota.icms'] || '0'),
              valIss: 0, valPisCofins: 0, valIcms: 0,
            }
            return computeService(row)
          })
        } else {
          result[key] = rows.filter(r => r['valorOperação'] || r['valorOperacao']).map(r => {
            const val = String(r['valorOperação'] || r['valorOperacao'] || '')
            const row: ProductRow = {
              id: uid(),
              descricao: String(r['descricaoItem'] || r['codItem'] || ''),
              ncm: String(r['ncm'] || ''),
              valor: val,
              aliqIcms: String(r['aliqIcms'] || r['aliquota.icms'] || '0'),
              aliqPisCofins: String(r['aliquota.pisCo'] || '0'),
              aliqIpi: String(r['aliquota.ipi'] || '0'),
              valIcms: 0, valPisCofins: 0, valIpi: 0,
            }
            return computeProduct(row)
          })
        }
      }
    } catch (e) {
      result.errors.push('Erro ao ler XLSX: ' + String(e))
    }
    return result
  }

  // ── CSV (formato de resultado do motor) ──
  if (ext === 'csv') {
    try {
      const text = new TextDecoder('utf-8').decode(buffer)
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { result.errors.push('CSV vazio'); return result }

      const headers = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, ''))
      const get = (row: string[], key: string) => {
        const i = headers.indexOf(key)
        return i >= 0 ? row[i]?.trim().replace(/^"|"$/g, '') ?? '' : ''
      }

      for (const line of lines.slice(1)) {
        if (!line.trim()) continue
        const cols = line.split(';')
        const tipoMov = get(cols, 'tipo_movimentacao')
        const valorBruto = get(cols, 'valor_bruto_input')
        if (!valorBruto) continue

        // Detect if service or product based on presence of ISS vs ICMS
        const hasIss = parseFloat(get(cols, 'aliq_iss_ar') || '0') > 0
        const descricao = get(cols, 'descricao_atividade') || ''

        if (hasIss || get(cols, 'aliq_iss_ar')) {
          // Service
          const row: ServiceRow = {
            id: uid(), descricao: descricao.slice(0, 60),
            faturamento: valorBruto,
            aliqIss:        String(parseFloat(get(cols, 'aliq_iss_ar') || '0') * 100),
            aliqPisCofins:  String(parseFloat(get(cols, 'aliq_pis_cofins_ar') || '0') * 100),
            aliqIcms:       String(parseFloat(get(cols, 'aliq_icms_ar') || '0') * 100),
            valIss: 0, valPisCofins: 0, valIcms: 0,
          }
          const computed = computeService(row)
          if (tipoMov === 'entrada') result.servicosTomados.push(computed)
          else result.servicosPrestados.push(computed)
        } else {
          // Product
          const row: ProductRow = {
            id: uid(), descricao: descricao.slice(0, 60),
            ncm: get(cols, 'cnae_principal') || '',
            valor: valorBruto,
            aliqIcms:      String(parseFloat(get(cols, 'aliq_icms_ar') || '0') * 100),
            aliqPisCofins: String(parseFloat(get(cols, 'aliq_pis_cofins_ar') || '0') * 100),
            aliqIpi:       String(parseFloat(get(cols, 'aliq_ipi_ar') || '0') * 100),
            valIcms: 0, valPisCofins: 0, valIpi: 0,
          }
          const computed = computeProduct(row)
          if (tipoMov === 'entrada') result.produtosAdquiridos.push(computed)
          else result.produtosVendidos.push(computed)
        }
      }
    } catch (e) {
      result.errors.push('Erro ao ler CSV: ' + String(e))
    }
    return result
  }

  result.errors.push('Formato não suportado. Use .xlsx, .xls ou .csv')
  return result
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */

// ── Stepper ──
function Stepper({ current }: { current: number }) {
  const steps = [{ label: 'Empresa' }, { label: 'Dados fiscais' }, { label: 'Resultado' }]
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-0">
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300',
              i < current  ? 'border-primary bg-primary text-primary-foreground' : '',
              i === current ? 'border-primary bg-primary text-primary-foreground' : '',
              i > current  ? 'border-border bg-card text-muted-foreground' : '',
            )}>
              {i < current ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{String(i + 1).padStart(2, '0')}</span>}
            </div>
            <span className={cn('text-sm font-medium', i === current ? 'text-foreground' : 'text-muted-foreground')}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn('mx-4 h-px w-12 transition-colors duration-500', i < current ? 'bg-primary' : 'bg-border')} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Regime selector cards ──
const REGIMES = ['Lucro Real', 'Lucro Presumido', 'Simples Nacional', 'MEI']

function RegimeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {REGIMES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            'rounded-xl border px-3 py-3 text-left text-xs font-medium transition-all duration-200',
            value === r
              ? 'border-primary bg-accent text-primary shadow-[0_0_12px_rgba(255,180,0,0.18)]'
              : 'border-border bg-secondary/30 text-muted-foreground hover:border-border/80 hover:bg-secondary/60 hover:text-foreground',
          )}
        >
          <span className={cn('block text-[10px] font-semibold uppercase tracking-wider mb-1', value === r ? 'text-primary' : 'text-muted-foreground/60')}>
            Regime
          </span>
          {r}
        </button>
      ))}
    </div>
  )
}

// ── Ano Base selector ──
function AnoBaseSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TRANSITION.map((t) => {
        const isSelected = value === t.ano
        const pctLabel = t.pct === 1 ? 'Completo' : `${(t.pct * 100).toFixed(0)}%`
        return (
          <button
            key={t.ano}
            type="button"
            onClick={() => onChange(t.ano)}
            className={cn(
              'relative flex flex-col items-center rounded-xl border px-3 py-2.5 text-center text-xs font-medium transition-all duration-200',
              isSelected
                ? 'border-primary bg-accent text-primary shadow-[0_0_14px_rgba(255,180,0,0.2)]'
                : 'border-border bg-secondary/30 text-muted-foreground hover:border-border/80 hover:bg-secondary/60',
            )}
          >
            <span className="text-sm font-bold">{t.ano}</span>
            <span className={cn('text-[9px] mt-0.5 font-semibold uppercase tracking-wide', isSelected ? 'text-primary/80' : 'text-muted-foreground/60')}>
              {pctLabel}
            </span>
            {isSelected && (
              <motion.div
                layoutId="anobase-indicator"
                className="absolute inset-0 rounded-xl border-2 border-primary"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Margem de lucro toggle ──
function MargemSection({ enabled, onToggle, value, onChange }: {
  enabled: boolean; onToggle: () => void; value: string; onChange: (v: string) => void
}) {
  return (
    <div className={cn('rounded-xl border transition-all duration-300', enabled ? 'border-primary/40 bg-accent/30' : 'border-border bg-secondary/20')}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="text-left">
          <p className="text-sm font-semibold">Margem de lucro</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {enabled ? 'Análise incluirá impacto na margem da empresa' : 'Ativar para ver o impacto sobre a rentabilidade'}
          </p>
        </div>
        <div className={cn('flex h-6 w-11 items-center rounded-full border-2 transition-all duration-300', enabled ? 'border-primary bg-primary' : 'border-border bg-secondary')}>
          <motion.div
            animate={{ x: enabled ? 20 : 2 }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.35 }}
            className="h-4 w-4 rounded-full bg-white shadow"
          />
        </div>
      </button>
      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50 px-4 pb-4 pt-3">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Margem de lucro líquida estimada (%)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  className="h-9 w-32 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
                <p className="text-xs text-muted-foreground">
                  Usado para calcular quanto da sua margem é consumida pelas mudanças tributárias.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── File import zone ──
function FileImportZone({ onImport, importing }: {
  onImport: (file: File) => void
  importing: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    onImport(files[0])
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300',
        dragging ? 'border-primary bg-accent/40 scale-[1.01]' : 'border-border/60 bg-secondary/20 hover:border-primary/40 hover:bg-accent/20',
      )}
    >
      <input
        ref={inputRef} type="file"
        accept=".csv,.xlsx,.xls"
        onChange={e => handleFiles(e.target.files)}
        className="hidden"
      />
      {importing ? (
        <>
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-accent">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          </div>
          <p className="text-sm font-semibold">Processando arquivo…</p>
        </>
      ) : (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent border border-primary/20">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Arraste seu arquivo aqui</p>
            <p className="mt-1 text-xs text-muted-foreground">ou clique para selecionar</p>
          </div>
          <div className="flex gap-2">
            {['.XLSX', '.XLS', '.CSV'].map(ext => (
              <span key={ext} className="rounded-lg border border-border bg-secondary/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                {ext}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground max-w-xs">
            Use o template oficial (Serviços Prestados, Serviços Tomados, Produtos Vendidos, Produtos Adquiridos)
            ou o CSV de resultado exportado pelo sistema.
          </p>
        </>
      )}
    </div>
  )
}

// ── Service row input ──
function ServiceRowInput({ row, onChange, onRemove }: {
  row: ServiceRow; onChange: (r: ServiceRow) => void; onRemove: () => void
}) {
  function update(key: keyof ServiceRow, val: string) {
    onChange(computeService({ ...row, [key]: val } as ServiceRow))
  }
  const totalImp = row.valIss + row.valPisCofins + row.valIcms
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      className="rounded-xl border border-border bg-secondary/20 p-3">
      <div className="grid gap-2" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto' }}>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">Descrição</label>
          <input value={row.descricao} onChange={e => update('descricao', e.target.value)}
            placeholder="Serviço" className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">Valor (R$)</label>
          <input value={row.faturamento} onChange={e => update('faturamento', e.target.value)}
            type="number" min="0" step="0.01" placeholder="0,00" className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">ISS (%)</label>
          <input value={row.aliqIss} onChange={e => update('aliqIss', e.target.value)}
            type="number" min="0" max="100" step="0.01" className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">PIS/COFINS (%)</label>
          <input value={row.aliqPisCofins} onChange={e => update('aliqPisCofins', e.target.value)}
            type="number" min="0" max="100" step="0.01" className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">ICMS (%)</label>
          <input value={row.aliqIcms} onChange={e => update('aliqIcms', e.target.value)}
            type="number" min="0" max="100" step="0.01" className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring" />
        </div>
        <div className="flex items-end">
          <button onClick={onRemove} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {totalImp > 0 && (
        <div className="mt-2 flex flex-wrap gap-3 border-t border-border/40 pt-2">
          {row.valIss > 0 && <span className="text-[10px] text-muted-foreground">ISS: <span className="text-warning font-medium">{formatBRL(row.valIss)}</span></span>}
          {row.valPisCofins > 0 && <span className="text-[10px] text-muted-foreground">PIS/COFINS: <span className="text-warning font-medium">{formatBRL(row.valPisCofins)}</span></span>}
          {row.valIcms > 0 && <span className="text-[10px] text-muted-foreground">ICMS: <span className="text-warning font-medium">{formatBRL(row.valIcms)}</span></span>}
          <span className="ml-auto text-[10px] font-bold text-primary">Total: {formatBRL(totalImp)}</span>
        </div>
      )}
    </motion.div>
  )
}

// ── Product row input ──
function ProductRowInput({ row, onChange, onRemove }: {
  row: ProductRow; onChange: (r: ProductRow) => void; onRemove: () => void
}) {
  function update(key: keyof ProductRow, val: string) {
    onChange(computeProduct({ ...row, [key]: val } as ProductRow))
  }
  const totalImp = row.valIcms + row.valPisCofins + row.valIpi
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      className="rounded-xl border border-border bg-secondary/20 p-3">
      <div className="grid gap-2" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr auto' }}>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">Descrição</label>
          <input value={row.descricao} onChange={e => update('descricao', e.target.value)}
            placeholder="Produto" className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">NCM</label>
          <input value={row.ncm} onChange={e => update('ncm', e.target.value)}
            placeholder="0000.00" className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">Valor (R$)</label>
          <input value={row.valor} onChange={e => update('valor', e.target.value)}
            type="number" min="0" step="0.01" className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">ICMS (%)</label>
          <input value={row.aliqIcms} onChange={e => update('aliqIcms', e.target.value)}
            type="number" min="0" max="100" step="0.01" className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">PIS/COF (%)</label>
          <input value={row.aliqPisCofins} onChange={e => update('aliqPisCofins', e.target.value)}
            type="number" min="0" max="100" step="0.01" className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">IPI (%)</label>
          <input value={row.aliqIpi} onChange={e => update('aliqIpi', e.target.value)}
            type="number" min="0" max="100" step="0.01" className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring" />
        </div>
        <div className="flex items-end">
          <button onClick={onRemove} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {totalImp > 0 && (
        <div className="mt-2 flex flex-wrap gap-3 border-t border-border/40 pt-2">
          {row.valIcms > 0 && <span className="text-[10px] text-muted-foreground">ICMS: <span className="text-warning font-medium">{formatBRL(row.valIcms)}</span></span>}
          {row.valPisCofins > 0 && <span className="text-[10px] text-muted-foreground">PIS/COFINS: <span className="text-warning font-medium">{formatBRL(row.valPisCofins)}</span></span>}
          {row.valIpi > 0 && <span className="text-[10px] text-muted-foreground">IPI: <span className="text-warning font-medium">{formatBRL(row.valIpi)}</span></span>}
          <span className="ml-auto text-[10px] font-bold text-primary">Total: {formatBRL(totalImp)}</span>
        </div>
      )}
    </motion.div>
  )
}

// ── Bar chart ──
function BarChart({ bars }: { bars: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...bars.map(b => b.value), 1)
  return (
    <div className="flex flex-col gap-3">
      {bars.map((bar, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-40 shrink-0 text-xs text-muted-foreground">{bar.label}</span>
          <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-secondary/40">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${(bar.value / max) * 100}%` }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-lg" style={{ backgroundColor: bar.color }} />
          </div>
          <span className="w-28 shrink-0 text-right text-xs font-semibold tabular-nums">{formatBRL(bar.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Tax gauge comparison ──
function TaxGauge({ atual, reforma, label, anoBase }: { atual: number; reforma: number; label: string; anoBase: number }) {
  const delta = reforma - atual
  const positive = delta > 0
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold">{anoBase}</span>
      </div>
      <div className="flex flex-col gap-3">
        {[
          { label: 'Atual', pct: atual, color: 'bg-muted-foreground/60', textColor: 'text-foreground' },
          { label: `Reforma ${anoBase}`, pct: reforma, color: positive ? 'bg-destructive' : 'bg-success', textColor: positive ? 'text-destructive' : 'text-success' },
        ].map((item, i) => (
          <div key={i}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
              <span className={cn('text-sm font-bold tabular-nums', item.textColor)}>{formatPct(item.pct)}</span>
            </div>
            <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${Math.min(item.pct * 250, 100)}%` }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className={cn('h-full rounded-full', item.color)} />
            </div>
          </div>
        ))}
      </div>
      <div className={cn('mt-3 flex items-center gap-1.5 text-xs font-semibold', positive ? 'text-destructive' : 'text-success')}>
        {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        {positive ? '+' : ''}{formatPct(delta)} na carga tributária
      </div>
    </div>
  )
}

// ── Timeline chart ──
function TimelineChart({ currentTax, rateServ, rateProd, hasServ, hasProd }: {
  currentTax: number; rateServ: number; rateProd: number; hasServ: boolean; hasProd: boolean
}) {
  return (
    <div>
      <div className="flex items-end gap-1 h-28">
        {TRANSITION.map((a, i) => {
          const rateEff = hasServ ? rateServ * a.pct + currentTax * (1 - a.pct) : rateProd * a.pct + currentTax * (1 - a.pct)
          const barH = Math.min((rateEff / 0.35) * 100, 100)
          const isHigher = rateEff > currentTax
          return (
            <div key={a.ano} className="flex-1 flex flex-col items-center gap-0.5">
              <motion.div
                initial={{ height: 0 }} animate={{ height: `${barH}%` }}
                transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className={cn('w-full rounded-t-md', isHigher ? 'bg-destructive/70' : 'bg-primary/70')}
                style={{ alignSelf: 'flex-end', minHeight: 4 }}
                title={`${a.ano}: ${(rateEff * 100).toFixed(1)}%`}
              />
            </div>
          )
        })}
      </div>
      <div className="flex mt-1">
        {TRANSITION.map(a => <div key={a.ano} className="flex-1 text-center text-[9px] text-muted-foreground">{a.ano}</div>)}
      </div>
    </div>
  )
}

// ── CTA popup ──
function CTAPopup({ onClose, companyName }: { onClose: () => void; companyName: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg">
        <SpotlightCard className="rounded-3xl border border-primary/30 bg-card p-8 glow-gold text-center">
          <button onClick={onClose} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
            <Star className="h-8 w-8 text-primary" />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary mb-2">Próximo passo</p>
          <h2 className="text-2xl font-bold tracking-tight mb-3">
            Análise Analítica para <span className="text-gradient-gold">{companyName}</span>
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            A análise sintética te deu o panorama geral. Com a <strong className="text-foreground">Análise Analítica</strong>,
            acompanhamos sua empresa mês a mês com métricas detalhadas, alertas em tempo real e relatórios
            personalizados para cada fase da transição.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-7">
            {[
              { icon: BarChart3, label: 'Métricas mensais', desc: 'KPIs tributários em tempo real' },
              { icon: BookOpen, label: 'Relatórios sob medida', desc: 'Para apresentar ao board' },
              { icon: Sparkles, label: 'Alertas inteligentes', desc: 'Oportunidades e riscos' },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-border bg-secondary/40 p-3 text-left">
                <item.icon className="h-4 w-4 text-primary mb-2" />
                <p className="text-xs font-semibold">{item.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
          <button className="btn-shine glow-gold w-full h-12 rounded-2xl bg-primary text-sm font-bold text-primary-foreground flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" />
            Quero a Análise Analítica
            <ArrowRight className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Agora não
          </button>
        </SpotlightCard>
      </motion.div>
    </motion.div>
  )
}

// ── Chapter divider ──
function Chapter({ number, label, children }: { number: string; label: string; children: React.ReactNode }) {
  return (
    <Reveal y={24} className="relative">
      <div className="mb-6 flex items-center gap-3">
        <span className="font-mono text-xs font-semibold text-primary">{number}</span>
        <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      </div>
      {children}
    </Reveal>
  )
}
function SectionFade() { return <div className="relative py-10"><div className="divider-fade" aria-hidden /></div> }

/* ─────────────────────────────────────────────
   RESULTS VIEW
───────────────────────────────────────────── */
function ResultadoView({
  company, anoBase, incluirMargem, margemLucro,
  spRows, stRows, pvRows, paRows,
  onNovaAnalise, savedCompanies, setSavedCompanies,
}: {
  company: CompanyForm; anoBase: number; incluirMargem: boolean; margemLucro: string
  spRows: ServiceRow[]; stRows: ServiceRow[]; pvRows: ProductRow[]; paRows: ProductRow[]
  onNovaAnalise: () => void
  savedCompanies: SavedCompany[]; setSavedCompanies: (c: SavedCompany[]) => void
}) {
  const [showPopup, setShowPopup] = useState(false)
  const [popupShown, setPopupShown] = useState(false)
  const [activeTab, setActiveTab] = useState<'analise' | 'empresas'>('analise')
  const [saved, setSaved] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Aggregates
  const spTotal = spRows.reduce((a, r) => ({ v: a.v + pf(r.faturamento), i: a.i + r.valIss + r.valPisCofins + r.valIcms }), { v: 0, i: 0 })
  const stTotal = stRows.reduce((a, r) => ({ v: a.v + pf(r.faturamento), i: a.i + r.valIss + r.valPisCofins + r.valIcms }), { v: 0, i: 0 })
  const pvTotal = pvRows.reduce((a, r) => ({ v: a.v + pf(r.valor), i: a.i + r.valIcms + r.valPisCofins + r.valIpi }), { v: 0, i: 0 })
  const paTotal = paRows.reduce((a, r) => ({ v: a.v + pf(r.valor), i: a.i + r.valIcms + r.valPisCofins + r.valIpi }), { v: 0, i: 0 })

  const servValor = spTotal.v + stTotal.v
  const servImp   = spTotal.i + stTotal.i
  const prodValor = pvTotal.v + paTotal.v
  const prodImp   = pvTotal.i + paTotal.i
  const totalValor = servValor + prodValor
  const totalImp   = servImp + prodImp
  const hasData = totalValor > 0

  const taxAtualServ = servValor > 0 ? servImp / servValor : 0
  const taxAtualProd = prodValor > 0 ? prodImp / prodValor : 0
  const taxAtual = totalValor > 0 ? totalImp / totalValor : 0

  const refServ = calcReforma(servValor, servImp, REFORMA_FULL.servicos, anoBase)
  const refProd = calcReforma(prodValor, prodImp, REFORMA_FULL.produtos, anoBase)

  const totalImpRef = refServ.impostosDr + refProd.impostosDr
  const totalValorRef = refServ.valorDr + refProd.valorDr
  const taxRef = totalValorRef > 0 ? totalImpRef / totalValorRef : 0
  const deltaImp = totalImpRef - totalImp
  const poupando = deltaImp < 0

  const margem = pf(margemLucro) / 100
  const lucroAtual = totalValor * margem
  const lucroRef = (totalValorRef * margem) - deltaImp
  const deltaLucro = lucroRef - lucroAtual

  // Decomposition
  const sp_iss = spRows.reduce((a, r) => a + r.valIss, 0)
  const sp_pc  = spRows.reduce((a, r) => a + r.valPisCofins, 0)
  const pv_icm = pvRows.reduce((a, r) => a + r.valIcms, 0)
  const pv_pc  = pvRows.reduce((a, r) => a + r.valPisCofins, 0)
  const pv_ipi = pvRows.reduce((a, r) => a + r.valIpi, 0)

  // Popup trigger
  useEffect(() => {
    if (popupShown) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setPopupShown(true); setTimeout(() => setShowPopup(true), 900) }
    }, { threshold: 0.5 })
    if (bottomRef.current) obs.observe(bottomRef.current)
    return () => obs.disconnect()
  }, [popupShown])

  function handleSalvar() {
    setSavedCompanies([...savedCompanies, {
      id: uid(), razaoSocial: company.razaoSocial, cnpj: company.cnpj || '—',
      date: new Date().toLocaleDateString('pt-BR'), economia: -deltaImp, anoBase, regime: company.regime,
    }])
    setSaved(true)
  }

  const transitionPct = TRANSITION.find(a => a.ano === anoBase)?.pct ?? 1
  const narrativeText = !hasData
    ? `Insira dados fiscais para ver a análise personalizada de ${company.razaoSocial}.`
    : poupando
    ? `Em ${anoBase} (${(transitionPct * 100).toFixed(0)}% da reforma implantada), ${company.razaoSocial} pode reduzir sua carga tributária em ${formatBRL(Math.abs(deltaImp))}, passando de ${formatPct(taxAtual)} para ${formatPct(taxRef)} de carga efetiva.`
    : `Em ${anoBase}, a Reforma Tributária representa um aumento de ${formatBRL(Math.abs(deltaImp))} para ${company.razaoSocial}. A carga sobe de ${formatPct(taxAtual)} para ${formatPct(taxRef)}. Planejamento tributário é essencial.`

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex gap-1 mb-8 border-b border-border">
        {[
          { id: 'analise', label: 'Análise', icon: BarChart3 },
          { id: 'empresas', label: `Empresas salvas (${savedCompanies.length})`, icon: Building2 },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn('flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Empresas salvas */}
      {activeTab === 'empresas' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {savedCompanies.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card/60 py-16 text-center">
              <Building2 className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Nenhuma empresa salva.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {savedCompanies.map(sc => (
                <SpotlightCard key={sc.id} className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{sc.razaoSocial}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">CNPJ: {sc.cnpj} · {sc.regime} · {sc.date}</p>
                    </div>
                    <div className="text-right">
                      <span className={cn('text-xs font-bold', sc.economia > 0 ? 'text-success' : 'text-destructive')}>
                        {sc.economia > 0 ? '▼' : '▲'} {formatBRL(Math.abs(sc.economia))}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Ano base {sc.anoBase}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">{sc.economia > 0 ? 'Carga reduz' : 'Carga aumenta'} com reforma</span>
                    <button onClick={onNovaAnalise} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                      Nova análise <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          )}
          <div className="mt-6">
            <button onClick={onNovaAnalise}
              className="btn-shine glow-gold h-11 gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground flex items-center">
              <Plus className="h-4 w-4" />Nova análise
            </button>
          </div>
        </motion.div>
      )}

      {/* Análise principal */}
      {activeTab === 'analise' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

          {/* HERO */}
          <section className="relative min-h-[50vh] overflow-hidden pb-8 pt-2">
            <div className="pointer-events-none absolute left-1/2 top-[-60px] h-[380px] w-[680px] -translate-x-1/2 rounded-full blur-[140px]"
              style={{ background: poupando ? 'radial-gradient(circle, rgba(255,180,0,0.18), transparent 70%)' : 'radial-gradient(circle, rgba(255,77,77,0.12), transparent 70%)' }} />

            <Reveal y={12}>
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <p className="text-sm font-medium text-primary">Análise da empresa</p>
                  <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{company.razaoSocial}</h1>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {company.cnpj && <span className="rounded-full border border-border px-3 py-0.5 text-xs">{company.cnpj}</span>}
                    <span className="rounded-full border border-primary/30 bg-accent px-3 py-0.5 text-xs text-primary font-medium">{company.regime}</span>
                    {company.uf && <span className="rounded-full border border-border px-3 py-0.5 text-xs">{company.uf}</span>}
                    <span className="rounded-full border border-border px-3 py-0.5 text-xs font-semibold">Ano base: {anoBase}</span>
                    {hasData && (
                      <span className={cn('rounded-full px-3 py-0.5 text-xs font-semibold', poupando ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')}>
                        {poupando ? '↓ Carga reduz pós-reforma' : '↑ Carga aumenta pós-reforma'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={handleSalvar} disabled={saved}
                    className={cn('flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-all',
                      saved ? 'bg-success/10 border-success/30 text-success' : 'border-border bg-secondary/60 hover:bg-secondary text-foreground')}>
                    {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {saved ? 'Salvo' : 'Salvar'}
                  </button>
                  <button onClick={onNovaAnalise}
                    className="flex h-10 items-center gap-2 rounded-xl border border-border bg-secondary/60 px-4 text-sm font-medium hover:bg-secondary">
                    <Plus className="h-4 w-4" />Nova análise
                  </button>
                </div>
              </div>
            </Reveal>

            {hasData && (
              <>
                <Reveal delay={0.08} y={32} className="mt-10 text-center">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {poupando ? 'Redução de impostos estimada' : 'Aumento de impostos estimado'} — {anoBase}
                  </p>
                  <p className="mt-3 text-5xl font-semibold tracking-tight md:text-7xl">
                    <span className={poupando ? 'text-gradient-gold' : 'text-destructive'}>
                      <AnimatedCounter value={Math.abs(deltaImp) / 1000} decimals={1} prefix="R$ " suffix=" mil" />
                    </span>
                  </p>
                  <p className="mt-2 text-lg text-muted-foreground">
                    <AnimatedCounter value={Math.abs(taxRef - taxAtual) * 100} decimals={2} suffix="pp de variação na carga tributária" />
                  </p>
                </Reveal>

                <Reveal delay={0.12} y={16} className="mt-8 flex justify-center gap-3 flex-wrap">
                  {[
                    { label: 'Carga atual', value: formatPct(taxAtual) },
                    { label: `Carga ${anoBase}`, value: formatPct(taxRef) },
                    { label: 'Impostos hoje', value: formatBRL(totalImp) },
                    { label: `Impostos em ${anoBase}`, value: formatBRL(totalImpRef) },
                    ...(incluirMargem && margem > 0 ? [{ label: `Impacto na margem`, value: formatBRL(Math.abs(deltaLucro)) }] : []),
                  ].map(item => (
                    <div key={item.label} className="rounded-2xl border border-border bg-card/70 px-5 py-3 text-center backdrop-blur-sm">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold">{item.value}</p>
                    </div>
                  ))}
                </Reveal>

                {incluirMargem && margem > 0 && (
                  <Reveal delay={0.15} y={12} className="mt-4">
                    <div className={cn('mx-auto max-w-lg rounded-2xl border p-4 text-center text-sm', deltaLucro < 0 ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-success/30 bg-success/5 text-success')}>
                      {deltaLucro < 0
                        ? `⚠ A reforma consome ${formatBRL(Math.abs(deltaLucro))} da margem de ${pf(margemLucro).toFixed(1)}% em ${anoBase}`
                        : `✓ Com a reforma, a margem de ${pf(margemLucro).toFixed(1)}% ganha ${formatBRL(Math.abs(deltaLucro))} em ${anoBase}`}
                    </div>
                  </Reveal>
                )}
              </>
            )}
          </section>

          {hasData && (
            <>
              <SectionFade />

              {/* CH 01 */}
              <Chapter number="01" label="O cenário">
                <WordReveal text={narrativeText}
                  className="text-balance text-xl font-semibold leading-snug tracking-tight md:text-2xl" />
              </Chapter>

              <SectionFade />

              {/* CH 02 — Comparação */}
              <Chapter number="02" label="Comparação por segmento">
                <p className="mb-6 text-sm text-muted-foreground">
                  Carga tributária atual vs pós-reforma para o ano-base selecionado ({anoBase}).
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {servValor > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                      <TaxGauge atual={taxAtualServ} reforma={refServ.impostosDr / Math.max(refServ.valorDr, 1)} label="Serviços" anoBase={anoBase} />
                    </motion.div>
                  )}
                  {prodValor > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.08 }}>
                      <TaxGauge atual={taxAtualProd} reforma={refProd.impostosDr / Math.max(refProd.valorDr, 1)} label="Produtos" anoBase={anoBase} />
                    </motion.div>
                  )}
                </div>
              </Chapter>

              <SectionFade />

              {/* CH 03 — Composição */}
              <Chapter number="03" label="Composição da carga tributária">
                <p className="mb-6 text-sm text-muted-foreground">
                  Tributos atuais vs IVA Dual (IBS + CBS) pós-reforma.
                </p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm">
                    <h3 className="mb-4 text-sm font-semibold">Impostos atuais</h3>
                    <BarChart bars={[
                      ...(sp_iss > 0 ? [{ label: 'ISS (serviços)', value: sp_iss, color: '#9ca3af' }] : []),
                      ...((sp_pc + pv_pc) > 0 ? [{ label: 'PIS/COFINS', value: sp_pc + pv_pc, color: '#6b7280' }] : []),
                      ...(pv_icm > 0 ? [{ label: 'ICMS', value: pv_icm, color: '#4b5563' }] : []),
                      ...(pv_ipi > 0 ? [{ label: 'IPI', value: pv_ipi, color: '#374151' }] : []),
                    ]} />
                  </SpotlightCard>
                  <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm">
                    <h3 className="mb-4 text-sm font-semibold">IVA Dual — reforma {anoBase} ({(transitionPct * 100).toFixed(0)}%)</h3>
                    <BarChart bars={[
                      ...(refServ.ibs > 0 ? [{ label: 'IBS Serviços', value: refServ.ibs, color: '#ffb400' }] : []),
                      ...(refServ.cbs > 0 ? [{ label: 'CBS Serviços', value: refServ.cbs, color: '#e7a300' }] : []),
                      ...(refProd.ibs > 0 ? [{ label: 'IBS Produtos', value: refProd.ibs, color: '#c78c00' }] : []),
                      ...(refProd.cbs > 0 ? [{ label: 'CBS Produtos', value: refProd.cbs, color: '#ad7b04' }] : []),
                    ]} />
                  </SpotlightCard>
                </div>
              </Chapter>

              <SectionFade />

              {/* CH 04 — Transição */}
              <Chapter number="04" label="Transição 2026 → 2033">
                <p className="mb-6 text-sm text-muted-foreground">
                  Evolução estimada da carga tributária ao longo dos anos da reforma.
                </p>
                <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm">
                  <TimelineChart
                    currentTax={taxAtual}
                    rateServ={REFORMA_FULL.servicos.total}
                    rateProd={REFORMA_FULL.produtos.total}
                    hasServ={servValor > 0}
                    hasProd={prodValor > 0}
                  />
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><div className="h-2 w-4 rounded bg-primary/70" /><span className="text-[10px] text-muted-foreground">Carga reduz</span></div>
                    <div className="flex items-center gap-1.5"><div className="h-2 w-4 rounded bg-destructive/70" /><span className="text-[10px] text-muted-foreground">Carga aumenta</span></div>
                    <div className="ml-auto flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Selecionado: {anoBase}
                    </div>
                  </div>
                </SpotlightCard>
              </Chapter>

              <SectionFade />

              {/* CH 05 — Detalhamento */}
              <Chapter number="05" label="Detalhamento por operação">
                <SpotlightCard className="rounded-2xl border border-border bg-card/70 overflow-hidden backdrop-blur-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-secondary/20">
                          {['Descrição', 'Tipo', 'Valor', 'Imp. Atual', 'Carga %', `Imp. ${anoBase}`, 'Δ', ...(incluirMargem && margem > 0 ? ['Δ Margem'] : [])].map(h => (
                            <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...spRows.map(r => ({ desc: r.descricao || 'Serviço prestado', tipo: 'Serv. Prest.', valor: pf(r.faturamento), imp: r.valIss + r.valPisCofins + r.valIcms, rate: REFORMA_FULL.servicos })),
                          ...stRows.map(r => ({ desc: r.descricao || 'Serviço tomado',   tipo: 'Serv. Tom.',  valor: pf(r.faturamento), imp: r.valIss + r.valPisCofins + r.valIcms, rate: REFORMA_FULL.servicos })),
                          ...pvRows.map(r => ({ desc: r.descricao || 'Produto vendido',  tipo: 'Prod. Vend.', valor: pf(r.valor), imp: r.valIcms + r.valPisCofins + r.valIpi, rate: REFORMA_FULL.produtos })),
                          ...paRows.map(r => ({ desc: r.descricao || 'Produto adquirido',tipo: 'Prod. Adq.',  valor: pf(r.valor), imp: r.valIcms + r.valPisCofins + r.valIpi, rate: REFORMA_FULL.produtos })),
                        ].filter(r => r.valor > 0).map((r, i) => {
                          const ref = calcReforma(r.valor, r.imp, r.rate, anoBase)
                          const delta = ref.impostosDr - r.imp
                          const deltaM = incluirMargem && margem > 0 ? -(delta * margem) : null
                          return (
                            <motion.tr key={i}
                              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                              transition={{ delay: i * 0.02 }}
                              className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                              <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">{r.desc}</td>
                              <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{r.tipo}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{formatBRL(r.valor)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-warning">{formatBRL(r.imp)}</td>
                              <td className="px-4 py-2.5 text-right">{r.valor > 0 ? `${(r.imp / r.valor * 100).toFixed(1)}%` : '—'}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{formatBRL(ref.impostosDr)}</td>
                              <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', delta > 0 ? 'text-destructive' : 'text-success')}>
                                {delta > 0 ? '+' : ''}{formatBRL(delta)}
                              </td>
                              {incluirMargem && margem > 0 && (
                                <td className={cn('px-4 py-2.5 text-right tabular-nums', (deltaM ?? 0) < 0 ? 'text-destructive' : 'text-success')}>
                                  {deltaM != null ? formatBRL(deltaM) : '—'}
                                </td>
                              )}
                            </motion.tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border bg-secondary/20 font-bold">
                          <td colSpan={2} className="px-4 py-3">TOTAL</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatBRL(totalValor)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-warning">{formatBRL(totalImp)}</td>
                          <td className="px-4 py-3 text-right">{formatPct(taxAtual)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatBRL(totalImpRef)}</td>
                          <td className={cn('px-4 py-3 text-right tabular-nums', deltaImp > 0 ? 'text-destructive' : 'text-success')}>
                            {deltaImp > 0 ? '+' : ''}{formatBRL(deltaImp)}
                          </td>
                          {incluirMargem && margem > 0 && (
                            <td className={cn('px-4 py-3 text-right tabular-nums', deltaLucro < 0 ? 'text-destructive' : 'text-success')}>
                              {formatBRL(deltaLucro)}
                            </td>
                          )}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </SpotlightCard>
              </Chapter>

              <SectionFade />

              {/* CTA anchor */}
              <div ref={bottomRef} className="py-6 text-center">
                <Reveal y={20}>
                  <SpotlightCard className="rounded-3xl border border-primary/20 bg-card/60 p-8 backdrop-blur-sm">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary mb-2">Análise concluída</p>
                    <h3 className="text-xl font-bold tracking-tight mb-2">Quer ir além da análise sintética?</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                      Com a Análise Analítica, acompanhamos sua empresa mês a mês com métricas detalhadas e alertas em tempo real.
                    </p>
                    <button onClick={() => setShowPopup(true)}
                      className="btn-shine glow-gold h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground flex items-center gap-2 mx-auto">
                      <Sparkles className="h-4 w-4" />Conhecer a Análise Analítica<ArrowRight className="h-4 w-4" />
                    </button>
                  </SpotlightCard>
                </Reveal>
              </div>
            </>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {showPopup && <CTAPopup onClose={() => setShowPopup(false)} companyName={company.razaoSocial} />}
      </AnimatePresence>
    </div>
  )
}

/* ─────────────────────────────────────────────
   DATA TABS CONFIG
───────────────────────────────────────────── */
const DATA_TABS: { id: DataTab; label: string }[] = [
  { id: 'importar',             label: '↑ Importar arquivo' },
  { id: 'servicos_prestados',   label: 'Serviços Prestados' },
  { id: 'servicos_tomados',     label: 'Serviços Tomados' },
  { id: 'produtos_vendidos',    label: 'Produtos Vendidos' },
  { id: 'produtos_adquiridos',  label: 'Produtos Adquiridos' },
]

const SETORES = ['Comércio', 'Serviços', 'Indústria', 'Agronegócio', 'Construção Civil', 'Tecnologia', 'Saúde', 'Educação']
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

/* ─────────────────────────────────────────────
   MAIN WIZARD
───────────────────────────────────────────── */
export function AnaliseWizard() {
  const [step, setStep]               = useState<WizardStep>('empresa')
  const [dataTab, setDataTab]         = useState<DataTab>('importar')
  const [company, setCompany]         = useState<CompanyForm>({ razaoSocial: '', cnpj: '', regime: 'Lucro Real', setor: 'Comércio', uf: 'SP' })
  const [anoBase, setAnoBase]         = useState<number>(2033)
  const [incluirMargem, setMargem]    = useState(false)
  const [margemLucro, setMargemLucro] = useState('10')
  const [spRows, setSpRows]           = useState<ServiceRow[]>([emptyService()])
  const [stRows, setStRows]           = useState<ServiceRow[]>([emptyService()])
  const [pvRows, setPvRows]           = useState<ProductRow[]>([emptyProduct()])
  const [paRows, setPaRows]           = useState<ProductRow[]>([emptyProduct()])
  const [savedCompanies, setSaved]    = useState<SavedCompany[]>([])
  const [importing, setImporting]     = useState(false)
  const [importMsg, setImportMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // When regime changes, update default alíquotas in new empty rows
  function handleRegimeChange(r: string) {
    setCompany(c => ({ ...c, regime: r }))
  }

  function handleEmpresaNext(e: React.FormEvent) {
    e.preventDefault()
    setStep('dados')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCalcular() {
    setStep('calculando')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => { setStep('resultado'); window.scrollTo({ top: 0, behavior: 'smooth' }) }, 2600)
  }

  function handleNovaAnalise() {
    setStep('empresa')
    setCompany({ razaoSocial: '', cnpj: '', regime: 'Lucro Real', setor: 'Comércio', uf: 'SP' })
    setAnoBase(2033)
    setMargem(false)
    setSpRows([emptyService()])
    setStRows([emptyService()])
    setPvRows([emptyProduct()])
    setPaRows([emptyProduct()])
    setImportMsg(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleFileImport(file: File) {
    setImporting(true)
    setImportMsg(null)
    try {
      const parsed = await parseUploadedFile(file)
      let count = 0
      if (parsed.servicosPrestados.length > 0) { setSpRows(parsed.servicosPrestados); count += parsed.servicosPrestados.length }
      if (parsed.servicosTomados.length > 0)   { setStRows(parsed.servicosTomados);   count += parsed.servicosTomados.length }
      if (parsed.produtosVendidos.length > 0)   { setPvRows(parsed.produtosVendidos);  count += parsed.produtosVendidos.length }
      if (parsed.produtosAdquiridos.length > 0) { setPaRows(parsed.produtosAdquiridos);count += parsed.produtosAdquiridos.length }

      if (parsed.errors.length > 0) {
        setImportMsg({ type: 'error', text: parsed.errors.join(' · ') })
      } else if (count === 0) {
        setImportMsg({ type: 'error', text: 'Nenhum dado encontrado no arquivo. Verifique o formato.' })
      } else {
        setImportMsg({ type: 'success', text: `${count} registro${count > 1 ? 's' : ''} importado${count > 1 ? 's' : ''} com sucesso.` })
      }
    } catch (e) {
      setImportMsg({ type: 'error', text: 'Erro ao processar arquivo: ' + String(e) })
    } finally {
      setImporting(false)
    }
  }

  const stepIndex = step === 'empresa' ? 0 : step === 'dados' ? 1 : 2

  // Running totals for "dados" step summary
  const spSum = spRows.reduce((a, r) => a + pf(r.faturamento), 0)
  const stSum = stRows.reduce((a, r) => a + pf(r.faturamento), 0)
  const pvSum = pvRows.reduce((a, r) => a + pf(r.valor), 0)
  const paSum = paRows.reduce((a, r) => a + pf(r.valor), 0)
  const totalDados = spSum + stSum + pvSum + paSum

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <p className="text-sm font-medium text-primary">Análise da empresa</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          Descubra o impacto da <span className="text-gradient-gold">Reforma Tributária</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Preencha os dados da empresa, escolha o ano-base e importe ou insira os dados fiscais para uma análise completa.
        </p>
      </motion.div>

      {step !== 'calculando' && step !== 'resultado' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
          <Stepper current={stepIndex} />
        </motion.div>
      )}

      <AnimatePresence mode="wait">

        {/* ─── STEP 1: Empresa ─── */}
        {step === 'empresa' && (
          <motion.div key="empresa" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm">
              <form onSubmit={handleEmpresaNext}>
                <div className="flex flex-col gap-6">

                  {/* Identificação */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold">Identificação da empresa</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-sm font-medium">Razão Social <span className="text-destructive">*</span></label>
                        <input required value={company.razaoSocial} onChange={e => setCompany(c => ({ ...c, razaoSocial: e.target.value }))}
                          placeholder="Minha Empresa LTDA"
                          className="h-10 w-full rounded-xl border border-input bg-secondary/40 px-4 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">CNPJ</label>
                        <input value={company.cnpj} onChange={e => setCompany(c => ({ ...c, cnpj: e.target.value }))}
                          placeholder="00.000.000/0001-00"
                          className="h-10 w-full rounded-xl border border-input bg-secondary/40 px-4 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Estado (UF)</label>
                        <select value={company.uf} onChange={e => setCompany(c => ({ ...c, uf: e.target.value }))}
                          className="h-10 w-full rounded-xl border border-input bg-secondary/40 px-4 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30">
                          {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Setor</label>
                        <select value={company.setor} onChange={e => setCompany(c => ({ ...c, setor: e.target.value }))}
                          className="h-10 w-full rounded-xl border border-input bg-secondary/40 px-4 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30">
                          {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Regime tributário */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold">Regime tributário</p>
                    </div>
                    <RegimeSelector value={company.regime} onChange={handleRegimeChange} />
                  </div>

                  {/* Ano Base */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
                        <BarChart3 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Ano-base da análise</p>
                        <p className="text-xs text-muted-foreground mt-0.5">A reforma é implementada gradualmente até 2033</p>
                      </div>
                    </div>
                    <AnoBaseSelector value={anoBase} onChange={setAnoBase} />
                  </div>

                  {/* Margem de lucro */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold">Análise de rentabilidade</p>
                    </div>
                    <MargemSection
                      enabled={incluirMargem}
                      onToggle={() => setMargem(m => !m)}
                      value={margemLucro}
                      onChange={setMargemLucro}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button type="submit"
                      className="btn-shine glow-gold flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground">
                      Continuar para dados fiscais
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </form>
            </SpotlightCard>
          </motion.div>
        )}

        {/* ─── STEP 2: Dados fiscais ─── */}
        {step === 'dados' && (
          <motion.div key="dados" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <div className="flex flex-col gap-6">

              {/* Tab bar */}
              <div className="flex gap-1 overflow-x-auto border-b border-border -mb-px">
                {DATA_TABS.map(tab => (
                  <button key={tab.id} onClick={() => setDataTab(tab.id)}
                    className={cn(
                      'whitespace-nowrap shrink-0 pb-3 px-3 text-xs font-medium border-b-2 -mb-px transition-colors',
                      dataTab === tab.id
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Import tab */}
              {dataTab === 'importar' && (
                <motion.div key="importar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                  <FileImportZone onImport={handleFileImport} importing={importing} />
                  {importMsg && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border p-4 text-sm',
                        importMsg.type === 'success'
                          ? 'border-success/30 bg-success/10 text-success'
                          : 'border-destructive/30 bg-destructive/10 text-destructive',
                      )}>
                      {importMsg.type === 'success'
                        ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                        : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                      <span>{importMsg.text}</span>
                    </motion.div>
                  )}
                  {importMsg?.type === 'success' && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: 'Serv. Prestados', count: spRows.filter(r => r.faturamento).length },
                        { label: 'Serv. Tomados',   count: stRows.filter(r => r.faturamento).length },
                        { label: 'Prod. Vendidos',  count: pvRows.filter(r => r.valor).length },
                        { label: 'Prod. Adquiridos',count: paRows.filter(r => r.valor).length },
                      ].map(item => (
                        <div key={item.label} className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-center">
                          <p className="text-xl font-bold text-primary">{item.count}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Serviços Prestados */}
              {dataTab === 'servicos_prestados' && (
                <motion.div key="sp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
                  <AnimatePresence>
                    {spRows.map((row, i) => (
                      <ServiceRowInput key={row.id} row={row}
                        onChange={r => setSpRows(rows => rows.map((x, j) => j === i ? r : x))}
                        onRemove={() => setSpRows(rows => rows.filter((_, j) => j !== i))} />
                    ))}
                  </AnimatePresence>
                  <button onClick={() => setSpRows(r => [...r, emptyService(company.regime)])}
                    className="flex h-9 items-center gap-2 self-start rounded-xl border border-dashed border-border px-4 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                    <Plus className="h-3.5 w-3.5" />Adicionar linha
                  </button>
                </motion.div>
              )}

              {/* Serviços Tomados */}
              {dataTab === 'servicos_tomados' && (
                <motion.div key="st" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
                  <AnimatePresence>
                    {stRows.map((row, i) => (
                      <ServiceRowInput key={row.id} row={row}
                        onChange={r => setStRows(rows => rows.map((x, j) => j === i ? r : x))}
                        onRemove={() => setStRows(rows => rows.filter((_, j) => j !== i))} />
                    ))}
                  </AnimatePresence>
                  <button onClick={() => setStRows(r => [...r, emptyService(company.regime)])}
                    className="flex h-9 items-center gap-2 self-start rounded-xl border border-dashed border-border px-4 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                    <Plus className="h-3.5 w-3.5" />Adicionar linha
                  </button>
                </motion.div>
              )}

              {/* Produtos Vendidos */}
              {dataTab === 'produtos_vendidos' && (
                <motion.div key="pv" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
                  <AnimatePresence>
                    {pvRows.map((row, i) => (
                      <ProductRowInput key={row.id} row={row}
                        onChange={r => setPvRows(rows => rows.map((x, j) => j === i ? r : x))}
                        onRemove={() => setPvRows(rows => rows.filter((_, j) => j !== i))} />
                    ))}
                  </AnimatePresence>
                  <button onClick={() => setPvRows(r => [...r, emptyProduct(company.regime)])}
                    className="flex h-9 items-center gap-2 self-start rounded-xl border border-dashed border-border px-4 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                    <Plus className="h-3.5 w-3.5" />Adicionar linha
                  </button>
                </motion.div>
              )}

              {/* Produtos Adquiridos */}
              {dataTab === 'produtos_adquiridos' && (
                <motion.div key="pa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
                  <AnimatePresence>
                    {paRows.map((row, i) => (
                      <ProductRowInput key={row.id} row={row}
                        onChange={r => setPaRows(rows => rows.map((x, j) => j === i ? r : x))}
                        onRemove={() => setPaRows(rows => rows.filter((_, j) => j !== i))} />
                    ))}
                  </AnimatePresence>
                  <button onClick={() => setPaRows(r => [...r, emptyProduct(company.regime)])}
                    className="flex h-9 items-center gap-2 self-start rounded-xl border border-dashed border-border px-4 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                    <Plus className="h-3.5 w-3.5" />Adicionar linha
                  </button>
                </motion.div>
              )}

              {/* Summary + Actions */}
              <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Volume total inserido</p>
                    <p className="mt-1 text-xl font-bold">{formatBRL(totalDados)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setStep('empresa'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
                      <ArrowLeft className="h-4 w-4" />Voltar
                    </button>
                    <button onClick={handleCalcular}
                      className="btn-shine glow-gold flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
                      <BarChart3 className="h-4 w-4" />Calcular análise
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </SpotlightCard>

            </div>
          </motion.div>
        )}

        {/* ─── CALCULANDO ─── */}
        {step === 'calculando' && (
          <motion.div key="calculando"
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
            <div className="relative h-20 w-20">
              <div className="absolute inset-0 rounded-full bg-primary/15 animate-ping" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent border border-primary/20">
                <Loader2 className="h-9 w-9 animate-spin text-primary" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Calculando…</p>
              <h2 className="mt-1.5 text-xl font-semibold">Processando os dados fiscais de</h2>
              <p className="text-xl font-bold text-gradient-gold mt-0.5">{company.razaoSocial}</p>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              {['Aplicando legislação da Reforma Tributária…', 'Calculando IBS e CBS…', 'Projetando cenários de transição…'].map((msg, i) => (
                <motion.p key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.6 + 0.3 }}>
                  {msg}
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── RESULTADO ─── */}
        {step === 'resultado' && (
          <motion.div key="resultado" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <ResultadoView
              company={company}
              anoBase={anoBase}
              incluirMargem={incluirMargem}
              margemLucro={margemLucro}
              spRows={spRows}
              stRows={stRows}
              pvRows={pvRows}
              paRows={paRows}
              onNovaAnalise={handleNovaAnalise}
              savedCompanies={savedCompanies}
              setSavedCompanies={setSaved}
            />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
