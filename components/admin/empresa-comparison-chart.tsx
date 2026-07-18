'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import type { PeriodoAgrupado } from '@/lib/admin-engine'
import { fmtShort, pct } from '@/lib/admin-format'
import { CHART_COLORS, ChartTooltip } from '@/lib/admin-colors'
import { useDrillDown } from '@/components/admin/drill-down'

export function EmpresaComparisonChart({ periodos }: { periodos: PeriodoAgrupado[] }) {
  const { open } = useDrillDown()

  if (periodos.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-foreground/[0.02] p-8 text-center">
        <p className="text-sm text-foreground/30">Selecione ao menos um período para comparar.</p>
      </div>
    )
  }

  const data = periodos.map(p => ({
    label: p.label,
    chave: p.chave,
    Custo: p.resumo.custoDR,
    Receita: p.resumo.receitaDR,
    Resultado: p.resumo.resultadoDR,
  }))

  function abrirDetalhe(chave: string) {
    const p = periodos.find(x => x.chave === chave)
    if (!p) return
    open({
      title: p.label,
      subtitle: `${p.qtdRelatorios} relatório${p.qtdRelatorios !== 1 ? 's' : ''} agregados`,
      columns: [
        { key: 'metrica', label: 'Métrica' },
        { key: 'ar', label: 'Antes', format: 'currency' },
        { key: 'dr', label: 'Depois', format: 'currency' },
      ],
      rows: [
        { metrica: 'Custo', ar: p.resumo.custoAR, dr: p.resumo.custoDR },
        { metrica: 'Receita', ar: p.resumo.receitaAR, dr: p.resumo.receitaDR },
        { metrica: 'Resultado', ar: p.resumo.resultadoAR, dr: p.resumo.resultadoDR },
        { metrica: 'Impostos', ar: p.resumo.impostosAR, dr: p.resumo.impostosDR },
        { metrica: 'Carga Tributária', ar: pct(p.resumo.cargaTributariaARPct), dr: pct(p.resumo.cargaTributariaDRPct) },
      ],
    })
  }

  return (
    <div className="rounded-xl border border-border bg-foreground/[0.02] p-4">
      <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">
        Comparativo entre períodos selecionados — valores pós-reforma (DR)
        <span className="ml-2 text-foreground/25 normal-case font-normal">clique numa barra para ver o detalhe</span>
      </p>
      <ResponsiveContainer width="100%" height={Math.max(260, periodos.length * 70)}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--foreground) 4%, transparent)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'color-mix(in srgb, var(--foreground) 50%, transparent)', fontSize: 11 }} axisLine={false} tickLine={false} className="font-tabular" />
          <YAxis tickFormatter={v => fmtShort(v)} tick={{ fill: 'color-mix(in srgb, var(--foreground) 25%, transparent)', fontSize: 10 }} axisLine={false} tickLine={false} className="font-tabular" width={64} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'color-mix(in srgb, var(--foreground) 50%, transparent)' }} />
          <Bar dataKey="Custo" fill={CHART_COLORS[4]} radius={[3, 3, 0, 0]} barSize={28} cursor="pointer" onClick={(d: { payload?: { chave: string } }) => d.payload && abrirDetalhe(d.payload.chave)} />
          <Bar dataKey="Receita" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} barSize={28} cursor="pointer" onClick={(d: { payload?: { chave: string } }) => d.payload && abrirDetalhe(d.payload.chave)} />
          <Bar dataKey="Resultado" fill={CHART_COLORS[2]} radius={[3, 3, 0, 0]} barSize={28} cursor="pointer" onClick={(d: { payload?: { chave: string } }) => d.payload && abrirDetalhe(d.payload.chave)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
