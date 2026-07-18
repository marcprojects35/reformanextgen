import { requireAdmin } from '@/lib/admin-auth'
import { AdminShell } from '@/components/admin/admin-shell'
import { HistoryView } from '@/components/admin/history-view'

export default async function HistoricoPage() {
  await requireAdmin()
  return (
    <AdminShell>
      <HistoryView />
    </AdminShell>
  )
}
