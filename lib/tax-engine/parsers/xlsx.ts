import * as XLSX from 'xlsx'

import type { LineItem, Operacao, ParsedDocument } from '../types'

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const HEADER_MAP: Record<string, keyof LineItem> = {
  ncm: 'ncm',
  cfop: 'cfop',
  cst: 'cst',
  csosn: 'cst',
  descricao: 'descricao',
  descricaoproduto: 'descricao',
  produto: 'descricao',
  item: 'descricao',
  operacao: 'operacao',
  tipo: 'operacao',
  tipooperacao: 'operacao',
  valor: 'valor',
  valortotal: 'valor',
  total: 'valor',
  vprod: 'valor',
  clientefornecedor: 'clienteFornecedor',
  cliente: 'clienteFornecedor',
  fornecedor: 'clienteFornecedor',
  parceiro: 'clienteFornecedor',
}

function parseOperacao(raw: unknown): { operacao: Operacao; warning?: string } {
  if (raw === null || raw === undefined || raw === '') return { operacao: 'saida' }
  const value = normalize(String(raw))
  if (['entrada', 'compra', 'purchase', 'in', 'e'].includes(value)) return { operacao: 'entrada' }
  if (['saida', 'venda', 'sale', 'out', 's', 'v'].includes(value)) return { operacao: 'saida' }
  return { operacao: 'saida', warning: `Valor de operação não reconhecido ("${raw}"), tratado como saída.` }
}

/**
 * Lê uma planilha XLSX cuja primeira linha contenha cabeçalhos com os nomes
 * (em qualquer ordem, acentos/maiúsculas tolerados): ncm, cfop, cst,
 * descricao, operacao (entrada|saida), valor, cliente_fornecedor.
 */
export function parseXlsx(buffer: Buffer): ParsedDocument {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' })
  } catch {
    return { items: [], warnings: ['Não foi possível interpretar o arquivo XLSX enviado.'] }
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { items: [], warnings: ['A planilha enviada está vazia.'] }
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: null,
  })

  if (rows.length === 0) {
    return { items: [], warnings: ['Nenhuma linha de dados encontrada na planilha.'] }
  }

  const warnings: string[] = []
  const items: LineItem[] = []

  for (const [index, row] of rows.entries()) {
    const mapped: Partial<Record<keyof LineItem, unknown>> = {}
    for (const [header, value] of Object.entries(row)) {
      const field = HEADER_MAP[normalize(header)]
      if (field) mapped[field] = value
    }

    const valorRaw = mapped.valor
    const valor = typeof valorRaw === 'number' ? valorRaw : Number(String(valorRaw ?? '').replace(',', '.'))
    if (!Number.isFinite(valor)) {
      warnings.push(`Linha ${index + 2}: valor inválido ou ausente, item ignorado.`)
      continue
    }

    const { operacao, warning } = parseOperacao(mapped.operacao)
    if (warning) warnings.push(`Linha ${index + 2}: ${warning}`)

    items.push({
      ncm: mapped.ncm != null ? String(mapped.ncm) : null,
      cfop: mapped.cfop != null ? String(mapped.cfop) : null,
      cst: mapped.cst != null ? String(mapped.cst) : null,
      descricao: mapped.descricao != null ? String(mapped.descricao) : null,
      operacao,
      valor,
      clienteFornecedor: mapped.clienteFornecedor != null ? String(mapped.clienteFornecedor) : null,
    })
  }

  if (items.length === 0) {
    warnings.push(
      'Nenhuma linha válida foi extraída. Confira se os cabeçalhos incluem "valor" e, idealmente, "ncm", "cfop" e "operacao".',
    )
  }

  return { items, warnings }
}
