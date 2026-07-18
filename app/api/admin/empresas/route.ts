import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { createEmpresa, getEmpresa, listEmpresas, updateEmpresa } from '@/lib/db-admin'

const MAX_LOGO_BASE64_CHARS = 700_000 // ~500KB de imagem em base64

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const empresas = listEmpresas()
  return NextResponse.json({ empresas })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  let body: {
    nome?: string; cnpj?: string; regime?: string; nomeFantasia?: string; telefone?: string
    responsavel?: string; endereco?: string; ramo?: string; logo?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
  }

  const nome = body.nome?.trim()
  if (!nome) return NextResponse.json({ error: 'Nome da empresa é obrigatório.' }, { status: 400 })
  if (body.logo && body.logo.length > MAX_LOGO_BASE64_CHARS) {
    return NextResponse.json({ error: 'Logo muito grande (máximo ~500KB).' }, { status: 400 })
  }

  const id = createEmpresa({ nome, cnpj: body.cnpj?.trim() ?? '', regime: body.regime?.trim() ?? '' })

  const extras = {
    nomeFantasia: body.nomeFantasia?.trim(),
    telefone: body.telefone?.trim(),
    responsavel: body.responsavel?.trim(),
    endereco: body.endereco?.trim(),
    ramo: body.ramo?.trim(),
    logo: body.logo ?? undefined,
  }
  if (Object.values(extras).some((v) => v !== undefined && v !== '')) {
    updateEmpresa(id, extras)
  }

  return NextResponse.json({ id, empresa: getEmpresa(id) })
}
