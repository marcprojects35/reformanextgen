/**
 * Premissas tributárias de referência usadas pelo motor de simulação.
 *
 * A regulamentação da Reforma Tributária (EC 132/2023, LC 214/2025) ainda está
 * em finalização — alíquotas definitivas de CBS/IBS por produto, o cronograma
 * exato de transição e a lista completa de reduções/Imposto Seletivo por NCM
 * dependem de resoluções do Senado e do Comitê Gestor do IBS que ainda virão.
 *
 * Por isso, todos os números abaixo são premissas de referência, isoladas
 * neste arquivo para serem revisadas/ajustadas facilmente sem tocar no resto
 * do motor de cálculo. Eles não substituem parecer tributário.
 */

import type { RegimeAtual, Setor } from '@/lib/db'

// --- Alíquota de referência do IVA Dual ---
// Mesmo número já usado na landing page (ImpactSection): 27,5% combinados.
export const CBS_RATE = 8.8
export const IBS_RATE = 18.7
export const IVA_DUAL_REFERENCE_RATE = CBS_RATE + IBS_RATE // 27.5

// --- Cronograma de transição 2026 → 2033 ---
// `newWeight` representa a fração do imposto sobre o consumo já calculada
// pelas regras da reforma (CBS+IBS+IS) naquele ano; `oldWeight` é o
// complemento, calculado pelas regras atuais (ICMS/ISS/PIS-Cofins/IPI).
// Curva simplificada para fins didáticos (início lento em 2026-2028,
// aceleração a partir de 2029), não é o texto legal exato.
export const TRANSITION_SCHEDULE: Record<number, { oldWeight: number; newWeight: number }> = {
  2026: { oldWeight: 1, newWeight: 0 },
  2027: { oldWeight: 0.9, newWeight: 0.1 },
  2028: { oldWeight: 0.85, newWeight: 0.15 },
  2029: { oldWeight: 0.75, newWeight: 0.25 },
  2030: { oldWeight: 0.6, newWeight: 0.4 },
  2031: { oldWeight: 0.4, newWeight: 0.6 },
  2032: { oldWeight: 0.2, newWeight: 0.8 },
  2033: { oldWeight: 0, newWeight: 1 },
}

export const SIMULATION_YEARS = Object.keys(TRANSITION_SCHEDULE)
  .map(Number)
  .sort((a, b) => a - b)

// --- Imposto Seletivo (IS) por prefixo de NCM ---
// Lista representativa (não exaustiva) dos setores citados na EC 132/2023
// como sujeitos ao "Imposto do Pecado". Alíquotas são placeholders.
export const SELECTIVE_TAX_RULES: Array<{
  prefixes: string[]
  rate: number
  label: string
}> = [
  { prefixes: ['24'], rate: 25, label: 'Cigarros e derivados de tabaco' },
  { prefixes: ['2203', '2204', '2205', '2206', '2208'], rate: 20, label: 'Bebidas alcoólicas' },
  { prefixes: ['2710'], rate: 5, label: 'Combustíveis fósseis' },
  { prefixes: ['8703'], rate: 3, label: 'Veículos automotores' },
  { prefixes: ['8802', '8901', '8903'], rate: 4, label: 'Embarcações e aeronaves' },
  { prefixes: ['2601', '2602', '7106', '7108'], rate: 1, label: 'Bens minerais' },
]

// --- Reduções/isenções por prefixo de NCM ---
// `factor` multiplica a alíquota cheia de CBS+IBS (0 = isento, 0.4 = redução de 60%).
export const REDUCTION_RULES: Array<{ prefixes: string[]; factor: number; label: string }> = [
  {
    prefixes: ['1006', '0713', '0401', '0201', '0202', '0207', '1101', '0901', '1507'],
    factor: 0,
    label: 'Cesta básica nacional (subconjunto representativo)',
  },
  { prefixes: ['30'], factor: 0, label: 'Medicamentos essenciais' },
  { prefixes: ['9021'], factor: 0, label: 'Dispositivos médicos para PcD' },
  { prefixes: ['8702'], factor: 0.4, label: 'Transporte coletivo' },
]

// CST que indicam isenção/não incidência em tabelas comuns (ICMS e PIS/COFINS
// combinadas de forma simplificada — um único campo `cst` é extraído dos
// documentos, por isso tratamos a união dos códigos de isenção mais comuns).
const EXEMPT_CST_CODES = new Set(['040', '041', '050', '060', '004', '006', '007', '008', '009'])

export function isExemptCst(cst: string | null): boolean {
  if (!cst) return false
  const normalized = cst.padStart(3, '0')
  return EXEMPT_CST_CODES.has(normalized)
}

export function findNcmRule<T extends { prefixes: string[] }>(
  ncm: string | null,
  rules: T[],
): T | null {
  if (!ncm) return null
  return rules.find((rule) => rule.prefixes.some((prefix) => ncm.startsWith(prefix))) ?? null
}

// --- ICMS médio de referência por UF (estimativa para a alíquota "interna" padrão) ---
export const ICMS_REFERENCE_BY_UF: Record<string, number> = {
  AC: 19, AL: 19, AP: 18, AM: 20, BA: 19, CE: 18, DF: 18, ES: 17, GO: 19,
  MA: 20, MT: 17, MS: 17, MG: 18, PA: 19, PB: 18, PR: 19.5, PE: 18, PI: 21,
  RJ: 20, RN: 18, RS: 17, RO: 19.5, RR: 17, SC: 17, SP: 18, SE: 19, TO: 20,
}
export const ISS_REFERENCE_RATE = 5
export const DEFAULT_ICMS_RATE = 18

export function consumptionRateAtual(setor: Setor, uf: string): number {
  if (setor === 'servicos' || setor === 'servicos_fator_r') return ISS_REFERENCE_RATE
  return ICMS_REFERENCE_BY_UF[uf] ?? DEFAULT_ICMS_RATE
}

// --- PIS/COFINS ---
export const PIS_COFINS_CUMULATIVE_RATE = 3.65 // Lucro Presumido e Simples (referência)
export const PIS_COFINS_NON_CUMULATIVE_RATE = 9.25 // Lucro Real

// --- IRPJ / CSLL ---
export const IRPJ_RATE = 15
export const IRPJ_SURTAX_RATE = 10
export const IRPJ_SURTAX_ANNUAL_THRESHOLD = 240_000
export const CSLL_RATE = 9

export const PRESUMPTION_IRPJ_PCT: Record<Setor, number> = {
  comercio: 8,
  industria: 8,
  servicos: 32,
  servicos_fator_r: 32,
  agropecuaria: 8,
}

export const PRESUMPTION_CSLL_PCT: Record<Setor, number> = {
  comercio: 12,
  industria: 12,
  servicos: 32,
  servicos_fator_r: 32,
  agropecuaria: 12,
}

// --- Simples Nacional: tabelas simplificadas (Anexos I, II, III e V — LC 123/2006) ---
export interface SimplesBracket {
  limit: number
  rate: number
  deduction: number
}

export const SIMPLES_ANEXOS: Record<'I' | 'II' | 'III' | 'V', SimplesBracket[]> = {
  I: [
    { limit: 180_000, rate: 4.0, deduction: 0 },
    { limit: 360_000, rate: 7.3, deduction: 5_940 },
    { limit: 720_000, rate: 9.5, deduction: 13_860 },
    { limit: 1_800_000, rate: 10.7, deduction: 22_500 },
    { limit: 3_600_000, rate: 14.3, deduction: 87_300 },
    { limit: 4_800_000, rate: 19.0, deduction: 378_000 },
  ],
  II: [
    { limit: 180_000, rate: 4.5, deduction: 0 },
    { limit: 360_000, rate: 7.8, deduction: 5_940 },
    { limit: 720_000, rate: 10.0, deduction: 13_860 },
    { limit: 1_800_000, rate: 11.2, deduction: 22_500 },
    { limit: 3_600_000, rate: 14.7, deduction: 85_500 },
    { limit: 4_800_000, rate: 30.0, deduction: 720_000 },
  ],
  III: [
    { limit: 180_000, rate: 6.0, deduction: 0 },
    { limit: 360_000, rate: 11.2, deduction: 9_360 },
    { limit: 720_000, rate: 13.5, deduction: 17_640 },
    { limit: 1_800_000, rate: 16.0, deduction: 35_640 },
    { limit: 3_600_000, rate: 21.0, deduction: 125_640 },
    { limit: 4_800_000, rate: 33.0, deduction: 648_000 },
  ],
  V: [
    { limit: 180_000, rate: 15.5, deduction: 0 },
    { limit: 360_000, rate: 18.0, deduction: 4_500 },
    { limit: 720_000, rate: 19.5, deduction: 9_900 },
    { limit: 1_800_000, rate: 20.5, deduction: 17_100 },
    { limit: 3_600_000, rate: 23.0, deduction: 62_100 },
    { limit: 4_800_000, rate: 30.5, deduction: 540_000 },
  ],
}

export const SETOR_TO_ANEXO: Record<Setor, keyof typeof SIMPLES_ANEXOS> = {
  comercio: 'I',
  industria: 'II',
  servicos: 'III',
  servicos_fator_r: 'V',
  agropecuaria: 'I',
}

export function simplesEffectiveRate(setor: Setor, faturamentoAnual: number): number {
  const anexo = SIMPLES_ANEXOS[SETOR_TO_ANEXO[setor]]
  const bracket = anexo.find((b) => faturamentoAnual <= b.limit) ?? anexo[anexo.length - 1]
  const grossRate = (faturamentoAnual * (bracket.rate / 100) - bracket.deduction) / faturamentoAnual
  return Math.max(grossRate * 100, 0)
}

export function regimeLabel(regime: RegimeAtual | 'iva_dual'): string {
  switch (regime) {
    case 'simples':
      return 'Simples Nacional'
    case 'presumido':
      return 'Lucro Presumido'
    case 'real':
      return 'Lucro Real'
    case 'iva_dual':
      return 'IVA Dual (regime regular pleno)'
  }
}
