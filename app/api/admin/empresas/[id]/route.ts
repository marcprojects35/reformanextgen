import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { getEmpresa, getEmpresaReports, getEmpresaAnalises, getAdminReport, updateEmpresa } from '@/lib/db-admin'
import { getUserById, listCompanyEditsWithUser } from '@/lib/db'
import { syncEmpresaLogoToCompany } from '@/lib/empresa-link'
import { resumoPeriodo, type AdminReportV2 } from '@/lib/admin-engine'

const MAX_LOGO_BASE64_CHARS = 700_000 // ~500KB de imagem em base64

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const empresaId = Number(id)
  if (!Number.isFinite(empresaId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const empresa = getEmpresa(empresaId)
  if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

  const relatorios = getEmpresaReports(empresaId)

  // Resumo compacto por relatório — computado no servidor para não trafegar o
  // JSON completo (que pode ser grande) para o cliente só para exibir o histórico.
  const resumos = relatorios.map(r => {
    const full = getAdminReport(r.id)
    if (!full) return null
    try {
      const report = JSON.parse(full.report_json) as AdminReportV2
      return { id: r.id, periodo: r.periodo, createdAt: r.created_at, resumo: resumoPeriodo(report) }
    } catch {
      return null
    }
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  // 1 linha por análise (os 8 anos de transição importados juntos) — usado na tela
  // "Relatórios Anteriores". `resumos` (1 por ano) continua existindo à parte pro
  // agrupamento mensal/trimestral/etc. de "Comparativos", que não muda aqui.
  const analises = getEmpresaAnalises(empresaId)

  const clienteVinculado = empresa.app_user_id ? getUserById(empresa.app_user_id) : null
  const historicoEdicoes = empresa.app_company_id ? listCompanyEditsWithUser(empresa.app_company_id) : []

  return NextResponse.json({
    empresa,
    relatorios,
    resumos,
    analises,
    clienteVinculado: clienteVinculado
      ? { id: clienteVinculado.id, name: clienteVinculado.name, email: clienteVinculado.email }
      : null,
    historicoEdicoes,
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const empresaId = Number(id)
  if (!Number.isFinite(empresaId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const existing = getEmpresa(empresaId)
  if (!existing) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

  let body: {
    nome?: string; cnpj?: string; regime?: string; nomeFantasia?: string; telefone?: string
    responsavel?: string; endereco?: string; ramo?: string; logo?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
  }

  if (body.nome !== undefined && !body.nome.trim()) {
    return NextResponse.json({ error: 'Nome da empresa não pode ficar vazio.' }, { status: 400 })
  }
  if (body.logo && body.logo.length > MAX_LOGO_BASE64_CHARS) {
    return NextResponse.json({ error: 'Logo muito grande (máximo ~500KB).' }, { status: 400 })
  }

  updateEmpresa(empresaId, body)
  if (body.logo !== undefined) syncEmpresaLogoToCompany(empresaId)
  const empresa = getEmpresa(empresaId)
  return NextResponse.json({ empresa })
}
