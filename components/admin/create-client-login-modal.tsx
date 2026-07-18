'use client'

import { useState } from 'react'
import { X, UserPlus, Loader2 } from 'lucide-react'

export function CreateClientLoginModal({
  empresaId,
  empresaNome,
  onClose,
  onLinked,
}: {
  empresaId: number
  empresaNome: string
  onClose: () => void
  onLinked: (user: { id: number; name: string; email: string }) => void
}) {
  const [name, setName] = useState(empresaNome)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/empresas/${empresaId}/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao criar acesso.'); return }
      onLinked(data.user)
      onClose()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-popover p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Criar acesso do cliente</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-foreground/40 hover:bg-foreground/5 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs text-foreground/40">
          Se já existir um login com esse e-mail, ele será vinculado a esta empresa; caso contrário, criamos um novo com a senha informada.
        </p>

        <div className="space-y-3">
          <Field label="Nome do cliente">
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="E-mail *">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Senha (para novo login)">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} placeholder="mínimo 6 caracteres" />
          </Field>

          {error && <p className="text-xs text-loss">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground/60 hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !email.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Criando...' : 'Criar / vincular acesso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'h-10 w-full rounded-lg border border-border bg-foreground/5 px-3 text-sm text-foreground placeholder-white/30 outline-none focus:border-primary/50'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-foreground/40">{label}</label>
      {children}
    </div>
  )
}
