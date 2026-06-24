'use client'

import { useRef } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SpotlightCardProps = {
  children: ReactNode
  className?: string
}

/**
 * Wraps a card and renders a soft gold glow that follows the cursor,
 * the "spotlight hover" treatment seen on Linear, Vercel and Stripe.
 */
export function SpotlightCard({ children, className }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`)
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`)
  }

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      className={cn('group/spotlight relative isolate overflow-hidden', className)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/spotlight:opacity-100"
        style={{
          background:
            'radial-gradient(320px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(255,180,0,0.14), transparent 70%)',
        }}
        aria-hidden
      />
      {children}
    </div>
  )
}
