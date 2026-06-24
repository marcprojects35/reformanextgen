'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import type { RegimeAtual, Setor } from '@/lib/db'
import { regimeAtualLabels, setorLabels, ufOptions } from '@/lib/labels'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { SpotlightCard } from '@/components/landing/spotlight-card'
import { FileDropzone } from './file-dropzone'

/* ─── step config ─────────────────────────────────────────────── */
const STEPS = [
  { number: '01', label: 'Dados da empresa' },
  { number: '02', label: 'Arquivos fiscais' },
]

/* ─── stagger variants for form field groups ─────────────────── */
const formVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}
const fieldVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

/* ─── types ──────────────────────────────────────────────────── */
type WizardStep = 'empresa' | 'arquivos' | 'calculando'

interface CompanyForm {
  razaoSocial: string
  cnpj: string
  setor: Setor
  uf: string
  regimeAtual: RegimeAtual
  faturamentoAnual: string
  margemLucro: string
}

const initialForm: CompanyForm = {
  razaoSocial: '',
  cnpj: '',
  setor: 'comercio',
  uf: 'SP',
  regimeAtual: 'simples',
  faturamentoAnual: '',
  margemLucro: '10',
}

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

/* ─── component ──────────────────────────────────────────────── */
export function SimulationWizard() {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>('empresa')
  const [form, setForm] = useState<CompanyForm>(initialForm)
  const [files, setFiles] = useState<File[]>([])
  const [simulationId, setSimulationId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function updateForm<K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleEmpresaSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { company } = await postJson('/api/companies', {
        razaoSocial: form.razaoSocial,
        cnpj: form.cnpj || undefined,
        setor: form.setor,
        uf: form.uf,
        regimeAtual: form.regimeAtual,
        faturamentoAnual: Number(form.faturamentoAnual),
        margemLucro: Number(form.margemLucro),
      })
      const { simulation } = await postJson('/api/simulations', { companyId: company.id })
      setSimulationId(simulation.id)
      setStep('arquivos')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCalcular() {
    if (!simulationId) return
    setError(null)
    setStep('calculando')
    try {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      const response = await fetch(`/api/simulations/${simulationId}/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Não foi possível calcular a simulação.')
      router.push(`/simulacao/${simulationId}/resultado`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado ao calcular.')
      setStep('arquivos')
    }
  }

  const currentStepIndex = step === 'empresa' ? 0 : 1
  const progressPct = step === 'calculando' ? 100 : currentStepIndex === 0 ? 0 : 50

  return (
    <div className="flex flex-col gap-8">
      {/* page header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-sm font-medium text-primary">Nova simulação</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          Descubra o impacto da{' '}
          <span className="text-gradient-gold">Reforma Tributária</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Cadastre os dados da sua empresa e, se quiser mais precisão, envie seus arquivos fiscais.
        </p>
      </motion.div>

      {/* step indicator + progress bar */}
      {step !== 'calculando' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s.number} className="flex items-center gap-0">
                <div className="flex items-center gap-2.5">
                  <div
                    className={[
                      'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-300',
                      i <= currentStepIndex
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground',
                    ].join(' ')}
                  >
                    {s.number}
                  </div>
                  <span
                    className={[
                      'text-sm font-medium transition-colors duration-300',
                      i === currentStepIndex ? 'text-foreground' : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={[
                      'mx-4 h-px w-12 transition-colors duration-500',
                      currentStepIndex > i ? 'bg-primary' : 'bg-border',
                    ].join(' ')}
                  />
                )}
              </div>
            ))}
          </div>

          {/* animated progress track */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-primary"
              style={{ originX: 0 }}
              animate={{ width: `${progressPct + 50}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </motion.div>
      )}

      {error && <Alert variant="destructive">{error}</Alert>}

      <AnimatePresence mode="wait">
        {/* ── STEP 1: Empresa ─────────────────────────────────── */}
        {step === 'empresa' && (
          <motion.div
            key="empresa"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm">
              <form onSubmit={handleEmpresaSubmit}>
                <motion.div
                  className="flex flex-col gap-5"
                  variants={formVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div variants={fieldVariants}>
                    <Label htmlFor="razaoSocial">Razão social</Label>
                    <Input
                      id="razaoSocial"
                      required
                      value={form.razaoSocial}
                      onChange={(e) => updateForm('razaoSocial', e.target.value)}
                      placeholder="Minha Empresa LTDA"
                    />
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <Label htmlFor="cnpj">
                      CNPJ{' '}
                      <span className="text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input
                      id="cnpj"
                      value={form.cnpj}
                      onChange={(e) => updateForm('cnpj', e.target.value)}
                      placeholder="00.000.000/0000-00"
                    />
                  </motion.div>

                  <motion.div variants={fieldVariants} className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="setor">Setor de atividade</Label>
                      <Select
                        id="setor"
                        value={form.setor}
                        onChange={(e) => updateForm('setor', e.target.value as Setor)}
                      >
                        {Object.entries(setorLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="uf">Estado (UF)</Label>
                      <Select
                        id="uf"
                        value={form.uf}
                        onChange={(e) => updateForm('uf', e.target.value)}
                      >
                        {ufOptions.map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </Select>
                    </div>
                  </motion.div>

                  <motion.div variants={fieldVariants} className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="regimeAtual">Regime tributário atual</Label>
                      <Select
                        id="regimeAtual"
                        value={form.regimeAtual}
                        onChange={(e) => updateForm('regimeAtual', e.target.value as RegimeAtual)}
                      >
                        {Object.entries(regimeAtualLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="faturamentoAnual">Faturamento anual (R$)</Label>
                      <Input
                        id="faturamentoAnual"
                        type="number"
                        min="1"
                        step="0.01"
                        required
                        value={form.faturamentoAnual}
                        onChange={(e) => updateForm('faturamentoAnual', e.target.value)}
                        placeholder="1.200.000"
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <Label htmlFor="margemLucro">Margem de lucro estimada (%)</Label>
                    <Input
                      id="margemLucro"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      required
                      value={form.margemLucro}
                      onChange={(e) => updateForm('margemLucro', e.target.value)}
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Usada para estimar a base do Lucro Real na comparação entre regimes.
                    </p>
                  </motion.div>

                  <motion.div
                    variants={fieldVariants}
                    className="flex items-center justify-between border-t border-border pt-5"
                  >
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-success" />
                      Dados criptografados · LGPD
                    </p>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="btn-shine glow-gold h-11 gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Continuar
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </motion.div>
                </motion.div>
              </form>
            </SpotlightCard>
          </motion.div>
        )}

        {/* ── STEP 2: Arquivos ─────────────────────────────────── */}
        {step === 'arquivos' && (
          <motion.div
            key="arquivos"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm">
              <motion.div
                className="flex flex-col gap-5"
                variants={formVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div variants={fieldVariants} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Arquivos fiscais (opcional)</p>
                    <p className="text-xs text-muted-foreground">
                      XML NF-e, EFD/SPED, XLSX ou JSON · máx. 10 arquivos · 20 MB cada
                    </p>
                  </div>
                </motion.div>

                <motion.p variants={fieldVariants} className="text-sm text-muted-foreground">
                  Envie seus arquivos para um resultado baseado nos seus dados reais de compra e
                  venda. Se preferir, pule e usaremos uma estimativa com base no faturamento
                  informado.
                </motion.p>

                <motion.div variants={fieldVariants}>
                  <FileDropzone files={files} onChange={setFiles} />
                </motion.div>

                <motion.div
                  variants={fieldVariants}
                  className="flex items-center justify-between border-t border-border pt-5"
                >
                  <button
                    type="button"
                    onClick={() => setStep('empresa')}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    ← Voltar
                  </button>
                  <Button
                    onClick={handleCalcular}
                    className="btn-shine glow-gold h-11 gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
                  >
                    {files.length > 0
                      ? `Calcular com ${files.length} arquivo${files.length > 1 ? 's' : ''}`
                      : 'Continuar sem arquivos'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              </motion.div>
            </SpotlightCard>
          </motion.div>
        )}

        {/* ── Calculando ───────────────────────────────────────── */}
        {step === 'calculando' && (
          <motion.div
            key="calculando"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <SpotlightCard className="rounded-2xl border border-primary/30 bg-card/70 py-20 text-center backdrop-blur-sm glow-gold">
              <div className="relative mx-auto h-14 w-14">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              </div>
              <p className="mt-6 text-lg font-semibold tracking-tight">
                Calculando o impacto…
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Aplicando CBS, IBS e Imposto Seletivo sobre os dados da sua empresa.
              </p>
              <div className="mx-auto mt-6 h-1 w-48 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  style={{ originX: 0 }}
                  initial={{ width: '0%' }}
                  animate={{ width: '90%' }}
                  transition={{ duration: 8, ease: 'linear' }}
                />
              </div>
            </SpotlightCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
