import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { getEmpresa, getDashboardTextos, setDashboardTexto } from '@/lib/db-admin'
import { DASHBOARD_TEXTO_FIELDS } from '@/lib/dashboard-textos'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const empresaId = Number(id)
  if (!Number.isFinite(empresaId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  if (!getEmpresa(empresaId)) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

  return NextResponse.json({ textos: getDashboardTextos(empresaId), campos: DASHBOARD_TEXTO_FIELDS })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const empresaId = Number(id)
  if (!Number.isFinite(empresaId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  if (!getEmpresa(empresaId)) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

  let body: Record<string, string>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
  }

  const chavesValidas = new Set(DASHBOARD_TEXTO_FIELDS.map(f => f.chave))
  for (const [chave, valor] of Object.entries(body)) {
    if (!chavesValidas.has(chave)) continue
    setDashboardTexto(empresaId, chave, String(valor ?? ''))
  }

  return NextResponse.json({ textos: getDashboardTextos(empresaId) })
}
