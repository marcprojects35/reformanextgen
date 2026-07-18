'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { motion } from 'motion/react'
import type { TributoComposicao } from '@/lib/admin-engine'
import { R$, fmtShort } from '@/lib/admin-format'
import { CHART_COLORS, GAIN, GOLD, ChartTooltip } from '@/lib/admin-colors'
import { useDrillDown } from '@/components/admin/drill-down'
import { Explain } from '@/components/admin/explain-tooltip'

// ─── Animation wrapper ────────────────────────────────────────────────────────

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

// ─── Slice builders ───────────────────────────────────────────────────────────
// "Antes": tributos antigos (ICMS combinado com ST/DIFAL, ISS, IPI, PIS/COFINS).
// "Depois": os novos tributos da reforma (IBS, CBS) — o que sobrar de tributo
// antigo (fase de transição) entra como resíduo.

function slicesAntes(t: TributoComposicao) {
  const icms = t.icms.ar + t.icmsSt.ar + t.icmsDifal.ar
  return [
    { name: 'ICMS (+ST/DIFAL)', value: icms },
    { name: 'ISS', value: t.iss.ar },
    { name: 'IPI', value: t.ipi.ar },
    { name: 'PIS/COFINS', value: t.pisCofins.ar },
  ].filter(s => s.value > 0)
}

function slicesDepois(t: TributoComposicao) {
  const residual = Math.max(0, (t.icms.dr + t.icmsSt.dr + t.icmsDifal.dr) + t.iss.dr + t.ipi.dr + t.pisCofins.dr)
  return [
    { name: 'IBS', value: t.ibs.dr },
    { name: 'CBS', value: t.cbs.dr },
    { name: 'Residual (transição)', value: residual },
  ].filter(s => s.value > 0)
}

function MiniDonut({ title, slices, accentColor, contexto }: { title: string; slices: { name: string; value: number }[]; accentColor?: string; contexto?: string }) {
  const { open } = useDrillDown()
  const [active, setActive] = useState<number | null>(null)
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (!slices.length || total === 0) {
    return (
      <div className="flex-1 rounded-xl border border-border bg-foreground/[0.02] p-4 flex flex-col items-center justify-center min-h-[220px]">
        <p className="text-xs text-foreground/25 uppercase tracking-widest mb-3">{title}</p>
        <p className="text-sm text-foreground/25">Sem dados</p>
      </div>
    )
  }
  const pie = slices
    .sort((a, b) => b.value - a.value)
    .map((s, i) => ({ ...s, pct: (s.value / total) * 100, fill: s.name.startsWith('Residual') ? 'color-mix(in srgb, var(--foreground) 18%, transparent)' : (accentColor ?? chartColorSafe(i)) }))

  function abrirFatia(s: { name: string; value: number; pct: number }) {
    open({
      title: s.name,
      subtitle: contexto,
      columns: [
        { key: 'nome', label: 'Tributo' },
        { key: 'valor', label: 'Valor', format: 'currency' },
        { key: 'pct', label: '% do total', format: 'percent' },
      ],
      rows: [{ nome: s.name, valor: s.value, pct: s.pct }],
    })
  }

  return (
    <div className="flex-1 rounded-xl border border-border bg-foreground/[0.02] p-4">
      <p className="text-xs text-foreground/40 uppercase tracking-widest mb-2 text-center">{title}</p>
      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pie} cx="50%" cy="50%" innerRadius={54} outerRadius={active !== null ? 76 : 72} dataKey="value" stroke="none">
              {pie.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.fill}
                  stroke={i === active ? GOLD : 'none'}
                  strokeWidth={i === active ? 2 : 0}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => abrirFatia(entry)}
                  className="cursor-pointer"
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip formatter={fmtShort} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-sm font-bold text-foreground font-tabular">{fmtShort(total)}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {pie.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-foreground/50">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.fill }} />
              {s.name}
            </span>
            <span className="text-foreground/70 font-tabular">{R$(s.value, 0)} · {s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Índices fixos (não-verde/vermelho) para as fatias "antes" — identidade, não ganho/perda.
function chartColorSafe(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length]
}

function Bloco({ titulo, dados, ano }: { titulo: string; dados: TributoComposicao; ano?: number | null }) {
  const totalAR = dados.icms.ar + dados.icmsSt.ar + dados.icmsDifal.ar + dados.iss.ar + dados.ipi.ar + dados.pisCofins.ar
  const totalDR = dados.ibs.dr + dados.cbs.dr
  const semIvaAR = dados.semIva.ar
  const semIvaDR = dados.semIva.dr

  return (
    <FadeUp delay={0.05} className="space-y-4">
      <h4 className="text-sm font-semibold text-foreground/60 uppercase tracking-wide">{titulo}</h4>
      <div className="flex flex-col sm:flex-row gap-4">
        <MiniDonut title="Antes da Reforma" slices={slicesAntes(dados)} contexto={titulo} />
        <MiniDonut title={`Depois da Reforma${ano ? ` (${ano})` : ''}`} slices={slicesDepois(dados)} accentColor={GAIN} contexto={titulo} />
      </div>
      {(semIvaAR > 0 || semIvaDR > 0) && (
        <Explain text="Parte do valor que não entra na base de cálculo de nenhum imposto sobre consumo (ICMS/ISS/PIS-COFINS antes, IBS/CBS depois) — ex.: isenções, imunidades ou operações fora do campo de incidência." className="block">
          <div className="rounded-xl border border-border bg-foreground/[0.02] p-4 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-foreground/30 uppercase tracking-widest mb-1">Base sem IVA — Antes</p>
              <p className="text-foreground font-semibold font-tabular">{R$(semIvaAR)}</p>
            </div>
            <div>
              <p className="text-foreground/30 uppercase tracking-widest mb-1">Base sem IVA — Depois</p>
              <p className="text-foreground font-semibold font-tabular">{R$(semIvaDR)}</p>
            </div>
          </div>
        </Explain>
      )}
      <p className="text-[11px] text-foreground/25">
        Total tributos antigos: <span className="text-foreground/60 font-tabular">{R$(totalAR)}</span> · Total IBS+CBS: <span className="text-foreground/60 font-tabular">{R$(totalDR)}</span>
      </p>
    </FadeUp>
  )
}

export function TributoCharts({ tributos, ano }: { tributos?: { compras: TributoComposicao; vendas: TributoComposicao }; ano?: number | null }) {
  if (!tributos) {
    return <p className="text-sm text-foreground/30">Sem quebra de tributos disponível para este relatório.</p>
  }
  return (
    <div className="space-y-10">
      <Bloco titulo="Compras" dados={tributos.compras} ano={ano} />
      <Bloco titulo="Vendas" dados={tributos.vendas} ano={ano} />
    </div>
  )
}
