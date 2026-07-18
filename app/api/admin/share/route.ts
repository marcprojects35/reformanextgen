import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { getAdminReport, generateShareToken } from '@/lib/db-admin'

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  let id: number
  try {
    const body = await request.json()
    id = Number(body.id)
    if (!id || isNaN(id)) throw new Error()
  } catch {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  }

  const row = getAdminReport(id)
  if (!row) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })

  const token = generateShareToken(id)
  return NextResponse.json({ token })
}
