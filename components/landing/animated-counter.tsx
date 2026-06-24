'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import { cn } from '@/lib/utils'

type AnimatedCounterProps = {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

/**
 * Counts up as the element scrolls through view — scrubbed by scroll
 * position rather than a timer, so it tracks scroll direction and speed.
 */
export function AnimatedCounter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.9', 'start 0.35'],
  })
  const count = useTransform(scrollYProgress, [0, 1], [0, value])
  const rounded = useTransform(count, (latest) =>
    latest.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  )

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  )
}
