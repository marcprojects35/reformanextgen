import { NextResponse } from 'next/server'

import { isAdminAuthed } from '@/lib/admin-auth'
import { getAdminReport, getEmpresa, markAnaliseSentToClient } from '@/lib/db-admin'
import { createNotification } from '@/lib/db'

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const id = Number(body?.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const report = getAdminReport(id)
  if (!report) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })

  if (!report.empresa_id) {
    return NextResponse.json({ error: 'REPORT_NOT_LINKED', message: 'Este relatório não está associado a uma empresa cadastrada.' }, { status: 400 })
  }

  const empresa = getEmpresa(report.empresa_id)
  if (!empresa) {
    return NextResponse.json({ error: 'REPORT_NOT_LINKED', message: 'Empresa do relatório não encontrada.' }, { status: 400 })
  }

  if (!empresa.app_user_id) {
    return NextResponse.json(
      { error: 'NO_CLIENT_LINKED', message: 'Esta empresa ainda não tem um login de cliente vinculado.', empresaId: empresa.id, empresaNome: empresa.nome },
      { status: 409 },
    )
  }

  markAnaliseSentToClient(report.empresa_id, report.lote, id)
  createNotification({
    userId: empresa.app_user_id,
    type: 'report_sent',
    title: 'Novo relatório disponível',
    body: `Sua análise tributária já está disponível para consulta.`,
    link: `/dashboard/relatorios/${id}`,
    reportId: id,
  })

  return NextResponse.json({ ok: true })
}
