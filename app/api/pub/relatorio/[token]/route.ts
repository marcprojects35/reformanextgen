import { NextResponse } from 'next/server'
import { getReportByToken, getEmpresaLogoForReport } from '@/lib/db-admin'
import { getComputedReport } from '@/lib/projecao-real'
import { jsonResponse } from '@/lib/json-response'

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const row = getReportByToken(token)
  if (!row) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })

  const report = getComputedReport(row.id)
  if (!report) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })

  return jsonResponse({
    report,
    empresa: row.empresa,
    cnpj: row.cnpj,
    regime: row.regime,
    periodo: row.periodo,
    geradoEm: row.created_at,
    logo: getEmpresaLogoForReport(row.id),
  }, req)
}
