'use client'

import { useState, type FormEvent } from 'react'
import { Mail, CheckCircle2 } from 'lucide-react'
import { motion } from 'motion/react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }
const item = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Algo deu errado.')
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-4 py-4 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 text-success">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <p className="text-base font-semibold">Verifique seu e-mail</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Se existir uma conta associada a{' '}
            <span className="font-medium text-foreground">{email}</span>, você
            receberá as instruções de recuperação em breve.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Não recebeu?{' '}
          <button
            type="button"
            onClick={() => { setSent(false); setEmail('') }}
            className="font-medium text-primary hover:underline"
          >
            Tentar com outro e-mail
          </button>
        </p>
      </motion.div>
    )
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
        <Label htmlFor="email">E-mail cadastrado</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com.br"
            className="pl-9"
          />
        </div>
      </motion.div>

      <motion.div variants={item}>
        <Button
          type="submit"
          disabled={loading}
          className="btn-shine glow-gold h-11 w-full justify-center rounded-xl text-sm font-semibold"
        >
          {loading ? 'Enviando…' : 'Enviar instruções'}
        </Button>
      </motion.div>
    </motion.form>
  )
}
