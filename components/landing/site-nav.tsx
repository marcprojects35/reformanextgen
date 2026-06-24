'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { motion, useMotionValueEvent, useScroll } from 'motion/react'
import { LayoutDashboard, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './theme-toggle'

const links = [
  { label: 'O Problema', href: '#problema' },
  { label: 'Solução', href: '#solucao' },
  { label: 'Como Funciona', href: '#como-funciona' },
  { label: 'Impactos', href: '#impactos' },
  { label: 'Comece agora', href: '#planos' },
]

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const { scrollY } = useScroll()

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.user?.name) setUserName(data.user.name) })
      .catch(() => {})
  }, [])

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 24)
  })

  useEffect(() => {
    const sections = links
      .map((link) => document.querySelector(link.href))
      .filter((el): el is Element => el !== null)

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length === 0) return
        const top = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
        )
        setActive(`#${top.target.id}`)
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )

    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 px-4 pt-4"
    >
      <nav
        className={cn(
          'mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-transparent px-4 py-3 transition-all duration-300 md:px-6',
          scrolled && 'glass border-border',
        )}
      >
        <a href="#topo" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Reforma NextGen"
            width={36}
            height={36}
            className="h-9 w-9"
          />
          <span className="text-base font-semibold tracking-tight">
            Reforma<span className="text-primary">NextGen</span>
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'relative text-sm transition-colors',
                active === link.href
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {link.label}
              {active === link.href && (
                <motion.span
                  layoutId="nav-active-dot"
                  className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {userName ? (
            <a
              href="/dashboard"
              className="btn-shine flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              <LayoutDashboard className="h-4 w-4" />
              {userName.split(' ')[0]}
            </a>
          ) : (
            <>
              <a
                href="/login"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Entrar
              </a>
              <a
                href="/cadastro"
                className="btn-shine rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
              >
                Começar agora
              </a>
            </>
          )}
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mx-auto mt-2 max-w-6xl rounded-2xl border border-border p-4 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            {userName ? (
              <a
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <LayoutDashboard className="h-4 w-4" />
                Ir ao dashboard
              </a>
            ) : (
              <>
                <a
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Entrar
                </a>
                <a
                  href="/cadastro"
                  onClick={() => setOpen(false)}
                  className="mt-1 rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground"
                >
                  Começar agora
                </a>
              </>
            )}
          </div>
        </motion.div>
      )}
    </motion.header>
  )
}
