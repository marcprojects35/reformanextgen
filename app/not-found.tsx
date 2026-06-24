'use client'

import Link from 'next/link'
import { motion } from 'motion/react'

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[700px] -translate-x-1/2 rounded-full blur-[160px]"
        style={{ background: 'radial-gradient(circle, rgba(255,180,0,0.12), transparent 70%)' }}
        aria-hidden
      />

      <motion.div
        className="relative text-center"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        <motion.p
          variants={item}
          className="select-none text-[9rem] font-bold leading-none tracking-tight text-primary/10 md:text-[12rem]"
        >
          404
        </motion.p>

        <motion.h1 variants={item} className="-mt-4 text-2xl font-semibold tracking-tight">
          Página não encontrada
        </motion.h1>

        <motion.p variants={item} className="mt-3 max-w-sm text-sm text-muted-foreground">
          O endereço que você tentou acessar não existe ou foi removido.
        </motion.p>

        <motion.div variants={item} className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Ir ao dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-xl border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Página inicial
          </Link>
        </motion.div>
      </motion.div>
    </main>
  )
}
