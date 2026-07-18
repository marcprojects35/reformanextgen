import { requireAdmin } from '@/lib/admin-auth'
import { AdminShell } from '@/components/admin/admin-shell'
import { LeadsView } from '@/components/admin/leads-view'

export default async function LeadsPage() {
  await requireAdmin()
  return (
    <AdminShell>
      <LeadsView />
    </AdminShell>
  )
}
