'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Eye, EyeOff, KeyRound, Loader2, User } from 'lucide-react'

import { ufOptions } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'
import { SpotlightCard } from '@/components/landing/spotlight-card'
import type { PublicUser } from '@/lib/auth'

/* ─── helpers ──────────────────────────────────────────────── */
async function patchUser(body: Record<string, unknown>) {
  const res = await fetch('/api/user', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Algo deu errado. Tente novamente.')
  return data
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-10" />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        tabIndex={-1}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function SuccessAlert() {
  return (
    <Alert variant="default" className="border-success/40 bg-success/10 text-success">
      <Check className="inline h-4 w-4" /> Salvo com sucesso.
    </Alert>
  )
}

/* ══════════════════════════════════════════════════════════════ */
/*  PERFIL — nome, telefone, UF, ramo                           */
/* ══════════════════════════════════════════════════════════════ */
export function UpdateProfileForm({ user }: { user: PublicUser }) {
  const router = useRouter()
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(formatPhone(user.phone ?? ''))
  const [uf, setUf] = useState(user.uf ?? '')
  const [businessArea, setBusinessArea] = useState(user.business_area ?? '')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty =
    name !== user.name ||
    phone.replace(/\D/g, '') !== (user.phone ?? '') ||
    uf !== (user.uf ?? '') ||
    businessArea !== (user.business_area ?? '')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)
    try {
      await patchUser({ action: 'update_profile', name, phone, uf: uf || null, businessArea: businessArea || null })
      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <User className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">Informações pessoais</h2>
          <p className="text-sm text-muted-foreground">Atualize seus dados de perfil.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        {error && <Alert variant="destructive">{error}</Alert>}
        {success && <SuccessAlert />}

        <div>
          <Label htmlFor="name">Nome completo</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => { setName(e.target.value); setSuccess(false) }}
            placeholder="Seu nome"
          />
        </div>

        <div>
          <Label htmlFor="phone">Telefone para contato</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => { setPhone(formatPhone(e.target.value)); setSuccess(false) }}
            placeholder="(11) 99999-9999"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="uf">Estado (UF)</Label>
            <Select id="uf" value={uf} onChange={(e) => { setUf(e.target.value); setSuccess(false) }}>
              <option value="">Selecione</option>
              {ufOptions.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="businessArea">Ramo empresarial</Label>
            <Input
              id="businessArea"
              value={businessArea}
              onChange={(e) => { setBusinessArea(e.target.value); setSuccess(false) }}
              placeholder="Ex: varejo, indústria…"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={loading || !isDirty}
            className="h-10 gap-2 rounded-xl px-5"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </form>
    </SpotlightCard>
  )
}

/* ══════════════════════════════════════════════════════════════ */
/*  SENHA                                                         */
/* ══════════════════════════════════════════════════════════════ */
export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (newPassword !== confirm) {
      setError('As senhas não coincidem.')
      return
    }
    setLoading(true)
    try {
      await patchUser({ action: 'change_password', currentPassword, newPassword })
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <KeyRound className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">Alterar senha</h2>
          <p className="text-sm text-muted-foreground">
            Escolha uma senha forte com pelo menos 8 caracteres.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        {error && <Alert variant="destructive">{error}</Alert>}
        {success && <SuccessAlert />}

        <div>
          <Label htmlFor="currentPassword">Senha atual</Label>
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => { setCurrentPassword(e.target.value); setSuccess(false) }}
            placeholder="••••••••"
          />
        </div>
        <div>
          <Label htmlFor="newPassword">Nova senha</Label>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setSuccess(false) }}
            placeholder="Mínimo de 8 caracteres"
          />
        </div>
        <div>
          <Label htmlFor="confirm">Confirmar nova senha</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setSuccess(false) }}
            placeholder="Repita a nova senha"
          />
          {confirm && newPassword !== confirm && (
            <p className="mt-1 text-xs text-destructive">As senhas não coincidem.</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={loading}
            className="h-10 gap-2 rounded-xl px-5"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Alterar senha
          </Button>
        </div>
      </form>
    </SpotlightCard>
  )
}
