'use client'

import { useRef } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'

type MagneticButtonProps = {
  children: ReactNode
  className?: string
  strength?: number
}

/**
 * Nudges its content toward the cursor on hover, the subtle "attraction"
 * effect on primary buttons seen on award-winning agency sites.
 */
export function MagneticButton({
  children,
  className,
  strength = 0.35,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 200, damping: 15, mass: 0.3 })
  const springY = useSpring(y, { stiffness: 200, damping: 15, mass: 0.3 })

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    x.set((e.clientX - rect.left - rect.width / 2) * strength)
    y.set((e.clientY - rect.top - rect.height / 2) * strength)
  }

  function handlePointerLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ x: springX, y: springY }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
