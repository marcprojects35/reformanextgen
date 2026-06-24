'use client'

import { motion } from 'motion/react'

import type { WaterfallStep } from '@/lib/tax-engine/types'
import { formatCurrencyBRL } from '@/lib/labels'
import { cn } from '@/lib/utils'

export function WaterfallChart({ steps }: { steps: WaterfallStep[] }) {
  const maxAbs = Math.max(...steps.map((s) => Math.abs(s.valor)), 1)

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, index) => {
        const isTotal = index === 0 || index === steps.length - 1
        const widthPct = (Math.abs(step.valor) / maxAbs) * 100
        return (
          <div key={step.label} className="flex items-center gap-3">
            <span className="w-48 shrink-0 text-xs text-muted-foreground sm:w-56">
              {step.label}
            </span>
            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-secondary/40">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${widthPct}%` }}
                transition={{ duration: 0.6, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'h-full rounded-md',
                  isTotal && 'bg-primary',
                  !isTotal && step.valor >= 0 && 'bg-warning/70',
                  !isTotal && step.valor < 0 && 'bg-success/70',
                )}
              />
            </div>
            <span
              className={cn(
                'w-32 shrink-0 text-right text-xs font-medium tabular-nums sm:w-36',
                !isTotal && step.valor < 0 && 'text-success',
                !isTotal && step.valor >= 0 && 'text-warning',
              )}
            >
              {step.valor >= 0 ? '+' : ''}
              {formatCurrencyBRL(step.valor)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
