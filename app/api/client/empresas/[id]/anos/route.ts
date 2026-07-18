import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getEmpresa, listVisibleReportsForEmpresa, getDashboardTextos } from '@/lib/db-admin'
import { anoDoPeriodo } from '@/lib/admin-engine'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const empresaId = Number(id)
  if (!Number.isFinite(empresaId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const empresa = getEmpresa(empresaId)
  if (!empresa || empresa.app_user_id !== user.id) {
    return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
  }

  const url = new URL(request.url)
  const refReportIdRaw = url.searchParams.get('reportId')
  const refReportId = refReportIdRaw ? Number(refReportIdRaw) : null

  const relatorios = listVisibleReportsForEmpresa(empresaId)

  // Escopo pelo lote do relatório aberto na tela (o de referência) — sem isso, uma empresa
  // com mais de uma análise (reimportou o lote inteiro, ou tem imports avulsos antigos)
  // misturava reportIds de análises diferentes, e trocar de ano podia abrir dado de outra
  // planilha. Sem lote no relatório de referência (legado), escopa só a ele mesmo — não dá
  // pra saber quais outros são "irmãos" com segurança.
  const refRow = refReportId ? relatorios.find(r => r.id === refReportId) : undefined
  const escopo = !refReportId
    ? relatorios
    : refRow?.lote
    ? relatorios.filter(r => r.lote === refRow.lote)
    : refRow
    ? [refRow]
    : relatorios

  const porAno = new Map<number, { ano: number; reportId: number; periodo: string }>()
  for (const r of escopo) {
    const ano = anoDoPeriodo(r.periodo)
    if (Number.isFinite(ano)) porAno.set(ano, { ano, reportId: r.id, periodo: r.periodo })
  }
  const anos = [...porAno.values()].sort((a, b) => a.ano - b.ano)

  return NextResponse.json({ anos, textos: getDashboardTextos(empresaId) })
}
