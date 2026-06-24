import type { LineItem, Operacao, ParsedDocument } from '../types'

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key]
  }
  return undefined
}

function parseOperacao(raw: unknown): { operacao: Operacao; warning?: string } {
  if (raw === null || raw === undefined || raw === '') return { operacao: 'saida' }
  const value = String(raw).toLowerCase()
  if (['entrada', 'compra', 'purchase', 'in'].includes(value)) return { operacao: 'entrada' }
  if (['saida', 'saída', 'venda', 'sale', 'out'].includes(value)) return { operacao: 'saida' }
  return { operacao: 'saida', warning: `Valor de operação não reconhecido ("${raw}"), tratado como saída.` }
}

/**
 * Aceita um array de itens fiscais ou um objeto `{ items: [...] }`. Chaves em
 * snake_case ou camelCase são aceitas (ex.: cliente_fornecedor / clienteFornecedor).
 */
export function parseJson(content: string): ParsedDocument {
  let data: unknown
  try {
    data = JSON.parse(content)
  } catch {
    return { items: [], warnings: ['O arquivo JSON enviado não é válido.'] }
  }

  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown })?.items)
      ? (data as { items: unknown[] }).items
      : null

  if (!rows) {
    return {
      items: [],
      warnings: ['Formato JSON não reconhecido. Envie um array de itens ou { "items": [...] }.'],
    }
  }

  const warnings: string[] = []
  const items: LineItem[] = []

  rows.forEach((row, index) => {
    if (typeof row !== 'object' || row === null) {
      warnings.push(`Item ${index + 1}: ignorado (não é um objeto).`)
      return
    }
    const obj = row as Record<string, unknown>
    const valorRaw = pick(obj, ['valor', 'value', 'total', 'vProd'])
    const valor = typeof valorRaw === 'number' ? valorRaw : Number(valorRaw)
    if (!Number.isFinite(valor)) {
      warnings.push(`Item ${index + 1}: valor inválido ou ausente, ignorado.`)
      return
    }

    const { operacao, warning } = parseOperacao(pick(obj, ['operacao', 'operação', 'tipo']))
    if (warning) warnings.push(`Item ${index + 1}: ${warning}`)

    const ncm = pick(obj, ['ncm', 'NCM'])
    const cfop = pick(obj, ['cfop', 'CFOP'])
    const cst = pick(obj, ['cst', 'CST', 'csosn', 'CSOSN'])
    const descricao = pick(obj, ['descricao', 'descrição', 'produto', 'descricaoProduto'])
    const clienteFornecedor = pick(obj, ['clienteFornecedor', 'cliente_fornecedor', 'cliente', 'fornecedor', 'parceiro'])

    items.push({
      ncm: ncm != null ? String(ncm) : null,
      cfop: cfop != null ? String(cfop) : null,
      cst: cst != null ? String(cst) : null,
      descricao: descricao != null ? String(descricao) : null,
      operacao,
      valor,
      clienteFornecedor: clienteFornecedor != null ? String(clienteFornecedor) : null,
    })
  })

  if (items.length === 0) {
    warnings.push('Nenhum item válido foi extraído do JSON.')
  }

  return { items, warnings }
}
