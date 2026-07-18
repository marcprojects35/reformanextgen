import { NextResponse } from 'next/server'

import { isAdminAuthed } from '@/lib/admin-auth'
import { hashPassword } from '@/lib/auth'
import { createUser, getUserByEmail } from '@/lib/db'
import { getEmpresa, linkEmpresaToAppUser } from '@/lib/db-admin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const empresaId = Number(id)
  if (!Number.isFinite(empresaId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const empresa = getEmpresa(empresaId)
  if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
  if (empresa.app_user_id) {
    return NextResponse.json({ error: 'Esta empresa já tem um login de cliente vinculado.' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : empresa.nome

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  }

  let user = getUserByEmail(email)
  if (!user) {
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Defina uma senha com pelo menos 6 caracteres.' }, { status: 400 })
    }
    const { hash, salt } = hashPassword(password)
    user = createUser({ name, email, passwordHash: hash, passwordSalt: salt })
  }

  linkEmpresaToAppUser(empresaId, { appUserId: user.id })

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } })
}
