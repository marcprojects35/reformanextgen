'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, User, Briefcase, MapPin } from 'lucide-react'
import { motion } from 'motion/react'

import { ufOptions } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'

/* ─── stagger variants ───────────────────────────────────────── */
const container = { hidden: {}, visible: { transition: { staggerChildren: 0.055 } } }
const item = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

/* ─── helpers ────────────────────────────────────────────────── */
async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Algo deu errado. Tente novamente.')
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

/* ─── icon input wrapper ─────────────────────────────────────── */
function IconInput({
  icon: Icon,
  ...props
}: React.ComponentProps<typeof Input> & { icon: React.ElementType }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input {...props} className="pl-9" />
    </div>
  )
}

/* ─── password input with show/hide ─────────────────────────── */
function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input {...props} type={show ? 'text' : 'password'} className="pl-9 pr-10" />
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

/* ══════════════════════════════════════════════════════════════ */
/*  LOGIN FORM                                                    */
/* ══════════════════════════════════════════════════════════════ */
export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await postJson('/api/auth/login', { email, password })
      router.push(searchParams.get('next') || '/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
      setLoading(false)
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {error && <Alert variant="destructive">{error}</Alert>}

      <motion.div variants={item}>
        <Label htmlFor="email">E-mail</Label>
        <IconInput
          icon={Mail}
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com.br"
        />
      </motion.div>

      <motion.div variants={item}>
        <Label htmlFor="password">Senha</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </motion.div>

      <motion.div variants={item}>
        <Button
          type="submit"
          disabled={loading}
          className="btn-shine glow-gold mt-2 h-11 w-full justify-center rounded-xl text-sm font-semibold"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Entrar
        </Button>
      </motion.div>
    </motion.form>
  )
}

/* ══════════════════════════════════════════════════════════════ */
/*  SIGNUP FORM                                                   */
/* ══════════════════════════════════════════════════════════════ */
export function SignupForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    uf: '',
    businessArea: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (form.password !== form.confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      await postJson('/api/auth/signup', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        uf: form.uf || null,
        businessArea: form.businessArea || null,
        password: form.password,
      })
      router.push('/cadastro/empresa')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
      setLoading(false)
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {error && <Alert variant="destructive">{error}</Alert>}

      {/* Nome completo */}
      <motion.div variants={item}>
        <Label htmlFor="name">
          Nome completo <span className="text-destructive">*</span>
        </Label>
        <IconInput
          icon={User}
          id="name"
          autoComplete="name"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Seu nome completo"
        />
      </motion.div>

      {/* E-mail */}
      <motion.div variants={item}>
        <Label htmlFor="email">
          Email <span className="text-destructive">*</span>
        </Label>
        <IconInput
          icon={Mail}
          id="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="seu@email.com"
        />
      </motion.div>

      {/* Telefone */}
      <motion.div variants={item}>
        <Label htmlFor="phone">
          Telefone para contato <span className="text-destructive">*</span>
        </Label>
        <IconInput
          icon={Phone}
          id="phone"
          type="tel"
          autoComplete="tel"
          required
          inputMode="numeric"
          value={form.phone}
          onChange={(e) => set('phone', formatPhone(e.target.value))}
          placeholder="(11) 99999-9999"
        />
      </motion.div>

      {/* Estado + Ramo */}
      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="uf">
            Estado{' '}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Select
              id="uf"
              value={form.uf}
              onChange={(e) => set('uf', e.target.value)}
              className="pl-9"
            >
              <option value="">Selecione seu estado</option>
              {ufOptions.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="businessArea">
            Ramo empresarial{' '}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <IconInput
            icon={Briefcase}
            id="businessArea"
            value={form.businessArea}
            onChange={(e) => set('businessArea', e.target.value)}
            placeholder="Ex: varejo, indústria…"
          />
        </div>
      </motion.div>

      {/* Senha */}
      <motion.div variants={item}>
        <Label htmlFor="password">
          Senha <span className="text-destructive">*</span>
        </Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          placeholder="Mínimo 8 caracteres"
        />
      </motion.div>

      {/* Confirmar senha */}
      <motion.div variants={item}>
        <Label htmlFor="confirmPassword">
          Confirmar senha <span className="text-destructive">*</span>
        </Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.confirmPassword}
          onChange={(e) => set('confirmPassword', e.target.value)}
          placeholder="Repita a senha"
        />
        {form.confirmPassword && form.password !== form.confirmPassword && (
          <p className="mt-1 text-xs text-destructive">As senhas não coincidem.</p>
        )}
      </motion.div>

      {/* CTA */}
      <motion.div variants={item} className="pt-1">
        <Button
          type="submit"
          disabled={loading}
          className="btn-shine glow-gold h-11 w-full justify-center gap-2 rounded-xl text-sm font-semibold"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar conta
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Ao criar a conta, você concorda com os{' '}
          <a href="/termos" target="_blank" className="underline hover:text-foreground">
            Termos de uso
          </a>{' '}
          e a{' '}
          <a href="/privacidade" target="_blank" className="underline hover:text-foreground">
            Política de privacidade
          </a>
          .
        </p>
      </motion.div>
    </motion.form>
  )
}
