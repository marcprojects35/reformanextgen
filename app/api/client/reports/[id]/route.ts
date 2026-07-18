import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { getVisibleReportForUser, getEmpresaLogoForReport } from '@/lib/db-admin'
import { getComputedReport } from '@/lib/projecao-real'
import { jsonResponse } from '@/lib/json-response'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const reportId = Number(id)
  if (!Number.isFinite(reportId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const row = getVisibleReportForUser(reportId, user.id)
  if (!row) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })

  const computed = getComputedReport(row.id)
  if (!computed) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })

  return jsonResponse({
    report: computed,
    logo: getEmpresaLogoForReport(row.id),
  }, request)
}
