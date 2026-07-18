'use client'

import { motion } from 'motion/react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { DRELinha, FluxoLinha } from '@/lib/admin-engine'
import { DRE_ANOS_LIST } from '@/lib/admin-engine'
import { fmtShort } from '@/lib/admin-format'
import { GAIN, LOSS, GOLD, ChartTooltip } from '@/lib/admin-colors'
import { useDrillDown } from '@/components/admin/drill-down'
import { Explain } from '@/components/admin/explain-tooltip'

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

// ─── DRE Projection Chart ─────────────────────────────────────────────────────

export function DREProjectionChart({ dre }: { dre: DRELinha[] }) {
  const { open } = useDrillDown()
  const lucro = dre.find(d =>
    d.categoria.toLowerCase().includes('líquido') ||
    d.categoria.toLowerCase().includes('liquido')
  )
  if (!lucro) return null

  const data = DRE_ANOS_LIST.map(ano => ({
    ano: String(ano),
    'Lucro Líquido': lucro.anos[ano] ?? 0,
  }))

  function abrirDetalhe(payload: { ano: string; 'Lucro Líquido': number } | undefined) {
    if (!payload) return
    open({
      title: `Lucro Líquido — ${payload.ano}`,
      accentColor: GAIN,
      columns: [{ key: 'ano', label: 'Ano' }, { key: 'valor', label: 'Valor', format: 'currency' }],
      rows: [{ ano: payload.ano, valor: payload['Lucro Líquido'] }],
    })
  }

  return (
    <FadeUp delay={0.05}>
      <div className="rounded-xl border border-border bg-foreground/[0.02] p-4">
        <Explain text="Projeta o Lucro Líquido ano a ano seguindo o cronograma oficial de transição da Reforma (2026-2033) — cada ano tem uma fatia diferente de IBS/CBS já em vigor." className="mb-3 block w-fit">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-gain" />
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Projeção do Lucro Líquido — 2026 a 2033</p>
          <span className="text-foreground/25 normal-case font-normal text-[11px]">clique num ponto para ver o detalhe</span>
        </div>
        </Explain>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="lucroGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={GAIN} stopOpacity={0.4} />
                <stop offset="95%" stopColor={GAIN} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--foreground) 4%, transparent)" />
            <XAxis dataKey="ano" tick={{ fill: 'color-mix(in srgb, var(--foreground) 25%, transparent)', fontSize: 10 }} axisLine={false} tickLine={false} className="font-tabular" />
            <YAxis tickFormatter={v => fmtShort(v)} tick={{ fill: 'color-mix(in srgb, var(--foreground) 20%, transparent)', fontSize: 10 }} axisLine={false} tickLine={false} width={60} className="font-tabular" />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="Lucro Líquido"
              stroke={GAIN}
              strokeWidth={2}
              fill="url(#lucroGrad)"
              dot={{ fill: GAIN, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: GAIN, stroke: GOLD, strokeWidth: 2, cursor: 'pointer', onClick: (props: any) => abrirDetalhe(props?.payload) }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </FadeUp>
  )
}

export function FluxoProjectionChart({ fluxo }: { fluxo: FluxoLinha[] }) {
  const { open } = useDrillDown()
  const resultado = fluxo.find(f => f.categoria.toLowerCase().includes('resultado'))
  if (!resultado) return null

  const data = DRE_ANOS_LIST.map(ano => ({
    ano: String(ano),
    'Resultado de Caixa': resultado.anos[ano] ?? 0,
  }))
  const isPositive = (resultado.dr ?? 0) >= (resultado.ar ?? 0)
  const color = isPositive ? GAIN : LOSS

  function abrirDetalhe(payload: { ano: string; 'Resultado de Caixa': number } | undefined) {
    if (!payload) return
    open({
      title: `Resultado de Caixa — ${payload.ano}`,
      accentColor: color,
      columns: [{ key: 'ano', label: 'Ano' }, { key: 'valor', label: 'Valor', format: 'currency' }],
      rows: [{ ano: payload.ano, valor: payload['Resultado de Caixa'] }],
    })
  }

  return (
    <FadeUp delay={0.05}>
      <div className="rounded-xl border border-border bg-foreground/[0.02] p-4">
        <Explain text="Projeta o Resultado de Caixa ano a ano seguindo o cronograma oficial de transição da Reforma (2026-2033), incluindo o efeito dos créditos e débitos de IBS/CBS." className="mb-3 block w-fit">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: color }} />
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Projeção do Resultado de Caixa — 2026 a 2033</p>
          <span className="text-foreground/25 normal-case font-normal text-[11px]">clique num ponto para ver o detalhe</span>
        </div>
        </Explain>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fluxoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--foreground) 4%, transparent)" />
            <XAxis dataKey="ano" tick={{ fill: 'color-mix(in srgb, var(--foreground) 25%, transparent)', fontSize: 10 }} axisLine={false} tickLine={false} className="font-tabular" />
            <YAxis tickFormatter={v => fmtShort(v)} tick={{ fill: 'color-mix(in srgb, var(--foreground) 20%, transparent)', fontSize: 10 }} axisLine={false} tickLine={false} width={60} className="font-tabular" />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="Resultado de Caixa"
              stroke={color}
              strokeWidth={2}
              fill="url(#fluxoGrad)"
              dot={{ fill: color, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: color, stroke: GOLD, strokeWidth: 2, cursor: 'pointer', onClick: (props: any) => abrirDetalhe(props?.payload) }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </FadeUp>
  )
}
