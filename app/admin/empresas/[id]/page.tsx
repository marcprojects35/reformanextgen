import { requireAdmin } from '@/lib/admin-auth'
import { AdminShell } from '@/components/admin/admin-shell'
import { EmpresaDetail } from '@/components/admin/empresa-detail'

export default async function EmpresaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  return (
    <AdminShell>
      <EmpresaDetail empresaId={Number(id)} />
    </AdminShell>
  )
}
