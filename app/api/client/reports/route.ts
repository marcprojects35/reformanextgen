import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { listVisibleAnalisesForEmpresa } from '@/lib/db-admin'
import { getActiveEmpresaId } from '@/lib/active-company'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const empresaId = await getActiveEmpresaId(user.id)
  if (!empresaId) return NextResponse.json({ reports: [] })

  const reports = listVisibleAnalisesForEmpresa(empresaId)
  return NextResponse.json({ reports })
}
