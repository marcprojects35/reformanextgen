import { requireAdmin } from '@/lib/admin-auth'
import { AdminShell } from '@/components/admin/admin-shell'
import { ImportForm } from '@/components/admin/import-form'

export default async function ImportarPage() {
  await requireAdmin()
  return (
    <AdminShell>
      <ImportForm />
    </AdminShell>
  )
}
