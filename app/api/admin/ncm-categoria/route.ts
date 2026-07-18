import { NextResponse } from 'next/server'

import { isAdminAuthed } from '@/lib/admin-auth'
import { getNcmCategoriaOverrides, setNcmCategoriaOverride, deleteNcmCategoriaOverride } from '@/lib/db-admin'
import { getMercCategoria } from '@/lib/merc-categorias'
import { normalizeNcm } from '@/lib/admin-engine'

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  return NextResponse.json({ overrides: getNcmCategoriaOverrides() })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const ncm = typeof body?.ncm === 'string' ? normalizeNcm(body.ncm) : ''
  const categoriaCodigo = typeof body?.categoriaCodigo === 'string' ? body.categoriaCodigo.trim() : ''
  if (!ncm) return NextResponse.json({ error: 'NCM não informado.' }, { status: 400 })
  if (!categoriaCodigo) return NextResponse.json({ error: 'Categoria não informada.' }, { status: 400 })

  const categoria = getMercCategoria(categoriaCodigo)
  if (!categoria || categoria.nivel !== 'familia') {
    return NextResponse.json({ error: 'Categoria inválida — escolha uma Família da estrutura mercadológica.' }, { status: 400 })
  }

  setNcmCategoriaOverride(ncm, categoriaCodigo)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const ncmRaw = searchParams.get('ncm')?.trim()
  const ncm = ncmRaw ? normalizeNcm(ncmRaw) : ''
  if (!ncm) return NextResponse.json({ error: 'NCM não informado.' }, { status: 400 })

  deleteNcmCategoriaOverride(ncm)
  return NextResponse.json({ ok: true })
}
