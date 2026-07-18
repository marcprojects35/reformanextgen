'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'

interface NotificationItem {
  id: number
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export function NotificationBell() {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setItems(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      /* silencioso — sino não é crítico */
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  async function handleClick(item: NotificationItem) {
    if (!item.read_at) {
      await fetch(`/api/notifications/${item.id}/read`, { method: 'POST' })
      load()
    }
    setOpen(false)
    if (item.link) router.push(item.link)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
          <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-foreground/40">
            Notificações
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-foreground/30">Nenhuma notificação por aqui.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleClick(item)}
                  className={`block w-full border-b border-border/60 px-4 py-3 text-left transition hover:bg-foreground/[0.03] last:border-0 ${
                    item.read_at ? '' : 'bg-primary/[0.04]'
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.body && <p className="mt-0.5 text-xs text-foreground/50">{item.body}</p>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
