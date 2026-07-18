import { requireAdmin } from '@/lib/admin-auth'
import { AdminShell } from '@/components/admin/admin-shell'
import { ReportDashboard } from '@/components/admin/report-dashboard'

export default async function RelatorioPage() {
  await requireAdmin()
  return (
    <AdminShell>
      <ReportDashboard />
    </AdminShell>
  )
}
