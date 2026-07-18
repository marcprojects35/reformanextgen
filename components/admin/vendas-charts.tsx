'use client'

import {
  Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { motion } from 'motion/react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { VendasDetalheRow } from '@/lib/admin-engine'
import { fmtShort, pct, sign } from '@/lib/admin-format'
import { GAIN, LOSS, ChartTooltip, ACTIVE_BAR, chartColor } from '@/lib/admin-colors'
import { useDrillDown, buildDetalhesExtra, DrillMoreRow, type DrillContent } from '@/components/admin/drill-down'
import { ClickableTick } from '@/components/admin/clickable-tick'
import { Explain } from '@/components/admin/explain-tooltip'

// ─── Animation wrapper ────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Section Title ────────────────────────────────────────────────────────────

function SectionLabel({ index, title, subtitle, explain }: { index: string; title: string; subtitle?: string; explain?: string }) {
  const label = (
    <div className="flex items-end gap-4">
      <span className="text-xs text-foreground/20 font-mono">{index}</span>
      <div>
        <h3 className="text-2xl font-bold tracking-tight text-foreground">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-foreground/40">{subtitle}</p>}
      </div>
    </div>
  )
  return (
    <FadeUp className="mb-6">
      {explain ? <Explain text={explain} className="block w-fit">{label}</Explain> : label}
    </FadeUp>
  )
}

const CARD = 'rounded-xl border border-border bg-foreground/[0.02] p-4'

// ─── NCM Horizontal Bars ──────────────────────────────────────────────────────
// Mesma convenção de ArDrBarChart (report-dashboard.tsx): AR neutro, DR colorido
// por direção (GAIN se a carga caiu, LOSS se subiu).

const NCM_INITIAL_COUNT = 8

// Mesmas cores/índices de CAT_COLOR_IDX em categoria-charts.tsx — categoria de
// operação (via CFOP) mostrada como bolinha ao lado do produto neste gráfico.
const CATEGORIA_COLOR: Record<string, string> = {
  'Produtos':           chartColor(0),
  'Locação de Móveis':  chartColor(1),
  'Serviços':           chartColor(2),
  'Venda de Imóveis':   chartColor(3),
  'Locação de Imóveis': chartColor(4),
  'Outros':             chartColor(6),
}

function NCMBars({ data, ano }: { data: VendasDetalheRow[]; ano?: number | null }) {
  const { open } = useDrillDown()
  const sorted = [...data].sort((a, b) => b.valorAR - a.valorAR)
  const top = sorted.slice(0, NCM_INITIAL_COUNT)
  if (!top.length) return <p className="text-sm text-foreground/30">Sem dados de produto</p>

  const biggestNCM = sorted.reduce((a, b) => Math.abs(b.cargaDRPct - b.cargaARPct) > Math.abs(a.cargaDRPct - a.cargaARPct) ? b : a, sorted[0])
  const biggestDiff = biggestNCM.cargaDRPct - biggestNCM.cargaARPct

  const chartData = top.map(item => ({
    // codigoProduto quando existe — vários produtos podem compartilhar o mesmo NCM
    // (classificação fiscal, não identidade do produto), então usar só o NCM aqui colidiria
    // no eixo/categoria do gráfico quando dois deles entrassem no top N.
    categoria: item.codigoProduto || item.codigo,
    descricao: item.descricao,
    AR: item.valorAR,
    DR: item.valorDR,
    diff: item.cargaDRPct - item.cargaARPct,
  }))
  const labelByCodigo = new Map(chartData.map(d => [d.categoria, d.descricao || d.categoria]))

  function abrirNCM(item: VendasDetalheRow) {
    open({
      title: item.descricao || `NCM ${item.codigo}`,
      subtitle: [item.descricao ? `NCM ${item.codigo}` : null, item.categoria].filter(Boolean).join(' · ') || undefined,
      columns: [
        { key: 'metrica', label: 'Métrica' },
        { key: 'ar', label: 'Antes', format: 'currency' },
        { key: 'dr', label: 'Depois', format: 'currency' },
      ],
      rows: [
        { metrica: 'Valor', ar: item.valorAR, dr: item.valorDR },
        { metrica: 'Carga Tributária', ar: pct(item.cargaARPct), dr: pct(item.cargaDRPct) },
      ],
      extra: { title: 'Detalhes técnicos da planilha', items: buildDetalhesExtra(item.detalhes) },
    })
  }

  const todosContent: DrillContent = {
    title: 'Todos os produtos',
    subtitle: `${sorted.length} produtos analisados`,
    wide: true,
    columns: [
      { key: 'produto', label: 'Produto' },
      { key: 'ncm', label: 'NCM', mono: true },
      { key: 'categoria', label: 'Categoria' },
      { key: 'ar', label: 'Antes', format: 'currency' },
      { key: 'dr', label: 'Depois', format: 'currency' },
      { key: 'variacao', label: 'Variação', format: 'pctPointDelta' },
    ],
    rows: sorted.map(item => ({
      produto: item.descricao || 'Produto sem descrição',
      ncm: item.codigo,
      categoria: item.categoria ?? '—',
      ar: item.valorAR,
      dr: item.valorDR,
      variacao: item.cargaDRPct - item.cargaARPct,
    })),
  }

  return (
    <div className="space-y-4">
      {/* Insight strip */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-foreground/[0.02] border border-border">
        <span className="text-xs text-foreground/30">{sorted.length} produtos analisados</span>
        <span className="text-foreground/15">·</span>
        <span className="text-xs text-foreground/30">Maior variação:</span>
        <span className={`text-sm font-semibold font-tabular ${biggestDiff > 0 ? 'text-loss' : 'text-gain'}`}>
          {biggestNCM.descricao ? `${biggestNCM.descricao} (${biggestNCM.codigo})` : `NCM ${biggestNCM.codigo}`} — {biggestDiff > 0 ? '↑' : '↓'}{Math.abs(biggestDiff).toFixed(1)}pp
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-5 text-xs text-foreground/25">
        <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-full bg-foreground/20 inline-block" />Antes da Reforma</span>
        <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-full bg-gain/40 inline-block" />Depois — carga caiu</span>
        <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-full bg-loss/40 inline-block" />Depois — carga subiu</span>
        {Array.from(new Set(top.map(i => i.categoria).filter((c): c is string => !!c))).map(cat => (
          <span key={cat} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full inline-block" style={{ background: CATEGORIA_COLOR[cat] }} />
            {cat}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 34)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--foreground) 4%, transparent)" horizontal={false} />
          <XAxis type="number" tickFormatter={v => fmtShort(v)} tick={{ fill: 'color-mix(in srgb, var(--foreground) 25%, transparent)', fontSize: 10 }} axisLine={false} tickLine={false} className="font-tabular" />
          <YAxis
            type="category"
            dataKey="categoria"
            width={110}
            axisLine={false}
            tickLine={false}
            className="font-tabular"
            tick={
              <ClickableTick
                onSelect={i => abrirNCM(top[i])}
                formatter={(c: string) => { const l = labelByCodigo.get(c) ?? c; return l.length > 16 ? `${l.slice(0, 15)}…` : l }}
                dotColor={i => { const cat = top[i]?.categoria; return cat ? CATEGORIA_COLOR[cat] : undefined }}
              />
            }
          />
          <Tooltip content={<ChartTooltip />} labelFormatter={(c: unknown) => { const key = String(c); const l = labelByCodigo.get(key); return l && l !== key ? `${l} (${key})` : key }} cursor={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }} />
          <Bar dataKey="AR" name="Antes" fill="color-mix(in srgb, var(--foreground) 22%, transparent)" radius={[0, 3, 3, 0]} barSize={9} activeBar={ACTIVE_BAR} />
          <Bar dataKey="DR" name={ano ? `Depois (${ano})` : 'Depois'} radius={[0, 3, 3, 0]} barSize={9} activeBar={ACTIVE_BAR}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.diff > 0 ? LOSS : GAIN} onClick={() => abrirNCM(top[i])} className="cursor-pointer" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {sorted.length > NCM_INITIAL_COUNT && (
        <DrillMoreRow content={todosContent} label={`Ver mais (+${sorted.length - NCM_INITIAL_COUNT})`} />
      )}
    </div>
  )
}

// ─── Ranked list tooltip (Cliente) ────────────────────────────────────────────
// Mesmo invólucro visual do ChartTooltip compartilhado, com contexto extra
// (AR → DR, valor) que uma única série de barras não carrega no payload padrão.

interface RankedPoint {
  label: string
  diff: number
  ar: number
  dr: number
  valor: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RankedTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as RankedPoint
  return (
    <div className="rounded-lg border border-border bg-popover/95 backdrop-blur-xl px-3 py-2 shadow-2xl">
      <p className="text-[11px] text-foreground/70 font-mono mb-1.5">{d.label}</p>
      <div className="flex items-center gap-2 text-[11px] text-foreground/55 font-tabular">
        <span>AR {d.ar.toFixed(1)}%</span><span className="text-foreground/25">→</span><span>DR {d.dr.toFixed(1)}%</span>
      </div>
      <div className="flex items-center justify-between gap-4 mt-1.5">
        <span className="text-[11px] text-foreground/40 font-tabular">{fmtShort(d.valor)}</span>
        <span className={`text-xs font-semibold font-tabular ${d.diff > 0 ? 'text-loss' : 'text-gain'}`}>{sign(d.diff)}{d.diff.toFixed(1)}pp</span>
      </div>
    </div>
  )
}

// ─── Clientes Ranked List ─────────────────────────────────────────────────────

function ClienteList({ data, type }: { data: VendasDetalheRow[]; type: 'aumento' | 'reducao' }) {
  const { open } = useDrillDown()
  const sorted = [...data]
    .filter(d => type === 'aumento' ? d.cargaDRPct > d.cargaARPct : d.cargaDRPct <= d.cargaARPct)
    .sort((a, b) =>
      type === 'aumento'
        ? (b.cargaDRPct - b.cargaARPct) - (a.cargaDRPct - a.cargaARPct)
        : (a.cargaDRPct - a.cargaARPct) - (b.cargaDRPct - b.cargaARPct)
    )
    .slice(0, 5)

  if (!sorted.length) return <p className="text-sm text-foreground/20 text-center py-4">—</p>

  const chartData: RankedPoint[] = sorted.map(item => ({
    label: item.nome || item.codigo || '(sem CNPJ)',
    diff: item.cargaDRPct - item.cargaARPct,
    ar: item.cargaARPct,
    dr: item.cargaDRPct,
    valor: item.valorAR,
  }))

  function abrirCliente(item: VendasDetalheRow) {
    open({
      title: item.nome || item.codigo || '(sem CNPJ)',
      subtitle: `Carga tributária: ${pct(item.cargaARPct)} → ${pct(item.cargaDRPct)}`,
      columns: [
        { key: 'metrica', label: 'Métrica' },
        { key: 'ar', label: 'Antes', format: 'currency' },
        { key: 'dr', label: 'Depois', format: 'currency' },
      ],
      rows: [
        { metrica: 'Valor', ar: item.valorAR, dr: item.valorDR },
        { metrica: 'Tributos', ar: item.tributosAR, dr: item.tributosDR },
      ],
    })
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 46)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--foreground) 4%, transparent)" horizontal={false} />
        <XAxis type="number" tickFormatter={v => `${sign(v)}${v.toFixed(1)}pp`} tick={{ fill: 'color-mix(in srgb, var(--foreground) 25%, transparent)', fontSize: 10 }} axisLine={false} tickLine={false} className="font-tabular" />
        <YAxis type="category" dataKey="label" width={124} axisLine={false} tickLine={false} className="font-tabular" tick={<ClickableTick onSelect={i => abrirCliente(sorted[i])} />} />
        <Tooltip content={<RankedTooltip />} cursor={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }} />
        <Bar dataKey="diff" name="Variação de carga" radius={[0, 3, 3, 0]} barSize={16} activeBar={ACTIVE_BAR}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.diff > 0 ? LOSS : GAIN} onClick={() => abrirCliente(sorted[i])} className="cursor-pointer" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface Props {
  vendasNCM: VendasDetalheRow[]
  vendasClientes: VendasDetalheRow[]
  ano?: number | null
}

export function VendasCharts({ vendasNCM, vendasClientes, ano }: Props) {
  const hasData = vendasNCM.length > 0 || vendasClientes.length > 0
  if (!hasData) return null

  return (
    <div className="space-y-16 pb-10">

      {vendasNCM.length > 0 && (
        <section>
          <SectionLabel index="01" title="Valores por Produto" subtitle="Comparação de carga tributária nas vendas antes e depois da reforma" explain="Cada barra é um produto (ou NCM, quando a planilha não traz o código do produto). Clique numa barra pra ver o detalhe; clique em 'Ver mais' pra lista completa." />
          <FadeUp delay={0.1}>
            <div className={CARD}>
              <NCMBars data={vendasNCM} ano={ano} />
            </div>
          </FadeUp>
        </section>
      )}

      {vendasClientes.length > 0 && (
        <section>
          <SectionLabel index="02" title="Clientes por CNPJ" subtitle="Impacto da reforma na carga tributária por cliente" explain="Top clientes com maior aumento e maior redução de carga tributária nas vendas, comparando antes e depois da reforma." />
          <FadeUp delay={0.1}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={CARD}>
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="h-4 w-4 text-loss" />
                  <span className="text-sm font-semibold text-foreground/60">Maior Aumento de Carga</span>
                </div>
                <ClienteList data={vendasClientes} type="aumento" />
              </div>
              <div className={CARD}>
                <div className="flex items-center gap-2 mb-6">
                  <TrendingDown className="h-4 w-4 text-gain" />
                  <span className="text-sm font-semibold text-foreground/60">Maior Redução de Carga</span>
                </div>
                <ClienteList data={vendasClientes} type="reducao" />
              </div>
            </div>
          </FadeUp>
        </section>
      )}

    </div>
  )
}
