import { NextResponse } from 'next/server'
import { getUserByEmail } from '@/lib/db'
import { setSessionCookie, verifyPassword } from '@/lib/auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  const user = email ? getUserByEmail(email) : undefined
  const valid = user && verifyPassword(password, user.password_salt, user.password_hash)

  if (!user || !valid) {
    return NextResponse.json(
      { error: 'E-mail ou senha incorretos.' },
      { status: 401 },
    )
  }

  await setSessionCookie(user.id)
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } })
}
