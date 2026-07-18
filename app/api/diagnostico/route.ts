import { NextResponse } from 'next/server'

import type { RegimeAtual, Setor } from '@/lib/db'
import { createDiagnosticLead } from '@/lib/db-admin'
import { computeDiagnostic } from '@/lib/diagnostic-engine'

const SETORES: Setor[] = ['comercio', 'industria', 'servicos', 'servicos_fator_r', 'agropecuaria']
const REGIMES: RegimeAtual[] = ['simples', 'presumido', 'real']

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  const setor = body?.setor as Setor
  const regimeAtual = body?.regimeAtual as RegimeAtual
  const faturamentoAnual = Number(body?.faturamentoAnual)
  const margemLucro = Number(body?.margemLucro ?? 10)
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const telefone = typeof body?.telefone === 'string' ? body.telefone.trim() : ''

  if (!SETORES.includes(setor)) {
    return NextResponse.json({ error: 'Setor inválido.' }, { status: 400 })
  }
  if (!REGIMES.includes(regimeAtual)) {
    return NextResponse.json({ error: 'Regime tributário inválido.' }, { status: 400 })
  }
  if (!Number.isFinite(faturamentoAnual) || faturamentoAnual <= 0) {
    return NextResponse.json({ error: 'Informe um faturamento anual válido.' }, { status: 400 })
  }

  const resultado = computeDiagnostic({ setor, regimeAtual, faturamentoAnual, margemLucro })

  // Nome/e-mail/telefone só existem se a pessoa já tiver avançado para o
  // cadastro — o diagnóstico em si não exige nenhum contato antes do resultado.
  createDiagnosticLead({
    nome: nome || null,
    email: email || null,
    telefone: telefone || null,
    setor,
    regimeAtual,
    faturamentoAnual,
    margemLucro,
    resultado,
  })

  return NextResponse.json({ resultado })
}
