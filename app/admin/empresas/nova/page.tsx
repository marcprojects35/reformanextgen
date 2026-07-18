import { requireAdmin } from '@/lib/admin-auth'
import { AdminShell } from '@/components/admin/admin-shell'
import { NovaEmpresaView } from '@/components/admin/nova-empresa-view'

export default async function NovaEmpresaPage() {
  await requireAdmin()
  return (
    <AdminShell>
      <NovaEmpresaView />
    </AdminShell>
  )
}
