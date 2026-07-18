// Converte a planilha "Estrutura Mercadologica Ctrib" (Seção/Grupo/Subgrupo/Família)
// em lib/data/estrutura-mercadologica.json, consumido por lib/merc-categorias.ts.
//
// Rodar de novo se a planilha de origem for atualizada:
//   node scripts/gerar-estrutura-mercadologica.mjs
import * as XLSX from 'xlsx'
import { writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'

const SRC = path.join(process.cwd(), 'Estrutura Mercadologica Ctrib - correta certa.xlsx')
const OUT = path.join(process.cwd(), 'lib', 'data', 'estrutura-mercadologica.json')

// A planilha original tem um erro de digitação: o Grupo "Pet Shop" (Seção 4 -
// Animais Vivos) está codificado como 4.02, duplicando o código do Grupo
// "Para Reprodução". O Subgrupo filho dele já usa 4.03.001, então o código
// correto do grupo é 4.03. Corrigido aqui na conversão.
const CORRECOES = {
  '4.02|Pet Shop': '4.03',
}

const wb = XLSX.read(readFileSync(SRC))
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

const NIVEL_POR_PARTES = { 1: 'secao', 2: 'grupo', 3: 'subgrupo', 4: 'familia' }

const categorias = []
for (const row of rows) {
  if (!row || row.length < 3) continue
  const [codigoRaw, descricao, nivelLabel] = row
  if (!codigoRaw || !descricao || !nivelLabel) continue

  let codigo = String(codigoRaw).trim()
  const desc = String(descricao).trim()
  const key = `${codigo}|${desc}`
  if (CORRECOES[key]) codigo = CORRECOES[key]

  const partes = codigo.split('.')
  const nivel = NIVEL_POR_PARTES[partes.length]
  if (!nivel) continue

  const parentCodigo = partes.length > 1 ? partes.slice(0, -1).join('.') : null

  categorias.push({ codigo, descricao: desc, nivel, parentCodigo })
}

writeFileSync(OUT, JSON.stringify(categorias, null, 2) + '\n', 'utf-8')
console.log(`Gerado ${OUT} com ${categorias.length} categorias.`)
