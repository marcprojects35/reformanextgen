import { NextResponse } from 'next/server'
import { checkAdminCredentials, setAdminCookie, clearAdminCookie, isAdminAuthed } from '@/lib/admin-auth'

export async function GET() {
  const authed = await isAdminAuthed()
  return NextResponse.json({ authed })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const username = typeof body?.username === 'string' ? body.username : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!checkAdminCredentials(username, password)) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos.' }, { status: 401 })
  }

  await setAdminCookie()
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  await clearAdminCookie()
  return NextResponse.json({ ok: true })
}
