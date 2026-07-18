'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2 } from 'lucide-react'

const MAX_LOGO_BYTES = 500 * 1024

const REGIME_OPTIONS = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real']

export function EmpresaCreateForm() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [nome, setNome] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [telefone, setTelefone] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [endereco, setEndereco] = useState('')
  const [ramo, setRamo] = useState('')
  const [regime, setRegime] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleLogoFile(f: File) {
    if (f.size > MAX_LOGO_BYTES) {
      setError('Logo muito grande (máximo 500KB).')
      return
    }
    if (!f.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.')
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => setLogo(reader.result as string)
    reader.readAsDataURL(f)
  }

  async function handleCreate() {
    if (!nome.trim()) { setError('Nome não pode ficar vazio.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          nomeFantasia: nomeFantasia.trim(),
          cnpj: cnpj.trim(),
          telefone: telefone.trim(),
          responsavel: responsavel.trim(),
          endereco: endereco.trim(),
          ramo: ramo.trim(),
          regime,
          logo,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao cadastrar empresa.'); return }
      router.push(`/admin/empresas/${data.id}`)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border bg-foreground/5 hover:border-primary/40"
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <Upload className="h-5 w-5 text-foreground/30" />
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs font-medium text-primary hover:text-primary/80"
          >
            {logo ? 'Trocar logo' : 'Enviar logo'}
          </button>
          <p className="mt-0.5 text-[11px] text-foreground/30">PNG, JPG · até 500KB</p>
          {logo && (
            <button type="button" onClick={() => setLogo(null)} className="mt-0.5 block text-[11px] text-foreground/30 hover:text-loss">
              Remover
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome *">
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Nome fantasia">
          <input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} className={inputCls} />
        </Field>
        <Field label="CNPJ">
          <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} className={`${inputCls} font-tabular`} />
        </Field>
        <Field label="Telefone para contato">
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className={`${inputCls} font-tabular`} />
        </Field>
        <Field label="Sócio ou responsável">
          <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Ramo">
          <input value={ramo} onChange={(e) => setRamo(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Regime tributário" className="sm:col-span-2">
          <select value={regime} onChange={(e) => setRegime(e.target.value)} className={inputCls}>
            <option value="" className="bg-popover">Selecione…</option>
            {REGIME_OPTIONS.map((r) => (
              <option key={r} value={r} className="bg-popover">{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Endereço" className="sm:col-span-2">
          <input value={endereco} onChange={(e) => setEndereco(e.target.value)} className={inputCls} />
        </Field>
      </div>

      {error && <p className="text-xs text-loss">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving || !nome.trim()}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? 'Cadastrando...' : 'Cadastrar empresa'}
        </button>
      </div>
    </div>
  )
}

const inputCls = 'h-10 w-full rounded-lg border border-border bg-foreground/5 px-3 text-sm text-foreground placeholder-white/30 outline-none focus:border-primary/50'

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <label className="text-xs text-foreground/40">{label}</label>
      {children}
    </div>
  )
}
