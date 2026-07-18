import { requireAdmin } from '@/lib/admin-auth'
import { AdminShell } from '@/components/admin/admin-shell'
import { EmpresasView } from '@/components/admin/empresas-view'

export default async function EmpresasPage() {
  await requireAdmin()
  return (
    <AdminShell>
      <EmpresasView />
    </AdminShell>
  )
}
