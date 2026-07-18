import { redirect } from 'next/navigation'
import { isAdminAuthed } from '@/lib/admin-auth'
import { AdminLoginForm } from '@/components/admin/login-form'

export default async function AdminPage() {
  if (await isAdminAuthed()) redirect('/admin/empresas')
  return <AdminLoginForm />
}
