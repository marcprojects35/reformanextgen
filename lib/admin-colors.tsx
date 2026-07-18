// Sistema de cor compartilhado do admin — "terminal financeiro".
// Ganho/perda vívidos (validados com a skill dataviz: 9.4:1 / 5.6:1 contra #09090b)
// + paleta categórica de 7 tons validada (validate_palette.js — todas checagens OK)
// que nunca usa verde/vermelho puro, para não colidir com o significado de ganho/perda.

import { fmtShort } from '@/lib/admin-format'

export const GAIN = '#00e28c'
export const LOSS = '#f6465d'
export const GOLD = '#ffb400'

export const CHART_COLORS = [
  '#3987e5', // azul
  '#199e70', // verde-azulado
  '#9085e9', // violeta
  '#d55181', // magenta
  '#d95926', // laranja
  '#6366f1', // índigo
  '#0ea5b5', // ciano
] as const

export function chartColor(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length]
}

/**
 * Cor de um delta. `invert` = true quando um valor negativo é bom
 * (ex.: redução de custo) em vez do padrão (valor positivo é bom).
 */
export function deltaColor(value: number, invert = false): string {
  const good = invert ? value <= 0 : value >= 0
  return good ? GAIN : LOSS
}

export function deltaTextClass(isGood: boolean): string {
  return isGood ? 'text-gain' : 'text-loss'
}

export function deltaBgClass(isGood: boolean): string {
  return isGood
    ? 'border-gain/25 bg-gain/10'
    : 'border-loss/25 bg-loss/10'
}

/** Contorno dourado (cor da marca) pra destacar a barra/fatia sob o mouse, sem
 *  perder a cor semântica de ganho/perda do preenchimento — usado junto com um
 *  estado `activeIndex` (onMouseEnter/onMouseLeave por barra) em todo gráfico
 *  interativo do admin. */
export function hoverCellProps(isActive: boolean): { stroke: string; strokeWidth: number } {
  return isActive ? { stroke: GOLD, strokeWidth: 2 } : { stroke: 'none', strokeWidth: 0 }
}

/** Prop `activeBar` do recharts — contorno dourado nativo na barra sob o mouse,
 *  sem precisar rastrear estado manualmente. Usar em todo `<Bar activeBar={ACTIVE_BAR}>`. */
export const ACTIVE_BAR = { stroke: GOLD, strokeWidth: 2, fillOpacity: 0.95 }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null
  const fmt = formatter ?? fmtShort
  return (
    <div className="rounded-lg border border-border bg-popover/95 backdrop-blur-xl px-3 py-2 shadow-2xl">
      {label != null && <p className="text-[10px] text-muted-foreground mb-1.5 font-tabular">{label}</p>}
      {payload.map((p: { name: string; value: number; color: string; fill?: string }, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: p.color ?? p.fill }} />
          <span className="text-[11px] text-muted-foreground">{p.name}</span>
          <span className="text-xs font-semibold text-foreground ml-2 font-tabular">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/** Estilos compartilhados para eixos/grid do recharts — adaptam ao tema via CSS vars. */
export const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 10 } as const
export const AXIS_TICK_STRONG = { fill: 'var(--foreground)', fontSize: 11 } as const
export const GRID_STROKE = 'var(--border)'
export const CURSOR_FILL = { fill: 'var(--foreground)', fillOpacity: 0.04 } as const
