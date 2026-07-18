'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, ChevronDown, Search, FileDown, Maximize2 } from 'lucide-react'
import { R$, pct, fmtShort, sign } from '@/lib/admin-format'
import { GAIN, LOSS } from '@/lib/admin-colors'
import { normalizeSearch } from '@/lib/utils'
import type { DetalhesTecnicos } from '@/lib/admin-engine'

export type DrillFormat = 'currency' | 'currencyShort' | 'percent' | 'text' | 'delta' | 'pctPointDelta' | 'pctPointDeltaGain' | 'costDelta'

export interface DrillColumn {
  key: string
  label: string
  format?: DrillFormat
  /** Colunas de código/identificador (ex.: NCM) — mono simples, sem o zero cortado
   *  do font-tabular, que fica estranho numa sequência de dígitos como "02013000". */
  mono?: boolean
}

export interface DrillExtraItem {
  label: string
  value: string | number | undefined
  format?: DrillFormat
}

export interface DrillContent {
  title: string
  subtitle?: string
  accentColor?: string
  columns: DrillColumn[]
  rows: Array<Record<string, string | number | undefined>>
  /** Seção secundária colapsável — campos técnicos/de cauda longa da planilha original. */
  extra?: { title: string; items: DrillExtraItem[] }
  /** Painel mais largo — para tabelas com várias colunas numéricas + texto longo na primeira coluna. */
  wide?: boolean
}

// ─── Campos técnicos de cauda longa (DetalhesTecnicos) → lista label/valor ─────
// Usado por qualquer gráfico de NCM/produto para satisfazer "todos os campos da
// planilha aparecem em algum lugar", sem poluir a tabela principal do drill-down.

const DETALHES_LABELS: Array<[keyof DetalhesTecnicos, string, DrillFormat?]> = [
  ['desconto', 'Desconto', 'currency'],
  ['metodo', 'Método de cálculo'],
  ['custoDespesa', 'Custo/Despesa'],
  ['origem', 'Origem'],
  ['fornecedorIndustrial', 'Fornecedor industrial'],
  ['temCreditoIcms', 'Tem crédito ICMS'],
  ['temCreditoPisCofins', 'Tem crédito PIS/COFINS'],
  ['temCreditoIpi', 'Tem crédito IPI'],
  ['valorMovimentacaoContraria', 'Valor movimentação contrária', 'currency'],
  ['valorDepreciacao', 'Valor depreciação', 'currency'],
  ['descricaoAnexo', 'Descrição do anexo (Simples)'],
  ['anexo', 'Anexo (Simples)'],
  ['prestacao', 'Prestação de serviço'],
  ['cstIcms', 'CST ICMS'],
  ['cstIpi', 'CST IPI'],
  ['cstPis', 'CST PIS'],
  ['cstCofins', 'CST COFINS'],
  ['valorBrutoInput', 'Valor bruto (input)', 'currency'],
  ['aliqIcmsInput', 'Alíquota ICMS (input)', 'percent'],
  ['aliqIssInput', 'Alíquota ISS (input)', 'percent'],
  ['aliqIpiInput', 'Alíquota IPI (input)', 'percent'],
  ['aliqPisCofinsCreditarInput', 'Alíquota PIS/COFINS a creditar (input)', 'percent'],
  ['aliqPisCofinsDesonerarInput', 'Alíquota PIS/COFINS a desonerar (input)', 'percent'],
  ['aliqIcmsStInput', 'Alíquota ICMS-ST (input)', 'percent'],
  ['aliqIcmsDifalInput', 'Alíquota ICMS-DIFAL (input)', 'percent'],
  ['valorIcmsInput', 'Valor ICMS (input)', 'currency'],
  ['valorIcmsStInput', 'Valor ICMS-ST (input)', 'currency'],
  ['valorIcmsDifalInput', 'Valor ICMS-DIFAL (input)', 'currency'],
  ['valorIssInput', 'Valor ISS (input)', 'currency'],
  ['valorIpiInput', 'Valor IPI (input)', 'currency'],
  ['valorPisCofinsInput', 'Valor PIS/COFINS (input)', 'currency'],
  ['idInput', 'ID (input)'],
  ['dataCriacaoInput', 'Criado em (input)'],
  ['versaoInicialInput', 'Versão inicial'],
  ['versaoFinalInput', 'Versão final'],
  ['calculoId', 'ID do cálculo'],
  ['chaveValidacao', 'Chave de validação'],
  ['inputId', 'ID de referência do input'],
  ['idResultadoAr', 'ID resultado (antes)'],
  ['dataCriacaoResultadoAr', 'Criado em (resultado antes)'],
  ['idResultadoDr', 'ID resultado (depois)'],
  ['dataCriacaoResultadoDr', 'Criado em (resultado depois)'],
  ['anoDr', 'Ano (depois)'],
  ['anoNumDr', 'Ano numérico (depois)'],
  ['tipoInput', 'Tipo do input'],
]

export function buildDetalhesExtra(d?: DetalhesTecnicos): DrillExtraItem[] {
  if (!d) return []
  const items: DrillExtraItem[] = []
  for (const [key, label, format] of DETALHES_LABELS) {
    const value = d[key]
    if (value === undefined || value === '') continue
    items.push({ label, value, format })
  }
  return items
}

interface DrillDownContextValue {
  open: (content: DrillContent) => void
  close: () => void
}

const DrillDownContext = createContext<DrillDownContextValue | null>(null)

export function useDrillDown(): DrillDownContextValue {
  const ctx = useContext(DrillDownContext)
  if (!ctx) {
    // Fora do provider (ex.: preview isolado) — no-op seguro, nunca quebra o gráfico.
    return { open: () => {}, close: () => {} }
  }
  return ctx
}

// Mesma lógica de `formatValue`, mas em texto puro — usado no filtro de busca e na exportação em PDF.
function formatValuePlain(value: string | number | undefined, format?: DrillFormat): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'string') return value
  switch (format) {
    case 'currency': return R$(value)
    case 'currencyShort': return fmtShort(value)
    case 'percent': return pct(value)
    case 'delta': return `${value >= 0 ? '+' : ''}${R$(value)}`
    case 'pctPointDelta': return `${value > 0 ? '↑' : '↓'}${Math.abs(value).toFixed(1)}pp`
    case 'pctPointDeltaGain': return `${value >= 0 ? '↑' : '↓'}${Math.abs(value).toFixed(1)}pp`
    case 'costDelta': return `${sign(value)}${R$(value)}`
    default: return value.toLocaleString('pt-BR')
  }
}

async function loadLogoDataUrl(): Promise<{ dataUrl: string; ratio: number } | null> {
  try {
    const res = await fetch('/logo.png')
    const blob = await res.blob()
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const ratio: number = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img.naturalHeight / img.naturalWidth)
      img.onerror = reject
      img.src = dataUrl
    })
    return { dataUrl, ratio }
  } catch {
    return null
  }
}

// ─── Ordenação da tabela do drill-down ─────────────────────────────────────────
// Deriva as opções (alfabética / maior valor / maior variação) a partir dos
// formatos das colunas, então funciona igual em qualquer tabela `wide`.

interface SortOption { value: string; label: string }

function buildSortOptions(columns: DrillColumn[]): SortOption[] {
  const options: SortOption[] = [{ value: '', label: 'Padrão' }]
  const first = columns[0]
  if (first) options.push({ value: `alpha:${first.key}`, label: 'Ordem alfabética' })

  const valueCols = columns.filter(c => c.format === 'currency' || c.format === 'currencyShort' || c.format === 'percent')
  const valueCol = valueCols[valueCols.length - 1]
  if (valueCol) options.push({ value: `num:${valueCol.key}`, label: 'Maior valor' })

  const deltaCol = columns.find(c => c.format === 'delta' || c.format === 'pctPointDelta' || c.format === 'pctPointDeltaGain' || c.format === 'costDelta')
  if (deltaCol) options.push({ value: `abs:${deltaCol.key}`, label: 'Maior variação' })

  return options
}

function applySort(rows: DrillContent['rows'], sortValue: string): DrillContent['rows'] {
  if (!sortValue) return rows
  const [mode, key] = sortValue.split(':')
  const sorted = [...rows]
  if (mode === 'alpha') {
    sorted.sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'pt-BR'))
  } else if (mode === 'abs') {
    sorted.sort((a, b) => Math.abs(Number(b[key] ?? 0)) - Math.abs(Number(a[key] ?? 0)))
  } else if (mode === 'num') {
    sorted.sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0))
  }
  return sorted
}

function drillFilename(title: string, ext: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'relatorio'
  return `${slug}.${ext}`
}

// Mesmos valores formatados da tabela (e do PDF) — assim os três formatos de
// exportação sempre mostram exatamente o que a tela mostra.
function drillRowsAsRecords(content: DrillContent, rows: DrillContent['rows']): Record<string, string>[] {
  return rows.map(row => {
    const record: Record<string, string> = {}
    for (const c of content.columns) record[c.label] = formatValuePlain(row[c.key], c.format)
    return record
  })
}

export async function exportDrillXLSX(content: DrillContent, rows: DrillContent['rows']) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(drillRowsAsRecords(content, rows))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  XLSX.writeFile(wb, drillFilename(content.title, 'xlsx'))
}

export async function exportDrillCSV(content: DrillContent, rows: DrillContent['rows']) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(drillRowsAsRecords(content, rows))
  const csv = XLSX.utils.sheet_to_csv(ws)
  // BOM pra Excel abrir acentos (UTF-8) corretamente no Windows.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = drillFilename(content.title, 'csv')
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportDrillPDF(content: DrillContent, rows: DrillContent['rows']) {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = autoTableModule.default
  const doc = new jsPDF({ orientation: content.wide ? 'landscape' : 'portrait', unit: 'mm' })
  const pageWidth = doc.internal.pageSize.getWidth()

  const logo = await loadLogoDataUrl()
  let cursorY = 14
  if (logo) {
    const w = 14
    doc.addImage(logo.dataUrl, 'PNG', 14, cursorY - 6, w, w * logo.ratio)
  }
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Reforma NextGen', logo ? 32 : 14, cursorY)
  cursorY += 8
  doc.setFontSize(12)
  doc.text(content.title, 14, cursorY)
  cursorY += 6
  if (content.subtitle) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120)
    doc.text(content.subtitle, 14, cursorY)
    cursorY += 5
  }
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, cursorY)
  cursorY += 4

  autoTable(doc, {
    startY: cursorY,
    head: [content.columns.map(c => c.label)],
    body: rows.map(row => content.columns.map(c => formatValuePlain(row[c.key], c.format))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [20, 20, 22], textColor: 255 },
    columnStyles: { 0: { halign: 'left' } },
    theme: 'grid',
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index > 0) data.cell.styles.halign = 'right'
    },
    margin: { left: 14, right: 14 },
    tableWidth: pageWidth - 28,
  })

  doc.save(drillFilename(content.title, 'pdf'))
}

function formatValue(value: string | number | undefined, format?: DrillFormat): React.ReactNode {
  if (value === undefined || value === null || value === '') return <span className="text-foreground/20">—</span>
  if (typeof value === 'string') return value
  switch (format) {
    case 'currency': return R$(value)
    case 'currencyShort': return fmtShort(value)
    case 'percent': return pct(value)
    case 'delta': return (
      <span style={{ color: value >= 0 ? GAIN : LOSS }}>{value >= 0 ? '+' : ''}{R$(value)}</span>
    )
    // Ponto percentual onde aumento é ruim (ex.: carga tributária) — inverso do 'delta' de R$.
    case 'pctPointDelta': return (
      <span className="font-semibold" style={{ color: value > 0 ? LOSS : GAIN }}>
        {value > 0 ? '↑' : '↓'}{Math.abs(value).toFixed(1)}pp
      </span>
    )
    // Ponto percentual onde aumento é bom (ex.: margem de contribuição) — inverso do 'pctPointDelta'.
    case 'pctPointDeltaGain': return (
      <span className="font-semibold" style={{ color: value >= 0 ? GAIN : LOSS }}>
        {value >= 0 ? '↑' : '↓'}{Math.abs(value).toFixed(1)}pp
      </span>
    )
    // Delta de R$ onde aumento é ruim (ex.: custo/despesa) — inverso do 'delta' padrão.
    case 'costDelta': return (
      <span style={{ color: value <= 0 ? GAIN : LOSS }}>{value >= 0 ? '+' : ''}{R$(value)}</span>
    )
    default: return value.toLocaleString('pt-BR')
  }
}

// ─── Menu de exportação (PDF / Excel / CSV) ────────────────────────────────────

type ExportFormat = 'pdf' | 'xlsx' | 'csv'

const EXPORT_OPTIONS: Array<{ format: ExportFormat; label: string }> = [
  { format: 'pdf', label: 'PDF' },
  { format: 'xlsx', label: 'Excel (.xlsx)' },
  { format: 'csv', label: 'CSV' },
]

async function runExport(format: ExportFormat, content: DrillContent, rows: DrillContent['rows']) {
  if (format === 'pdf') await exportDrillPDF(content, rows)
  else if (format === 'xlsx') await exportDrillXLSX(content, rows)
  else await exportDrillCSV(content, rows)
}

function ExportMenu({ content, rows, iconOnly = false }: { content: DrillContent; rows: DrillContent['rows']; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  async function handle(format: ExportFormat, e: React.MouseEvent) {
    e.stopPropagation()
    setOpen(false)
    setExporting(format)
    try {
      await runExport(format, content, rows)
    } catch (err) {
      console.error(err)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        disabled={!!exporting}
        title="Exportar"
        className={iconOnly
          ? 'flex h-6 w-6 items-center justify-center rounded-md text-foreground/30 transition hover:bg-foreground/5 hover:text-primary disabled:opacity-50'
          : 'flex items-center gap-1.5 rounded-lg border border-border px-2.5 h-7 text-xs font-medium text-foreground/40 transition hover:border-foreground/20 hover:text-foreground disabled:opacity-50'}
      >
        <FileDown className="h-3.5 w-3.5" />
        {!iconOnly && (exporting ? 'Gerando…' : 'Exportar')}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
          {EXPORT_OPTIONS.map(o => (
            <button
              key={o.format}
              type="button"
              onClick={e => handle(o.format, e)}
              className="block w-full px-3 py-2 text-left text-xs text-foreground/70 transition hover:bg-foreground/5 hover:text-foreground"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DrillDownPanel({ content, onClose }: { content: DrillContent | null; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [sortValue, setSortValue] = useState('')

  useEffect(() => {
    if (!content) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [content, onClose])

  useEffect(() => { setQuery(''); setSortValue('') }, [content])

  const filterable = !!content && content.wide && content.rows.length > 5
  const sortOptions = useMemo(() => (content ? buildSortOptions(content.columns) : []), [content])

  const filteredRows = useMemo(() => {
    if (!content) return []
    const q = normalizeSearch(query.trim())
    const base = q
      ? content.rows.filter(row => content.columns.some(c => normalizeSearch(formatValuePlain(row[c.key], c.format)).includes(q)))
      : content.rows
    return applySort(base, sortValue)
  }, [content, query, sortValue])

  return (
    <AnimatePresence>
      {content && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed left-1/2 top-1/2 z-[91] ${content.wide ? 'w-[min(95vw,960px)]' : 'w-[min(92vw,720px)]'} max-h-[80vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl`}
          >
            <div
              className="flex items-start justify-between gap-4 border-b border-border px-5 py-4"
              style={content.accentColor ? { borderLeft: `3px solid ${content.accentColor}` } : undefined}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{content.title}</p>
                {content.subtitle && <p className="mt-0.5 text-xs text-foreground/40">{content.subtitle}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ExportMenu content={content} rows={filteredRows} />
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-foreground/40 transition hover:border-foreground/20 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {filterable && (
              <div className="flex items-center gap-2 border-b border-border px-5 py-2.5">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/25" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Filtrar..."
                    className="w-full rounded-lg border border-border bg-foreground/[0.02] py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/20"
                  />
                </div>
                {sortOptions.length > 1 && (
                  <select
                    value={sortValue}
                    onChange={e => setSortValue(e.target.value)}
                    className="shrink-0 rounded-lg border border-border bg-foreground/[0.02] py-1.5 pl-2.5 pr-7 text-xs text-foreground outline-none focus:border-foreground/20"
                  >
                    {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </div>
            )}
            <div className="max-h-[calc(80vh-64px)] overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-foreground/[0.015] sticky top-0">
                    {content.columns.map((c, i) => (
                      <th
                        key={c.key}
                        className={`px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-foreground/30 whitespace-nowrap ${i === 0 ? 'text-left' : 'text-right'}`}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr><td colSpan={content.columns.length} className="px-4 py-8 text-center text-sm text-foreground/25">{content.rows.length === 0 ? 'Sem dados de detalhe.' : 'Nenhum resultado para o filtro.'}</td></tr>
                  ) : filteredRows.map((row, i) => (
                    <tr key={i} className={`border-b border-border ${i % 2 === 1 ? 'bg-foreground/[0.01]' : ''}`}>
                      {content.columns.map((c, ci) => (
                        <td
                          key={c.key}
                          title={ci === 0 ? String(row[c.key] ?? '') : undefined}
                          className={`px-4 py-2.5 text-xs ${c.mono ? 'font-mono' : 'font-tabular'} ${ci === 0 ? 'max-w-[280px] truncate text-left text-foreground font-medium' : 'whitespace-nowrap text-right text-foreground/60'}`}
                        >
                          {formatValue(row[c.key], c.format)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {content.extra && content.extra.items.length > 0 && (
                <details className="border-t border-border group">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-medium text-foreground/40 hover:text-foreground/70 transition">
                    {content.extra.title}
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-4 pb-4 space-y-1.5">
                    {content.extra.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-4 text-xs">
                        <span className="text-foreground/35">{it.label}</span>
                        <span className="text-foreground/60 font-tabular text-right">{formatValue(it.value, it.format)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Linha "Ver mais" reutilizável ─────────────────────────────────────────────
// Mesmo botão de abrir o drill-down `wide`, com atalhos de busca e exportação em
// PDF já visíveis fora do modal — evita repetir os três botões em cada gráfico.

export function DrillMoreRow({ content, label, className = '' }: { content: DrillContent; label: string; className?: string }) {
  const { open } = useDrillDown()

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => open(content)}
        className="flex items-center gap-1.5 text-xs font-medium text-foreground/40 transition-colors hover:text-primary"
      >
        {label}
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => open(content)}
        title="Buscar"
        className="flex h-6 w-6 items-center justify-center rounded-md text-foreground/30 transition hover:bg-foreground/5 hover:text-primary"
      >
        <Search className="h-3.5 w-3.5" />
      </button>
      <ExportMenu content={content} rows={content.rows} iconOnly />
    </div>
  )
}

export function DrillDownProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<DrillContent | null>(null)

  const open = useCallback((c: DrillContent) => setContent(c), [])
  const close = useCallback(() => setContent(null), [])

  return (
    <DrillDownContext.Provider value={{ open, close }}>
      {children}
      <DrillDownPanel content={content} onClose={close} />
    </DrillDownContext.Provider>
  )
}
