'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Upload, LogOut, Shield, Building2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/landing/theme-toggle'

const NAV = [
  { href: '/admin/empresas', label: 'Empresas', icon: Building2 },
  { href: '/admin/importar', label: 'Importar', icon: Upload },
  { href: '/admin/leads', label: 'Leads', icon: Users },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    router.push('/admin')
  }

  return (
    <div className="relative min-h-screen bg-background">
      {/* ambient grid + glow — mesmo vocabulário visual do site do cliente */}
      <div className="terminal-grid pointer-events-none fixed inset-0 opacity-[0.035]" aria-hidden />
      <div
        className="pointer-events-none fixed left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full blur-[180px]"
        style={{ background: 'radial-gradient(circle, rgba(255,180,0,0.07), transparent 70%)' }}
        aria-hidden
      />

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="relative mx-auto flex h-11 max-w-[1600px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-6">
            <Link href="/admin/empresas" className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <Shield className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[13px] font-bold tracking-tight text-foreground">Admin</span>
                <span className="text-[13px] font-bold tracking-tight text-primary">NextGen</span>
              </div>
              <span className="ml-1 flex items-center gap-1.5 rounded-full border border-gain/25 bg-gain/10 px-1.5 py-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gain" />
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-gain">Live</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-0.5 md:flex">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 border-b-2 px-2.5 py-3 text-xs font-medium transition-colors',
                    pathname.startsWith(href)
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden text-[11px] text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              ← Voltar ao App
            </Link>
            <ThemeToggle className="h-7 w-7 rounded-md" />
            <button
              onClick={logout}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-loss/40 hover:text-loss"
              title="Sair do admin"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 md:px-6">{children}</main>
    </div>
  )
}
