'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { extractPaletteFromImage } from '@/lib/color-extract'

// Cores neutras (amber/cinza da marca) usadas quando não há logo ou a extração falha.
const FALLBACK_PALETTE = ['rgb(255, 180, 0)', 'rgb(140, 140, 150)', 'rgb(255, 180, 0)']

interface Blob { color: string; top: string; left: string; size: number; duration: number; delay: number }

/**
 * Fundo ambiente para as telas do cliente (dashboard logado e link público) — glows
 * radiais grandes, desfocados e em baixa opacidade que derivam da cor da marca do
 * cliente (extraída do logo) e ficam "respirando" devagar, tipo dashboard de
 * videogame (Xbox/PlayStation) que reage à arte do jogo atual.
 */
export function AmbientBackground({ logoUrl }: { logoUrl?: string | null }) {
  const [colors, setColors] = useState<string[] | null>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    let cancelled = false
    if (!logoUrl) { setColors(null); return }
    extractPaletteFromImage(logoUrl).then(palette => {
      if (!cancelled) setColors(palette.length ? palette : null)
    })
    return () => { cancelled = true }
  }, [logoUrl])

  const palette = colors && colors.length ? colors : FALLBACK_PALETTE
  const blobs: Blob[] = [
    { color: palette[0], top: '-10%', left: '-8%', size: 620, duration: 26, delay: 0 },
    { color: palette[1] ?? palette[0], top: '55%', left: '68%', size: 560, duration: 32, delay: 3 },
    { color: palette[2] ?? palette[0], top: '78%', left: '2%', size: 480, duration: 38, delay: 6 },
  ]

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
            opacity: 0.22,
            filter: 'blur(90px)',
          }}
          animate={reduceMotion ? undefined : {
            x: [0, 60, -40, 0],
            y: [0, -50, 40, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{ duration: b.duration, delay: b.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}
