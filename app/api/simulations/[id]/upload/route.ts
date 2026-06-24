import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import {
  getSimulationWithCompany,
  getLineItems,
  insertDocument,
  insertLineItems,
  replaceResults,
  updateSimulationStatus,
} from '@/lib/db'
import { detectDocumentType, parseDocument } from '@/lib/tax-engine/parsers'
import { runTaxEngine } from '@/lib/tax-engine/engine'
import { toResultRows } from '@/lib/tax-engine/persistence'
import type { CompanyProfile, LineItem } from '@/lib/tax-engine/types'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const simulationId = Number(id)
  const simulation = getSimulationWithCompany(simulationId, user.id)
  if (!simulation) {
    return NextResponse.json({ error: 'Simulação não encontrada.' }, { status: 404 })
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Não foi possível ler os arquivos enviados.' }, { status: 400 })
  }

  const MAX_FILES = 10
  const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB por arquivo

  updateSimulationStatus(simulationId, 'processando')

  const alertas: string[] = []
  const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File)

  if (files.length > MAX_FILES) {
    updateSimulationStatus(simulationId, 'erro', `Limite de ${MAX_FILES} arquivos por simulação.`)
    return NextResponse.json({ error: `Envie no máximo ${MAX_FILES} arquivos por simulação.` }, { status: 400 })
  }

  const oversized = files.find((f) => f.size > MAX_FILE_BYTES)
  if (oversized) {
    updateSimulationStatus(simulationId, 'erro', `Arquivo ${oversized.name} excede o limite de 20 MB.`)
    return NextResponse.json({ error: `O arquivo "${oversized.name}" excede o limite de 20 MB.` }, { status: 400 })
  }

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const type = detectDocumentType(file.name, buffer)
    const parsed = parseDocument(type, buffer)

    alertas.push(...parsed.warnings.map((warning) => `${file.name}: ${warning}`))

    const document = insertDocument({ simulationId, filename: file.name, type })
    if (parsed.items.length > 0) {
      insertLineItems(simulationId, document.id, parsed.items)
    }
  }

  try {
    const lineItems: LineItem[] = getLineItems(simulationId).map((row) => ({
      ncm: row.ncm,
      cfop: row.cfop,
      cst: row.cst,
      descricao: row.descricao,
      operacao: row.operacao,
      valor: row.valor,
      clienteFornecedor: row.cliente_fornecedor,
    }))

    const profile: CompanyProfile = {
      razaoSocial: simulation.razao_social,
      setor: simulation.setor,
      uf: simulation.uf,
      regimeAtual: simulation.regime_atual,
      faturamentoAnual: simulation.faturamento_anual,
      margemLucro: simulation.margem_lucro,
    }

    const output = runTaxEngine(profile, lineItems, alertas)
    replaceResults(simulationId, toResultRows(output, profile.faturamentoAnual))
    updateSimulationStatus(simulationId, 'concluida')

    return NextResponse.json({ simulationId, status: 'concluida', alertas: output.alertas })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao calcular.'
    updateSimulationStatus(simulationId, 'erro', message)
    return NextResponse.json({ error: `Falha ao calcular a simulação: ${message}` }, { status: 500 })
  }
}
