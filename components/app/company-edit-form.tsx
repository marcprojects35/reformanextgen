'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Camera, Check, Loader2, X } from 'lucide-react'

import type { CompanyRow, RegimeAtual, Setor } from '@/lib/db'
import { setorLabels, regimeAtualLabels, ufOptions } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { SpotlightCard } from '@/components/landing/spotlight-card'

const SETORES = Object.keys(setorLabels) as Setor[]
const REGIMES = Object.keys(regimeAtualLabels) as RegimeAtual[]
const MAX_LOGO_BYTES = 500 * 1024

function SuccessAlert() {
  return (
    <Alert variant="default" className="border-success/40 bg-success/10 text-success">
      <Check className="inline h-4 w-4" /> Alteração salva e registrada no histórico da empresa.
    </Alert>
  )
}

export function CompanyEditForm({
  company,
  onSaved,
}: {
  company: CompanyRow
  onSaved?: (updated: CompanyRow) => void
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const selectedCompanyId = useRef(company.id)

  const [razaoSocial, setRazaoSocial] = useState(company.razao_social)
  const [cnpj, setCnpj] = useState(company.cnpj ?? '')
  const [setor, setSetor] = useState<Setor | ''>(company.setor)
  const [uf, setUf] = useState(company.uf)
  const [regimeAtual, setRegimeAtual] = useState<RegimeAtual | ''>(company.regime_atual)
  const [faturamentoAnual, setFaturamentoAnual] = useState(String(company.faturamento_anual))
  const [margemLucro, setMargemLucro] = useState(String(company.margem_lucro))
  const [logo, setLogo] = useState<string | null>(company.logo ?? null)
  const [motivo, setMotivo] = useState('')

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reseta o form só quando o usuário troca de empresa selecionada (não quando
  // `company` é atualizada após um save bem-sucedido da mesma empresa — senão
  // apagaria o banner de sucesso que acabou de aparecer).
  useEffect(() => {
    if (selectedCompanyId.current === company.id) return
    selectedCompanyId.current = company.id

    setRazaoSocial(company.razao_social)
    setCnpj(company.cnpj ?? '')
    setSetor(company.setor)
    setUf(company.uf)
    setRegimeAtual(company.regime_atual)
    setFaturamentoAnual(String(company.faturamento_anual))
    setMargemLucro(String(company.margem_lucro))
    setLogo(company.logo ?? null)
    setMotivo('')
    setSuccess(false)
    setError(null)
  }, [company])

  const isDirty =
    razaoSocial !== company.razao_social ||
    cnpj !== (company.cnpj ?? '') ||
    setor !== company.setor ||
    uf !== company.uf ||
    regimeAtual !== company.regime_atual ||
    faturamentoAnual !== String(company.faturamento_anual) ||
    margemLucro !== String(company.margem_lucro) ||
    logo !== (company.logo ?? null)

  function handleLogoFile(f: File) {
    if (f.size > MAX_LOGO_BYTES) {
      setError('Logo muito grande (máximo 500KB).')
      return
    }
    if (!f.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.')
      return
    }
    setError(null)
    setSuccess(false)
    const reader = new FileReader()
    reader.onload = () => setLogo(reader.result as string)
    reader.readAsDataURL(f)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!motivo.trim() || motivo.trim().length < 5) {
      setError('Informe o motivo da alteração (mínimo 5 caracteres).')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razaoSocial,
          cnpj: cnpj || null,
          setor,
          uf,
          regimeAtual,
          faturamentoAnual: Number(faturamentoAnual),
          margemLucro: Number(margemLucro),
          logo,
          motivo: motivo.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Algo deu errado.')
      onSaved?.(data.company)
      setMotivo('')
      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <Building2 className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">Dados da empresa</h2>
          <p className="text-sm text-muted-foreground">
            Qualquer alteração fica registrada no histórico da empresa, com o motivo informado.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        {error && <Alert variant="destructive">{error}</Alert>}
        {success && <SuccessAlert />}

        <div className="flex items-center gap-4">
          <div className="group/logo relative shrink-0">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-accent transition-colors group-hover/logo:border-primary/50"
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Logo da empresa" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-7 w-7 text-muted-foreground" />
              )}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 opacity-0 backdrop-blur-sm transition-opacity group-hover/logo:opacity-100">
                <Camera className="h-5 w-5 text-foreground" />
              </span>
            </button>
            {logo && (
              <button
                type="button"
                onClick={() => { setLogo(null); setSuccess(false) }}
                aria-label="Remover logo"
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-destructive/50 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Logo da empresa</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1 text-sm font-medium text-primary hover:text-primary/80"
            >
              {logo ? 'Trocar logo' : 'Enviar logo'}
            </button>
            <p className="mt-0.5 text-xs text-muted-foreground">Aparece também no painel administrativo · PNG, JPG · até 500KB</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }}
          />
        </div>

        <div>
          <Label htmlFor="razaoSocial">Razão social</Label>
          <Input id="razaoSocial" value={razaoSocial} onChange={(e) => { setRazaoSocial(e.target.value); setSuccess(false) }} />
        </div>

        <div>
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input id="cnpj" value={cnpj} onChange={(e) => { setCnpj(e.target.value); setSuccess(false) }} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="setor">Setor</Label>
            <Select id="setor" value={setor} onChange={(e) => { setSetor(e.target.value as Setor); setSuccess(false) }}>
              {SETORES.map((s) => <option key={s} value={s}>{setorLabels[s]}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="uf">Estado (UF)</Label>
            <Select id="uf" value={uf} onChange={(e) => { setUf(e.target.value); setSuccess(false) }}>
              {ufOptions.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="regimeAtual">Regime tributário atual</Label>
          <Select id="regimeAtual" value={regimeAtual} onChange={(e) => { setRegimeAtual(e.target.value as RegimeAtual); setSuccess(false) }}>
            {REGIMES.map((r) => <option key={r} value={r}>{regimeAtualLabels[r]}</option>)}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="faturamentoAnual">Faturamento anual (R$)</Label>
            <Input
              id="faturamentoAnual"
              type="number"
              min="0"
              value={faturamentoAnual}
              onChange={(e) => { setFaturamentoAnual(e.target.value); setSuccess(false) }}
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
              onChange={(e) => { setMargemLucro(e.target.value); setSuccess(false) }}
            />
          </div>
        </div>

        {isDirty && (
          <div>
            <Label htmlFor="motivo">Motivo da alteração *</Label>
            <Textarea
              id="motivo"
              required
              rows={2}
              value={motivo}
              onChange={(e) => { setMotivo(e.target.value); setSuccess(false) }}
              placeholder="Explique por que está alterando esses dados…"
            />
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !isDirty} className="h-10 gap-2 rounded-xl px-5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </form>
    </SpotlightCard>
  )
}
