import type { RegimeAtual, Setor } from '@/lib/db'

export interface CompanyProfile {
  razaoSocial: string
  setor: Setor
  uf: string
  regimeAtual: RegimeAtual
  faturamentoAnual: number
  /** Margem de lucro estimada sobre o faturamento (%), usada para aproximar a base do Lucro Real. */
  margemLucro: number
}

export type Operacao = 'entrada' | 'saida'

export interface LineItem {
  ncm: string | null
  cfop: string | null
  cst: string | null
  descricao: string | null
  operacao: Operacao
  valor: number
  clienteFornecedor: string | null
}

export type RegimeKey = 'simples' | 'presumido' | 'real' | 'iva_dual'

export interface YearlyProjection {
  ano: number
  receita: number
  tributosAtuais: number
  tributosReforma: number
  cargaAtualPct: number
  cargaReformaPct: number
}

export interface RegimeResult {
  regime: RegimeKey
  label: string
  /** Carga total no primeiro ano simulado (2026), em R$. Nulo para o cartão "IVA Dual" (não existe pré-reforma). */
  tributosHoje: number | null
  cargaHojePct: number | null
  tributos2033: number
  carga2033Pct: number
  economiaEstimada: number
  anos: YearlyProjection[]
}

export interface DrillDownRow {
  chave: string
  label: string
  receita: number
  tributosAtuais: number
  tributosReforma: number
  percentualReceita: number
}

export interface WaterfallStep {
  label: string
  valor: number
}

export interface EngineOutput {
  resumo: {
    receitaConsiderada: number
    regimeAtual: RegimeKey
    regimeIdeal: RegimeKey
    economiaAnual: number
    economiaPct: number
    baseadoEmArquivos: boolean
    totalLinhas: number
  }
  regimes: RegimeResult[]
  waterfall: WaterfallStep[]
  drillDownPorNcm: DrillDownRow[]
  drillDownPorParceiro: DrillDownRow[]
  alertas: string[]
}

export interface ParsedDocument {
  items: LineItem[]
  warnings: string[]
}
