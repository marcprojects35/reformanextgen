import { NextResponse } from 'next/server'

import { isAdminAuthed } from '@/lib/admin-auth'
import { getCurrentUser } from '@/lib/auth'
import { getAdminReport, getEmpresa, insertReportComment, listReportComments } from '@/lib/db-admin'

async function resolveViewer(reportId: number): Promise<
  | { role: 'admin'; userId: null; label: string }
  | { role: 'cliente'; userId: number; label: string }
  | null
> {
  if (await isAdminAuthed()) return { role: 'admin', userId: null, label: 'Consultoria' }

  const user = await getCurrentUser()
  if (!user) return null

  const report = getAdminReport(reportId)
  if (!report || !report.empresa_id || !report.visible_to_client) return null

  const empresa = getEmpresa(report.empresa_id)
  if (!empresa || empresa.app_user_id !== user.id) return null

  return { role: 'cliente', userId: user.id, label: user.name }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const reportId = Number(id)
  if (!Number.isFinite(reportId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const viewer = await resolveViewer(reportId)
  if (!viewer) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  return NextResponse.json({ comments: listReportComments(reportId) })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const reportId = Number(id)
  if (!Number.isFinite(reportId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const viewer = await resolveViewer(reportId)
  if (!viewer) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const text = typeof body?.body === 'string' ? body.body.trim() : ''
  if (!text) return NextResponse.json({ error: 'Escreva um comentário.' }, { status: 400 })
  if (text.length > 2000) return NextResponse.json({ error: 'Comentário muito longo.' }, { status: 400 })

  const rawSection = typeof body?.section === 'string' ? body.section.trim() : ''
  const section = rawSection && rawSection.length <= 60 ? rawSection : null

  const comment = insertReportComment({
    reportId,
    authorType: viewer.role,
    authorUserId: viewer.userId,
    authorLabel: viewer.label,
    section,
    body: text,
  })

  return NextResponse.json({ comment })
}
