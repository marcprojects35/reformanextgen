import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import {
  getCompanyById,
  insertCompanyEdit,
  updateCompany,
  type CompanyEditChange,
  type RegimeAtual,
  type Setor,
} from '@/lib/db'
import { syncCompanyToEmpresa } from '@/lib/empresa-link'
import { ufOptions } from '@/lib/labels'

const SETORES: Setor[] = ['comercio', 'industria', 'servicos', 'servicos_fator_r', 'agropecuaria']
const REGIMES: RegimeAtual[] = ['simples', 'presumido', 'real']
const MAX_LOGO_BASE64_CHARS = 700_000 // ~500KB de imagem em base64

const FIELD_LABELS: Record<string, string> = {
  razaoSocial: 'Razão social',
  cnpj: 'CNPJ',
  setor: 'Setor',
  uf: 'Estado (UF)',
  regimeAtual: 'Regime tributário atual',
  faturamentoAnual: 'Faturamento anual',
  margemLucro: 'Margem de lucro',
  logo: 'Logo da empresa',
}

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const companyId = Number(id)
  if (!Number.isFinite(companyId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const company = getCompanyById(companyId)
  if (!company || company.user_id !== user.id) {
    return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''
  if (!motivo || motivo.length < 5) {
    return NextResponse.json({ error: 'Informe o motivo da alteração (mínimo 5 caracteres).' }, { status: 400 })
  }

  const candidates: Record<string, unknown> = {}

  if (body?.razaoSocial !== undefined) {
    const razaoSocial = String(body.razaoSocial).trim()
    if (!razaoSocial || razaoSocial.length < 2) {
      return NextResponse.json({ error: 'Informe a razão social da empresa.' }, { status: 400 })
    }
    candidates.razaoSocial = razaoSocial
  }
  if (body?.cnpj !== undefined) {
    const cnpj = body.cnpj ? String(body.cnpj).trim() : null
    if (cnpj && !isValidCnpj(cnpj)) {
      return NextResponse.json({ error: 'CNPJ inválido.' }, { status: 400 })
    }
    candidates.cnpj = cnpj
  }
  if (body?.setor !== undefined) {
    if (!SETORES.includes(body.setor)) return NextResponse.json({ error: 'Setor inválido.' }, { status: 400 })
    candidates.setor = body.setor
  }
  if (body?.uf !== undefined) {
    const uf = String(body.uf).toUpperCase()
    if (!ufOptions.includes(uf)) return NextResponse.json({ error: 'UF inválida.' }, { status: 400 })
    candidates.uf = uf
  }
  if (body?.regimeAtual !== undefined) {
    if (!REGIMES.includes(body.regimeAtual)) return NextResponse.json({ error: 'Regime tributário inválido.' }, { status: 400 })
    candidates.regimeAtual = body.regimeAtual
  }
  if (body?.faturamentoAnual !== undefined) {
    const faturamentoAnual = Number(body.faturamentoAnual)
    if (!Number.isFinite(faturamentoAnual) || faturamentoAnual <= 0) {
      return NextResponse.json({ error: 'Informe um faturamento anual válido.' }, { status: 400 })
    }
    candidates.faturamentoAnual = faturamentoAnual
  }
  if (body?.margemLucro !== undefined) {
    const margemLucro = Number(body.margemLucro)
    if (!Number.isFinite(margemLucro) || margemLucro < 0 || margemLucro > 100) {
      return NextResponse.json({ error: 'Margem de lucro deve estar entre 0 e 100.' }, { status: 400 })
    }
    candidates.margemLucro = margemLucro
  }
  if (body?.logo !== undefined) {
    const logo = body.logo ? String(body.logo) : null
    if (logo && logo.length > MAX_LOGO_BASE64_CHARS) {
      return NextResponse.json({ error: 'Logo muito grande (máximo ~500KB).' }, { status: 400 })
    }
    if (logo && !logo.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Formato de logo inválido.' }, { status: 400 })
    }
    candidates.logo = logo
  }

  const currentByField: Record<string, unknown> = {
    razaoSocial: company.razao_social,
    cnpj: company.cnpj,
    setor: company.setor,
    uf: company.uf,
    regimeAtual: company.regime_atual,
    faturamentoAnual: company.faturamento_anual,
    margemLucro: company.margem_lucro,
    logo: company.logo,
  }

  const changes: CompanyEditChange[] = []
  const toApply: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(candidates)) {
    if (value !== currentByField[field]) {
      changes.push({ field, label: FIELD_LABELS[field] ?? field, before: currentByField[field], after: value })
      toApply[field] = value
    }
  }

  if (changes.length === 0) {
    return NextResponse.json({ error: 'Nenhuma alteração detectada.' }, { status: 400 })
  }

  updateCompany(companyId, toApply)
  insertCompanyEdit({ companyId, userId: user.id, motivo, changes })
  syncCompanyToEmpresa(companyId)

  return NextResponse.json({ company: getCompanyById(companyId) })
}
