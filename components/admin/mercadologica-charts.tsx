'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import type { CategoriaMercadologicaRow } from '@/lib/merc-categorias'
import { R$, pct, fmtShort } from '@/lib/admin-format'
import { GAIN, LOSS, ChartTooltip, ACTIVE_BAR } from '@/lib/admin-colors'
import { Explain } from '@/components/admin/explain-tooltip'
import { ClickableTick } from '@/components/admin/clickable-tick'

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

const SECAO_ICONS: Record<string, string> = {
  'Alimentos':                  '🍽️',
  'Não Alimentos':               '🧴',
  'Apropriações':                '🧾',
  'Animais Vivos':               '🐾',
  'Material de Construção':      '🧱',
  'Automotivo':                  '🚗',
  'Hospitalar e Médico':         '🏥',
  'Veículos':                    '🚙',
  'Industrial e Equipamentos':   '⚙️',
  'Não Classificado':            '❔',
}

// ─── Bar chart AR vs DR por Seção ───────────────────────────────────────────

function MercadologicaBarChart({ data, title, ano, selected, onSelect }: {
  data: CategoriaMercadologicaRow[]
  title: string
  ano?: number | null
  selected: string | null
  onSelect: (categoria: string) => void
}) {
  const sorted = [...data].sort((a, b) => b.valorAR - a.valorAR)
  const chartData = sorted.map(r => ({ categoria: r.categoria, AR: r.valorAR, DR: r.valorDR, diffCusto: r.diffCusto }))

  return (
    <div className="rounded-xl border border-border bg-foreground/[0.02] p-4">
      <Explain text="Agrupa produtos por Seção da taxonomia de mercado (alimentos, saúde etc.), não pelo NCM — verde = custo caiu com a Reforma, vermelho = subiu. Clique numa categoria pra ver o detalhe." className="mb-3 block w-fit">
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{title}</p>
      </Explain>
      <ResponsiveContainer width="100%" height={Math.max(140, chartData.length * 40)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--foreground) 4%, transparent)" horizontal={false} />
          <XAxis type="number" tickFormatter={v => fmtShort(v)} tick={{ fill: 'color-mix(in srgb, var(--foreground) 25%, transparent)', fontSize: 10 }} axisLine={false} tickLine={false} className="font-tabular" />
          <YAxis
            type="category"
            dataKey="categoria"
            width={140}
            axisLine={false}
            tickLine={false}
            tick={<ClickableTick onSelect={i => onSelect(chartData[i].categoria)} fontSize={11} />}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }} />
          <Bar dataKey="AR" name="Antes" fill="color-mix(in srgb, var(--foreground) 22%, transparent)" radius={[0, 3, 3, 0]} barSize={10} activeBar={ACTIVE_BAR} />
          <Bar dataKey="DR" name={ano ? `Depois (${ano})` : 'Depois'} radius={[0, 3, 3, 0]} barSize={10} activeBar={ACTIVE_BAR}>
            {chartData.map((d, i) => (
              <Cell
                key={i}
                fill={d.diffCusto <= 0 ? GAIN : LOSS}
                stroke={d.categoria === selected ? 'var(--foreground)' : 'none'}
                strokeWidth={d.categoria === selected ? 1 : 0}
                cursor="pointer"
                onClick={() => onSelect(d.categoria)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CatSummary({ row, delay }: { row: CategoriaMercadologicaRow; delay: number }) {
  const diff = row.diffCusto
  const isReduction = diff < 0

  return (
    <FadeUp delay={delay}>
      <Explain text='Agrupa os NCMs por Seção da taxonomia de mercado (ex.: alimentos, saúde) — útil pra ver o impacto em categorias como cesta básica, que o NCM sozinho não deixa evidente. "Carga AR/DR" é o imposto de hoje vs. do ano selecionado.' className="block">
      <div className="w-full rounded-xl border border-border bg-foreground/[0.025] p-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground/[0.06] text-xs">
              {SECAO_ICONS[row.categoria] ?? '📦'}
            </span>
            <div>
              <p className="text-xs font-semibold text-foreground">{row.categoria}</p>
              <p className="text-[10px] text-foreground/35 font-tabular">{row.count.toLocaleString('pt-BR')} NCMs</p>
            </div>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold font-tabular ${isReduction ? 'text-gain bg-gain/10' : 'text-loss bg-loss/10'}`}>
            {isReduction ? '▼' : '▲'} {pct(Math.abs(row.cargaDRPct - row.cargaARPct))}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-border pt-2.5">
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
        </div>
      </div>
      </Explain>
    </FadeUp>
  )
}

// ─── Bloco Compras/Vendas (gráfico + card da categoria selecionada) ──────────
// O card de detalhe só aparece depois de clicar numa categoria do gráfico —
// mostrar as 8 categorias sempre ligadas ocupava a tela toda sem necessidade.

export function MercadologicaBlock({ tag, tagClass, subtitle, data, ano }: {
  tag: string
  tagClass: string
  subtitle: string
  data: CategoriaMercadologicaRow[]
  ano?: number | null
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const selectedRow = data.find(r => r.categoria === selected) ?? null

  return (
    <div className="space-y-3">
      <FadeUp>
        <div className="flex items-center gap-3">
          <span className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold ${tagClass}`}>{tag}</span>
          <p className="text-xs text-foreground/30">{subtitle}</p>
        </div>
      </FadeUp>
      <MercadologicaBarChart
        data={data}
        title="Valor por Categoria — Antes vs Depois"
        ano={ano}
        selected={selected}
        onSelect={categoria => setSelected(prev => prev === categoria ? null : categoria)}
      />
      {selectedRow && <CatSummary row={selectedRow} delay={0} />}
    </div>
  )
}

