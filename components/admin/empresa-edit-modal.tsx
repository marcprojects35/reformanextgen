'use client'

import { useState, useRef } from 'react'
import { X, Building2, Upload, Loader2 } from 'lucide-react'

export interface EmpresaEditData {
  id: number
  nome: string
  cnpj: string
  regime: string
  nome_fantasia: string
  telefone: string
  responsavel: string
  endereco: string
  ramo: string
  logo: string | null
  created_at: string
}

const MAX_LOGO_BYTES = 500 * 1024

const REGIME_OPTIONS = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real']

function tempoCadastrada(createdAt: string): string {
  const criado = new Date(createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`)
  if (Number.isNaN(criado.getTime())) return '—'
  const dias = Math.floor((Date.now() - criado.getTime()) / 86_400_000)
  if (dias < 1) return 'Hoje'
  if (dias < 30) return `${dias} dia${dias !== 1 ? 's' : ''}`
  if (dias < 365) {
    const meses = Math.floor(dias / 30)
    return `${meses} ${meses !== 1 ? 'meses' : 'mês'}`
  }
  const anos = Math.floor(dias / 365)
  const mesesRestantes = Math.floor((dias % 365) / 30)
  return `${anos} ano${anos !== 1 ? 's' : ''}${mesesRestantes ? ` e ${mesesRestantes} ${mesesRestantes !== 1 ? 'meses' : 'mês'}` : ''}`
}

export function EmpresaEditModal({
  empresa,
  onClose,
  onSaved,
}: {
  empresa: EmpresaEditData
  onClose: () => void
  onSaved: (updated: EmpresaEditData) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [nome, setNome] = useState(empresa.nome)
  const [nomeFantasia, setNomeFantasia] = useState(empresa.nome_fantasia)
  const [cnpj, setCnpj] = useState(empresa.cnpj)
  const [telefone, setTelefone] = useState(empresa.telefone)
  const [responsavel, setResponsavel] = useState(empresa.responsavel)
  const [endereco, setEndereco] = useState(empresa.endereco)
  const [ramo, setRamo] = useState(empresa.ramo)
  const [regime, setRegime] = useState(empresa.regime)
  const [logo, setLogo] = useState<string | null>(empresa.logo)
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

  async function handleSave() {
    if (!nome.trim()) { setError('Nome não pode ficar vazio.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/empresas/${empresa.id}`, {
        method: 'PATCH',
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
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar.'); return }
      onSaved(data.empresa as EmpresaEditData)
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-popover p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Editar Empresa</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-foreground/40 hover:bg-foreground/5 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

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
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome *">
              <input value={nome} onChange={e => setNome(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Nome fantasia">
              <input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} className={inputCls} />
            </Field>
            <Field label="CNPJ">
              <input value={cnpj} onChange={e => setCnpj(e.target.value)} className={`${inputCls} font-tabular`} />
            </Field>
            <Field label="Telefone para contato">
              <input value={telefone} onChange={e => setTelefone(e.target.value)} className={`${inputCls} font-tabular`} />
            </Field>
            <Field label="Sócio ou responsável">
              <input value={responsavel} onChange={e => setResponsavel(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Ramo">
              <input value={ramo} onChange={e => setRamo(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Regime tributário" className="sm:col-span-2">
              <select value={regime} onChange={e => setRegime(e.target.value)} className={inputCls}>
                <option value="" className="bg-popover">Selecione…</option>
                {REGIME_OPTIONS.map(r => (
                  <option key={r} value={r} className="bg-popover">{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Endereço" className="sm:col-span-2">
              <input value={endereco} onChange={e => setEndereco(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="rounded-lg border border-border bg-foreground/2 px-3 py-2">
            <p className="text-[11px] text-foreground/30">Cadastrada há</p>
            <p className="text-sm text-foreground/70">{tempoCadastrada(empresa.created_at)}</p>
          </div>

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
              onClick={handleSave}
              disabled={saving || !nome.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
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
