'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react'
import { ArrowRight, Play, ShieldCheck } from 'lucide-react'
import { Parallax } from './parallax'
import { MagneticButton } from './magnetic-button'

export function Hero() {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  const textY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, -60])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])
  const textBlur = useTransform(
    scrollYProgress,
    [0, 0.7],
    reduceMotion ? [0, 0] : [0, 8],
  )
  const filter = useTransform(textBlur, (v) => `blur(${v}px)`)

  return (
    <section
      id="topo"
      ref={ref}
      className="relative overflow-hidden px-4 pb-24 pt-36 md:pb-32 md:pt-44"
    >
      {/* Ambient background */}
      <div className="bg-grid absolute inset-0 opacity-60" aria-hidden />
      <Parallax
        speed={50}
        className="absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full blur-[140px]"
      >
        <div
          className="h-full w-full rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,180,0,0.18), transparent 70%)' }}
        />
      </Parallax>

      <motion.div
        style={{ y: textY, opacity, filter }}
        className="relative mx-auto max-w-4xl text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <span className="flex h-1.5 w-1.5 rounded-full bg-success" />
          Reforma Tributária 2026 · IVA Dual · CBS &amp; IBS
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-balance text-4xl font-semibold leading-[0.98] tracking-tight md:text-6xl lg:text-8xl"
        >
          Antecipe o impacto da{' '}
          <span className="text-gradient-gold">Reforma Tributária</span> antes
          que ela aconteça.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          Simule cenários, compare regimes e descubra o caminho ideal de
          tributação para a sua empresa com a plataforma de análise mais moderna
          do Brasil.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <MagneticButton className="inline-flex">
            <a
              href="/cadastro"
              className="btn-shine glow-gold group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Simular minha empresa
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </MagneticButton>
          <a
            href="#demonstracao"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-6 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            <Play className="h-4 w-4 text-primary" />
            Ver demonstração
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"
        >
          <ShieldCheck className="h-4 w-4 text-success" />
          Dados criptografados · LGPD · Sem cartão de crédito
        </motion.div>
      </motion.div>
    </section>
  )
}
