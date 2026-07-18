'use client'

import { useState } from 'react'
import {
  PieChart, Pie, Cell, Sector, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { motion, AnimatePresence } from 'motion/react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { ComprasFornecedorRow, ComprasNCMRow, ComprasRegimeRow } from '@/lib/admin-engine'
import { fmtShort, pct, sign } from '@/lib/admin-format'
import { GAIN, LOSS, GOLD, chartColor, ChartTooltip, ACTIVE_BAR } from '@/lib/admin-colors'
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

function NCMBars({ data, ano }: { data: ComprasNCMRow[]; ano?: number | null }) {
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
    categoria: item.codigoProduto || item.ncm,
    descricao: item.descricao,
    AR: item.valorAR,
    DR: item.valorDR,
    diff: item.cargaDRPct - item.cargaARPct,
  }))
  const labelByNcm = new Map(chartData.map(d => [d.categoria, d.descricao || d.categoria]))

  function abrirNCM(item: ComprasNCMRow) {
    open({
      title: item.descricao || `NCM ${item.ncm}`,
      subtitle: [item.descricao ? `NCM ${item.ncm}` : null, item.categoria].filter(Boolean).join(' · ') || undefined,
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
      ncm: item.ncm,
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
          {biggestNCM.descricao ? `${biggestNCM.descricao} (${biggestNCM.ncm})` : `NCM ${biggestNCM.ncm}`} — {biggestDiff > 0 ? '↑' : '↓'}{Math.abs(biggestDiff).toFixed(1)}pp
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
                formatter={(ncm: string) => { const l = labelByNcm.get(ncm) ?? ncm; return l.length > 16 ? `${l.slice(0, 15)}…` : l }}
                dotColor={i => { const cat = top[i]?.categoria; return cat ? CATEGORIA_COLOR[cat] : undefined }}
              />
            }
          />
          <Tooltip content={<ChartTooltip />} labelFormatter={(ncm: unknown) => { const key = String(ncm); const l = labelByNcm.get(key); return l && l !== key ? `${l} (${key})` : key }} cursor={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }} />
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

// ─── Regime Donut ─────────────────────────────────────────────────────────────

const OUTROS_FILL = 'color-mix(in srgb, var(--foreground) 22%, transparent)'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, onClick } = props
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 10} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.25} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} stroke={GOLD} strokeWidth={2} onClick={onClick} cursor="pointer" />
    </g>
  )
}

function RegimeDonut({ data, fornecedores }: { data: ComprasRegimeRow[]; fornecedores: ComprasFornecedorRow[] }) {
  const { open } = useDrillDown()
  const [active, setActive] = useState<number | null>(null)
  if (!data.length) return <p className="text-sm text-foreground/30">Sem dados de regime</p>
  const total = data.reduce((s, r) => s + r.valorAR, 0)

  // Nunca cicla a paleta categórica: top 6 nomeados, o resto vira "Outros".
  const sorted = [...data].sort((a, b) => b.valorAR - a.valorAR)
  const top = sorted.slice(0, 6)
  const restSum = sorted.slice(6).reduce((s, r) => s + r.valorAR, 0)
  const grouped = restSum > 0 ? [...top, { regime: 'Outros', valorAR: restSum }] : top

  const pie = grouped.map((r, i) => ({
    name: r.regime,
    value: r.valorAR,
    pct: total > 0 ? (r.valorAR / total) * 100 : 0,
    fill: r.regime === 'Outros' ? OUTROS_FILL : chartColor(i),
  }))
  const shown = active !== null ? pie[active] : null

  function abrirRegime(entry: (typeof pie)[number]) {
    const fornecedoresRegime = fornecedores
      .filter(f => f.regime === entry.name)
      .sort((a, b) => b.valorAR - a.valorAR)
      .slice(0, 30)

    if (fornecedoresRegime.length === 0) {
      open({
        title: entry.name,
        subtitle: `${entry.pct.toFixed(1)}% do total — ${fmtShort(entry.value)}`,
        accentColor: entry.fill,
        columns: [
          { key: 'metrica', label: 'Métrica' },
          { key: 'valor', label: 'Valor', format: 'currencyShort' },
        ],
        rows: [
          { metrica: 'Valor', valor: entry.value },
          { metrica: 'Participação', valor: pct(entry.pct) },
        ],
      })
      return
    }

    open({
      title: `Fornecedores — ${entry.name}`,
      subtitle: `${entry.pct.toFixed(1)}% do total — ${fmtShort(entry.value)} · ${fornecedoresRegime.length} fornecedor${fornecedoresRegime.length > 1 ? 'es' : ''}`,
      accentColor: entry.fill,
      columns: [
        { key: 'cnpj', label: 'Fornecedor' },
        { key: 'valor', label: 'Valor AR', format: 'currencyShort' },
        { key: 'cargaAR', label: 'Carga AR', format: 'percent' },
        { key: 'cargaDR', label: 'Carga DR', format: 'percent' },
      ],
      rows: fornecedoresRegime.map(f => ({
        cnpj: f.nome || f.cnpj || '(sem CNPJ)',
        valor: f.valorAR,
        cargaAR: f.cargaARPct,
        cargaDR: f.cargaDRPct,
      })),
    })
  }

  return (
    <div className="flex flex-col lg:flex-row items-center gap-8">
      <div className="relative w-72 h-72 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pie}
              cx="50%" cy="50%"
              innerRadius={90} outerRadius={120}
              dataKey="value"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...(active !== null ? { activeIndex: active, activeShape: (p: any) => <ActiveSlice {...p} /> } : {})}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              stroke="none"
            >
              {pie.map((entry, i) => <Cell key={i} fill={entry.fill} opacity={active === null || active === i ? 1 : 0.3} cursor="pointer" onClick={() => abrirRegime(entry)} />)}
            </Pie>
            <Tooltip content={<ChartTooltip formatter={fmtShort} />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            {shown ? (
              <motion.div key={shown.name} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.2 }} className="text-center px-4">
                <p className="text-2xl font-bold text-foreground font-tabular">{shown.pct.toFixed(1)}%</p>
                <p className="text-xs text-foreground/40 mt-1">{shown.name}</p>
              </motion.div>
            ) : (
              <motion.div key="total" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.2 }} className="text-center">
                <p className="text-xs text-foreground/30 uppercase tracking-widest mb-1">Total</p>
                <p className="text-xl font-bold text-foreground font-tabular">{fmtShort(total)}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex-1 space-y-3 w-full">
        {pie.sort((a, b) => b.value - a.value).map((entry, i) => (
          <motion.div
            key={entry.name}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.6 }}
            onMouseEnter={() => setActive(pie.indexOf(entry))}
            onMouseLeave={() => setActive(null)}
            onClick={() => abrirRegime(entry)}
            className="flex items-center gap-3 group cursor-pointer rounded-lg -mx-2 px-2 py-1 transition-colors hover:bg-foreground/[0.03]"
          >
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: entry.fill }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-foreground/70 truncate group-hover:text-foreground transition-colors">{entry.name}</span>
                <span className="text-sm font-semibold text-foreground ml-2 font-tabular">{entry.pct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: entry.fill }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${entry.pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: i * 0.06 + 0.2 }}
                />
              </div>
            </div>
            <span className="text-xs text-foreground/30 shrink-0 font-tabular w-20 text-right">{fmtShort(entry.value)}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Ranked list tooltip (Fornecedor) ─────────────────────────────────────────
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

// ─── Fornecedor Ranked List ───────────────────────────────────────────────────

function FornecedorList({ data, type }: { data: ComprasFornecedorRow[]; type: 'aumento' | 'reducao' }) {
  const { open } = useDrillDown()
  const sorted = [...data]
    .filter(d => type === 'aumento' ? d.cargaDRPct > d.cargaARPct : d.cargaDRPct < d.cargaARPct)
    .sort((a, b) =>
      type === 'aumento'
        ? (b.cargaDRPct - b.cargaARPct) - (a.cargaDRPct - a.cargaARPct)
        : (a.cargaDRPct - a.cargaARPct) - (b.cargaDRPct - b.cargaARPct)
    )
    .slice(0, 5)

  if (!sorted.length) return <p className="text-sm text-foreground/20 text-center py-4">—</p>

  const chartData: RankedPoint[] = sorted.map(item => ({
    label: item.nome || item.cnpj || '(sem CNPJ)',
    diff: item.cargaDRPct - item.cargaARPct,
    ar: item.cargaARPct,
    dr: item.cargaDRPct,
    valor: item.valorAR,
  }))

  function abrirFornecedor(item: ComprasFornecedorRow) {
    open({
      title: item.nome || item.cnpj || '(sem CNPJ)',
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
        <YAxis type="category" dataKey="label" width={124} axisLine={false} tickLine={false} className="font-tabular" tick={<ClickableTick onSelect={i => abrirFornecedor(sorted[i])} />} />
        <Tooltip content={<RankedTooltip />} cursor={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }} />
        <Bar dataKey="diff" name="Variação de carga" radius={[0, 3, 3, 0]} barSize={16} activeBar={ACTIVE_BAR}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.diff > 0 ? LOSS : GAIN} onClick={() => abrirFornecedor(sorted[i])} className="cursor-pointer" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface ComprasChartsProps {
  comprasNCM: ComprasNCMRow[]
  comprasRegime: ComprasRegimeRow[]
  comprasFornecedores: ComprasFornecedorRow[]
  ano?: number | null
}

export function ComprasCharts({ comprasNCM, comprasRegime, comprasFornecedores, ano }: ComprasChartsProps) {
  return (
    <div className="space-y-16 pb-10">

      {/* NCM */}
      {comprasNCM.length > 0 && (
        <section>
          <SectionLabel index="01" title="Valores por Produto" subtitle="Comparação de carga tributária antes e depois da reforma" explain="Cada barra é um produto (ou NCM, quando a planilha não traz o código do produto). Clique numa barra pra ver o detalhe; clique em 'Ver mais' pra lista completa." />
          <FadeUp delay={0.1}>
            <div className={CARD}>
              <NCMBars data={comprasNCM} ano={ano} />
            </div>
          </FadeUp>
        </section>
      )}

      {/* Regime Fornecedor */}
      {comprasRegime.length > 0 && (
        <section>
          <SectionLabel index="02" title="Regime dos Fornecedores" subtitle="Distribuição de valor de compras por regime tributário do fornecedor — clique para ver os fornecedores" explain="Passe o mouse sobre uma fatia pra ver o total; clique pra abrir a lista de fornecedores daquele regime. Regime do fornecedor importa porque muda como o crédito de IBS/CBS funciona pra você." />
          <FadeUp delay={0.1}>
            <div className={CARD}>
              <RegimeDonut data={comprasRegime} fornecedores={comprasFornecedores} />
            </div>
          </FadeUp>
        </section>
      )}

      {/* Fornecedores */}
      {comprasFornecedores.length > 0 && (
        <section>
          <SectionLabel index="03" title="Fornecedores" subtitle="Impacto da reforma na carga tributária por fornecedor (CNPJ)" explain="Top 5 fornecedores com maior aumento e maior redução de carga tributária, comparando antes e depois da reforma." />
          <FadeUp delay={0.1}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={CARD}>
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="h-4 w-4 text-loss" />
                  <span className="text-sm font-semibold text-foreground/60">Maior Aumento de Carga</span>
                </div>
                <FornecedorList data={comprasFornecedores} type="aumento" />
              </div>
              <div className={CARD}>
                <div className="flex items-center gap-2 mb-6">
                  <TrendingDown className="h-4 w-4 text-gain" />
                  <span className="text-sm font-semibold text-foreground/60">Maior Redução de Carga</span>
                </div>
                <FornecedorList data={comprasFornecedores} type="reducao" />
              </div>
            </div>
          </FadeUp>
        </section>
      )}

    </div>
  )
}
