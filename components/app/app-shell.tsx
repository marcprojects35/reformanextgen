'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, LogOut, UserCircle } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/landing/theme-toggle'
import { NotificationBell } from '@/components/app/notification-bell'

const links = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Minha conta', href: '/conta' },
]

const mobileLinks = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Conta', href: '/conta', icon: UserCircle },
]

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <div className="relative min-h-screen bg-background">
      {/* ambient grid + glow — mesmo vocabulário visual do landing */}
      <div className="bg-grid pointer-events-none fixed inset-0 opacity-[0.035]" aria-hidden />
      <div
        className="pointer-events-none fixed left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full blur-[180px]"
        style={{ background: 'radial-gradient(circle, rgba(255,180,0,0.07), transparent 70%)' }}
        aria-hidden
      />

      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Reforma NextGen" width={32} height={32} className="h-8 w-8" />
              <span className="text-sm font-semibold tracking-tight">
                Reforma<span className="text-primary">NextGen</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'text-sm transition-colors',
                    pathname === link.href
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
            <NotificationBell />
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sair"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1600px] px-4 py-10 pb-24 md:px-6 md:pb-10">{children}</main>

      {/* bottom nav — mobile only */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl md:hidden">
        <div className="flex items-stretch">
          {mobileLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors',
                pathname === link.href || pathname.startsWith(link.href + '/')
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <link.icon className="h-5 w-5" />
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </nav>
    </div>
  )
}
