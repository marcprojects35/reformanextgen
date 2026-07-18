'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { motion } from 'motion/react'

import type { RegimeAtual, Setor } from '@/lib/db'
import { setorLabels, regimeAtualLabels, ufOptions } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'

const SETORES = Object.keys(setorLabels) as Setor[]
const REGIMES = Object.keys(regimeAtualLabels) as RegimeAtual[]

export function CompanyOnboardingForm() {
  const router = useRouter()
  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [setor, setSetor] = useState<Setor | ''>('')
  const [uf, setUf] = useState('')
  const [regimeAtual, setRegimeAtual] = useState<RegimeAtual | ''>('')
  const [faturamentoAnual, setFaturamentoAnual] = useState('')
  const [margemLucro, setMargemLucro] = useState('10')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razaoSocial,
          cnpj: cnpj || null,
          setor,
          uf,
          regimeAtual,
          faturamentoAnual: Number(faturamentoAnual),
          margemLucro: Number(margemLucro),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Algo deu errado. Tente novamente.')
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
      setLoading(false)
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex max-w-lg flex-col gap-4"
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Sobre sua empresa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esses dados aparecem para nossa equipe analisar o impacto da reforma tributária no seu negócio.
        </p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <div>
        <Label htmlFor="razaoSocial">Razão social *</Label>
        <Input id="razaoSocial" required value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Nome da sua empresa" />
      </div>

      <div>
        <Label htmlFor="cnpj">CNPJ <span className="font-normal text-muted-foreground">(opcional)</span></Label>
        <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="setor">Setor *</Label>
          <Select id="setor" required value={setor} onChange={(e) => setSetor(e.target.value as Setor)}>
            <option value="">Selecione…</option>
            {SETORES.map((s) => (
              <option key={s} value={s}>{setorLabels[s]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="uf">Estado *</Label>
          <Select id="uf" required value={uf} onChange={(e) => setUf(e.target.value)}>
            <option value="">Selecione…</option>
            {ufOptions.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="regimeAtual">Regime tributário atual *</Label>
        <Select id="regimeAtual" required value={regimeAtual} onChange={(e) => setRegimeAtual(e.target.value as RegimeAtual)}>
          <option value="">Selecione…</option>
          {REGIMES.map((r) => (
            <option key={r} value={r}>{regimeAtualLabels[r]}</option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="faturamentoAnual">Faturamento anual (R$) *</Label>
          <Input
            id="faturamentoAnual"
            type="number"
            min="0"
            required
            value={faturamentoAnual}
            onChange={(e) => setFaturamentoAnual(e.target.value)}
            placeholder="1200000"
          />
        </div>
        <div>
          <Label htmlFor="margemLucro">Margem de lucro (%)</Label>
          <Input
            id="margemLucro"
            type="number"
            min="0"
            max="100"
            value={margemLucro}
            onChange={(e) => setMargemLucro(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="btn-shine glow-gold mt-2 h-11 w-full justify-center rounded-xl text-sm font-semibold">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Concluir cadastro
      </Button>
    </motion.form>
  )
}
