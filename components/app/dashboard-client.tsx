'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Calendar, ChevronRight, FileBarChart2, MessageSquareText } from 'lucide-react'
import { motion } from 'motion/react'

import { Reveal } from '@/components/landing/reveal'
import { SpotlightCard } from '@/components/landing/spotlight-card'

interface ReportItem {
  id: number
  periodo: string
  created_at: string
  sent_at: string | null
}

export function DashboardClient() {
  const [reports, setReports] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const reportsRes = await fetch('/api/client/reports').then((r) => r.json())
      setReports(reportsRes.reports ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="mt-10 flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <Reveal delay={0.1} className="mt-10">
        <SpotlightCard className="rounded-3xl border border-border bg-card/60 py-16 text-center backdrop-blur-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-accent/60">
            <FileBarChart2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mt-5 text-lg font-semibold tracking-tight">Nenhum relatório enviado ainda</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Assim que nossa equipe concluir a análise da sua empresa, o relatório aparece aqui.
          </p>
        </SpotlightCard>
      </Reveal>
    )
  }

  return (
    <div className="mt-8 space-y-10">
      {/* Lista de relatórios enviados */}
      <Reveal delay={0.05} y={12}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link href={`/dashboard/relatorios/${r.id}`} className="block h-full">
                <SpotlightCard className="group h-full rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-sm transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                      <Calendar className="h-4 w-4 text-primary" />
                      {r.periodo}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageSquareText className="h-3.5 w-3.5" />
                    Ver relatório e comentar
                  </p>
                </SpotlightCard>
              </Link>
            </motion.div>
          ))}
        </div>
      </Reveal>
    </div>
  )
}
