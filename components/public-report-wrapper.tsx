'use client'

import { useState, useEffect } from 'react'
import { ReportDashboard } from '@/components/admin/report-dashboard'
import type { AdminReportV2 } from '@/lib/admin-engine'

export function PublicReportWrapper({ token }: { token: string }) {
  const [report, setReport] = useState<AdminReportV2 | null>(null)
  const [logo, setLogo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/pub/relatorio/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.report) { setReport(data.report as AdminReportV2); setLogo(data.logo ?? null) }
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-sm text-white/30">Carregando relatório…</p>
        </div>
      </div>
    )
  }

  if (notFound || !report) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-6">
        <div className="text-4xl font-bold text-white/10">404</div>
        <p className="text-lg font-semibold text-white">Relatório não encontrado</p>
        <p className="text-sm text-white/40 max-w-xs">
          Este link pode ter expirado ou o relatório foi removido. Contate quem enviou o link.
        </p>
        <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-2">
          <p className="text-xs text-amber-400/70">Powered by Reforma NextGen</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <ReportDashboard reportData={report} publicMode logo={logo} />
    </div>
  )
}
