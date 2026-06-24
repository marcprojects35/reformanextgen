'use client'

import { useRef } from 'react'
import type { ReactNode } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react'

type ParallaxProps = {
  children: ReactNode
  className?: string
  /** Max vertical travel in px as the section crosses the viewport. */
  speed?: number
}

/**
 * Wraps a decorative background element (e.g. an ambient glow) and drifts it
 * vertically at a different rate than the surrounding content, the layering
 * effect that creates depth in parallax scrolling.
 */
export function Parallax({ children, className, speed = 80 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [-speed, speed],
  )

  return (
    <motion.div ref={ref} style={{ y }} className={className} aria-hidden>
      {children}
    </motion.div>
  )
}
