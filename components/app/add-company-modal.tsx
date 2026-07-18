'use client'

import { useState, type FormEvent } from 'react'
import { Building2, Loader2, X } from 'lucide-react'

import type { CompanyRow, RegimeAtual, Setor } from '@/lib/db'
import { setorLabels, regimeAtualLabels, ufOptions } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'

const SETORES = Object.keys(setorLabels) as Setor[]
const REGIMES = Object.keys(regimeAtualLabels) as RegimeAtual[]

export function AddCompanyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (company: CompanyRow) => void
}) {
  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [setor, setSetor] = useState<Setor | ''>('')
  const [uf, setUf] = useState('')
  const [regimeAtual, setRegimeAtual] = useState<RegimeAtual | ''>('')
  const [faturamentoAnual, setFaturamentoAnual] = useState('')
  const [margemLucro, setMargemLucro] = useState('10')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
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
      onCreated(data.company as CompanyRow)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-popover p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">Adicionar empresa</h2>
              <p className="text-xs text-muted-foreground">Cadastre uma matriz, filial ou outra empresa do grupo.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <Alert variant="destructive">{error}</Alert>}

          <div>
            <Label htmlFor="new-razaoSocial">Razão social *</Label>
            <Input
              id="new-razaoSocial"
              required
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>

          <div>
            <Label htmlFor="new-cnpj">CNPJ <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Input
              id="new-cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-setor">Setor *</Label>
              <Select id="new-setor" required value={setor} onChange={(e) => setSetor(e.target.value as Setor)}>
                <option value="">Selecione…</option>
                {SETORES.map((s) => (
                  <option key={s} value={s}>{setorLabels[s]}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="new-uf">Estado *</Label>
              <Select id="new-uf" required value={uf} onChange={(e) => setUf(e.target.value)}>
                <option value="">Selecione…</option>
                {ufOptions.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="new-regimeAtual">Regime tributário atual *</Label>
            <Select id="new-regimeAtual" required value={regimeAtual} onChange={(e) => setRegimeAtual(e.target.value as RegimeAtual)}>
              <option value="">Selecione…</option>
              {REGIMES.map((r) => (
                <option key={r} value={r}>{regimeAtualLabels[r]}</option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-faturamentoAnual">Faturamento anual (R$) *</Label>
              <Input
                id="new-faturamentoAnual"
                type="number"
                min="0"
                required
                value={faturamentoAnual}
                onChange={(e) => setFaturamentoAnual(e.target.value)}
                placeholder="1200000"
              />
            </div>
            <div>
              <Label htmlFor="new-margemLucro">Margem de lucro (%)</Label>
              <Input
                id="new-margemLucro"
                type="number"
                min="0"
                max="100"
                value={margemLucro}
                onChange={(e) => setMargemLucro(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} className="h-10 rounded-xl px-4">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="h-10 gap-2 rounded-xl px-5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Cadastrar empresa
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
