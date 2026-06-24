'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, Search, Sparkles, X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import type { SimulationWithCompany, SimulationStatus } from '@/lib/db'
import { setorLabels, statusLabels, formatSqliteDate, formatCurrencyBRL } from '@/lib/labels'
import { SpotlightCard } from '@/components/landing/spotlight-card'
import { Reveal } from '@/components/landing/reveal'
import { Badge } from '@/components/ui/badge'
import { DeleteSimulationButton } from './delete-simulation-button'

const statusVariant: Record<SimulationStatus, 'outline' | 'warning' | 'success' | 'destructive'> = {
  rascunho: 'outline',
  processando: 'warning',
  concluida: 'success',
  erro: 'destructive',
}

const STATUS_OPTS: { value: SimulationStatus | 'todas'; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'concluida', label: 'Concluídas' },
  { value: 'processando', label: 'Processando' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'erro', label: 'Com erro' },
]

export function DashboardClient({ simulations }: { simulations: SimulationWithCompany[] }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<SimulationStatus | 'todas'>('todas')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return simulations.filter((s) => {
      const matchQuery = !q || s.razao_social.toLowerCase().includes(q) || s.uf.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'todas' || s.status === statusFilter
      return matchQuery && matchStatus
    })
  }, [simulations, query, statusFilter])

  return (
    <div>
      {/* Search + filter bar */}
      <Reveal delay={0.08} y={10} className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por empresa ou UF…"
              className="h-10 w-full rounded-xl border border-input bg-secondary/40 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={[
                  'h-8 rounded-lg px-3 text-xs font-medium transition-colors',
                  statusFilter === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Simulation grid */}
      <div className="mt-5">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty-filter"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-border bg-card/60 py-14 text-center"
            >
              <p className="text-sm text-muted-foreground">
                Nenhuma simulação encontrada com esses filtros.
              </p>
              <button
                type="button"
                onClick={() => { setQuery(''); setStatusFilter('todas') }}
                className="mt-3 text-sm font-medium text-primary hover:underline"
              >
                Limpar filtros
              </button>
            </motion.div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((sim, i) => {
                const isClickable = sim.status === 'concluida'
                const card = (
                  <SpotlightCard
                    className={[
                      'group relative h-full rounded-2xl border bg-card/70 p-5 backdrop-blur-sm transition-[transform,border-color] duration-300',
                      isClickable ? 'cursor-pointer hover:-translate-y-1 hover:border-primary/40 border-border' : 'border-border/60',
                    ].join(' ')}
                  >
                    {isClickable && (
                      <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        <Sparkles className="h-2.5 w-2.5" />
                        Ver resultado
                      </span>
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold leading-snug tracking-tight">{sim.razao_social}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {setorLabels[sim.setor]} · {sim.uf}
                        </p>
                      </div>
                      <Badge variant={statusVariant[sim.status]}>{statusLabels[sim.status]}</Badge>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Faturamento anual</span>
                      <span className="font-semibold tabular-nums">{formatCurrencyBRL(sim.faturamento_anual)}</span>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                      <span>{formatSqliteDate(sim.created_at)}</span>
                      <div className="flex items-center gap-3">
                        {isClickable && (
                          <span className="inline-flex items-center gap-1 font-medium text-primary">
                            Abrir <ArrowRight className="h-3 w-3" />
                          </span>
                        )}
                        <DeleteSimulationButton simulationId={sim.id} />
                      </div>
                    </div>
                  </SpotlightCard>
                )

                return (
                  <motion.div
                    key={sim.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {isClickable ? (
                      <Link href={`/simulacao/${sim.id}/resultado`} className="block h-full">
                        {card}
                      </Link>
                    ) : card}
                  </motion.div>
                )
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
