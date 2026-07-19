'use client'

import { useEffect, useRef, useState, useMemo, useCallback, createContext, useContext, type RefObject } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  RefreshCw, FileDown, ChevronDown, ChevronUp, Building2,
  FileSpreadsheet, ArrowDown, ArrowUp, Minus,
  ShoppingCart, TrendingUp, TrendingDown, BarChart3, Waves, Scale,
  Layers, ArrowLeft, ArrowRight,
  Globe,
  Share2, Printer, CheckCircle, Landmark, Send, MessageSquareText,
  Boxes, Calculator,
} from 'lucide-react'
import { motion, AnimatePresence, useInView } from 'motion/react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import type {
  AdminReportV2, CompraCategoria, VendaCategoria, DRELinha, FluxoLinha, RegimeComparacao,
} from '@/lib/admin-engine'
import { comprasInsight, vendasInsight, vendasImpactoInsight, dreInsight, fluxoInsight, DRE_ANOS_LIST, chaveCompra, chaveVenda } from '@/lib/admin-engine'
import { ComprasCharts } from '@/components/admin/compras-charts'
import { VendasCharts } from '@/components/admin/vendas-charts'
import { MercadoCharts } from '@/components/admin/mercado-charts'
import { PriceSimulator } from '@/components/admin/price-simulator'
import { ImpactoProduto } from '@/components/admin/impacto-produto'
import { CompraCategoriaCharts, VendaCategoriaCharts } from '@/components/admin/categoria-charts'
import { MercadologicaBlock } from '@/components/admin/mercadologica-charts'
import { EstruturaMercadologicaImpacto, ProdutosMaisImpactadosCards, ProdutosMaisAfetadosMercadologica } from '@/components/admin/estrutura-mercadologica-impacto'
import { DreProduto } from '@/components/admin/dre-produto'
import { TributoCharts } from '@/components/admin/tributo-charts'
import { DREProjectionChart, FluxoProjectionChart } from '@/components/admin/projection-charts'
import { SimplesCharts } from '@/components/admin/simples-charts'
import { AmbientConsentPrompt } from '@/components/admin/ambient-consent-prompt'
import { DrillDownProvider, useDrillDown } from '@/components/admin/drill-down'
import { ClickableTick } from '@/components/admin/clickable-tick'
import { Explain, ExplainRow } from '@/components/admin/explain-tooltip'
import { R$, pct, sign, fmtShort, makeFmt } from '@/lib/admin-format'
import { GAIN, LOSS, ChartTooltip, ACTIVE_BAR } from '@/lib/admin-colors'
import { CreateClientLoginModal } from '@/components/admin/create-client-login-modal'
import { ReportCommentsPanel, type FocusSectionRequest } from '@/components/report-comments-panel'

// ─── Ampliação automática em telas grandes (ex.: apresentar num segundo monitor) ──
// O conteúdo do slide é desenhado numa largura de referência de 1440px (mesma do
// max-w do container). Em viewports mais largos que isso sobra espaço vazio nas
// laterais e o texto (pensado pra caber nesses 1440px) fica pequeno demais pra
// apresentar numa tela grande — em vez de redesenhar cada card, escalamos o bloco
// inteiro via transform, preservando o layout/medições internas dos gráficos
// (que dependem de ResizeObserver e quebram com a propriedade CSS `zoom`).
const REPORT_SCALE_THRESHOLD = 1600
const REPORT_MAX_SCALE = 1.4

function computeReportScale(viewportWidth: number): number {
  if (viewportWidth <= REPORT_SCALE_THRESHOLD) return 1
  return Math.min(REPORT_MAX_SCALE, viewportWidth / REPORT_SCALE_THRESHOLD)
}

function useReportPresentationScale(contentRef: RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1)
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null)

  useEffect(() => {
    function update() { setScale(computeReportScale(window.innerWidth)) }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setNaturalHeight(entries[0].contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [contentRef])

  return { scale, naturalHeight }
}

// ─── Clipboard (com fallback pra contexto inseguro, ex: IP puro em HTTP) ──────

async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch { /* cai no fallback abaixo */ }
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, format, className = '' }: {
  value: number
  format?: (v: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const fmt = useMemo(() => format ?? makeFmt(value), [format, value])
  const [display, setDisplay] = useState(fmt(0))

  useEffect(() => {
    if (!inView) return
    const duration = 1800
    const start = performance.now()
    let raf: number

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplay(fmt(value * ease))
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value])

  return <span ref={ref} className={className}>{display}</span>
}

// ─── Nav item type ────────────────────────────────────────────────────────────

interface NavItem { id: string; label: string; icon: React.ReactNode }

// ─── FadeUp ───────────────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Executive Summary ────────────────────────────────────────────────────────

interface ExecProps {
  report: AdminReportV2
  comprasDiff: number; comprasPct: number
  vendasDiff: number; vendasPct: number
  dreData: { diffRS: number; diffPct: number } | null
  fluxoData: { diffRS: number; diffPct: number } | null
  anoSelecionado: number | null
  anosDisponiveis: { ano: number; reportId: number }[]
  onChangeAno: (ano: number) => void
  trocandoAno: boolean
  textos: Record<string, string>
}

const ANO_ATUAL = 2026

// Quantas colunas de 4 (breakpoint lg) o card de ano preenche — o resto do espaço vazio
// que sobra ao lado dos cards de KPI quando há menos de 4 métricas na tela. Classes
// estáticas (não interpoladas) pro Tailwind JIT conseguir detectar em build.
const ANO_CARD_COL_SPAN: Record<number, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
}

function ExecutiveSummary({ report, comprasDiff, comprasPct, vendasDiff, vendasPct, dreData, fluxoData, anoSelecionado, anosDisponiveis, onChangeAno, trocandoAno, textos }: ExecProps) {
  const { open } = useDrillDown()
  const netGood = (dreData?.diffRS ?? (comprasDiff < 0 ? 1 : -1)) > 0 || comprasDiff < 0

  // Indicadores operacionais — volumes, não julgamento de ganho/perda, por isso sem GAIN/LOSS.
  const qtdeFornecedores = report.comprasFornecedores.length
  const qtdeClientes = report.vendasClientes.length
  const vendasCount = report.vendasCount ?? 0
  const totalVendasARLocal = report.vendas.reduce((s, v) => s + v.valorAR, 0)
  const ticketMedio = vendasCount > 0 ? totalVendasARLocal / vendasCount : 0
  const fmtInt = (v: number) => Math.round(v).toLocaleString('pt-BR')
  const temOperacao = qtdeFornecedores > 0 || vendasCount > 0 || qtdeClientes > 0

  const metrics = [
    report.compras.length > 0 && {
      label: 'Custo de Compras',
      // Custo caindo é economia real pro cliente (verde); custo subindo é alerta (vermelho).
      title: comprasDiff < 0 ? (textos['kpi.compras.bom'] ?? 'Economia Real') : (textos['kpi.compras.ruim'] ?? 'Mais Imposto'),
      value: comprasDiff,
      pctV: comprasPct,
      good: comprasDiff < 0,
      suffixGood: 'de economia',
      suffixBad: 'a mais de custo',
      icon: <ShoppingCart className="h-4 w-4" />,
    },
    report.vendas.length > 0 && {
      label: 'Receita de Vendas',
      title: vendasDiff > 0 ? (textos['kpi.vendas.bom'] ?? 'Vendas em Alta') : (textos['kpi.vendas.ruim'] ?? 'Vendas em Queda'),
      value: vendasDiff,
      pctV: vendasPct,
      good: vendasDiff > 0,
      suffixGood: 'a mais em vendas',
      suffixBad: 'a menos em vendas',
      icon: <TrendingUp className="h-4 w-4" />,
    },
    dreData && {
      label: 'Lucro Líquido',
      title: dreData.diffRS > 0 ? 'Lucro Maior' : 'Lucro Menor',
      value: dreData.diffRS,
      pctV: dreData.diffPct,
      good: dreData.diffRS > 0,
      suffixGood: 'de lucro a mais',
      suffixBad: 'de lucro a menos',
      icon: <BarChart3 className="h-4 w-4" />,
    },
    fluxoData && {
      label: 'Fluxo de Caixa',
      title: fluxoData.diffRS >= 0 ? 'Caixa Mais Forte' : 'Caixa Mais Apertado',
      value: fluxoData.diffRS,
      pctV: fluxoData.diffPct,
      good: fluxoData.diffRS >= 0,
      suffixGood: 'de caixa a mais',
      suffixBad: 'de caixa a menos',
      icon: <Waves className="h-4 w-4" />,
    },
  ].filter(Boolean) as Array<{ label: string; title: string; value: number; pctV: number; good: boolean; suffixGood: string; suffixBad: string; icon: React.ReactNode }>

  // Explicação conceitual ("o que é isso"), mostrada em hover de 3s — diferente do
  // drill-down no clique, que mostra de onde veio o número na planilha.
  const METRIC_EXPLAIN: Record<string, string> = {
    'Custo de Compras': 'Compara o custo total das suas compras hoje (2026) com o custo recalculado no ano selecionado, considerando a troca de ICMS/PIS-COFINS por IBS/CBS.',
    'Receita de Vendas': 'Compara a receita das suas vendas hoje (2026) com a receita recalculada no ano selecionado — mesmo volume de vendas, tributação diferente.',
    'Lucro Líquido': 'Compara o lucro líquido da sua DRE antes e depois da Reforma, já somando o efeito da mudança de custos e de receitas juntos.',
    'Fluxo de Caixa': 'Mostra como o resultado do seu fluxo de caixa muda com a Reforma, incluindo o efeito dos créditos e débitos tributários de IBS/CBS.',
  }

  const labelDepois = `Depois da Reforma${anoSelecionado ? ` (${anoSelecionado})` : ''}`

  // Ao clicar no card, mostra a quebra por categoria vinda direto da planilha
  // importada — a mesma fonte usada para compor o número resumido no card.
  function abrirDrillMetric(label: string) {
    if (label === 'Custo de Compras') {
      open({
        title: 'Custo de Compras — de onde vem esse número',
        subtitle: `${report.compras.length} categoria${report.compras.length !== 1 ? 's' : ''} da planilha de compras importada`,
        accentColor: comprasDiff < 0 ? GAIN : LOSS,
        columns: [
          { key: 'categoria', label: 'Categoria' },
          { key: 'custoAR', label: 'Antes da Reforma', format: 'currency' },
          { key: 'custoDR', label: labelDepois, format: 'currency' },
        ],
        rows: report.compras.map(c => ({ categoria: c.categoria, custoAR: c.custoAR, custoDR: c.custoDR })),
      })
    } else if (label === 'Receita de Vendas') {
      open({
        title: 'Receita de Vendas — de onde vem esse número',
        subtitle: `${report.vendas.length} categoria${report.vendas.length !== 1 ? 's' : ''} da planilha de vendas importada`,
        accentColor: vendasDiff > 0 ? GAIN : LOSS,
        columns: [
          { key: 'categoria', label: 'Categoria' },
          { key: 'valorAR', label: 'Antes da Reforma', format: 'currency' },
          { key: 'valorDR', label: labelDepois, format: 'currency' },
        ],
        rows: report.vendas.map(v => ({ categoria: v.categoria, valorAR: v.valorAR, valorDR: v.valorDR })),
      })
    } else if (label === 'Lucro Líquido') {
      open({
        title: 'Lucro Líquido — de onde vem esse número',
        subtitle: `${report.dre.length} linha${report.dre.length !== 1 ? 's' : ''} da DRE calculada a partir da planilha`,
        accentColor: (dreData?.diffRS ?? 0) > 0 ? GAIN : LOSS,
        columns: [
          { key: 'categoria', label: 'Categoria' },
          { key: 'ar', label: 'Antes da Reforma', format: 'currency' },
          { key: 'diffRS', label: 'Variação', format: 'currency' },
          { key: 'diffPct', label: '%', format: 'percent' },
        ],
        rows: report.dre.map(d => ({ categoria: d.categoria, ar: d.ar, diffRS: d.diffRS, diffPct: d.diffPct })),
      })
    } else if (label === 'Fluxo de Caixa') {
      open({
        title: 'Fluxo de Caixa — de onde vem esse número',
        subtitle: `${report.fluxo.length} linha${report.fluxo.length !== 1 ? 's' : ''} do fluxo de caixa calculado a partir da planilha`,
        accentColor: (fluxoData?.diffRS ?? 0) >= 0 ? GAIN : LOSS,
        columns: [
          { key: 'categoria', label: 'Categoria' },
          { key: 'ar', label: 'Antes da Reforma', format: 'currency' },
          { key: 'dr', label: labelDepois, format: 'currency' },
        ],
        rows: report.fluxo.map(f => ({ categoria: f.categoria, ar: f.ar, dr: f.dr })),
      })
    }
  }

  return (
    <section id="summary" className="space-y-10 py-4">
      {/* Ticker header */}
      <FadeUp>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-none text-foreground font-tabular">
              {textos['hero.titulo'] ? textos['hero.titulo'] : <>Impacto da <span className={netGood ? 'text-gain' : 'text-loss'}>Reforma</span></>}
            </h1>
            <p className="mt-3 text-sm text-foreground/35">
              {report.empresa.empresa && <span className="text-foreground/60 font-medium">{report.empresa.empresa} · </span>}
              {textos['hero.subtitulo'] ?? 'Análise comparativa antes/depois da Reforma Tributária'}
            </p>
          </div>
        </div>
      </FadeUp>

      {/* KPI hero cards — o card de ano ocupa o espaço vazio ao lado quando sobram
          colunas (menos de 4 métricas), em vez de ficar numa faixa própria acima. */}
      {(metrics.length > 0 || anosDisponiveis.length > 0) && (
        <FadeUp delay={0.08}>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {metrics.map((m, i) => {
              const c = m.good ? GAIN : LOSS
              return (
                <Explain key={m.label} text={METRIC_EXPLAIN[m.label] ?? m.label} className="block h-full">
                  <motion.button
                    type="button"
                    onClick={() => abrirDrillMetric(m.label)}
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="group relative flex min-h-[200px] w-full cursor-pointer flex-col overflow-hidden rounded-3xl border p-6 text-left sm:p-8"
                    style={{
                      borderColor: `${c}4D`,
                      background: `radial-gradient(140% 140% at 0% 0%, ${c}26, transparent 70%)`,
                      boxShadow: `0 24px 60px -32px ${c}66`,
                    }}
                  >
                    <div
                      className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
                      style={{ background: 'rgba(8,8,10,0.88)', color: c, border: `1px solid ${c}55` }}
                    >
                      {m.icon}
                      {m.title}
                    </div>
                    <p className="mt-6 text-4xl sm:text-5xl font-black tracking-tight font-tabular" style={{ color: c }}>
                      {m.value < 0 ? '▼' : '▲'}{' '}
                      <AnimatedNumber value={Math.abs(m.pctV)} format={v => `${v.toFixed(1)}%`} />
                    </p>
                    <p className="mt-3 text-xs text-foreground/40 font-tabular">
                      <AnimatedNumber value={Math.abs(m.value)} format={makeFmt(m.value)} />
                      {' '}{m.good ? m.suffixGood : m.suffixBad}
                    </p>
                  </motion.button>
                </Explain>
              )
            })}
            {anosDisponiveis.length > 0 && (
              <Explain
                text='O "Ano Atual" é sempre 2026, usado como base "antes da reforma". O seletor "Depois da Reforma" troca qual ano da transição (2026 a 2033) o sistema usa pra calcular o "depois" — cada ano tem uma fatia diferente de IBS/CBS já em vigor, seguindo o cronograma oficial da LC 214/2025.'
                className={`col-span-2 block h-full ${
                  ANO_CARD_COL_SPAN[Math.min(4, metrics.length >= 4 ? 4 : Math.max(1, 4 - metrics.length))]
                }`}
              >
              <div className="flex h-full min-h-[200px] flex-col justify-between gap-5 rounded-3xl border border-border bg-card/40 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-foreground/45">Ano Atual</span>
                    <span className="flex h-14 items-center rounded-xl border border-border bg-foreground/5 px-5 text-2xl font-tabular font-black text-foreground sm:h-16 sm:text-3xl">
                      {ANO_ATUAL}
                    </span>
                  </div>
                  <ArrowRight className="mt-6 h-6 w-6 shrink-0 text-foreground/25" />
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-primary">{textos['anoCard.titulo'] ?? 'Depois da Reforma'}</span>
                    <select
                      value={anoSelecionado ?? ''}
                      onChange={e => onChangeAno(Number(e.target.value))}
                      disabled={trocandoAno}
                      className="h-14 rounded-xl border-2 border-primary/40 bg-primary/10 px-5 text-2xl font-tabular font-black text-primary outline-none transition disabled:opacity-50 sm:h-16 sm:text-3xl"
                    >
                      {anosDisponiveis.map(a => (
                        <option key={a.ano} value={a.ano} className="bg-popover text-foreground">{a.ano}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-foreground/50">
                  {textos['anoCard.descricao'] ?? 'O sistema sempre usa o ano atual (2026) como base "antes da reforma". Escolha em qual ano da transição (2026 a 2033) você quer ver o "depois" — todo o dashboard passa a refletir os dados reais importados daquele ano.'}
                </p>
              </div>
              </Explain>
            )}
          </div>
        </FadeUp>
      )}

      {/* Operational stats — volume, sem julgamento de ganho/perda */}
      {temOperacao && (
        <FadeUp delay={0.11}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {qtdeFornecedores > 0 && (
              <div className="rounded-xl border border-border bg-foreground/[0.025] p-4">
                <p className="mb-3 text-[10px] uppercase tracking-widest text-foreground/25">Fornecedores</p>
                <p className="text-2xl font-bold text-foreground font-tabular">
                  <AnimatedNumber value={qtdeFornecedores} format={fmtInt} />
                </p>
                <p className="mt-1 text-xs text-foreground/30">fornecedores distintos nas compras</p>
              </div>
            )}
            {vendasCount > 0 && (
              <div className="rounded-xl border border-border bg-foreground/[0.025] p-4">
                <p className="mb-3 text-[10px] uppercase tracking-widest text-foreground/25">Notas/Cupons Emitidos</p>
                <p className="text-2xl font-bold text-foreground font-tabular">
                  <AnimatedNumber value={vendasCount} format={fmtInt} />
                </p>
                <p className="mt-1 text-xs text-foreground/30">movimentação de vendas no período</p>
              </div>
            )}
            {vendasCount > 0 && (
              <div className="rounded-xl border border-border bg-foreground/[0.025] p-4">
                <p className="mb-3 text-[10px] uppercase tracking-widest text-foreground/25">Ticket Médio</p>
                <p className="text-2xl font-bold text-foreground font-tabular">
                  <AnimatedNumber value={ticketMedio} />
                </p>
                <p className="mt-1 text-xs text-foreground/30">vendas ÷ notas/cupons emitidos</p>
              </div>
            )}
            {(qtdeClientes > 0 || vendasCount > 0) && (
              <div className="rounded-xl border border-border bg-foreground/[0.025] p-4">
                <p className="mb-3 text-[10px] uppercase tracking-widest text-foreground/25">
                  {qtdeClientes > 0 ? 'Clientes' : 'Cupons Emitidos'}
                </p>
                <p className="text-2xl font-bold text-foreground font-tabular">
                  <AnimatedNumber value={qtdeClientes > 0 ? qtdeClientes : vendasCount} format={fmtInt} />
                </p>
                <p className="mt-1 text-xs text-foreground/30">
                  {qtdeClientes > 0 ? 'clientes distintos nas vendas' : 'vendas por cupom fiscal, sem cliente identificado'}
                </p>
              </div>
            )}
          </div>
        </FadeUp>
      )}

      {/* Trend charts */}
      {(report.dre.length > 0 || report.fluxo.length > 0) && (
        <FadeUp delay={0.14}>
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
            {report.dre.length > 0 && <DREProjectionChart dre={report.dre} />}
            {report.fluxo.length > 0 && <FluxoProjectionChart fluxo={report.fluxo} />}
          </div>
        </FadeUp>
      )}

      {/* Category snapshot (always available when compras/vendas exist) */}
      {(report.compras.length > 0 || report.vendas.length > 0) && (
        <FadeUp delay={0.18}>
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
            {report.compras.length > 0 && (
              <ArDrBarChart
                title="Custo de Compras — Antes vs Depois"
                invert
                data={report.compras.map(c => ({ categoria: c.categoria, AR: c.custoAR, DR: c.custoDR }))}
                ano={anoSelecionado}
                explain="Prévia por categoria — veja o detalhe completo na tela Compras."
              />
            )}
            {report.vendas.length > 0 && (
              <ArDrBarChart
                title="Receita de Vendas — Antes vs Depois"
                data={report.vendas.map(v => ({ categoria: v.categoria, AR: v.valorAR, DR: v.valorDR }))}
                ano={anoSelecionado}
                explain="Prévia por categoria — veja o detalhe completo na tela Vendas."
              />
            )}
          </div>
        </FadeUp>
      )}
    </section>
  )
}

// ─── Metric Pair ─────────────────────────────────────────────────────────────

interface MetricPairProps {
  labelAR: string; labelDR: string
  valueAR: number; valueDR: number
  delta: number; deltaPct: number
  goodWhenNegativeDelta?: boolean
  /** Força a paleta (ignora o julgamento bom/ruim) — usado quando a métrica em si
   * tem identidade fixa, ex.: custo de compras é sempre despesa (vermelho). */
  forceColor?: 'gain' | 'loss'
  /** Ano "depois da reforma" selecionado — aparece no rótulo do card DR quando disponível. */
  ano?: number | null
  /** Explicação conceitual mostrada em hover de 3s — ver Explain. */
  explain?: string
}

function MetricPair({ labelAR, labelDR, valueAR, valueDR, delta, deltaPct, goodWhenNegativeDelta = false, forceColor, ano, explain }: MetricPairProps) {
  const isGood = goodWhenNegativeDelta ? delta < 0 : delta > 0
  const isNeutral = Math.abs(delta) < 0.01
  const colorGood = forceColor ? forceColor === 'gain' : isGood

  const content = (
      <div className="flex flex-col sm:flex-row items-stretch gap-4 mt-4 mb-8">
        {/* AR */}
        <div className="flex-1 rounded-2xl border border-border bg-foreground/[0.025] p-6">
          <p className="text-[10px] text-foreground/30 uppercase tracking-[0.12em] mb-2">Antes da Reforma</p>
          <p className="text-xs text-foreground/45 mb-1.5">{labelAR}</p>
          <p className="text-2xl font-bold text-foreground font-tabular">
            <AnimatedNumber value={valueAR} />
          </p>
        </div>

        {/* Delta */}
        <div className="flex sm:flex-col items-center justify-center gap-3 px-2 sm:px-0">
          <div className={`rounded-2xl border px-5 py-3 text-center ${
            isNeutral  ? 'border-border bg-foreground/5'
            : colorGood ? 'border-gain/35 bg-gain/15'
            :             'border-loss/35 bg-loss/15'
          }`}>
            <div className={`flex items-center justify-center gap-2 mb-1 ${
              isNeutral ? 'text-foreground/40' : colorGood ? 'text-gain' : 'text-loss'
            }`}>
              {isNeutral ? <Minus className="h-4 w-4" /> : isGood ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
              <span className="text-lg font-bold font-tabular">
                <AnimatedNumber value={Math.abs(delta)} />
              </span>
            </div>
            <p className={`text-xs font-semibold font-tabular ${
              isNeutral ? 'text-foreground/30' : colorGood ? 'text-gain' : 'text-loss'
            }`}>
              {sign(deltaPct)}{Math.abs(deltaPct).toFixed(2)}%
            </p>
          </div>
        </div>

        {/* DR */}
        <div className={`flex-1 rounded-2xl border p-6 ${
          isNeutral  ? 'border-border bg-foreground/[0.025]'
          : colorGood ? 'border-gain/30 bg-gradient-to-br from-gain/14 to-gain/4'
          :             'border-loss/30 bg-gradient-to-br from-loss/14 to-loss/4'
        }`}>
          <p className="text-[10px] text-foreground/30 uppercase tracking-[0.12em] mb-2">Depois da Reforma{ano ? ` (${ano})` : ''}</p>
          <p className={`text-xs mb-1.5 ${isNeutral ? 'text-foreground/45' : colorGood ? 'text-gain/80' : 'text-loss/80'}`}>{labelDR}</p>
          <p className={`text-2xl font-bold font-tabular ${
            isNeutral ? 'text-foreground' : colorGood ? 'text-gain' : 'text-loss'
          }`}>
            <AnimatedNumber value={valueDR} />
          </p>
        </div>
      </div>
  )

  return (
    <FadeUp delay={0.05}>
      {explain ? <Explain text={explain} className="block">{content}</Explain> : content}
    </FadeUp>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

interface CommentsMeta {
  counts: Record<string, number>
  onOpen: (sectionId: string) => void
}
const CommentsMetaContext = createContext<CommentsMeta | null>(null)

function SectionHeader({ num, title, subtitle, sectionId, explain }: { num: string; title: string; subtitle?: string; sectionId?: string; explain?: string }) {
  const commentsMeta = useContext(CommentsMetaContext)
  const count = sectionId ? commentsMeta?.counts[sectionId] ?? 0 : 0

  const heading = (
    <div>
      <p className="text-[10px] text-foreground/20 font-tabular tracking-[0.2em] uppercase mb-2">{num}</p>
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-none">{title}</h2>
      {subtitle && (
        <p className="mt-2 text-sm text-foreground/35 max-w-2xl leading-relaxed">{subtitle}</p>
      )}
    </div>
  )

  return (
    <FadeUp>
      <div className="pt-1 pb-1 flex items-start justify-between gap-4">
        {explain ? <Explain text={explain} className="block w-fit">{heading}</Explain> : heading}
        {sectionId && commentsMeta && (
          <button
            onClick={() => commentsMeta.onOpen(sectionId)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              count > 0
                ? 'border-primary/25 bg-primary/5 text-primary hover:bg-primary/10'
                : 'border-border text-foreground/35 hover:border-foreground/20 hover:text-foreground/60'
            }`}
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            {count > 0 ? count : 'Comentar'}
          </button>
        )}
      </div>
    </FadeUp>
  )
}

// ─── Section Divider ─────────────────────────────────────────────────────────

function SectionDivider() {
  return <div className="my-10 h-px w-full bg-gradient-to-r from-transparent via-white/6 to-transparent" />
}

// ─── Insight Bullet ──────────────────────────────────────────────────────────

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
      <p className="text-sm leading-relaxed text-foreground/55">{children}</p>
    </div>
  )
}

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>
}

// ─── Collapsible Table ────────────────────────────────────────────────────────

function CollapsibleTable({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-popover">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-foreground/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge && (
            <span className="rounded-md border border-border bg-foreground/5 px-2 py-0.5 text-xs text-foreground/35">{badge}</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-foreground/25" /> : <ChevronDown className="h-4 w-4 text-foreground/25" />}
      </button>
      {open && <div className="border-t border-border">{children}</div>}
    </div>
  )
}

// ─── AR vs DR bar chart (reused by Compras/Vendas) ─────────────────────────────

function ArDrBarChart({ data, title, invert = false, forceColor, ano, explain }: {
  data: { categoria: string; AR: number; DR: number }[]
  title: string
  invert?: boolean
  /** Força a paleta (ignora se DR está melhor ou pior que AR) — ex.: custo de
   * compras é sempre despesa (vermelho), independente de ter caído ou subido. */
  forceColor?: 'gain' | 'loss'
  ano?: number | null
  explain?: string
}) {
  const { open } = useDrillDown()

  function corLinha(d: { AR: number; DR: number }) {
    if (forceColor) return forceColor === 'gain' ? GAIN : LOSS
    return (invert ? d.DR <= d.AR : d.DR >= d.AR) ? GAIN : LOSS
  }

  function abrirDetalhe(d: { categoria: string; AR: number; DR: number }) {
    open({
      title: d.categoria,
      accentColor: corLinha(d),
      columns: [
        { key: 'lado', label: '' },
        { key: 'valor', label: 'Valor', format: 'currency' },
      ],
      rows: [
        { lado: 'Antes', valor: d.AR },
        { lado: 'Depois', valor: d.DR },
      ],
    })
  }

  return (
    <div className="rounded-xl border border-border bg-foreground/[0.02] p-4">
      {explain ? (
        <Explain text={explain} className="block w-fit">
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">{title}</p>
        </Explain>
      ) : (
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={Math.max(140, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--foreground) 4%, transparent)" horizontal={false} />
          <XAxis type="number" tickFormatter={v => fmtShort(v)} tick={{ fill: 'color-mix(in srgb, var(--foreground) 25%, transparent)', fontSize: 10 }} axisLine={false} tickLine={false} className="font-tabular" />
          <YAxis type="category" dataKey="categoria" width={110} axisLine={false} tickLine={false} tick={<ClickableTick onSelect={i => abrirDetalhe(data[i])} fontSize={11} />} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }} />
          <Bar
            dataKey="AR"
            name="Antes"
            fill="color-mix(in srgb, var(--foreground) 22%, transparent)"
            background={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)', radius: 3 }}
            radius={[0, 3, 3, 0]}
            barSize={9}
            cursor="pointer"
            activeBar={ACTIVE_BAR}
            onClick={(d: { payload?: { categoria: string; AR: number; DR: number } }) => d.payload && abrirDetalhe(d.payload)}
          />
          <Bar
            dataKey="DR"
            name={ano ? `Depois (${ano})` : 'Depois'}
            radius={[0, 3, 3, 0]}
            barSize={9}
            cursor="pointer"
            activeBar={ACTIVE_BAR}
            background={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}
            onClick={(d: { payload?: { categoria: string; AR: number; DR: number } }) => d.payload && abrirDetalhe(d.payload)}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={corLinha(d)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Compras Table ────────────────────────────────────────────────────────────

function ComprasSection({ compras, ano, comprasPorAno }: { compras: CompraCategoria[]; ano?: number | null; comprasPorAno?: Record<number, CompraCategoria[]> }) {
  const { open } = useDrillDown()
  const anosOrdenados = useMemo(() => Object.keys(comprasPorAno ?? {}).map(Number).sort((a, b) => a - b), [comprasPorAno])
  const totals: CompraCategoria = {
    categoria: 'Total',
    valorAR: compras.reduce((s, c) => s + c.valorAR, 0),
    impostosAR: compras.reduce((s, c) => s + c.impostosAR, 0),
    valorDesonerado: compras.reduce((s, c) => s + c.valorDesonerado, 0),
    custoAR: compras.reduce((s, c) => s + c.custoAR, 0),
    custoEfetivoARPct: 0,
    creditoAR: compras.reduce((s, c) => s + c.creditoAR, 0),
    cargaTributariaARPct: 0,
    valorDR: compras.reduce((s, c) => s + c.valorDR, 0),
    impostosDR: compras.reduce((s, c) => s + c.impostosDR, 0),
    custoDR: compras.reduce((s, c) => s + c.custoDR, 0),
    custoEfetivoDRPct: 0,
    creditoDR: compras.reduce((s, c) => s + c.creditoDR, 0),
  }
  if (totals.valorAR > 0) {
    totals.custoEfetivoARPct = (totals.custoAR / totals.valorAR) * 100
    totals.cargaTributariaARPct = (totals.impostosAR / totals.valorAR) * 100
    totals.custoEfetivoDRPct = totals.valorDR > 0 ? (totals.custoDR / totals.valorDR) * 100 : 0
  }

  const { diff, pct: pctVal } = comprasInsight(compras)
  const isReduction = diff < 0
  const th = 'px-3 py-2.5 text-right text-xs font-medium text-foreground/25 whitespace-nowrap'
  const td = 'px-3 py-3 text-right text-sm text-foreground/55 whitespace-nowrap tabular-nums'
  const tdb = 'px-3 py-3 text-right text-sm font-semibold text-foreground whitespace-nowrap tabular-nums'

  function abrirDetalheCompra(c: CompraCategoria) {
    const anosRows = anosOrdenados.map(a => ({
      metrica: `Custo DR — ${a}`,
      ar: undefined,
      dr: comprasPorAno?.[a]?.find(r => r.categoria === c.categoria)?.custoDR,
    }))
    open({
      title: c.categoria,
      accentColor: LOSS,
      columns: [
        { key: 'metrica', label: 'Métrica' },
        { key: 'ar', label: 'Antes', format: 'currency' },
        { key: 'dr', label: 'Depois', format: 'currency' },
      ],
      rows: [
        { metrica: 'Valor', ar: c.valorAR, dr: c.valorDR },
        { metrica: 'Impostos', ar: c.impostosAR, dr: c.impostosDR },
        { metrica: 'Desonerado', ar: c.valorDesonerado, dr: undefined },
        { metrica: 'Custo', ar: c.custoAR, dr: c.custoDR },
        { metrica: '% Custo', ar: pct(c.custoEfetivoARPct), dr: pct(c.custoEfetivoDRPct) },
        { metrica: 'Crédito', ar: c.creditoAR, dr: c.creditoDR },
        { metrica: '% Carga', ar: pct(c.cargaTributariaARPct), dr: undefined },
        ...anosRows,
      ],
    })
  }

  function Row({ c, isTotal }: { c: CompraCategoria; isTotal?: boolean }) {
    const cells = (
      <>
        <td className="px-3 py-3 text-sm font-medium text-foreground whitespace-nowrap">{c.categoria}</td>
        <td className={td}>{R$(c.valorAR)}</td>
        <td className="px-3 py-3 text-right text-sm text-loss/65 whitespace-nowrap tabular-nums">{R$(c.impostosAR)}</td>
        <td className={td}>{R$(c.valorDesonerado)}</td>
        <td className={isTotal ? tdb : td}>{R$(c.custoAR)}</td>
        <td className={td}>{pct(c.custoEfetivoARPct)}</td>
        <td className="px-3 py-3 text-right text-sm text-gain/65 whitespace-nowrap tabular-nums">{R$(c.creditoAR)}</td>
        <td className={td}>{pct(c.cargaTributariaARPct)}</td>
        <td className={td}>{R$(c.valorDR)}</td>
        <td className="px-3 py-3 text-right text-sm text-loss/65 whitespace-nowrap tabular-nums">{R$(c.impostosDR)}</td>
        <td className={isTotal ? `${tdb} text-loss` : `${td} text-loss/80`}>{R$(c.custoDR)}</td>
        <td className={td}>{pct(c.custoEfetivoDRPct)}</td>
        <td className="px-3 py-3 text-right text-sm text-gain/65 whitespace-nowrap tabular-nums">{R$(c.creditoDR)}</td>
      </>
    )
    if (isTotal) return <tr className="border-b border-border bg-foreground/[0.025]">{cells}</tr>
    return (
      <ExplainRow
        text="Clique na linha pra ver o detalhe completo desta categoria: valor, impostos, custo e crédito, antes e depois da reforma."
        className="border-b border-border"
        onClick={() => abrirDetalheCompra(c)}
      >
        {cells}
      </ExplainRow>
    )
  }

  return (
    <FadeUp delay={0.1} className="space-y-6">
      <div className="space-y-3">
        <Bullet>
          O preço de compra sofre uma <Highlight>{isReduction ? 'redução' : 'aumento'}</Highlight> de{' '}
          <Highlight>{R$(Math.abs(diff))}</Highlight>, variação de <Highlight>{pct(Math.abs(pctVal))}</Highlight>
        </Bullet>
        <Bullet>
          Seu custo {isReduction ? 'reduz' : 'aumenta'} em <Highlight>{R$(Math.abs(diff))}</Highlight>{' '}
          representando uma variação de <Highlight>{pct(Math.abs(pctVal))}</Highlight>
        </Bullet>
      </div>
      <ArDrBarChart
        title="Custo por Categoria — Antes vs Depois"
        invert
        data={compras.map(c => ({ categoria: c.categoria, AR: c.custoAR, DR: c.custoDR }))}
        ano={ano}
        explain="Clique numa barra pra ver o valor exato de cada lado. Barra verde = custo caiu com a Reforma; vermelha = subiu."
      />
      <CollapsibleTable title={`Detalhes por Categoria${ano ? ` · DR = Depois da Reforma (${ano})` : ''}`}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-foreground/[0.015]">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-foreground/25">Categoria</th>
                {['Valor AR','Impostos AR','Desonerado','Custo AR','% Custo AR','Crédito AR','% Carga AR','Valor DR','Impostos DR','Custo DR','% Custo DR','Crédito DR'].map(h => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compras.map((c, i) => <Row key={i} c={c} />)}
              <Row c={totals} isTotal />
            </tbody>
          </table>
        </div>
      </CollapsibleTable>
    </FadeUp>
  )
}

// ─── Vendas Table ─────────────────────────────────────────────────────────────

function VendasSection({ vendas, ano, vendasPorAno }: { vendas: VendaCategoria[]; ano?: number | null; vendasPorAno?: Record<number, VendaCategoria[]> }) {
  const { open } = useDrillDown()
  const anosOrdenados = useMemo(() => Object.keys(vendasPorAno ?? {}).map(Number).sort((a, b) => a - b), [vendasPorAno])
  const totals: VendaCategoria = {
    categoria: 'Total',
    valorAR: vendas.reduce((s, v) => s + v.valorAR, 0),
    impostosAR: vendas.reduce((s, v) => s + v.impostosAR, 0),
    debitoAR: vendas.reduce((s, v) => s + v.debitoAR, 0),
    valorDesonerado: vendas.reduce((s, v) => s + v.valorDesonerado, 0),
    cargaTributariaARPct: 0,
    valorDR: vendas.reduce((s, v) => s + v.valorDR, 0),
    impostosDR: vendas.reduce((s, v) => s + v.impostosDR, 0),
    debitoDR: vendas.reduce((s, v) => s + v.debitoDR, 0),
    cargaTributariaDRPct: 0,
  }
  if (totals.valorAR > 0) {
    totals.cargaTributariaARPct = (totals.impostosAR / totals.valorAR) * 100
    totals.cargaTributariaDRPct = totals.valorDR > 0 ? (totals.impostosDR / totals.valorDR) * 100 : 0
  }

  const { diff, pct: pctVal } = vendasInsight(vendas)
  const isReduction = diff < 0
  const th = 'px-3 py-2.5 text-right text-xs font-medium text-foreground/25 whitespace-nowrap'
  const td = 'px-3 py-3 text-right text-sm text-foreground/55 whitespace-nowrap tabular-nums'

  function abrirDetalheVenda(v: VendaCategoria) {
    const anosRows = anosOrdenados.map(a => ({
      metrica: `Valor DR — ${a}`,
      ar: undefined,
      dr: vendasPorAno?.[a]?.find(r => r.categoria === v.categoria)?.valorDR,
    }))
    open({
      title: v.categoria,
      accentColor: v.valorDR >= v.valorAR ? GAIN : LOSS,
      columns: [
        { key: 'metrica', label: 'Métrica' },
        { key: 'ar', label: 'Antes', format: 'currency' },
        { key: 'dr', label: 'Depois', format: 'currency' },
      ],
      rows: [
        { metrica: 'Valor', ar: v.valorAR, dr: v.valorDR },
        { metrica: 'Impostos', ar: v.impostosAR, dr: v.impostosDR },
        { metrica: 'Débito', ar: v.debitoAR, dr: v.debitoDR },
        { metrica: 'Desonerado', ar: v.valorDesonerado, dr: undefined },
        { metrica: '% Carga', ar: pct(v.cargaTributariaARPct), dr: pct(v.cargaTributariaDRPct) },
        ...anosRows,
      ],
    })
  }

  function Row({ v, isTotal }: { v: VendaCategoria; isTotal?: boolean }) {
    const cells = (
      <>
        <td className="px-3 py-3 text-sm font-medium text-foreground whitespace-nowrap">{v.categoria}</td>
        <td className={isTotal ? `${td} font-semibold text-foreground` : td}>{R$(v.valorAR)}</td>
        <td className="px-3 py-3 text-right text-sm text-loss/65 whitespace-nowrap tabular-nums">{R$(v.impostosAR)}</td>
        <td className="px-3 py-3 text-right text-sm text-chart-5/70 whitespace-nowrap tabular-nums">{R$(v.debitoAR)}</td>
        <td className={td}>{R$(v.valorDesonerado)}</td>
        <td className={td}>{pct(v.cargaTributariaARPct)}</td>
        <td className={isTotal ? `${td} font-semibold text-foreground` : td}>{R$(v.valorDR)}</td>
        <td className="px-3 py-3 text-right text-sm text-loss/65 whitespace-nowrap tabular-nums">{R$(v.impostosDR)}</td>
        <td className={td}>{R$(v.debitoDR)}</td>
        <td className={td}>{pct(v.cargaTributariaDRPct)}</td>
      </>
    )
    if (isTotal) return <tr className="border-b border-border bg-foreground/[0.025]">{cells}</tr>
    return (
      <ExplainRow
        text="Clique na linha pra ver o detalhe completo desta categoria: valor, impostos e débito, antes e depois da reforma."
        className="border-b border-border"
        onClick={() => abrirDetalheVenda(v)}
      >
        {cells}
      </ExplainRow>
    )
  }

  return (
    <FadeUp delay={0.1} className="space-y-6">
      <div className="space-y-3">
        <Bullet>
          O preço de venda sofre uma <Highlight>{isReduction ? 'redução' : 'aumento'}</Highlight> de{' '}
          <Highlight>{R$(Math.abs(diff))}</Highlight>, variação de <Highlight>{pct(Math.abs(pctVal))}</Highlight>
        </Bullet>
        {isReduction && (
          <Bullet>
            Seu cliente tem uma redução de <Highlight>{R$(Math.abs(diff))}</Highlight> no custo de compra
            e pode exigir preços menores para evitar repasse ao consumidor final
          </Bullet>
        )}
      </div>
      <ArDrBarChart
        title="Receita por Categoria — Antes vs Depois"
        data={vendas.map(v => ({ categoria: v.categoria, AR: v.valorAR, DR: v.valorDR }))}
        ano={ano}
        explain="Clique numa barra pra ver o valor exato de cada lado. Barra verde = receita subiu com a Reforma; vermelha = caiu."
      />
      <CollapsibleTable title={`Detalhes por Categoria${ano ? ` · DR = Depois da Reforma (${ano})` : ''}`} badge="Sem Ajuste">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-foreground/[0.015]">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-foreground/25">Categoria</th>
                {['Valor AR','Impostos AR','Débito AR','Desonerado','% Carga AR','Valor DR','Impostos DR','Débito DR','% Carga DR'].map(h => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendas.map((v, i) => <Row key={i} v={v} />)}
              <Row v={totals} isTotal />
            </tbody>
          </table>
        </div>
      </CollapsibleTable>
    </FadeUp>
  )
}

// ─── DRE Table ────────────────────────────────────────────────────────────────

function DRESection({ dre }: { dre: DRELinha[] }) {
  const { open } = useDrillDown()
  const insight = dreInsight(dre)
  const isGood = (insight?.diffRS ?? 0) > 0
  const th = 'px-3 py-2.5 text-right text-xs font-medium text-foreground/25 whitespace-nowrap'
  const td = 'px-3 py-3 text-right text-sm text-foreground/55 whitespace-nowrap tabular-nums'

  function abrirDetalheDRE(row: DRELinha) {
    open({
      title: row.categoria,
      subtitle: `AR: ${R$(row.ar)} · Ano Base: ${R$(row.anoBase)} · Diff: ${sign(row.diffRS)}${R$(row.diffRS)} (${sign(row.diffPct)}${pct(row.diffPct)})`,
      accentColor: row.diffRS >= 0 ? GAIN : LOSS,
      columns: [{ key: 'ano', label: 'Ano' }, { key: 'valor', label: 'Valor', format: 'currency' }],
      rows: DRE_ANOS_LIST.map(a => ({ ano: String(a), valor: row.anos[a] ?? 0 })),
    })
  }

  return (
    <FadeUp delay={0.1} className="space-y-6">
      {insight && (
        <Bullet>
          Seu Lucro Líquido <Highlight>{isGood ? 'aumentou' : 'diminuiu'}</Highlight> em{' '}
          <Highlight>{R$(Math.abs(insight.diffRS))}</Highlight> — você pode trabalhar o preço de venda
          em <Highlight>{pct(Math.abs(insight.diffPct))}</Highlight> para buscar mais competitividade
        </Bullet>
      )}
      <DREProjectionChart dre={dre} />
      <CollapsibleTable title="DRE Detalhada — Ano a Ano">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-foreground/[0.015]">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-foreground/25 whitespace-nowrap">Categoria</th>
                <th className={th}>AR</th>
                <th className={th}>Ano Base</th>
                <th className={th}>Diff R$</th>
                <th className={th}>Diff %</th>
                {DRE_ANOS_LIST.map(a => <th key={a} className={th}>{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {dre.map((row, i) => {
                const hl = ['Lucro Bruto', 'Lucro Antes', 'Lucro Líquido', 'Receita Bruta'].some(k => row.categoria.toLowerCase().includes(k.toLowerCase()))
                const isLL = row.categoria.toLowerCase().includes('líquido') || row.categoria.toLowerCase().includes('liquido')
                return (
                  <ExplainRow
                    key={i}
                    text="Clique na linha pra ver o valor projetado ano a ano (2026-2033) desta linha da DRE."
                    className={hl ? 'border-b border-border bg-foreground/[0.025]' : 'border-b border-border'}
                    onClick={() => abrirDetalheDRE(row)}
                  >
                    <td className={`px-3 py-3 text-sm whitespace-nowrap ${hl ? 'font-semibold text-foreground' : 'text-foreground/55'}`}>{row.categoria}</td>
                    <td className={`${td} ${hl ? 'font-semibold text-foreground' : ''}`}>{R$(row.ar)}</td>
                    <td className={`${td} ${hl ? 'font-semibold text-foreground' : ''}`}>{R$(row.anoBase)}</td>
                    <td className={`${td} font-semibold ${isLL ? (row.diffRS > 0 ? 'text-gain' : 'text-loss') : ''}`}>
                      {row.diffRS !== 0 ? `${sign(row.diffRS)}${R$(row.diffRS)}` : R$(0)}
                    </td>
                    <td className={`${td} ${row.diffPct > 0 ? 'text-gain' : row.diffPct < 0 ? 'text-loss' : ''}`}>
                      {row.diffPct !== 0 ? `${sign(row.diffPct)}${pct(row.diffPct)}` : '—'}
                    </td>
                    {DRE_ANOS_LIST.map(a => <td key={a} className="px-3 py-3 text-right text-xs text-foreground/35 whitespace-nowrap tabular-nums">{R$(row.anos[a] ?? 0)}</td>)}
                  </ExplainRow>
                )
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleTable>
    </FadeUp>
  )
}

// ─── Fluxo Section ────────────────────────────────────────────────────────────

function FluxoSection({ fluxo }: { fluxo: FluxoLinha[] }) {
  const { open } = useDrillDown()
  const insight = fluxoInsight(fluxo)
  const retencao = fluxo.find(f => f.categoria.toLowerCase().includes('resultado'))
  const th = 'px-3 py-2.5 text-right text-xs font-medium text-foreground/25 whitespace-nowrap'
  const td = 'px-3 py-3 text-right text-sm text-foreground/55 whitespace-nowrap tabular-nums'

  function abrirDetalheFluxo(row: FluxoLinha) {
    open({
      title: row.categoria,
      subtitle: `AR: ${R$(row.ar)} · DR: ${R$(row.dr)} · Diff: ${sign(row.diffRS)}${R$(row.diffRS)} (${sign(row.diffPct)}${pct(row.diffPct)})`,
      accentColor: row.diffRS >= 0 ? GAIN : LOSS,
      columns: [{ key: 'ano', label: 'Ano' }, { key: 'valor', label: 'Valor', format: 'currency' }],
      rows: DRE_ANOS_LIST.map(a => ({ ano: String(a), valor: row.anos[a] ?? 0 })),
    })
  }

  return (
    <FadeUp delay={0.1} className="space-y-6">
      {insight && (
        <div className="space-y-3">
          <Bullet>
            Seu caixa <Highlight>{insight.diffRS >= 0 ? 'aumentou' : 'diminuiu'}</Highlight> em{' '}
            <Highlight>{R$(Math.abs(insight.diffRS))}</Highlight>, impacto de{' '}
            <Highlight>{pct(Math.abs(insight.diffPct))}</Highlight>{' '}
            {insight.diffRS >= 0 ? 'positivo' : 'negativo'} no resultado.
          </Bullet>
          {retencao && (
            <Bullet>
              Capacidade de retenção de caixa {retencao.diffPct > 0 ? 'aumentou' : 'diminuiu'} em{' '}
              <Highlight>{pct(Math.abs(retencao.diffPct))}</Highlight>, equivalente a{' '}
              <Highlight>{R$(Math.abs(retencao.diffRS))}</Highlight>
            </Bullet>
          )}
        </div>
      )}
      <FluxoProjectionChart fluxo={fluxo} />
      <CollapsibleTable title="Fluxo de Caixa Detalhado">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-foreground/[0.015]">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-foreground/25 whitespace-nowrap">Categoria</th>
                <th className={th}>AR</th><th className={th}>DR</th>
                <th className={th}>Diff R$</th><th className={th}>Diff %</th>
                {DRE_ANOS_LIST.map(a => <th key={a} className={th}>{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {fluxo.map((row, i) => {
                const isRes = row.categoria.toLowerCase().includes('resultado')
                return (
                  <ExplainRow
                    key={i}
                    text="Clique na linha pra ver o valor projetado ano a ano (2026-2033) desta linha do Fluxo de Caixa."
                    className={isRes ? 'border-b border-border bg-foreground/[0.025]' : 'border-b border-border'}
                    onClick={() => abrirDetalheFluxo(row)}
                  >
                    <td className={`px-3 py-3 text-sm whitespace-nowrap ${isRes ? 'font-semibold text-foreground' : 'text-foreground/55'}`}>{row.categoria}</td>
                    <td className={`${td} ${isRes ? 'font-semibold text-foreground' : ''}`}>{R$(row.ar)}</td>
                    <td className={`${td} ${isRes ? 'font-semibold text-foreground' : ''}`}>{R$(row.dr)}</td>
                    <td className={`${td} font-semibold ${row.diffRS > 0 ? 'text-gain' : row.diffRS < 0 ? 'text-loss' : ''}`}>
                      {row.diffRS !== 0 ? `${sign(row.diffRS)}${R$(row.diffRS)}` : R$(0)}
                    </td>
                    <td className={`${td} ${row.diffPct > 0 ? 'text-gain' : row.diffPct < 0 ? 'text-loss' : ''}`}>
                      {row.diffPct !== 0 ? `${sign(row.diffPct)}${pct(row.diffPct)}` : '—'}
                    </td>
                    {DRE_ANOS_LIST.map(a => <td key={a} className="px-3 py-3 text-right text-xs text-foreground/35 whitespace-nowrap tabular-nums">{R$(row.anos[a] ?? 0)}</td>)}
                  </ExplainRow>
                )
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleTable>
    </FadeUp>
  )
}

// ─── Regime Section ───────────────────────────────────────────────────────────

function RegimeSection({ regimes }: { regimes: RegimeComparacao[] }) {
  const melhor = regimes.find(r => r.melhor)
  return (
    <FadeUp delay={0.1} className="space-y-6">
      {melhor && (
        <Explain text="Simulamos o mesmo movimento de compras/vendas nos regimes disponíveis (Lucro Real, Presumido, Simples) e comparamos o resultado depois de descontar Imposto de Renda e Contribuição Social — o regime com o maior resultado é o recomendado." className="block">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-primary/60 uppercase tracking-widest mb-1">Recomendação</p>
              <p className="text-foreground font-semibold">
                O melhor regime tributário para otimização é o{' '}
                <span className="text-primary">{melhor.regime}</span>
              </p>
              <p className="text-sm text-foreground/40 mt-1">
                Resultado Pós IR/CS: <span className="text-primary font-semibold">{R$(melhor.resultadoPosIRCS)}</span>
              </p>
            </div>
          </div>
        </Explain>
      )}
      <CollapsibleTable title="Comparativo de Regimes">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-foreground/[0.015]">
              {['Regime','Resultado Pós IR/CS','Tributos Crédito','Tributos Débito','Tributos Recolhidos'].map(h => (
                <th key={h} className={`px-5 py-3 ${h === 'Regime' ? 'text-left' : 'text-right'} text-xs font-medium text-foreground/25`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regimes.map((r, i) => (
              <ExplainRow
                key={i}
                text="Resultado Pós IR/CS já desconta Imposto de Renda e Contribuição Social. Tributos Crédito é o que você recupera; Débito é o que deve; Recolhidos é o saldo líquido pago."
                className={`border-b border-border ${r.melhor ? 'bg-primary/5' : ''}`}
              >
                <td className={`px-5 py-3 text-sm font-semibold ${r.melhor ? 'text-primary' : 'text-foreground'}`}>{r.regime}{r.melhor && ' ★'}</td>
                <td className={`px-5 py-3 text-right text-sm font-semibold tabular-nums ${r.melhor ? 'text-primary' : 'text-foreground/70'}`}>{R$(r.resultadoPosIRCS)}</td>
                <td className="px-5 py-3 text-right text-sm text-gain/75 tabular-nums">{R$(r.tributosCredito)}</td>
                <td className="px-5 py-3 text-right text-sm text-loss/75 tabular-nums">{R$(r.tributosDebito)}</td>
                <td className="px-5 py-3 text-right text-sm text-foreground/45 tabular-nums">{R$(r.tributosRecolhidos)}</td>
              </ExplainRow>
            ))}
          </tbody>
        </table>
      </CollapsibleTable>
    </FadeUp>
  )
}

// ─── PPTX Export ─────────────────────────────────────────────────────────────

async function exportPPTX(report: AdminReportV2) {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  const BG = '0a0a0b', GOLD = 'ffb400', WHITE = 'ffffff', GRAY = '888888', GREEN = '0ecb81', RED = 'f6465d'

  const fmtR = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
  const fmtP = (n: number) => `${n.toFixed(1)}%`
  const fmtS = (v: number): string => {
    const abs = Math.abs(v), prefix = v < 0 ? '-' : ''
    if (abs >= 1e6) return `${prefix}R$ ${(abs / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `${prefix}R$ ${(abs / 1e3).toFixed(1)}K`
    return `${prefix}R$ ${abs.toFixed(0)}`
  }

  const addSlide = (title: string) => {
    const s = pptx.addSlide()
    s.background = { color: BG }
    s.addText('Reforma NextGen', { x: 0.3, y: 0.2, w: 4, h: 0.3, color: GOLD, fontSize: 9, bold: true })
    s.addText(title, { x: 0.3, y: 0.55, w: 12, h: 0.5, color: WHITE, fontSize: 22, bold: true })
    s.addShape('rect' as Parameters<typeof s.addShape>[0], { x: 0.3, y: 1.0, w: 12.7, h: 0.03, fill: { color: GOLD } })
    return s
  }

  type Cell = { text: string; options: Record<string, unknown> }
  const TH = (text: string): Cell => ({ text, options: { bold: true, color: GOLD, fill: { color: '0d0d0f' } } })
  const TD = (text: string, color = WHITE): Cell => ({ text, options: { color } })
  const TOPT = { border: { type: 'solid' as const, pt: 0.5, color: '222225' }, fill: { color: '111113' }, color: WHITE, fontSize: 9, margin: 3 }

  // ── Cover ───────────────────────────────────────────────────────────────────
  const cover = pptx.addSlide()
  cover.background = { color: BG }
  cover.addText('Reforma NextGen', { x: 1, y: 1.5, w: 11, h: 1, color: GOLD, fontSize: 36, bold: true, align: 'center' })
  cover.addText('Análise de Impacto Tributário', { x: 1, y: 2.6, w: 11, h: 0.6, color: WHITE, fontSize: 20, align: 'center' })
  cover.addText(report.empresa.empresa || 'Relatório', { x: 1, y: 3.4, w: 11, h: 0.5, color: '999999', fontSize: 16, align: 'center' })
  cover.addText(`Período: ${report.empresa.periodo}  |  Regime: ${report.empresa.regime}`, { x: 1, y: 4.0, w: 11, h: 0.4, color: GRAY, fontSize: 12, align: 'center' })
  cover.addText(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, { x: 1, y: 4.5, w: 11, h: 0.3, color: '555555', fontSize: 10, align: 'center' })

  // ── Compras ──────────────────────────────────────────────────────────────────
  if (report.compras.length > 0) {
    const s = addSlide('Impacto nas Compras')
    const { diff, pct: pV } = comprasInsight(report.compras)
    s.addText(`O custo ${diff < 0 ? 'reduz' : 'aumenta'} em ${fmtR(Math.abs(diff))} (${Math.abs(pV).toFixed(2)}%)`, { x: 0.3, y: 1.2, w: 12, h: 0.4, color: diff < 0 ? GREEN : RED, fontSize: 14, bold: true })
    s.addTable([
      [TH('Categoria'), TH('Valor AR'), TH('Custo AR'), TH('Valor DR'), TH('Custo DR'), TH('Δ Custo')],
      ...report.compras.map(c => {
        const dc = c.custoDR - c.custoAR
        return [TD(c.categoria), TD(fmtR(c.valorAR)), TD(fmtR(c.custoAR)), TD(fmtR(c.valorDR)), TD(fmtR(c.custoDR)), TD((dc > 0 ? '+' : '') + fmtR(dc), dc <= 0 ? GREEN : RED)]
      }),
    ] as Parameters<typeof s.addTable>[0], { x: 0.3, y: 1.7, w: 12.5, colW: [3, 2, 2, 2, 2, 1.5], ...TOPT })
  }

  // ── Vendas ───────────────────────────────────────────────────────────────────
  if (report.vendas.length > 0) {
    const s = addSlide('Impacto nas Vendas')
    const { diff, pct: pV } = vendasInsight(report.vendas)
    s.addText(`O valor ${diff < 0 ? 'reduz' : 'aumenta'} em ${fmtR(Math.abs(diff))} (${Math.abs(pV).toFixed(2)}%)`, { x: 0.3, y: 1.2, w: 12, h: 0.4, color: diff >= 0 ? GREEN : RED, fontSize: 14, bold: true })
    s.addTable([
      [TH('Categoria'), TH('Valor AR'), TH('Impostos AR'), TH('Valor DR'), TH('Impostos DR'), TH('Δ Valor')],
      ...report.vendas.map(v => {
        const dv = v.valorDR - v.valorAR
        return [TD(v.categoria), TD(fmtR(v.valorAR)), TD(fmtR(v.impostosAR), RED), TD(fmtR(v.valorDR)), TD(fmtR(v.impostosDR), RED), TD((dv > 0 ? '+' : '') + fmtR(dv), dv >= 0 ? GREEN : RED)]
      }),
    ] as Parameters<typeof s.addTable>[0], { x: 0.3, y: 1.7, w: 12.5, colW: [3, 2, 2, 2, 2, 1.5], ...TOPT })
  }

  // ── DRE ──────────────────────────────────────────────────────────────────────
  if (report.dre.length > 0) {
    const s = addSlide('DRE — Demonstração de Resultado')
    s.addTable([
      [TH('Categoria'), TH('AR'), TH('Ano Base DR'), TH('Diff R$'), TH('Diff %'), TH('2026'), TH('2030'), TH('2033')],
      ...report.dre.map(d => [
        TD(d.categoria), TD(fmtR(d.ar)), TD(fmtR(d.anoBase)),
        TD((d.diffRS > 0 ? '+' : '') + fmtR(d.diffRS), d.diffRS > 0 ? GREEN : RED),
        TD((d.diffPct > 0 ? '+' : '') + d.diffPct.toFixed(2) + '%', d.diffPct > 0 ? GREEN : RED),
        TD(fmtR(d.anos[2026] ?? d.anoBase)), TD(fmtR(d.anos[2030] ?? d.anoBase)), TD(fmtR(d.anos[2033] ?? d.anoBase)),
      ]),
    ] as Parameters<typeof s.addTable>[0], { x: 0.3, y: 1.4, w: 12.5, colW: [2.5, 1.5, 1.5, 1.5, 1.2, 1.5, 1.5, 1.5], ...TOPT })
  }

  // ── Regime ───────────────────────────────────────────────────────────────────
  if (report.regimes.length > 0) {
    const s = addSlide('Melhor Regime Tributário')
    const melhor = report.regimes.find(r => r.melhor)
    if (melhor) s.addText(`Melhor regime: ${melhor.regime}`, { x: 0.3, y: 1.2, w: 12, h: 0.4, color: GOLD, fontSize: 16, bold: true })
    s.addTable([
      [TH('Regime'), TH('Resultado Pós IR/CS'), TH('Crédito'), TH('Débito'), TH('Recolhidos')],
      ...report.regimes.map(r => [
        TD(r.regime + (r.melhor ? ' ★' : ''), r.melhor ? GOLD : WHITE),
        TD(fmtR(r.resultadoPosIRCS), r.melhor ? GOLD : WHITE),
        TD(fmtR(r.tributosCredito), GREEN),
        TD(fmtR(r.tributosDebito), RED),
        TD(fmtR(r.tributosRecolhidos)),
      ]),
    ] as Parameters<typeof s.addTable>[0], { x: 0.3, y: 1.8, w: 12.5, colW: [3, 2.5, 2.5, 2.5, 2], ...TOPT })
  }

  // ── Fornecedores Simples ──────────────────────────────────────────────────────
  if (report.comprasSimples?.length) {
    const s = addSlide('Fornecedores Simples Nacional')
    s.addText('Fornecedores no Simples Nacional e participação nas compras', { x: 0.3, y: 1.2, w: 12, h: 0.3, color: GRAY, fontSize: 11 })
    const top = report.comprasSimples.slice(0, 10)
    s.addTable([
      [TH('Fornecedor'), TH('Volume AR'), TH('% Compras'), TH('NCMs principais')],
      ...top.map(r => [
        TD(r.nome || r.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '**.$2.$3/$4-**')),
        TD(fmtR(r.valorAR)),
        TD(fmtP(r.pctTotalCompras)),
        TD(r.ncms.slice(0, 4).map(n => n.ncm).join(', ')),
      ]),
    ] as Parameters<typeof s.addTable>[0], { x: 0.3, y: 1.6, w: 12.5, colW: [2.5, 2, 1.8, 6.2], ...TOPT })
    const mono = report.comprasNCM?.filter(n => n.isMonofasico) ?? []
    if (mono.length > 0) {
      s.addText(`⚠  ${mono.length} NCM(s) monofásico(s): ${mono.slice(0, 6).map(m => m.ncm).join(', ')}`, { x: 0.3, y: 6.5, w: 12.5, h: 0.4, color: 'f59e0b', fontSize: 10, italic: true })
    }
  }

  // ── Mercado B2B/B2C ───────────────────────────────────────────────────────────
  if (report.vendasB2C?.length || report.vendasRegime?.length) {
    const s = addSlide('Perfil de Mercado — B2B / B2C')
    if (report.vendasB2C?.length) {
      s.addText('Distribuição das Vendas por Perfil de Comprador', { x: 0.3, y: 1.2, w: 12, h: 0.3, color: GRAY, fontSize: 11, bold: true })
      const total = report.vendasB2C.reduce((acc, r) => acc + r.valorAR, 0)
      s.addTable([
        [TH('Perfil'), TH('Volume AR'), TH('% Receita'), TH('Carga AR'), TH('Carga DR'), TH('Δ Custo')],
        ...report.vendasB2C.map(r => [
          TD(r.tipo === 'B2B' ? 'B2B (Empresas/CNPJ)' : 'B2C (Consumidor/CPF)'),
          TD(fmtR(r.valorAR)),
          TD(total > 0 ? fmtP((r.valorAR / total) * 100) : '—'),
          TD(fmtP(r.cargaARPct)),
          TD(fmtP(r.cargaDRPct)),
          TD((r.diffCusto >= 0 ? '+' : '') + fmtR(r.diffCusto), r.diffCusto <= 0 ? GREEN : RED),
        ]),
      ] as Parameters<typeof s.addTable>[0], { x: 0.3, y: 1.6, w: 12.5, colW: [2.5, 2, 1.8, 1.8, 1.8, 2.6], ...TOPT })
    }
    if (report.vendasRegime?.length) {
      s.addText('Regime Tributário dos Clientes', { x: 0.3, y: 3.6, w: 6, h: 0.3, color: GRAY, fontSize: 11, bold: true })
      s.addTable([
        [TH('Regime do Cliente'), TH('Volume AR')],
        ...report.vendasRegime.map(r => [TD(r.regime), TD(fmtR(r.valorAR))]),
      ] as Parameters<typeof s.addTable>[0], { x: 0.3, y: 4.0, w: 5.5, colW: [3.5, 2], ...TOPT })
    }
  }

  // ── Categorias CFOP ───────────────────────────────────────────────────────────
  const allCats = [...(report.comprasCategorias?.map(r => ({ ...r, tipo: 'Compras' })) ?? []), ...(report.vendasCategorias?.map(r => ({ ...r, tipo: 'Vendas' })) ?? [])]
  if (allCats.length > 0) {
    const s = addSlide('Categorias de Operação — CFOP')
    s.addText('Quebra por tipo de operação derivada dos códigos CFOP', { x: 0.3, y: 1.2, w: 12, h: 0.3, color: GRAY, fontSize: 11 })
    s.addTable([
      [TH('Tipo'), TH('Categoria'), TH('Valor AR'), TH('Carga AR'), TH('Valor DR'), TH('Carga DR'), TH('Δ Carga'), TH('Impacto Custo')],
      ...allCats.map(r => {
        const diff = r.custoDR - r.custoAR
        const diffC = r.cargaDRPct - r.cargaARPct
        const isCompra = r.tipo === 'Compras'
        return [
          TD(r.tipo, isCompra ? '60a5fa' : '34d399'),
          TD(r.categoria),
          TD(fmtR(r.valorAR)),
          TD(fmtP(r.cargaARPct)),
          TD(fmtR(r.valorDR)),
          TD(fmtP(r.cargaDRPct)),
          TD((diffC > 0 ? '+' : '') + fmtP(diffC), diffC <= 0 ? GREEN : RED),
          TD((diff >= 0 ? '+' : '') + fmtS(diff), isCompra ? (diff <= 0 ? GREEN : RED) : (diff >= 0 ? GREEN : RED)),
        ]
      }),
    ] as Parameters<typeof s.addTable>[0], { x: 0.3, y: 1.6, w: 12.5, colW: [1.4, 2.1, 1.5, 1.2, 1.5, 1.2, 1.3, 2.3], ...TOPT })
  }

  // ── Simulador de Preço ────────────────────────────────────────────────────────
  if (report.simulador?.length) {
    const s = addSlide('Simulador de Preço por NCM')
    s.addText('Markup atual — projeção de resultado por ano da transição', { x: 0.3, y: 1.2, w: 12, h: 0.3, color: GRAY, fontSize: 11 })
    const top = report.simulador.slice(0, 8)
    const anoDe = (r: (typeof top)[number], ano: number) => r.projecao.find(p => p.ano === ano)?.resultado ?? 0
    s.addTable([
      [TH('NCM'), TH('Custo AR'), TH('Custo DR'), TH('Markup Atual'), TH('2027'), TH('2030'), TH('2033')],
      ...top.map(r => {
        return [
          TD(r.ncm),
          TD(fmtS(r.custoAR)),
          TD(fmtS(r.custoDR)),
          TD(fmtP(r.markupAtualPct)),
          TD(fmtR(anoDe(r, 2027)), anoDe(r, 2027) >= 0 ? GREEN : RED),
          TD(fmtR(anoDe(r, 2030)), anoDe(r, 2030) >= 0 ? GREEN : RED),
          TD(fmtR(anoDe(r, 2033)), anoDe(r, 2033) >= 0 ? GREEN : RED),
        ]
      }),
    ] as Parameters<typeof s.addTable>[0], { x: 0.3, y: 1.6, w: 12.5, colW: [1.7, 1.6, 1.6, 1.9, 1.8, 1.8, 2.1], ...TOPT })
  }

  // ── Impacto por Produto ───────────────────────────────────────────────────────
  {
    const vendasMap = new Map<string, (typeof report.vendasNCM)[0]>()
    for (const v of (report.vendasNCM ?? [])) vendasMap.set(chaveVenda(v), v)
    const impacts = (report.comprasNCM ?? [])
      .filter(c => vendasMap.has(chaveCompra(c)))
      .map(c => {
        const venda = vendasMap.get(chaveCompra(c))!
        const rev = venda.valorDR - venda.valorAR
        const cost = c.valorDR - c.valorAR
        return { ncm: c.ncm, netImpact: rev - cost, rev, cost }
      })
      .sort((a, b) => b.netImpact - a.netImpact)

    if (impacts.length > 0) {
      const s = addSlide('Impacto por Produto (NCM)')
      const totalNet = impacts.reduce((acc, r) => acc + r.netImpact, 0)
      s.addText(`Impacto líquido total: ${totalNet >= 0 ? '+' : ''}${fmtS(totalNet)}  |  ${impacts.length} NCMs analisados`, { x: 0.3, y: 1.2, w: 12, h: 0.35, color: totalNet >= 0 ? GREEN : RED, fontSize: 13, bold: true })
      const top5 = impacts.filter(r => r.netImpact > 0).slice(0, 5)
      const bot5 = [...impacts].reverse().filter(r => r.netImpact < 0).slice(0, 5)
      s.addText('+ Mais beneficiados em Margem Bruta', { x: 0.3, y: 1.7, w: 6, h: 0.3, color: GREEN, fontSize: 10, bold: true })
      s.addText('– Mais afetados em Margem Bruta', { x: 6.8, y: 1.7, w: 6, h: 0.3, color: RED, fontSize: 10, bold: true })
      if (top5.length > 0) {
        s.addTable([
          [TH('NCM'), TH('Δ Receita'), TH('Δ Custo'), TH('Impacto Líq.')],
          ...top5.map(r => [
            TD(r.ncm),
            TD((r.rev >= 0 ? '+' : '') + fmtS(r.rev), r.rev >= 0 ? GREEN : RED),
            TD((r.cost >= 0 ? '+' : '') + fmtS(r.cost), r.cost <= 0 ? GREEN : RED),
            TD('+' + fmtS(r.netImpact), GREEN),
          ]),
        ] as Parameters<typeof s.addTable>[0], { x: 0.3, y: 2.1, w: 6.2, colW: [1.6, 1.5, 1.5, 1.6], ...TOPT })
      }
      if (bot5.length > 0) {
        s.addTable([
          [TH('NCM'), TH('Δ Receita'), TH('Δ Custo'), TH('Impacto Líq.')],
          ...bot5.map(r => [
            TD(r.ncm),
            TD((r.rev >= 0 ? '+' : '') + fmtS(r.rev), r.rev >= 0 ? GREEN : RED),
            TD((r.cost >= 0 ? '+' : '') + fmtS(r.cost), r.cost <= 0 ? GREEN : RED),
            TD(fmtS(r.netImpact), RED),
          ]),
        ] as Parameters<typeof s.addTable>[0], { x: 6.8, y: 2.1, w: 6, colW: [1.5, 1.5, 1.5, 1.5], ...TOPT })
      }
    }
  }

  // ── DRE por Produto ───────────────────────────────────────────────────────────
  if (report.dreProduto?.length) {
    const s = addSlide('Resultado por Produto — Margem e Projeção 2026-2033')
    const avgAR = report.dreProduto.reduce((acc, r) => acc + r.margemBrutaARPct, 0) / report.dreProduto.length
    const avgDR = report.dreProduto.reduce((acc, r) => acc + r.margemBrutaDRPct, 0) / report.dreProduto.length
    const totalDiff = report.dreProduto.reduce((acc, r) => acc + r.diffResultado, 0)
    s.addText(`Margem média: AR ${fmtP(avgAR)} → DR ${fmtP(avgDR)}  |  Impacto total no resultado: ${totalDiff >= 0 ? '+' : ''}${fmtS(totalDiff)}`, { x: 0.3, y: 1.2, w: 12.5, h: 0.35, color: totalDiff >= 0 ? GREEN : RED, fontSize: 12, bold: true })
    const sorted = [...report.dreProduto].sort((a, b) => Math.abs(b.diffResultado) - Math.abs(a.diffResultado)).slice(0, 8)
    s.addTable([
      [TH('NCM'), TH('Receita AR'), TH('Custo AR'), TH('Margem AR'), TH('Resultado DR'), TH('Margem DR'), TH('Δ Resultado'), TH('Proj. 2033')],
      ...sorted.map(r => {
        const p33 = r.projecao.find(p => p.ano === 2033)
        return [
          TD(r.ncm),
          TD(fmtS(r.receitaAR)),
          TD(fmtS(r.custoAR)),
          TD(fmtP(r.margemBrutaARPct)),
          TD(fmtS(r.resultadoDR), r.resultadoDR >= r.resultadoAtual ? GREEN : RED),
          TD(fmtP(r.margemBrutaDRPct), r.margemBrutaDRPct >= r.margemBrutaARPct ? GREEN : RED),
          TD((r.diffResultado >= 0 ? '+' : '') + fmtS(r.diffResultado), r.diffResultado >= 0 ? GREEN : RED),
          TD(p33 ? fmtP(p33.margem) : '—', p33 && p33.margem >= r.margemBrutaARPct ? GREEN : RED),
        ]
      }),
    ] as Parameters<typeof s.addTable>[0], { x: 0.3, y: 1.65, w: 12.5, colW: [1.4, 1.4, 1.4, 1.5, 1.6, 1.5, 1.7, 1.5], ...TOPT })
  }

  await pptx.writeFile({ fileName: `relatorio-reforma-${report.empresa.empresa || 'empresa'}-${report.empresa.periodo}.pptx` })
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function ReportDashboard({
  reportData,
  publicMode = false,
  clientMode = false,
  reportId,
  logo,
}: {
  reportData?: AdminReportV2
  publicMode?: boolean
  clientMode?: boolean
  reportId?: number
  logo?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [report, setReport] = useState<AdminReportV2 | null>(reportData ?? null)
  const [loading, setLoading] = useState(!reportData)

  const [exporting, setExporting] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [sharing, setSharing] = useState(false)
  const [sendingToClient, setSendingToClient] = useState(false)
  const [sentToClient, setSentToClient] = useState(false)
  const [linkModal, setLinkModal] = useState<{ empresaId: number; empresaNome: string } | null>(null)
  const [fallbackSavedId, setFallbackSavedId] = useState<number | null>(null)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [focusSection, setFocusSection] = useState<FocusSectionRequest | null>(null)
  const openSectionComments = useCallback((sectionId: string) => {
    setFocusSection({ id: sectionId, nonce: Date.now() })
  }, [])
  const slideContentRef = useRef<HTMLDivElement>(null)
  const { scale: presentationScale, naturalHeight: presentationHeight } = useReportPresentationScale(slideContentRef)

  // ── Ano "depois da reforma" — cada admin_report já é um ano completo (AR + DR
  // daquele ano); trocar de ano é trocar QUAL relatório irmão da mesma empresa está
  // carregado, não fazer merge de campos. O "ano atual" é sempre 2026, fixo.
  const [anoSelecionado, setAnoSelecionado] = useState<number | null>(null)
  const [anosDisponiveis, setAnosDisponiveis] = useState<{ ano: number; reportId: number }[]>([])
  const [trocandoAno, setTrocandoAno] = useState(false)
  // DR ano a ano (2026-2033) por categoria de Compras/Vendas — reunido dos relatórios-irmãos
  // (ver categoriasPorAno em lib/projecao-real.ts), pro drill-down de "Detalhes por Categoria".
  const [comprasPorAno, setComprasPorAno] = useState<Record<number, CompraCategoria[]>>({})
  const [vendasPorAno, setVendasPorAno] = useState<Record<number, VendaCategoria[]>>({})
  // true assim que o ano "depois da reforma" default (2033) foi decidido — antes disso, o
  // relatório em tela é o inicial (normalmente ano-base 2026, AR≈DR), mostrar esses números
  // brevemente como se já fossem definitivos é o "vem vazio" que o usuário via: sem essa guarda,
  // o hero renderiza 0,0%/R$0 por um instante até o fetch de 2033 (carregarAno) terminar.
  const [anoResolvido, setAnoResolvido] = useState(false)
  // Textos editáveis por empresa (título/subtítulo do hero, card de ano, títulos dos KPIs) —
  // com fallback pro texto padrão hardcoded quando a empresa não tem override salvo.
  const [textos, setTextos] = useState<Record<string, string>>({})

  /** Busca e troca pro relatório de `alvo.ano`, atualizando `report` + `anoSelecionado` juntos —
   *  nunca só o label. Usada tanto pela troca manual (`trocarAno`) quanto pelo default automático
   *  (2033) no load inicial: sem isso, o seletor mostrava "2033" mas os dados continuavam sendo
   *  os do relatório inicial (normalmente o ano-base 2026, onde AR≈DR — "dados zerados" — já que
   *  o IBS/CBS praticamente não está implementado em 2026), até o usuário trocar de ano manualmente. */
  const carregarAno = useCallback(async (alvo: { ano: number; reportId: number }) => {
    setTrocandoAno(true)
    try {
      const res = await fetch(clientMode ? `/api/client/reports/${alvo.reportId}` : `/api/admin/reports?id=${alvo.reportId}`)
      const data = await res.json()
      if (data.report) {
        setReport(data.report as AdminReportV2)
        setAnoSelecionado(alvo.ano)
        if (!clientMode && !publicMode) router.replace(`/admin/relatorio?id=${alvo.reportId}`)
      }
    } finally {
      setTrocandoAno(false)
      setAnoResolvido(true)
    }
  }, [clientMode, publicMode, router])

  useEffect(() => {
    const empresaId = report?.empresa.empresaId
    if (!empresaId || publicMode) { setAnoResolvido(true); return }
    const base = clientMode ? '/api/client' : '/api/admin'
    // Manda o reportId do relatório aberto na tela — o servidor usa o lote dele pra escopar
    // "anos irmãos" só à MESMA análise, em vez de misturar reportIds de análises diferentes
    // da mesma empresa (era isso que fazia trocar de ano abrir dado de outra planilha).
    const refReportId = reportId ?? (searchParams.get('id') ? Number(searchParams.get('id')) : fallbackSavedId)
    const qs = refReportId ? `?reportId=${refReportId}` : ''
    fetch(`${base}/empresas/${empresaId}/anos${qs}`)
      .then(r => r.json())
      .then(data => {
        const anos = (data.anos ?? []) as { ano: number; reportId: number }[]
        setAnosDisponiveis(anos)
        setTextos(data.textos ?? {})
        setComprasPorAno(data.comprasPorAno ?? {})
        setVendasPorAno(data.vendasPorAno ?? {})
        if (anoSelecionado !== null) { setAnoResolvido(true); return }
        const alvo = anos.find(a => a.ano === 2033) ?? anos[anos.length - 1]
        if (!alvo) { setAnoResolvido(true); return }
        // Relatório inicial (reportData/refReportId) já É o ano-alvo — só rotula, sem refetch.
        if (alvo.reportId === refReportId) { setAnoSelecionado(alvo.ano); setAnoResolvido(true) }
        else carregarAno(alvo)
      })
      .catch(() => setAnoResolvido(true)) // sem anos irmãos — relatório antigo ou empresa sem outros imports
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.empresa.empresaId])

  const trocarAno = useCallback(async (ano: number) => {
    const alvo = anosDisponiveis.find(a => a.ano === ano)
    if (!alvo || trocandoAno) return
    await carregarAno(alvo)
  }, [anosDisponiveis, trocandoAno, carregarAno])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (reportData) return
    const queryId = searchParams.get('id')
    if (queryId) {
      fetch(`/api/admin/reports?id=${queryId}`)
        .then(r => r.json())
        .then(data => {
          if (data.report) { setReport(data.report as AdminReportV2); setSentToClient(!!data.meta?.visibleToClient) }
          else router.push('/admin/importar')
        })
        .catch(() => router.push('/admin/importar'))
        .finally(() => setLoading(false))
      return
    }
    const raw = sessionStorage.getItem('admin_report')
    if (!raw) { router.push('/admin/importar'); return }
    try {
      setReport(JSON.parse(raw) as AdminReportV2)
      // Relatório recém-importado, mas a URL não carrega o ?id= (ex.: usuário clicou na
      // aba "Relatório" do menu antes do redirect automático terminar). Sem isso, os botões
      // de Compartilhar/Enviar para cliente/Excel — que dependem de um id salvo — ficam
      // escondidos mesmo o relatório já estando salvo no banco.
      const rawId = sessionStorage.getItem('admin_report_id')
      const id = rawId ? Number(rawId) : null
      if (id) {
        setFallbackSavedId(id)
        router.replace(`/admin/relatorio?id=${id}`)
      }
    }
    catch { router.push('/admin/importar') }
    finally { setLoading(false) }
  }, [router, searchParams, reportData])

  // ── Derived metrics (before early returns — hooks must not be conditional) ──
  const comprasData = useMemo(() => report?.compras.length ? comprasInsight(report.compras) : { diff: 0, pct: 0 }, [report])
  const vendasData  = useMemo(() => report?.vendas.length  ? vendasInsight(report.vendas)   : { diff: 0, pct: 0 }, [report])
  // Card "Vendas em Alta/Queda" do resumo executivo usa impacto líquido de imposto, não valor
  // bruto vendido (esse fica em vendasData, usado pelo card "Receita Total" da tela de Vendas).
  const vendasImpactoData = useMemo(() => report?.vendas.length ? vendasImpactoInsight(report.vendas) : { diff: 0, pct: 0 }, [report])
  const dreData     = useMemo(() => dreInsight(report?.dre ?? []), [report])
  const fluxoData   = useMemo(() => fluxoInsight(report?.fluxo ?? []), [report])

  const totalComprasAR  = useMemo(() => report?.compras.reduce((s, c) => s + c.custoAR, 0) ?? 0, [report])
  const totalComprasDR  = useMemo(() => report?.compras.reduce((s, c) => s + c.custoDR, 0) ?? 0, [report])
  const totalVendasAR   = useMemo(() => report?.vendas.reduce((s, v) => s + v.valorAR, 0) ?? 0, [report])
  const totalVendasDR   = useMemo(() => report?.vendas.reduce((s, v) => s + v.valorDR, 0) ?? 0, [report])
  const lucroLiqAR = useMemo(() => report?.dre.find(d => d.categoria.toLowerCase().includes('líquido') || d.categoria.toLowerCase().includes('liquido'))?.ar ?? 0, [report])
  const lucroLiqDR = useMemo(() => lucroLiqAR + (dreData?.diffRS ?? 0), [lucroLiqAR, dreData])
  const fluxoResultAR = useMemo(() => report?.fluxo.find(f => f.categoria.toLowerCase().includes('resultado'))?.ar ?? 0, [report])
  const fluxoResultDR = useMemo(() => fluxoResultAR + (fluxoData?.diffRS ?? 0), [fluxoResultAR, fluxoData])

  // ── Nav items / slides ──
  const navItems = useMemo((): NavItem[] => {
    const items: NavItem[] = [{ id: 'summary', label: 'Visão Geral', icon: <Layers className="h-3.5 w-3.5" /> }]
    if (report?.compras.length) items.push({ id: 'compras', label: 'Compras', icon: <ShoppingCart className="h-3.5 w-3.5" /> })
    if (report?.vendas.length) items.push({ id: 'vendas', label: 'Vendas', icon: <TrendingUp className="h-3.5 w-3.5" /> })
    if (report?.tributos) items.push({ id: 'tributos', label: 'Tributos', icon: <Landmark className="h-3.5 w-3.5" /> })
    if (report?.dre.length) items.push({ id: 'dre', label: 'Resultado', icon: <BarChart3 className="h-3.5 w-3.5" /> })
    if (report?.fluxo.length) items.push({ id: 'fluxo', label: 'Caixa', icon: <Waves className="h-3.5 w-3.5" /> })
    if (report?.regimes.length) items.push({ id: 'regime', label: 'Regime', icon: <Scale className="h-3.5 w-3.5" /> })
    if (report?.vendasB2C?.length || report?.vendasRegime?.length) items.push({ id: 'mercado', label: 'Mercado', icon: <Globe className="h-3.5 w-3.5" /> })
    // "Produto" reúne Categoria de Produto + Impacto por Produto + Resultado por
    // Produto — tudo numa tela só, então o item de nav aparece se qualquer uma
    // dessas fontes tiver dado. Simulador de Preço tem tela própria (ver abaixo).
    const temMercadologica = (report?.comprasMercadologica?.length ?? 0) + (report?.vendasMercadologica?.length ?? 0) > 0
    if (temMercadologica || report?.margemProdutos?.length || report?.dreProduto?.length) {
      items.push({ id: 'mercadologica', label: 'Produto', icon: <Boxes className="h-3.5 w-3.5" /> })
    }
    if (report?.simulador?.length) {
      items.push({ id: 'simulador', label: 'Simulador de Preço', icon: <Calculator className="h-3.5 w-3.5" /> })
    }
    return items
  }, [report])

  // ── Seções disponíveis para marcação de comentários (rótulos completos) ──
  // "Categorias de Operação" vive dentro das telas Compras e Vendas (uma metade em
  // cada), e Simulador/Impacto/Resultado por Produto vivem dentro da tela Produto —
  // não são mais itens de navegação próprios, então a lista é montada direto pelas
  // mesmas condições de dado usadas no render, em vez de derivar de `navItems`.
  const commentSections = useMemo(() => {
    const labels: Record<string, string> = {
      compras: 'Compras',
      categoriasCompras: 'Categorias de Operação — Compras',
      fornecedoresSimples: 'Impacto de Fornecedores',
      vendas: 'Vendas',
      categoriasVendas: 'Categorias de Operação — Vendas',
      tributos: 'Tributos',
      dre: 'Resultado',
      fluxo: 'Fluxo de Caixa',
      regime: 'Regime Tributário',
      mercado: 'Mercado',
      mercadologica: 'Categoria de Produto',
      simulador: 'Simulador de Preço',
      impacto: 'Impacto por Produto',
      dreproduto: 'Resultado por Produto',
    }
    const ids: string[] = []
    if (report?.compras.length) ids.push('compras')
    if ((report?.comprasCategorias?.length ?? 0) > 0) ids.push('categoriasCompras')
    if ((report?.comprasSimples?.length ?? 0) > 0) ids.push('fornecedoresSimples')
    if (report?.vendas.length) ids.push('vendas')
    if ((report?.vendasCategorias?.length ?? 0) > 0) ids.push('categoriasVendas')
    if (report?.tributos) ids.push('tributos')
    if (report?.dre.length) ids.push('dre')
    if (report?.fluxo.length) ids.push('fluxo')
    if (report?.regimes.length) ids.push('regime')
    if (report?.vendasB2C?.length || report?.vendasRegime?.length) ids.push('mercado')
    const temMercadologica = (report?.comprasMercadologica?.length ?? 0) + (report?.vendasMercadologica?.length ?? 0) > 0
    if (temMercadologica || report?.margemProdutos?.length || report?.dreProduto?.length) {
      ids.push('mercadologica', 'impacto', 'dreproduto')
    }
    if (report?.simulador?.length) ids.push('simulador')
    return ids.map((id) => ({ id, label: labels[id] }))
  }, [report])

  // ── Keyboard navigation ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setCurrentSlide(s => {
          const next = Math.min(navItems.length - 1, s + 1)
          if (next > s) setDirection(1)
          return next
        })
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlide(s => {
          const next = Math.max(0, s - 1)
          if (next < s) setDirection(-1)
          return next
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navItems.length])

  if (loading || !anoResolvido) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-foreground/30">Carregando relatório…</p>
        </div>
      </div>
    )
  }

  if (!report) return null

  // ── Slide helpers ──
  function goTo(index: number) {
    if (index === currentSlide) return
    setDirection(index > currentSlide ? 1 : -1)
    setCurrentSlide(index)
  }
  const goPrev = () => goTo(currentSlide - 1)
  const goNext = () => goTo(currentSlide + 1)
  const hasPrev = currentSlide > 0
  const hasNext = currentSlide < navItems.length - 1
  const activeId = navItems[currentSlide]?.id ?? 'summary'

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  function renderSlideContent(id: string) {
    switch (id) {
      case 'summary':
        return (
          <ExecutiveSummary
            report={report!}
            comprasDiff={comprasData.diff}
            comprasPct={comprasData.pct}
            vendasDiff={vendasImpactoData.diff}
            vendasPct={vendasImpactoData.pct}
            dreData={dreData}
            fluxoData={fluxoData}
            anoSelecionado={anoSelecionado}
            anosDisponiveis={anosDisponiveis}
            onChangeAno={trocarAno}
            trocandoAno={trocandoAno}
            textos={textos}
          />
        )
      case 'compras':
        return (
          <div className="space-y-10">
            <SectionHeader num="01" title="Compras" subtitle="Variação do custo de compras com a Reforma Tributária — o que muda no seu preço de aquisição." sectionId="compras" explain="Todos os valores comparam o que você já pagou (Antes da Reforma, 2026) com o que pagaria pelas mesmas compras, mas com as regras do ano que você escolher no seletor de ano." />
            <MetricPair labelAR="Custo Total" labelDR="Custo Total" valueAR={totalComprasAR} valueDR={totalComprasDR} delta={comprasData.diff} deltaPct={comprasData.pct} goodWhenNegativeDelta ano={anoSelecionado} explain="Soma de tudo que você comprou, comparando o custo com as regras de hoje (2026) e com as regras do ano selecionado. Custo menor é bom pra você." />
            <ComprasSection compras={report!.compras} ano={anoSelecionado} comprasPorAno={comprasPorAno} />
            <ComprasCharts comprasNCM={report!.comprasNCM ?? []} comprasRegime={report!.comprasRegime ?? []} comprasFornecedores={report!.comprasFornecedores ?? []} ano={anoSelecionado} />
            {(report!.comprasMercadologica?.length ?? 0) > 0 && (
              <MercadologicaBlock
                tag="COMPRAS"
                tagClass="bg-chart-1/10 text-chart-1"
                subtitle="Custo de aquisição por categoria de produto"
                data={report!.comprasMercadologica ?? []}
                ano={anoSelecionado}
              />
            )}
            {((report!.comprasCategorias?.length ?? 0) > 0 || (report!.comprasTipoOperacao?.length ?? 0) > 0 || (report!.comprasOrigemUF?.length ?? 0) > 0 || (report!.comprasBeneficio?.length ?? 0) > 0 || (report!.comprasOrigem?.length ?? 0) > 0 || (report!.comprasCST?.length ?? 0) > 0) && (
              <>
                <SectionHeader num="02" title="Categorias de Operação — Compras" subtitle="Quebra das compras por tipo de operação (Produtos, Serviços, Locação, Substituição Tributária, Ativo Imobilizado/Uso e Consumo, Exportação, Créditos de ICMS e outras), derivada dos códigos CFOP." sectionId="categoriasCompras" explain="O CFOP de cada nota fiscal indica o tipo de operação — usamos ele pra separar suas compras em Produtos, Serviços, Locação, Substituição Tributária, Ativo Imobilizado, Exportação etc., já que cada uma pode ter tratamento tributário diferente na Reforma." />
                <CompraCategoriaCharts
                  comprasCategorias={report!.comprasCategorias ?? []}
                  comprasTipoOperacao={report!.comprasTipoOperacao ?? []}
                  comprasOrigemUF={report!.comprasOrigemUF ?? []}
                  comprasBeneficio={report!.comprasBeneficio ?? []}
                  comprasOrigem={report!.comprasOrigem ?? []}
                  comprasCST={report!.comprasCST ?? []}
                  ano={anoSelecionado}
                />
              </>
            )}
            {(report!.comprasSimples?.length ?? 0) > 0 && (
              <>
                <SectionHeader num="03" title="Impacto de Fornecedores" subtitle="Fornecedores do Simples Nacional e sua participação nas compras — atenção redobrada, já que o crédito de IBS/CBS deles funciona diferente do regime normal." sectionId="fornecedoresSimples" explain="Empresas do Simples Nacional recolhem os tributos de forma unificada — isso muda o crédito de IBS/CBS que você consegue aproveitar ao comprar delas, por isso vale acompanhar à parte." />
                <SimplesCharts comprasSimples={report!.comprasSimples ?? []} totalComprasAR={totalComprasAR} />
              </>
            )}
          </div>
        )
      case 'vendas':
        return (
          <div className="space-y-10">
            <SectionHeader num="04" title="Vendas" subtitle="Variação da receita de vendas — como sua precificação e margens são afetadas." sectionId="vendas" explain="Todos os valores comparam o que você já vendeu (Antes da Reforma, 2026) com o que receberia pelas mesmas vendas, mas com as regras do ano que você escolher no seletor de ano." />
            <MetricPair labelAR="Receita Total" labelDR="Receita Total" valueAR={totalVendasAR} valueDR={totalVendasDR} delta={vendasData.diff} deltaPct={vendasData.pct} goodWhenNegativeDelta={false} ano={anoSelecionado} explain="Soma de tudo que você vendeu, comparando a receita com as regras de hoje (2026) e com as regras do ano selecionado. Receita maior é bom pra você." />
            <VendasSection vendas={report!.vendas} ano={anoSelecionado} vendasPorAno={vendasPorAno} />
            <VendasCharts vendasNCM={report!.vendasNCM ?? []} vendasClientes={report!.vendasClientes ?? []} ano={anoSelecionado} />
            {(report!.vendasMercadologica?.length ?? 0) > 0 && (
              <MercadologicaBlock
                tag="VENDAS"
                tagClass="bg-chart-2/10 text-chart-2"
                subtitle="Receita e impacto tributário por categoria de produto"
                data={report!.vendasMercadologica ?? []}
                ano={anoSelecionado}
              />
            )}
            {(report!.vendasCategorias?.length ?? 0) > 0 && (
              <>
                <SectionHeader num="05" title="Categorias de Operação — Vendas" subtitle="Quebra das vendas por tipo de operação (Produtos, Serviços, Locação, Venda de Imóveis, Substituição Tributária, Ativo Imobilizado/Uso e Consumo, Exportação e outras), derivada dos códigos CFOP." sectionId="categoriasVendas" explain="O CFOP de cada nota fiscal indica o tipo de operação — usamos ele pra separar suas vendas em Produtos, Serviços, Locação, Venda de Imóveis, Substituição Tributária, Exportação etc., já que cada uma pode ter tratamento tributário diferente na Reforma." />
                <VendaCategoriaCharts vendasCategorias={report!.vendasCategorias ?? []} ano={anoSelecionado} />
              </>
            )}
          </div>
        )
      case 'tributos':
        return (
          <div className="space-y-10">
            <SectionHeader num="06" title="Tributos" subtitle="Composição da carga tributária — como os tributos antigos dão lugar ao IBS e à CBS." sectionId="tributos" explain="ICMS, ISS, IPI e PIS/COFINS somem gradualmente até 2033 e são substituídos por IBS (estados/municípios) e CBS (federal) — essa tela mostra o quanto de cada um pesa hoje e depois." />
            <TributoCharts tributos={report!.tributos} ano={anoSelecionado} />
          </div>
        )
      case 'dre':
        return (
          <div className="space-y-10">
            <SectionHeader num="07" title="Resultado" subtitle="Demonstração de resultado projetada — impacto no lucro líquido até 2033." sectionId="dre" explain="Vem direto da sua DRE (Demonstração de Resultado) importada — cada linha é recalculada ano a ano seguindo o cronograma oficial de transição da Reforma." />
            {dreData && <MetricPair labelAR="Lucro Líquido" labelDR="Lucro Líquido" valueAR={lucroLiqAR} valueDR={lucroLiqDR} delta={dreData.diffRS} deltaPct={dreData.diffPct} goodWhenNegativeDelta={false} ano={anoSelecionado} explain="Vem da linha 'Lucro Líquido' da sua DRE, recalculada com o efeito conjunto da mudança de custos e receitas pela Reforma." />}
            <DRESection dre={report!.dre} />
          </div>
        )
      case 'fluxo':
        return (
          <div className="space-y-10">
            <SectionHeader num="08" title="Fluxo de Caixa" subtitle="Impacto no caixa da empresa com projeção para os próximos anos." sectionId="fluxo" explain="Vem direto da sua planilha de Fluxo de Caixa importada — inclui o efeito de créditos e débitos tributários, que mudam de timing/valor com o IBS/CBS." />
            {fluxoData && <MetricPair labelAR="Resultado de Caixa" labelDR="Resultado de Caixa" valueAR={fluxoResultAR} valueDR={fluxoResultDR} delta={fluxoData.diffRS} deltaPct={fluxoData.diffPct} goodWhenNegativeDelta={false} ano={anoSelecionado} explain="Vem da linha 'Resultado' do seu Fluxo de Caixa, recalculada considerando os créditos e débitos tributários que mudam com o IBS/CBS." />}
            <FluxoSection fluxo={report!.fluxo} />
          </div>
        )
      case 'regime':
        return (
          <div className="space-y-10">
            <SectionHeader num="09" title="Regime Tributário" subtitle="Qual regime otimiza melhor seu resultado depois da reforma?" sectionId="regime" explain="Simulamos o mesmo movimento em Lucro Real, Presumido e Simples e comparamos o resultado líquido — útil pra decidir se vale a pena mudar de regime depois da Reforma." />
            <RegimeSection regimes={report!.regimes} />
          </div>
        )
      case 'mercado':
        return (
          <div className="space-y-10">
            <SectionHeader num="10" title="Mercado" subtitle="Perfil dos seus compradores: B2B (CNPJ) vs B2C (CPF) e regime tributário dos clientes." sectionId="mercado" explain="Entender pra quem você vende ajuda a antecipar o impacto da Reforma — vendas B2B costumam gerar mais crédito de IBS/CBS pro comprador do que vendas B2C." />
            <MercadoCharts
              vendasB2C={report!.vendasB2C ?? []}
              vendasRegime={report!.vendasRegime ?? []}
            />
          </div>
        )
      case 'mercadologica':
        return (
          <div className="space-y-10">
            <SectionHeader num="11" title="Categoria de Produto" subtitle="Compras e vendas agrupadas pela taxonomia de mercado (Seção/Grupo/Subgrupo/Família) — útil pra ver o impacto da reforma em categorias como cesta básica, saúde ou agropecuária, que o NCM sozinho não deixa evidente." sectionId="mercadologica" explain="A categoria de cada produto é sugerida automaticamente pela descrição a partir da planilha importada." />
            <EstruturaMercadologicaImpacto
              margemProdutos={report!.margemProdutos ?? []}
              ano={anoSelecionado}
            />
            <ProdutosMaisImpactadosCards
              margemProdutos={report!.margemProdutos ?? []}
              ano={anoSelecionado}
            />
            <ProdutosMaisAfetadosMercadologica
              margemProdutos={report!.margemProdutos ?? []}
              ano={anoSelecionado}
            />

            <SectionHeader num="13" title="Impacto por Produto" subtitle="Quais produtos são mais beneficiados e quais são mais prejudicados pela reforma, considerando custo e receita." sectionId="impacto" explain="Só entram produtos que aparecem tanto em compras quanto em vendas (pra calcular receita e custo do mesmo item). Impacto líquido = variação de receita menos variação de custo." />
            <ImpactoProduto
              comprasNCM={report!.comprasNCM ?? []}
              vendasNCM={report!.vendasNCM ?? []}
            />

            <SectionHeader num="14" title="Resultado por Produto" subtitle="Resultado, margem bruta e projeção 2026–2033 para cada NCM — visão individual de impacto com fase de transição da reforma." sectionId="dreproduto" explain="Se você já importou a planilha real de um ano específico, o gráfico troca o ponto projetado (fórmula) pelo valor real daquele ano — procure a bolinha marcada como 'Real'." />
            <DreProduto dreProduto={report!.dreProduto ?? []} />
          </div>
        )
      case 'simulador':
        return (
          <div className="space-y-10">
            <SectionHeader num="12" title="Simulador de Preço" subtitle="Simule o impacto no markup e no resultado por produto com diferentes cenários de reajuste de preço." sectionId="simulador" explain="Mostra, produto a produto, qual markup você precisaria praticar em cada ano da transição pra manter o mesmo resultado de hoje, sem precisar reajustar preço." />
            <PriceSimulator
              simulador={report!.simulador ?? []}
              margemProdutos={report!.margemProdutos ?? []}
              dre={report!.dre ?? []}
            />
          </div>
        )
      default:
        return null
    }
  }

  const isRestricted = publicMode || clientMode
  const savedId = reportId ?? (publicMode ? null : (searchParams.get('id') ? Number(searchParams.get('id')) : fallbackSavedId))

  async function handleSendToClient() {
    if (!savedId) return
    setSendingToClient(true)
    try {
      const res = await fetch('/api/admin/reports/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: savedId }),
      })
      const data = await res.json()
      if (res.status === 409 && data.error === 'NO_CLIENT_LINKED') {
        setLinkModal({ empresaId: data.empresaId, empresaNome: data.empresaNome })
        return
      }
      if (!res.ok) { showToast(data.message ?? 'Erro ao enviar para o cliente', false); return }
      setSentToClient(true)
      showToast('Enviado ao cliente!')
    } catch {
      showToast('Erro ao enviar para o cliente', false)
    } finally {
      setSendingToClient(false)
    }
  }

  async function handleShare() {
    if (!savedId) { showToast('Relatório não salvo — importe novamente', false); return }
    setSharing(true)
    try {
      const res = await fetch('/api/admin/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: savedId }) })
      const { token, error } = await res.json()
      if (!token) throw new Error(error)
      const link = `${window.location.origin}/relatorio/${token}`
      const copied = await copyToClipboard(link)
      showToast(copied ? 'Link copiado para a área de transferência!' : `Link gerado: ${link}`)
    } catch {
      showToast('Erro ao gerar link', false)
    } finally {
      setSharing(false)
    }
  }

  return (
    <DrillDownProvider>
    <CommentsMetaContext.Provider value={{ counts: commentCounts, onOpen: openSectionComments }}>
    {/* ── Toast ── */}
    {toast && (
      <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl transition-all ${toast.ok ? 'bg-gain text-black' : 'bg-loss text-white'}`}>
        {toast.ok ? <CheckCircle className="h-4 w-4" /> : null}
        {toast.msg}
      </div>
    )}

    {/* ── Print-only stacked view (hidden on screen) ── */}
    <div className="hidden print:block print:bg-white print:text-black">
      <div className="p-8 border-b border-gray-200">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Reforma NextGen</p>
        <h1 className="text-2xl font-bold mt-1">{report.empresa.empresa || 'Relatório de Impacto'}</h1>
        <p className="text-sm text-gray-500 mt-1">{report.empresa.regime} · {report.empresa.periodo}</p>
      </div>
      {navItems.map(item => (
        <div key={item.id} className="break-before-page px-8 py-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-4">{item.label}</p>
          {renderSlideContent(item.id)}
        </div>
      ))}
    </div>

    <div className="print:hidden relative">
      {(clientMode || publicMode) && <AmbientConsentPrompt logoUrl={logo} />}

      {/* ── Top bar ── */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 pb-6">
        <div className="flex min-w-0 items-center gap-2">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-8 w-8 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{report.empresa.empresa || 'Relatório de Impacto'}</p>
            <p className="text-xs text-foreground/25">{report.empresa.regime} · {report.empresa.periodo}</p>
          </div>
        </div>

        {/* seletor compacto de ano — visível em qualquer aba, não só na Visão Geral */}
        {anosDisponiveis.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="hidden text-[10px] uppercase tracking-wide text-foreground/25 sm:inline">{ANO_ATUAL}</span>
            <ArrowRight className="hidden h-3 w-3 text-foreground/15 sm:inline" />
            <select
              value={anoSelecionado ?? ''}
              onChange={e => trocarAno(Number(e.target.value))}
              disabled={trocandoAno}
              title="Ano depois da reforma"
              className="h-7 rounded-md border border-border bg-secondary/40 px-2 text-xs font-tabular font-semibold text-primary outline-none disabled:opacity-50"
            >
              {anosDisponiveis.map(a => (
                <option key={a.ano} value={a.ano} className="bg-popover text-foreground">{a.ano}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {!isRestricted && (
            <button onClick={() => router.push('/admin/importar')} className="flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs text-foreground/45 transition hover:border-foreground/20 hover:text-foreground">
              <RefreshCw className="h-3 w-3" /><span className="hidden sm:inline">Importar</span>
            </button>
          )}
          {!isRestricted && savedId && (
            <button onClick={handleShare} disabled={sharing} className="flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs text-foreground/45 transition hover:border-foreground/20 hover:text-foreground disabled:opacity-50">
              <Share2 className="h-3 w-3" /><span className="hidden sm:inline">{sharing ? 'Gerando…' : 'Compartilhar'}</span>
            </button>
          )}
          {!isRestricted && savedId && (
            <button
              onClick={handleSendToClient}
              disabled={sendingToClient || sentToClient}
              className="flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs text-foreground/45 transition hover:border-primary/40 hover:text-primary disabled:opacity-60"
            >
              {sentToClient ? <CheckCircle className="h-3 w-3 text-primary" /> : <Send className="h-3 w-3" />}
              <span className="hidden sm:inline">{sentToClient ? 'Enviado ✓' : sendingToClient ? 'Enviando…' : 'Enviar para cliente'}</span>
            </button>
          )}
          {!isRestricted && savedId && (
            <a href={`/api/admin/export-excel?id=${savedId}`} className="flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs text-foreground/45 transition hover:border-foreground/20 hover:text-foreground">
              <FileSpreadsheet className="h-3 w-3" /><span className="hidden sm:inline">Excel</span>
            </a>
          )}
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs text-foreground/45 transition hover:border-foreground/20 hover:text-foreground">
            <Printer className="h-3 w-3" /><span className="hidden sm:inline">PDF</span>
          </button>
          {!isRestricted && (
            <button onClick={async () => { setExporting(true); try { await exportPPTX(report) } catch(e) { console.error(e) } finally { setExporting(false) } }} disabled={exporting} className="flex items-center gap-1.5 rounded-xl bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
              {exporting ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" /></> : <FileDown className="h-3 w-3" />}
              <span className="hidden sm:inline">{exporting ? 'Exportando…' : 'PowerPoint'}</span>
            </button>
          )}
        </div>
      </div>

      {linkModal && (
        <CreateClientLoginModal
          empresaId={linkModal.empresaId}
          empresaNome={linkModal.empresaNome}
          onClose={() => setLinkModal(null)}
          onLinked={() => { setLinkModal(null); handleSendToClient() }}
        />
      )}

      {/* ── Slide content ── */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={activeId}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
          className="relative w-full"
        >
          <div
            className="w-full"
            style={presentationScale !== 1 && presentationHeight ? { height: presentationHeight * presentationScale } : undefined}
          >
            <div
              ref={slideContentRef}
              className="mx-auto w-full max-w-[1440px] pb-16"
              style={presentationScale !== 1 ? { transform: `scale(${presentationScale})`, transformOrigin: 'top center' } : undefined}
            >
              {renderSlideContent(activeId)}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {!publicMode && savedId && (
        <ReportCommentsPanel
          reportId={savedId}
          viewerRole={clientMode ? 'cliente' : 'admin'}
          sections={commentSections}
          focusSection={focusSection}
          onCountsChange={setCommentCounts}
        />
      )}

      {/* Prev button */}
      <button
        onClick={goPrev}
        disabled={!hasPrev}
        aria-label="Slide anterior"
        className="shine-sweep-host glow-gold fixed left-4 top-1/2 z-30 -translate-y-1/2 hidden h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-110 active:scale-95 disabled:pointer-events-none disabled:opacity-0 lg:flex"
      >
        <span className="shine-sweep" aria-hidden />
        <ArrowLeft className="relative h-5 w-5" strokeWidth={2.25} />
      </button>

      {/* Next button */}
      <button
        onClick={goNext}
        disabled={!hasNext}
        aria-label="Próximo slide"
        className="shine-sweep-host glow-gold fixed right-4 top-1/2 z-30 -translate-y-1/2 hidden h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-110 active:scale-95 disabled:pointer-events-none disabled:opacity-0 lg:flex"
      >
        <span className="shine-sweep" aria-hidden />
        <ArrowRight className="relative h-5 w-5" strokeWidth={2.25} />
      </button>

    </div>
    </CommentsMetaContext.Provider>
    </DrillDownProvider>
  )
}
