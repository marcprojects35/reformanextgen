import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { markNotificationRead } from '@/lib/db'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const notificationId = Number(id)
  if (!Number.isFinite(notificationId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  markNotificationRead(notificationId, user.id)
  return NextResponse.json({ ok: true })
}
