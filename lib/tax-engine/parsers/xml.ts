import { XMLParser } from 'fast-xml-parser'

import type { LineItem, ParsedDocument } from '../types'

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
})

function findFirst(node: unknown, tagName: string): unknown {
  if (node === null || typeof node !== 'object') return undefined
  const obj = node as Record<string, unknown>
  const lower = tagName.toLowerCase()
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lower) return obj[key]
  }
  for (const key of Object.keys(obj)) {
    const found = findFirst(obj[key], tagName)
    if (found !== undefined) return found
  }
  return undefined
}

function findAll(node: unknown, tagName: string): unknown[] {
  const results: unknown[] = []
  const lower = tagName.toLowerCase()
  function walk(n: unknown) {
    if (n === null || typeof n !== 'object') return
    const obj = n as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      const value = obj[key]
      if (key.toLowerCase() === lower) {
        if (Array.isArray(value)) results.push(...value)
        else results.push(value)
      } else if (Array.isArray(value)) {
        value.forEach(walk)
      } else {
        walk(value)
      }
    }
  }
  walk(node)
  return results
}

function findNested(node: unknown, ...path: string[]): unknown {
  let current = node
  for (const tag of path) {
    current = findFirst(current, tag)
    if (current === undefined) return undefined
  }
  return current
}

function asText(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'object') return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

/**
 * Faz o parsing de uma NF-e (layout padrão da SEFAZ). Aceita o XML com ou
 * sem o envelope `nfeProc`, e ignora namespaces (xmlns) automaticamente.
 */
export function parseXml(content: string): ParsedDocument {
  let root: unknown
  try {
    root = parser.parse(content)
  } catch {
    return { items: [], warnings: ['Não foi possível interpretar o arquivo XML enviado.'] }
  }

  const detNodes = findAll(root, 'det')
  if (detNodes.length === 0) {
    return {
      items: [],
      warnings: ['Nenhum item (tag <det>) encontrado no XML. Verifique se é uma NF-e válida.'],
    }
  }

  const tpNF = asText(findFirst(root, 'tpNF'))
  const operacao: 'entrada' | 'saida' = tpNF === '0' ? 'entrada' : 'saida'
  const destNome = asText(findNested(root, 'dest', 'xNome'))
  const emitNome = asText(findNested(root, 'emit', 'xNome'))
  const clienteFornecedor = operacao === 'saida' ? destNome : emitNome

  const warnings: string[] = []
  const items: LineItem[] = []

  for (const det of detNodes) {
    const prod = findFirst(det, 'prod')
    if (!prod) continue

    const descricao = asText(findFirst(prod, 'xProd'))
    const valorText = asText(findFirst(prod, 'vProd'))
    const valor = valorText ? Number(valorText) : NaN
    if (!Number.isFinite(valor)) {
      warnings.push(`Item ignorado: valor inválido (${descricao ?? 'sem descrição'}).`)
      continue
    }

    const imposto = findFirst(det, 'imposto')
    const cst = asText(findFirst(imposto, 'CST')) ?? asText(findFirst(imposto, 'CSOSN'))

    items.push({
      ncm: asText(findFirst(prod, 'NCM')),
      cfop: asText(findFirst(prod, 'CFOP')),
      cst,
      descricao,
      operacao,
      valor,
      clienteFornecedor,
    })
  }

  if (items.length === 0) {
    warnings.push('Nenhum item válido foi extraído do XML.')
  }

  return { items, warnings }
}
