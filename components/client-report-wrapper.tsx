'use client'

import { useState, useEffect } from 'react'
import { ReportDashboard } from '@/components/admin/report-dashboard'
import type { AdminReportV2 } from '@/lib/admin-engine'

export function ClientReportWrapper({ reportId }: { reportId: number }) {
  const [report, setReport] = useState<AdminReportV2 | null>(null)
  const [logo, setLogo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/client/reports/${reportId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.report) { setReport(data.report as AdminReportV2); setLogo(data.logo ?? null) }
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [reportId])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (notFound || !report) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold text-foreground">Relatório não encontrado</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Este relatório não existe ou ainda não foi liberado para você.
        </p>
      </div>
    )
  }

  return <ReportDashboard reportData={report} clientMode reportId={reportId} logo={logo} />
}
