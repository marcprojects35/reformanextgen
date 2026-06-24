import type { LineItem, Operacao, ParsedDocument } from '../types'

function toNumber(value: string | undefined): number {
  if (!value) return NaN
  return Number(value.trim().replace(/\./g, '').replace(',', '.'))
}

/**
 * Parser de melhor esforço para SPED EFD ICMS/IPI (texto delimitado por `|`).
 * Cobre os registros mais comuns para extração de itens fiscais:
 *  - 0200 (cadastro de item → NCM)
 *  - 0150 (cadastro de participante → nome do cliente/fornecedor)
 *  - C100 (cabeçalho do documento → indicador de operação e participante)
 *  - C170 (itens do documento → CFOP, CST, valor)
 * Outros blocos do SPED (ex.: EFD Contribuições, registros de serviços)
 * não são reconhecidos por este parser nesta versão.
 */
export function parseEfd(content: string): ParsedDocument {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) {
    return { items: [], warnings: ['Arquivo EFD vazio.'] }
  }

  const itemNcmMap = new Map<string, string | null>()
  const partnerNameMap = new Map<string, string>()

  for (const line of lines) {
    const fields = line.split('|')
    const reg = fields[1]
    if (reg === '0200') {
      const codItem = fields[2]
      const codNcm = fields[8]?.trim()
      if (codItem) itemNcmMap.set(codItem, codNcm && codNcm.length > 0 ? codNcm : null)
    } else if (reg === '0150') {
      const codPart = fields[2]
      const nome = fields[3]?.trim()
      if (codPart && nome) partnerNameMap.set(codPart, nome)
    }
  }

  let recognizedAnyRegister = false
  let currentOperacao: Operacao = 'saida'
  let currentPartnerCode: string | null = null
  const items: LineItem[] = []
  const warnings: string[] = []

  for (const line of lines) {
    const fields = line.split('|')
    const reg = fields[1]

    if (reg === 'C100') {
      recognizedAnyRegister = true
      currentOperacao = fields[2] === '0' ? 'entrada' : 'saida'
      currentPartnerCode = fields[4]?.trim() || null
      continue
    }

    if (reg === 'C170') {
      recognizedAnyRegister = true
      const codItem = fields[3]?.trim()
      const descricao = fields[4]?.trim() || null
      const valor = toNumber(fields[7])
      const cst = fields[10]?.trim() || null
      const cfop = fields[11]?.trim() || null

      if (!Number.isFinite(valor)) {
        warnings.push(`Registro C170 ignorado: valor inválido (${descricao ?? 'sem descrição'}).`)
        continue
      }

      items.push({
        ncm: codItem ? itemNcmMap.get(codItem) ?? null : null,
        cfop,
        cst,
        descricao,
        operacao: currentOperacao,
        valor,
        clienteFornecedor: currentPartnerCode
          ? partnerNameMap.get(currentPartnerCode) ?? null
          : null,
      })
    }
  }

  if (!recognizedAnyRegister) {
    return {
      items: [],
      warnings: [
        'Nenhum registro C100/C170 reconhecido. Este parser cobre apenas EFD ICMS/IPI; outros leiautes SPED ainda não são suportados.',
      ],
    }
  }
  if (items.length === 0) {
    warnings.push('Nenhum item (registro C170) válido foi extraído do arquivo EFD.')
  }

  return { items, warnings }
}
