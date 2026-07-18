import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { createCompany, getCompanyById, listCompaniesByUser, type RegimeAtual, type Setor } from '@/lib/db'
import { linkClienteCompanyToEmpresa } from '@/lib/empresa-link'
import { setActiveCompanyCookie } from '@/lib/active-company'
import { ufOptions } from '@/lib/labels'

const SETORES: Setor[] = ['comercio', 'industria', 'servicos', 'servicos_fator_r', 'agropecuaria']
const REGIMES: RegimeAtual[] = ['simples', 'presumido', 'real']

// Valida dígitos verificadores do CNPJ (formato numérico de 14 dígitos).
function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digits)) return false
  const calc = (factor: number[]) =>
    factor.reduce((sum, f, i) => sum + Number(digits[i]) * f, 0) % 11
  const r1 = calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  if (Number(digits[12]) !== (r1 < 2 ? 0 : 11 - r1)) return false
  const r2 = calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return Number(digits[13]) === (r2 < 2 ? 0 : 11 - r2)
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const companies = listCompaniesByUser(user.id)
  return NextResponse.json({ companies })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const razaoSocial = typeof body?.razaoSocial === 'string' ? body.razaoSocial.trim() : ''
  const cnpj = typeof body?.cnpj === 'string' && body.cnpj.trim() ? body.cnpj.trim() : null
  const setor = body?.setor as Setor
  const uf = typeof body?.uf === 'string' ? body.uf.toUpperCase() : ''
  const regimeAtual = body?.regimeAtual as RegimeAtual
  const faturamentoAnual = Number(body?.faturamentoAnual)
  const margemLucro = Number(body?.margemLucro ?? 10)

  if (!razaoSocial || razaoSocial.length < 2) {
    return NextResponse.json({ error: 'Informe a razão social da empresa.' }, { status: 400 })
  }
  if (cnpj && !isValidCnpj(cnpj)) {
    return NextResponse.json({ error: 'CNPJ inválido.' }, { status: 400 })
  }
  if (!SETORES.includes(setor)) {
    return NextResponse.json({ error: 'Setor inválido.' }, { status: 400 })
  }
  if (!ufOptions.includes(uf)) {
    return NextResponse.json({ error: 'UF inválida.' }, { status: 400 })
  }
  if (!REGIMES.includes(regimeAtual)) {
    return NextResponse.json({ error: 'Regime tributário atual inválido.' }, { status: 400 })
  }
  if (!Number.isFinite(faturamentoAnual) || faturamentoAnual <= 0) {
    return NextResponse.json({ error: 'Informe um faturamento anual válido.' }, { status: 400 })
  }
  if (!Number.isFinite(margemLucro) || margemLucro < 0 || margemLucro > 100) {
    return NextResponse.json({ error: 'Margem de lucro deve estar entre 0 e 100.' }, { status: 400 })
  }

  const company = createCompany({
    userId: user.id,
    cnpj,
    razaoSocial,
    setor,
    uf,
    regimeAtual,
    faturamentoAnual,
    margemLucro,
  })

  linkClienteCompanyToEmpresa(company, user.id)
  await setActiveCompanyCookie(company.id)

  return NextResponse.json({ company: getCompanyById(company.id) })
}
