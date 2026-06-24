import { NextResponse } from 'next/server'
import { createUser, getUserByEmail } from '@/lib/db'
import { hashPassword, setSessionCookie } from '@/lib/auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
  const uf = typeof body?.uf === 'string' ? body.uf.trim() : null
  const businessArea = typeof body?.businessArea === 'string' ? body.businessArea.trim() : null
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Informe seu nome completo.' }, { status: 400 })
  }
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  }
  const phoneDigits = phone.replace(/\D/g, '')
  if (phoneDigits.length < 10) {
    return NextResponse.json({ error: 'Informe um telefone válido com DDD.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'A senha deve ter pelo menos 8 caracteres.' },
      { status: 400 },
    )
  }

  if (getUserByEmail(email)) {
    return NextResponse.json(
      { error: 'Já existe uma conta com este e-mail.' },
      { status: 409 },
    )
  }

  const { hash, salt } = hashPassword(password)
  const user = createUser({
    name,
    email,
    phone: phoneDigits,
    uf: uf || null,
    businessArea: businessArea || null,
    passwordHash: hash,
    passwordSalt: salt,
  })
  await setSessionCookie(user.id)

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } })
}
