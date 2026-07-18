'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Shield, User } from 'lucide-react'

export function AdminLoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        router.push('/admin/importar')
      } else {
        const data = await res.json()
        setError(data.error ?? 'Usuário ou senha incorretos.')
      }
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background terminal-grid p-4">
      <div className="w-full max-w-sm">
        {/* Logo / header */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-foreground/5">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">Acesso Administrativo</h1>
            <p className="mt-1 text-sm text-foreground/50">Reforma NextGen — Painel Interno</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gain/25 bg-gain/10 px-2 py-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gain" />
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-gain">Sistema Ativo</span>
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/30" />
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Usuário"
              required
              autoFocus
              autoComplete="username"
              className="h-12 w-full rounded-xl border border-border bg-foreground/5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/30 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/30" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Senha"
              required
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-border bg-foreground/5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/30 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-center text-sm text-loss">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-foreground/20">
          Acesso restrito a administradores autorizados.
        </p>
      </div>
    </div>
  )
}
