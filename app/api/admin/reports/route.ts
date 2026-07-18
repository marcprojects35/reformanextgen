import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { listAdminReports, getAdminReport, deleteAdminReport } from '@/lib/db-admin'
import { getComputedReport } from '@/lib/projecao-real'
import { jsonResponse } from '@/lib/json-response'

export async function GET(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const empresa = url.searchParams.get('empresa') ?? undefined
  const periodoInicio = url.searchParams.get('inicio') ?? undefined
  const periodoFim = url.searchParams.get('fim') ?? undefined

  if (id) {
    const report = getAdminReport(Number(id))
    if (!report) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
    const computed = getComputedReport(Number(id))
    if (!computed) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
    return jsonResponse({
      report: computed,
      meta: {
        id: report.id,
        empresa: report.empresa,
        periodo: report.periodo,
        created_at: report.created_at,
        visibleToClient: !!report.visible_to_client,
        sentAt: report.sent_at,
        lote: report.lote,
      },
    }, request)
  }

  const reports = listAdminReports({ empresa, periodoInicio, periodoFim })
  return NextResponse.json({ reports })
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const ok = deleteAdminReport(id)
  return NextResponse.json({ ok })
}
