import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { getUserById, updateUser } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth'

export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const action = body?.action

  if (action === 'update_name') {
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Informe um nome válido (mínimo 2 caracteres).' }, { status: 400 })
    }
    updateUser(user.id, { name })
    return NextResponse.json({ ok: true })
  }

  if (action === 'update_profile') {
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : undefined
    const uf = typeof body?.uf === 'string' ? body.uf.trim() || null : undefined
    const businessArea = typeof body?.businessArea === 'string' ? body.businessArea.trim() || null : undefined
    if (name && name.length < 2) {
      return NextResponse.json({ error: 'Informe um nome válido (mínimo 2 caracteres).' }, { status: 400 })
    }
    updateUser(user.id, {
      ...(name ? { name } : {}),
      ...(phone !== undefined ? { phone: phone.replace(/\D/g, '') || null } : {}),
      ...(uf !== undefined ? { uf } : {}),
      ...(businessArea !== undefined ? { businessArea } : {}),
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'change_password') {
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

    if (!currentPassword) {
      return NextResponse.json({ error: 'Informe a senha atual.' }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'A nova senha deve ter pelo menos 8 caracteres.' }, { status: 400 })
    }

    const fullUser = getUserById(user.id)
    if (!fullUser || !verifyPassword(currentPassword, fullUser.password_salt, fullUser.password_hash)) {
      return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 })
    }

    const { hash, salt } = hashPassword(newPassword)
    updateUser(user.id, { passwordHash: hash, passwordSalt: salt })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
}
