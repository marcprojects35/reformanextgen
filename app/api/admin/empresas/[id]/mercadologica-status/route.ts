import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { countProdutoCategoriaCache } from '@/lib/db-admin'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const empresaId = Number(id)
  if (!Number.isFinite(empresaId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  return NextResponse.json({ count: countProdutoCategoriaCache(empresaId) })
}
