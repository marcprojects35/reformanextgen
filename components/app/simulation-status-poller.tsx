'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { motion } from 'motion/react'

import { SpotlightCard } from '@/components/landing/spotlight-card'

interface Props {
  simulationId: number
  /** Status inicial do servidor — polling só começa se for "processando" */
  initialStatus: string
}

export function SimulationStatusPoller({ simulationId, initialStatus }: Props) {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (initialStatus !== 'processando') return

    async function poll() {
      try {
        const res = await fetch(`/api/simulations/${simulationId}`)
        if (!res.ok) return
        const { simulation } = await res.json()
        if (simulation.status === 'concluida' || simulation.status === 'erro') {
          if (intervalRef.current) clearInterval(intervalRef.current)
          router.refresh()
        }
      } catch {
        // silently retry
      }
    }

    intervalRef.current = setInterval(poll, 3000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [simulationId, initialStatus, router])

  if (initialStatus !== 'processando') return null

  return (
    <SpotlightCard className="rounded-2xl border border-primary/30 bg-card/70 py-20 text-center backdrop-blur-sm glow-gold">
      <div className="relative mx-auto h-14 w-14">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
      <p className="mt-6 text-lg font-semibold tracking-tight">Calculando o impacto…</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Aplicando CBS, IBS e Imposto Seletivo sobre os dados da sua empresa.
        Esta página vai atualizar automaticamente.
      </p>
      <div className="mx-auto mt-6 h-1 w-48 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full rounded-full bg-primary"
          style={{ originX: 0 }}
          initial={{ width: '0%' }}
          animate={{ width: '85%' }}
          transition={{ duration: 20, ease: 'linear' }}
        />
      </div>
    </SpotlightCard>
  )
}
