'use client'

import { motion } from 'motion/react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, Cell,
} from 'recharts'
import type { ComprasSimplesRow } from '@/lib/admin-engine'
import { fmtShort, pct } from '@/lib/admin-format'
import { chartColor, ChartTooltip } from '@/lib/admin-colors'
import { useDrillDown, DrillMoreRow, type DrillContent } from '@/components/admin/drill-down'
import { ClickableTick } from '@/components/admin/clickable-tick'
import { Explain } from '@/components/admin/explain-tooltip'

// ─── Helpers ────────────────────────────────────────────────────────────────

function maskCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length >= 14) {
    return `${digits.slice(0, 3)}.***.***/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
  }
  if (digits.length >= 11) {
    return `${digits.slice(0, 3)}.***.***-${digits.slice(9, 11)}`
  }
  if (cnpj.length > 8) {
    return `${cnpj.slice(0, 3)}...${cnpj.slice(-2)}`
  }
  return cnpj
}

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

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ comprasSimples, totalComprasAR }: {
  comprasSimples: ComprasSimplesRow[]
  totalComprasAR: number
}) {
  const totalSimples = comprasSimples.reduce((s, r) => s + r.valorAR, 0)
  const pctTotal = totalComprasAR > 0 ? (totalSimples / totalComprasAR) * 100 : 0

  return (
    <FadeUp>
      <div className="grid grid-cols-3 gap-3">
        <Explain text="Quanto você comprou de fornecedores que estão no Simples Nacional — esse crédito de IBS/CBS funciona diferente do regime normal, por isso vale acompanhar à parte." className="block">
          <div className="rounded-xl border border-border bg-foreground/[0.025] p-4">
            <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-2">Volume Simples</p>
            <p className="text-2xl font-bold text-primary font-tabular">{fmtShort(totalSimples)}</p>
            <p className="text-xs text-foreground/30 mt-1">em compras de fornecedores Simples</p>
          </div>
        </Explain>
        <Explain text="Fatia das suas compras totais que vem de fornecedores do Simples Nacional." className="block">
          <div className="rounded-xl border border-border bg-foreground/[0.025] p-4">
            <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-2">% do Total</p>
            <p className="text-2xl font-bold text-foreground font-tabular">{pct(pctTotal)}</p>
            <p className="text-xs text-foreground/30 mt-1">das compras totais</p>
          </div>
        </Explain>
        <Explain text="Quantos fornecedores distintos do Simples Nacional aparecem nas suas compras." className="block">
          <div className="rounded-xl border border-border bg-foreground/[0.025] p-4">
            <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-2">Fornecedores</p>
            <p className="text-2xl font-bold text-foreground font-tabular">{comprasSimples.length}</p>
            <p className="text-xs text-foreground/30 mt-1">no regime Simples Nacional</p>
          </div>
        </Explain>
      </div>
    </FadeUp>
  )
}

// ─── Fornecedor Bar Chart ─────────────────────────────────────────────────────

const FORNECEDOR_CHART_COUNT = 10

function FornecedorVolumeChart({ comprasSimples }: { comprasSimples: ComprasSimplesRow[] }) {
  const { open } = useDrillDown()
  const sorted = [...comprasSimples].sort((a, b) => b.valorAR - a.valorAR)
  const top = sorted.slice(0, FORNECEDOR_CHART_COUNT)
  const data = top.map(f => ({ cnpj: f.nome || maskCNPJ(f.cnpj), valorAR: f.valorAR, raw: f }))

  function abrirDetalhe(row: { cnpj: string; raw: ComprasSimplesRow }, color: string) {
    open({
      title: row.cnpj,
      subtitle: `${fmtShort(row.raw.valorAR)} · ${pct(row.raw.pctTotalCompras)} do total de compras`,
      accentColor: color,
      columns: [
        { key: 'produto', label: 'Produto' },
        { key: 'ncm', label: 'NCM', mono: true },
        { key: 'valor', label: 'Valor', format: 'currency' },
      ],
      rows: row.raw.ncms.map(n => ({ produto: n.descricao ?? '—', ncm: n.ncm, valor: n.valorAR })),
    })
  }

  const todosContent: DrillContent = {
    title: 'Todos os Fornecedores Simples',
    subtitle: `${sorted.length} fornecedores analisados`,
    wide: true,
    columns: [
      { key: 'fornecedor', label: 'Fornecedor' },
      { key: 'valor', label: 'Valor', format: 'currency' },
      { key: 'pct', label: '% do Total', format: 'percent' },
    ],
    rows: sorted.map(f => ({
      fornecedor: f.nome || maskCNPJ(f.cnpj),
      valor: f.valorAR,
      pct: f.pctTotalCompras,
    })),
  }

  return (
    <div className="rounded-xl border border-border bg-foreground/[0.02] p-4">
      <Explain text="Clique numa barra pra ver quais NCMs você compra daquele fornecedor do Simples Nacional." className="mb-3 block w-fit">
        <p className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wide">Volume de Compras por Fornecedor</p>
      </Explain>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--foreground) 4%, transparent)" horizontal={false} />
          <XAxis type="number" tickFormatter={v => fmtShort(v)} tick={{ fill: 'color-mix(in srgb, var(--foreground) 25%, transparent)', fontSize: 10 }} axisLine={false} tickLine={false} className="font-tabular" />
          <YAxis type="category" dataKey="cnpj" width={130} axisLine={false} tickLine={false} tick={<ClickableTick onSelect={i => abrirDetalhe(data[i], chartColor(i))} />} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }} />
          <Bar dataKey="valorAR" name="Volume" radius={[0, 3, 3, 0]} barSize={12} activeBar={{ stroke: 'var(--foreground)', strokeWidth: 2, fillOpacity: 1 }}>
            {data.map((d, i) => (
              <Cell key={i} fill={chartColor(i)} cursor="pointer" onClick={() => abrirDetalhe(d, chartColor(i))} />
            ))}
            <LabelList
              dataKey="valorAR"
              position="right"
              formatter={(v: string | number | boolean | null | undefined) => (typeof v === 'number' ? fmtShort(v) : '')}
              style={{ fill: 'color-mix(in srgb, var(--foreground) 55%, transparent)', fontSize: 10 }}
              className="font-tabular"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {sorted.length > FORNECEDOR_CHART_COUNT && (
        <DrillMoreRow content={todosContent} label={`Ver mais (+${sorted.length - FORNECEDOR_CHART_COUNT})`} className="mt-3" />
      )}
    </div>
  )
}

// ─── Fornecedor List ──────────────────────────────────────────────────────────

function FornecedorSimplesList({ comprasSimples }: { comprasSimples: ComprasSimplesRow[] }) {
  if (!comprasSimples.length) return null

  return (
    <FadeUp delay={0.1}>
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-foreground">Principais Fornecedores Simples</h3>
        <p className="text-sm text-foreground/35 mt-0.5">Top fornecedores no regime Simples Nacional por volume de compras</p>
      </div>

      <div className="mt-4">
        <FornecedorVolumeChart comprasSimples={comprasSimples} />
      </div>
    </FadeUp>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function SimplesCharts({ comprasSimples, totalComprasAR }: {
  comprasSimples: ComprasSimplesRow[]
  totalComprasAR: number
}) {
  if (!comprasSimples.length) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-foreground/25 italic">Nenhum fornecedor do Simples Nacional identificado</p>
      </div>
    )
  }

  return (
    <div className="space-y-10 pb-10">
      <SummaryCards comprasSimples={comprasSimples} totalComprasAR={totalComprasAR} />
      <FornecedorSimplesList comprasSimples={comprasSimples} />
    </div>
  )
}
