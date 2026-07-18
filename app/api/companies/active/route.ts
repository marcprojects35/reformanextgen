import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { getCompanyById } from '@/lib/db'
import { setActiveCompanyCookie } from '@/lib/active-company'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const companyId = Number(body?.companyId)
  if (!Number.isFinite(companyId)) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  }

  const company = getCompanyById(companyId)
  if (!company || company.user_id !== user.id) {
    return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
  }

  await setActiveCompanyCookie(companyId)
  return NextResponse.json({ ok: true })
}
