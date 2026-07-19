'use client'

import { motion } from 'motion/react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import type { CategoriaRow } from '@/lib/admin-engine'
import { R$, pct, fmtShort } from '@/lib/admin-format'
import { GAIN, LOSS, ChartTooltip, ACTIVE_BAR } from '@/lib/admin-colors'
import { useDrillDown, DrillMoreRow, type DrillContent } from '@/components/admin/drill-down'
import { ClickableTick } from '@/components/admin/clickable-tick'
import { Explain } from '@/components/admin/explain-tooltip'

// Compartilhado entre a barra do gráfico e os cards de resumo — os dois abrem
// o mesmo detalhe pra uma categoria, então montam o mesmo conteúdo do drill-down.
function categoriaDrillContent(r: CategoriaRow): DrillContent {
  return {
    title: r.categoria,
    subtitle: `Carga tributária: ${pct(r.cargaARPct)} → ${pct(r.cargaDRPct)}`,
    columns: [
      { key: 'metrica', label: 'Métrica' },
      { key: 'ar', label: 'Antes', format: 'currency' },
      { key: 'dr', label: 'Depois', format: 'currency' },
    ],
    rows: [
      { metrica: 'Valor', ar: r.valorAR, dr: r.valorDR },
      { metrica: 'Custo', ar: r.custoAR, dr: r.custoDR },
      ...(r.valorDesonerado ? [{ metrica: 'Valor Exonerado', ar: r.valorDesonerado, dr: r.valorDesonerado }] : []),
    ],
  }
}

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const CAT_ICONS: Record<string, string> = {
  'Produtos':                          '📦',
  'Serviços':                          '⚙️',
  'Locação de Imóveis':                '🏢',
  'Locação de Móveis':                 '🚛',
  'Venda de Imóveis':                  '🏠',
  'Substituição Tributária':           '🧾',
  'Sistemas de Integração':            '🌾',
  'Remessa p/ Exportação':             '🚢',
  'Ativo Imobilizado e Uso/Consumo':   '🛠️',
  'Créditos e Ressarcimento de ICMS':  '↩️',
  'Outras Entradas/Saídas':            '📄',
  'Outros':                            '📋',
}

// Índice categórico (1-7) na paleta compartilhada — não é julgamento de ganho/perda,
// então usa a paleta CHART_COLORS/chart-N em vez de verde/vermelho.
const CAT_COLOR_IDX: Record<string, number> = {
  'Produtos':                          1,
  'Serviços':                          3,
  'Locação de Imóveis':                5,
  'Locação de Móveis':                 2,
  'Venda de Imóveis':                  4,
  'Substituição Tributária':           6,
  'Sistemas de Integração':            2,
  'Remessa p/ Exportação':             1,
  'Ativo Imobilizado e Uso/Consumo':   5,
  'Créditos e Ressarcimento de ICMS':  3,
  'Outras Entradas/Saídas':            4,
  'Outros':                            7,
}

// Classes literais completas (Tailwind exige strings estáticas para o scanner JIT
// detectar — interpolação tipo `bg-chart-${idx}` não funciona).
const CAT_BADGE_CLASS: Record<number, string> = {
  1: 'bg-chart-1/15',
  2: 'bg-chart-2/15',
  3: 'bg-chart-3/15',
  4: 'bg-chart-4/15',
  5: 'bg-chart-5/15',
  6: 'bg-chart-6/15',
  7: 'bg-chart-7/15',
}

function catBadgeClass(categoria: string): string {
  const idx = CAT_COLOR_IDX[categoria] ?? 7
  return CAT_BADGE_CLASS[idx]
}

// ─── Bar chart AR vs DR (mesma convenção de ArDrBarChart em report-dashboard.tsx) ──

const CATEGORIA_INITIAL_COUNT = 8

function CategoriaBarChart({ data, title = 'Valor por Categoria — Antes vs Depois', ano }: { data: CategoriaRow[]; title?: string; ano?: number | null }) {
  const { open } = useDrillDown()
  const sorted = [...data].sort((a, b) => b.valorAR - a.valorAR)
  const top = sorted.slice(0, CATEGORIA_INITIAL_COUNT)
  const chartData = top.map(r => ({ categoria: r.categoria, AR: r.valorAR, DR: r.valorDR, custoAR: r.custoAR, custoDR: r.custoDR }))

  function abrirCategoria(r: CategoriaRow) {
    open(categoriaDrillContent(r))
  }

  const todasContent: DrillContent = {
    title,
    subtitle: `${sorted.length} categorias analisadas`,
    wide: true,
    columns: [
      { key: 'categoria', label: 'Categoria' },
      { key: 'ar', label: 'Antes', format: 'currency' },
      { key: 'dr', label: 'Depois', format: 'currency' },
      { key: 'impacto', label: 'Impacto Custo', format: 'costDelta' },
      { key: 'exonerado', label: 'Exonerado', format: 'currency' },
    ],
    rows: sorted.map(r => ({
      categoria: r.categoria,
      ar: r.valorAR,
      dr: r.valorDR,
      impacto: r.custoDR - r.custoAR,
      exonerado: r.valorDesonerado ?? 0,
    })),
  }

  return (
    <div className="rounded-xl border border-border bg-foreground/[0.02] p-4">
      <Explain text="Clique numa barra pra ver o detalhe da categoria. Verde = custo caiu com a Reforma; vermelho = subiu." className="mb-3 block w-fit">
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{title}</p>
      </Explain>
      <ResponsiveContainer width="100%" height={Math.max(140, chartData.length * 40)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--foreground) 4%, transparent)" horizontal={false} />
          <XAxis type="number" tickFormatter={v => fmtShort(v)} tick={{ fill: 'color-mix(in srgb, var(--foreground) 25%, transparent)', fontSize: 10 }} axisLine={false} tickLine={false} className="font-tabular" />
          <YAxis type="category" dataKey="categoria" width={120} axisLine={false} tickLine={false} tick={<ClickableTick onSelect={i => abrirCategoria(top[i])} fontSize={11} />} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }} />
          <Bar dataKey="AR" name="Antes" fill="color-mix(in srgb, var(--foreground) 22%, transparent)" radius={[0, 3, 3, 0]} barSize={10} activeBar={ACTIVE_BAR} />
          <Bar dataKey="DR" name={ano ? `Depois (${ano})` : 'Depois'} radius={[0, 3, 3, 0]} barSize={10} activeBar={ACTIVE_BAR}>
            {chartData.map((d, i) => (
              <Cell
                key={i}
                fill={d.custoDR <= d.custoAR ? GAIN : LOSS}
                onClick={() => abrirCategoria(top[i])}
                className="cursor-pointer"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {sorted.length > CATEGORIA_INITIAL_COUNT && (
        <DrillMoreRow content={todasContent} label={`Ver mais (+${sorted.length - CATEGORIA_INITIAL_COUNT})`} className="mt-3" />
      )}
    </div>
  )
}

// ─── Cartão de resumo por categoria (badges + stats, sem barra de progresso) ──────

function CatSummary({ row, delay }: { row: CategoriaRow; delay: number }) {
  const { open } = useDrillDown()
  const diff = row.custoDR - row.custoAR
  const isReduction = diff < 0

  return (
    <FadeUp delay={delay}>
      <Explain text='"Carga AR" é o quanto de imposto pesa hoje sobre esse grupo; "Carga DR" é o mesmo cálculo com as regras do ano selecionado. "Exonerado" é o valor com isenção/imunidade, que não entra na conta do imposto.' className="block">
      <button
        type="button"
        onClick={() => open(categoriaDrillContent(row))}
        className="w-full cursor-pointer rounded-xl border border-border bg-foreground/[0.025] p-3 text-left transition-colors hover:border-primary/30 hover:bg-foreground/[0.04]"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs ${catBadgeClass(row.categoria)}`}>
              {CAT_ICONS[row.categoria] ?? '📋'}
            </span>
            <div>
              <p className="text-xs font-semibold text-foreground">{row.categoria}</p>
              <p className="text-[10px] text-foreground/35 font-tabular">{row.count.toLocaleString('pt-BR')} transações</p>
            </div>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold font-tabular ${isReduction ? 'text-gain bg-gain/10' : 'text-loss bg-loss/10'}`}>
            {isReduction ? '▼' : '▲'} {pct(Math.abs(row.cargaDRPct - row.cargaARPct))}
          </span>
        </div>

        <div className={`grid gap-2 border-t border-border pt-2.5 ${row.valorDesonerado ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <div>
            <p className="text-[9px] text-foreground/30 uppercase tracking-wider">Carga AR</p>
            <p className="text-xs font-semibold text-foreground/70 font-tabular">{pct(row.cargaARPct)}</p>
          </div>
          <div>
            <p className="text-[9px] text-foreground/30 uppercase tracking-wider">Carga DR</p>
            <p className="text-xs font-semibold text-foreground/70 font-tabular">{pct(row.cargaDRPct)}</p>
          </div>
          <div>
            <p className="text-[9px] text-foreground/30 uppercase tracking-wider">Impacto Custo</p>
            <p className={`text-xs font-semibold font-tabular ${isReduction ? 'text-gain' : 'text-loss'}`}>
              {isReduction ? '-' : '+'}{R$(Math.abs(diff), 0)}
            </p>
          </div>
          {!!row.valorDesonerado && (
            <div>
              <p className="text-[9px] text-foreground/30 uppercase tracking-wider">Exonerado</p>
              <p className="text-xs font-semibold text-foreground/70 font-tabular">{R$(row.valorDesonerado, 0)}</p>
            </div>
          )}
        </div>
      </button>
      </Explain>
    </FadeUp>
  )
}

// ─── Compras — categoria de operação + quebras adicionais (Tipo de Operação, UF do
// Fornecedor, Benefício Fiscal, Origem) ────────────────────────────────────────

export function CompraCategoriaCharts({
  comprasCategorias,
  comprasTipoOperacao = [],
  comprasOrigemUF = [],
  comprasBeneficio = [],
  comprasOrigem = [],
  comprasCST = [],
  ano,
}: {
  comprasCategorias: CategoriaRow[]
  comprasTipoOperacao?: CategoriaRow[]
  comprasOrigemUF?: CategoriaRow[]
  comprasBeneficio?: CategoriaRow[]
  comprasOrigem?: CategoriaRow[]
  comprasCST?: CategoriaRow[]
  ano?: number | null
}) {
  const temDimensoes = comprasTipoOperacao.length > 0 || comprasOrigemUF.length > 0
    || comprasBeneficio.length > 0 || comprasOrigem.length > 0 || comprasCST.length > 0

  if (comprasCategorias.length === 0 && !temDimensoes) return null

  return (
    <div className="space-y-8">
      {comprasCategorias.length > 0 && (
        <div className="space-y-3">
          <CategoriaBarChart data={comprasCategorias} ano={ano} />
          <div className="grid gap-3 sm:grid-cols-2">
            {comprasCategorias.map((row, i) => (
              <CatSummary key={row.categoria} row={row} delay={i * 0.06} />
            ))}
          </div>
        </div>
      )}

      {temDimensoes && (
        <div className="space-y-3">
          <FadeUp>
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-chart-6/10 px-2.5 py-0.5 text-xs font-semibold text-chart-6">DIMENSÕES</span>
              <p className="text-xs text-foreground/30">Quebras adicionais das compras — operação, origem, benefício fiscal e CST</p>
            </div>
          </FadeUp>
          <div className="grid gap-3 lg:grid-cols-2">
            {comprasTipoOperacao.length > 0 && (
              <CategoriaBarChart data={comprasTipoOperacao} title="Tipo de Operação — Antes vs Depois" ano={ano} />
            )}
            {comprasOrigemUF.length > 0 && (
              <CategoriaBarChart data={comprasOrigemUF} title="UF do Fornecedor — Antes vs Depois" ano={ano} />
            )}
            {comprasBeneficio.length > 0 && (
              <CategoriaBarChart data={comprasBeneficio} title="Benefício Fiscal — Antes vs Depois" ano={ano} />
            )}
            {comprasOrigem.length > 0 && (
              <CategoriaBarChart data={comprasOrigem} title="Origem (Nacional/Importado) — Antes vs Depois" ano={ano} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Vendas — categoria de operação ────────────────────────────────────────────

export function VendaCategoriaCharts({
  vendasCategorias,
  ano,
}: {
  vendasCategorias: CategoriaRow[]
  ano?: number | null
}) {
  if (vendasCategorias.length === 0) return null

  return (
    <div className="space-y-3">
      <CategoriaBarChart data={vendasCategorias} ano={ano} />
      <div className="grid gap-3 sm:grid-cols-2">
        {vendasCategorias.map((row, i) => (
          <CatSummary key={row.categoria} row={row} delay={i * 0.06} />
        ))}
      </div>
    </div>
  )
}
