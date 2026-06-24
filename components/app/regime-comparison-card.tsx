import { Sparkles } from 'lucide-react'

import type { RegimeResult } from '@/lib/tax-engine/types'
import { formatCurrencyBRL, formatPercent } from '@/lib/labels'
import { Badge } from '@/components/ui/badge'
import { SpotlightCard } from '@/components/landing/spotlight-card'
import { cn } from '@/lib/utils'

export function RegimeComparisonCard({
  regime,
  isIdeal,
  isAtual,
}: {
  regime: RegimeResult
  isIdeal: boolean
  isAtual: boolean
}) {
  return (
    <SpotlightCard
      className={cn(
        'relative h-full rounded-2xl border bg-card/70 p-5 backdrop-blur-sm transition-[transform,border-color] duration-300 hover:-translate-y-0.5',
        isIdeal ? 'border-primary/50 glow-gold' : 'border-border',
      )}
    >
      {isIdeal && (
        <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
          <Sparkles className="h-2.5 w-2.5" />
          Mais vantajoso em 2033
        </span>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold tracking-tight">{regime.label}</h3>
        {isAtual && <Badge variant="outline">Regime atual</Badge>}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-secondary/40 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Hoje · 2026
          </p>
          <p className="mt-1.5 text-lg font-semibold tabular-nums">
            {regime.tributosHoje == null ? '—' : formatCurrencyBRL(regime.tributosHoje)}
          </p>
          {regime.cargaHojePct != null && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatPercent(regime.cargaHojePct)} da receita
            </p>
          )}
        </div>

        <div
          className={cn(
            'rounded-xl p-3',
            isIdeal ? 'bg-primary/10' : 'bg-secondary/40',
          )}
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            2033 · Reforma plena
          </p>
          <p
            className={cn(
              'mt-1.5 text-lg font-semibold tabular-nums',
              isIdeal ? 'text-primary' : '',
            )}
          >
            {formatCurrencyBRL(regime.tributos2033)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatPercent(regime.carga2033Pct)} da receita
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
        {regime.tributosHoje == null ? (
          <span className="text-xs text-muted-foreground">
            Carga estimada com a reforma totalmente implementada
          </span>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">Economia estimada até 2033</span>
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                regime.economiaEstimada >= 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {regime.economiaEstimada >= 0 ? '+' : ''}
              {formatCurrencyBRL(regime.economiaEstimada)}
            </span>
          </div>
        )}
      </div>
    </SpotlightCard>
  )
}
