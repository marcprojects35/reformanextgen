'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LabelList,
} from 'recharts'
import type { VendasB2CRow, VendasRegimeRow } from '@/lib/admin-engine'
import { fmtShort, pct, sign } from '@/lib/admin-format'
import { chartColor, ChartTooltip, ACTIVE_BAR, GOLD } from '@/lib/admin-colors'
import { useDrillDown } from '@/components/admin/drill-down'
import { ClickableTick } from '@/components/admin/clickable-tick'
import { Explain } from '@/components/admin/explain-tooltip'

// ─── FadeUp ───────────────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── B2B / B2C Section ────────────────────────────────────────────────────────

function B2BDonut({ pie }: { pie: { name: string; value: number; share: number; fill: string }[] }) {
  const { open } = useDrillDown()
  const [active, setActive] = useState<number | null>(null)

  return (
    <div className="rounded-2xl border border-border bg-foreground/[0.025] p-4 flex flex-col items-center justify-center shrink-0 w-full lg:w-60">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={pie} cx="50%" cy="50%" innerRadius={58} outerRadius={80} dataKey="value" stroke="none">
            {pie.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.fill}
                stroke={i === active ? GOLD : 'none'}
                strokeWidth={i === active ? 2 : 0}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                cursor="pointer"
                onClick={() => open({
                  title: entry.name,
                  accentColor: entry.fill,
                  columns: [
                    { key: 'metrica', label: 'Métrica' },
                    { key: 'valor', label: 'Valor', format: 'currencyShort' },
                  ],
                  rows: [
                    { metrica: 'Volume', valor: entry.value },
                    { metrica: 'Participação', valor: pct(entry.share) },
                  ],
                })}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip formatter={fmtShort} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-1">
        {pie.map(p => (
          <div key={p.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.fill }} />
            <span className="text-[11px] text-foreground/50">{p.name}</span>
            <span className="text-[11px] font-semibold text-foreground font-tabular">{pct(p.share)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function B2BSection({ vendasB2C }: { vendasB2C: VendasB2CRow[] }) {
  if (!vendasB2C.length) return null

  const totalAR = vendasB2C.reduce((s, r) => s + r.valorAR, 0)
  const pie = vendasB2C.map((row, i) => ({
    name: row.tipo,
    value: row.valorAR,
    share: totalAR > 0 ? (row.valorAR / totalAR) * 100 : 0,
    fill: chartColor(i),
  }))

  return (
    <FadeUp>
      <Explain text="B2B = você vende pra outra empresa (identificada pelo CNPJ do cliente). B2C = você vende pro consumidor final (identificado pelo CPF)." className="mb-4 block w-fit">
        <div>
          <p className="text-xs text-foreground/20 font-mono tracking-[0.2em] uppercase mb-2">Segmentação de Clientes</p>
          <h3 className="text-2xl font-bold text-foreground">B2B vs B2C</h3>
          <p className="mt-1 text-sm text-foreground/35">Distribuição das vendas por tipo de comprador</p>
        </div>
      </Explain>

      <div className="flex flex-col lg:flex-row gap-4 mt-6">
        <B2BDonut pie={pie} />

        <div className="grid sm:grid-cols-2 gap-4 flex-1">
          {vendasB2C.map((row, i) => {
            const shareAR = totalAR > 0 ? (row.valorAR / totalAR) * 100 : 0
            const cargaDelta = row.cargaDRPct - row.cargaARPct
            const isB2B = row.tipo === 'B2B'
            const badgeClass = i === 0
              ? 'bg-chart-1/10 text-chart-1 border-chart-1/20'
              : 'bg-chart-2/10 text-chart-2 border-chart-2/20'

            return (
              <Explain
                key={row.tipo}
                className="block"
                text={`${isB2B ? 'Vendas para outras empresas (CNPJ).' : 'Vendas para consumidor final (CPF).'} "Carga AR" é o quanto de imposto pesa hoje sobre essas vendas; "Carga DR" é o mesmo cálculo com as regras do ano selecionado — a variação em pp é a diferença em pontos percentuais.`}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.7 }}
                  className="rounded-2xl border border-border bg-foreground/[0.025] p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] text-foreground/30 uppercase tracking-widest mb-1">
                        {isB2B ? 'Pessoa Jurídica' : 'Pessoa Física'}
                      </p>
                      <p className="text-lg font-bold text-foreground">{row.tipo}</p>
                    </div>
                    <div className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold font-tabular ${badgeClass}`}>
                      {row.count.toLocaleString('pt-BR')} notas
                    </div>
                  </div>

                  <p className="text-2xl font-bold text-foreground font-tabular mb-1">{fmtShort(row.valorAR)}</p>
                  <p className="text-[11px] text-foreground/30 mb-4">{pct(shareAR)} do faturamento total</p>

                  {/* Carga comparison */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-foreground/[0.02] border border-border p-2.5">
                      <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-1">Carga AR</p>
                      <p className="text-sm font-semibold text-foreground/70 font-tabular">{pct(row.cargaARPct)}</p>
                    </div>
                    <div className={`rounded-lg border p-2.5 ${cargaDelta > 0 ? 'border-loss/20 bg-loss/5' : 'border-gain/20 bg-gain/5'}`}>
                      <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-1">Carga DR</p>
                      <p className={`text-sm font-semibold font-tabular ${cargaDelta > 0 ? 'text-loss' : 'text-gain'}`}>
                        {pct(row.cargaDRPct)}
                        <span className="text-[10px] ml-1">({sign(cargaDelta)}{cargaDelta.toFixed(1)}pp)</span>
                      </p>
                    </div>
                  </div>
                </motion.div>
              </Explain>
            )
          })}
        </div>
      </div>
    </FadeUp>
  )
}

// ─── Regime Clientes Bars ─────────────────────────────────────────────────────

function RegimeClientesBars({ vendasRegime }: { vendasRegime: VendasRegimeRow[] }) {
  const { open } = useDrillDown()

  if (!vendasRegime.length) return null

  const sorted = [...vendasRegime].sort((a, b) => b.valorAR - a.valorAR)
  const total = sorted.reduce((s, r) => s + r.valorAR, 0)
  const data = sorted.map(r => ({
    regime: r.regime,
    valorAR: r.valorAR,
    share: total > 0 ? (r.valorAR / total) * 100 : 0,
  }))

  function abrirRegime(i: number) {
    const d = data[i]
    open({
      title: d.regime,
      accentColor: chartColor(i),
      columns: [
        { key: 'metrica', label: 'Métrica' },
        { key: 'valor', label: 'Valor', format: 'currency' },
      ],
      rows: [
        { metrica: 'Faturamento', valor: d.valorAR },
        { metrica: 'Participação', valor: pct(d.share) },
      ],
    })
  }

  return (
    <FadeUp delay={0.1}>
      <Explain text="Regime tributário informado pelo seu cliente (CNPJ) — clique numa barra pra ver o faturamento e a participação daquele regime." className="mb-4 block w-fit">
        <div>
          <p className="text-xs text-foreground/20 font-mono tracking-[0.2em] uppercase mb-2">Perfil de Compradores</p>
          <h3 className="text-2xl font-bold text-foreground">Regime dos Clientes</h3>
          <p className="mt-1 text-sm text-foreground/35">Distribuição de faturamento por regime tributário do cliente</p>
        </div>
      </Explain>

      <div className="rounded-2xl border border-border bg-foreground/[0.025] p-4 mt-6">
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--foreground) 4%, transparent)" horizontal={false} />
            <XAxis type="number" tickFormatter={v => fmtShort(v)} tick={{ fill: 'color-mix(in srgb, var(--foreground) 25%, transparent)', fontSize: 10 }} axisLine={false} tickLine={false} className="font-tabular" />
            <YAxis type="category" dataKey="regime" width={150} axisLine={false} tickLine={false} tick={<ClickableTick onSelect={abrirRegime} fontSize={11} />} />
            <Tooltip content={<ChartTooltip formatter={fmtShort} />} cursor={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }} />
            <Bar dataKey="valorAR" name="Faturamento" radius={[0, 3, 3, 0]} barSize={16} activeBar={ACTIVE_BAR}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={chartColor(i)}
                  cursor="pointer"
                  onClick={() => abrirRegime(i)}
                />
              ))}
              <LabelList
                dataKey="valorAR"
                position="right"
                formatter={v => fmtShort(Number(v))}
                fill="color-mix(in srgb, var(--foreground) 55%, transparent)"
                fontSize={11}
                className="font-tabular"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </FadeUp>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function MercadoCharts({ vendasB2C, vendasRegime }: {
  vendasB2C: VendasB2CRow[]
  vendasRegime: VendasRegimeRow[]
}) {
  const hasData = vendasB2C.length > 0 || vendasRegime.length > 0

  if (!hasData) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-foreground/25 italic">Dados de segmentação não disponíveis neste relatório</p>
      </div>
    )
  }

  return (
    <div className="space-y-16 pb-10">
      {vendasB2C.length > 0 && <B2BSection vendasB2C={vendasB2C} />}
      {vendasRegime.length > 0 && <RegimeClientesBars vendasRegime={vendasRegime} />}
    </div>
  )
}
