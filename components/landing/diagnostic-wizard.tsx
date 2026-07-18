'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import type { RegimeAtual, Setor } from '@/lib/db'
import { setorLabels, regimeAtualLabels, ufOptions } from '@/lib/labels'
import type { DiagnosticResult } from '@/lib/diagnostic-engine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'

const SETORES = Object.keys(setorLabels) as Setor[]
const REGIMES = Object.keys(regimeAtualLabels) as RegimeAtual[]

type Step = 0 | 1 | 2 | 3

export function DiagnosticWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [setor, setSetor] = useState<Setor | ''>('')
  const [regimeAtual, setRegimeAtual] = useState<RegimeAtual | ''>('')
  const [faturamentoAnual, setFaturamentoAnual] = useState('')
  const [margemLucro, setMargemLucro] = useState('10')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<DiagnosticResult | null>(null)

  const [showRegister, setShowRegister] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [uf, setUf] = useState('')
  const [senha, setSenha] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setor, regimeAtual, faturamentoAnual: Number(faturamentoAnual), margemLucro: Number(margemLucro) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Algo deu errado.')
      setResultado(data.resultado as DiagnosticResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    setRegisterError(null)

    if (!nome || nome.trim().length < 2) {
      setRegisterError('Informe seu nome completo.')
      return
    }
    if (!email.includes('@')) {
      setRegisterError('Informe um e-mail válido.')
      return
    }
    const phoneDigits = telefone.replace(/\D/g, '')
    if (phoneDigits.length < 10) {
      setRegisterError('Informe um telefone válido com DDD.')
      return
    }
    if (!uf) {
      setRegisterError('Selecione o estado da sua empresa.')
      return
    }
    if (senha.length < 8) {
      setRegisterError('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    setRegisterLoading(true)
    try {
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nome, email, phone: telefone, password: senha }),
      })
      const signupData = await signupRes.json()
      if (!signupRes.ok) throw new Error(signupData.error ?? 'Não foi possível criar seu acesso.')

      const companyRes = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razaoSocial: nome,
          cnpj: cnpj || null,
          setor,
          uf,
          regimeAtual,
          faturamentoAnual: Number(faturamentoAnual),
          margemLucro: Number(margemLucro),
        }),
      })
      const companyData = await companyRes.json()
      if (!companyRes.ok) throw new Error(companyData.error ?? 'Não foi possível cadastrar sua empresa.')

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Algo deu errado.')
      setRegisterLoading(false)
    }
  }

  if (resultado) {
    const Icon = resultado.direcao === 'aumento' ? TrendingUp : resultado.direcao === 'reducao' ? TrendingDown : Minus
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card/60 p-6 text-center backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-accent/60">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h2 className="mt-4 text-lg font-semibold tracking-tight">Seu diagnóstico</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{resultado.mensagem}</p>
        <div className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-3 text-left">
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Carga atual (est.)</p>
            <p className="text-sm font-semibold tabular-nums">{resultado.cargaAtualEstimadaPct.toFixed(1)}%</p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Pós-reforma (est.)</p>
            <p className="text-sm font-semibold tabular-nums">{resultado.cargaReformaEstimadaPct.toFixed(1)}%</p>
          </div>
        </div>
        <p className="mx-auto mt-4 max-w-sm text-[11px] text-muted-foreground/70">
          Estimativa simplificada e diretiva, sem análise de documentos fiscais. Para um diagnóstico completo e personalizado, fale com a nossa equipe.
        </p>

        {!showRegister ? (
          <Button
            type="button"
            onClick={() => setShowRegister(true)}
            className="btn-shine glow-gold mx-auto mt-6 h-11 gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Quero acompanhar isso na plataforma
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mt-6 max-w-sm space-y-3 text-left"
          >
            <p className="text-sm font-medium text-foreground">
              Preencha seus dados para acessar essa análise na plataforma (e receber por e-mail, se quiser).
            </p>

            {registerError && <Alert variant="destructive">{registerError}</Alert>}

            <div>
              <Label htmlFor="reg-nome">Nome *</Label>
              <Input id="reg-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
            </div>
            <div>
              <Label htmlFor="reg-email">E-mail *</Label>
              <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
            </div>
            <div>
              <Label htmlFor="reg-telefone">Telefone *</Label>
              <Input id="reg-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label htmlFor="uf">Estado *</Label>
              <Select id="uf" value={uf} onChange={(e) => setUf(e.target.value)}>
                <option value="">Selecione…</option>
                {ufOptions.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="senha">Crie uma senha *</Label>
              <Input id="senha" type="password" minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" />
            </div>

            <Button
              type="button"
              disabled={registerLoading}
              onClick={handleRegister}
              className="btn-shine glow-gold h-11 w-full justify-center gap-2 rounded-xl text-sm font-semibold"
            >
              {registerLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar acesso e ver na plataforma
            </Button>
          </motion.div>
        )}
      </motion.div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-sm">
      {/* progresso */}
      <div className="mb-6 flex items-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-secondary/60'}`} />
        ))}
      </div>

      {error && <div className="mb-4"><Alert variant="destructive">{error}</Alert></div>}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.25 }}
        >
          {step === 0 && (
            <div>
              <Label htmlFor="setor">1. Qual o setor da sua empresa?</Label>
              <Select id="setor" value={setor} onChange={(e) => setSetor(e.target.value as Setor)}>
                <option value="">Selecione…</option>
                {SETORES.map((s) => (
                  <option key={s} value={s}>{setorLabels[s]}</option>
                ))}
              </Select>
            </div>
          )}

          {step === 1 && (
            <div>
              <Label htmlFor="regimeAtual">2. Qual seu regime tributário atual?</Label>
              <Select id="regimeAtual" value={regimeAtual} onChange={(e) => setRegimeAtual(e.target.value as RegimeAtual)}>
                <option value="">Selecione…</option>
                {REGIMES.map((r) => (
                  <option key={r} value={r}>{regimeAtualLabels[r]}</option>
                ))}
              </Select>
            </div>
          )}

          {step === 2 && (
            <div>
              <Label htmlFor="faturamentoAnual">3. Qual o faturamento anual aproximado (R$)?</Label>
              <Input id="faturamentoAnual" type="number" min="0" value={faturamentoAnual} onChange={(e) => setFaturamentoAnual(e.target.value)} placeholder="1200000" />
            </div>
          )}

          {step === 3 && (
            <div>
              <Label htmlFor="margemLucro">4. Qual sua margem de lucro aproximada (%)?</Label>
              <Input id="margemLucro" type="number" min="0" max="100" value={margemLucro} onChange={(e) => setMargemLucro(e.target.value)} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-between gap-2">
        {step > 0 ? (
          <button type="button" onClick={() => setStep((s) => (s - 1) as Step)} className="text-sm text-muted-foreground hover:text-foreground">
            Voltar
          </button>
        ) : <span />}

        {step < 3 ? (
          <Button
            type="button"
            disabled={(step === 0 && !setor) || (step === 1 && !regimeAtual) || (step === 2 && !faturamentoAnual)}
            onClick={() => setStep((s) => (s + 1) as Step)}
            className="btn-shine glow-gold h-10 gap-2 rounded-xl px-5 text-sm font-semibold"
          >
            Próxima <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            disabled={loading || !margemLucro}
            onClick={handleSubmit}
            className="btn-shine glow-gold h-10 gap-2 rounded-xl px-5 text-sm font-semibold"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Ver meu diagnóstico
          </Button>
        )}
      </div>
    </div>
  )
}
