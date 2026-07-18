import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { listNotificationsByUser, markAllNotificationsRead, countUnreadNotifications } from '@/lib/db'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const notifications = listNotificationsByUser(user.id)
  const unreadCount = countUnreadNotifications(user.id)
  return NextResponse.json({ notifications, unreadCount })
}

export async function PATCH() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  markAllNotificationsRead(user.id)
  return NextResponse.json({ ok: true })
}
