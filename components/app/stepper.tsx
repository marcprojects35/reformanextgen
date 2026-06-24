import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export function Stepper({
  steps,
  currentIndex,
}: {
  steps: string[]
  currentIndex: number
}) {
  return (
    <div className="flex items-center">
      {steps.map((step, index) => {
        const isDone = index < currentIndex
        const isCurrent = index === currentIndex
        return (
          <div key={step} className="flex items-center">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  isDone && 'bg-primary text-primary-foreground',
                  isCurrent && 'border-2 border-primary text-primary',
                  !isDone && !isCurrent && 'border border-border text-muted-foreground',
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  isCurrent || isDone ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-4 h-px w-10 sm:w-16',
                  isDone ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
