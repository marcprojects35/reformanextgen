import type { RegimeAtual } from '@/lib/db'
import {
  CBS_RATE,
  IBS_RATE,
  IVA_DUAL_REFERENCE_RATE,
  CSLL_RATE,
  IRPJ_RATE,
  IRPJ_SURTAX_ANNUAL_THRESHOLD,
  IRPJ_SURTAX_RATE,
  PIS_COFINS_CUMULATIVE_RATE,
  PIS_COFINS_NON_CUMULATIVE_RATE,
  PRESUMPTION_CSLL_PCT,
  PRESUMPTION_IRPJ_PCT,
  REDUCTION_RULES,
  SELECTIVE_TAX_RULES,
  SIMULATION_YEARS,
  TRANSITION_SCHEDULE,
  consumptionRateAtual,
  findNcmRule,
  isExemptCst,
  regimeLabel,
  simplesEffectiveRate,
} from './rates'
import type {
  CompanyProfile,
  DrillDownRow,
  EngineOutput,
  LineItem,
  RegimeKey,
  RegimeResult,
  WaterfallStep,
  YearlyProjection,
} from './types'

// Quando não há linhas importadas, assumimos uma proporção típica de compras
// em relação à receita para estimar créditos — premissa simplificada.
const ESTIMATED_PURCHASE_RATIO = 0.55

interface Aggregate {
  receitaSaidas: number
  saidasBaseFull: number
  entradasBaseFull: number
  seletivoValor: number
  /** Receita bruta somada diretamente dos arquivos importados, sem escala. */
  amostraReceita: number
}

function taxFactor(ncm: string | null, cst: string | null) {
  if (isExemptCst(cst)) return { factor: 0, selectivoRate: 0 }
  const reduction = findNcmRule(ncm, REDUCTION_RULES)
  const selective = findNcmRule(ncm, SELECTIVE_TAX_RULES)
  return {
    factor: reduction ? reduction.factor : 1,
    selectivoRate: selective ? selective.rate : 0,
  }
}

function aggregateLineItems(lineItems: LineItem[], profile: CompanyProfile): Aggregate {
  if (lineItems.length === 0) {
    const receitaSaidas = profile.faturamentoAnual
    return {
      receitaSaidas,
      saidasBaseFull: receitaSaidas,
      entradasBaseFull: receitaSaidas * ESTIMATED_PURCHASE_RATIO,
      seletivoValor: 0,
      amostraReceita: 0,
    }
  }

  let amostraReceita = 0
  let saidasBaseFull = 0
  let entradasBaseFull = 0
  let seletivoValor = 0

  for (const item of lineItems) {
    const { factor, selectivoRate } = taxFactor(item.ncm, item.cst)
    if (item.operacao === 'saida') {
      amostraReceita += item.valor
      saidasBaseFull += item.valor * factor
      seletivoValor += item.valor * (selectivoRate / 100)
    } else {
      entradasBaseFull += item.valor * factor
    }
  }

  // Os arquivos importados normalmente representam uma amostra (não
  // necessariamente 100% das notas do ano). Para que a carga tributária
  // calculada sobre os itens importados seja comparável ao faturamento
  // anual informado, escalamos a amostra proporcionalmente — preservando o
  // mix de NCM/CFOP/CST identificado, mas ajustando a magnitude ao total
  // declarado.
  const scale = amostraReceita > 0 ? profile.faturamentoAnual / amostraReceita : 1

  return {
    receitaSaidas: amostraReceita * scale,
    saidasBaseFull: saidasBaseFull * scale,
    entradasBaseFull: entradasBaseFull * scale,
    seletivoValor: seletivoValor * scale,
    amostraReceita,
  }
}

function consumptionAtual(
  agg: Aggregate,
  profile: CompanyProfile,
  regime: 'presumido' | 'real',
) {
  const rate = consumptionRateAtual(profile.setor, profile.uf) / 100
  const allowsIcmsCredit = true // Presumido e Real apuram ICMS/ISS normalmente (não unificado)
  const debito = agg.saidasBaseFull * rate
  const credito = allowsIcmsCredit ? agg.entradasBaseFull * rate : 0
  const icmsIss = Math.max(debito - credito, 0)

  const pisCofinsRate =
    regime === 'real' ? PIS_COFINS_NON_CUMULATIVE_RATE : PIS_COFINS_CUMULATIVE_RATE
  const pisCofins =
    regime === 'real'
      ? Math.max(agg.saidasBaseFull - agg.entradasBaseFull, 0) * (pisCofinsRate / 100)
      : agg.saidasBaseFull * (pisCofinsRate / 100)

  return { icmsIss, pisCofins, total: icmsIss + pisCofins }
}

function consumptionReforma(agg: Aggregate, regime: 'presumido' | 'real') {
  const rate = IVA_DUAL_REFERENCE_RATE / 100
  const debito = agg.saidasBaseFull * rate
  const credito = agg.entradasBaseFull * rate // CBS/IBS é não cumulativo para todos os regimes regulares
  const liquido = Math.max(debito - credito, 0)
  const cbs = liquido * (CBS_RATE / IVA_DUAL_REFERENCE_RATE)
  const ibs = liquido * (IBS_RATE / IVA_DUAL_REFERENCE_RATE)
  return { cbs, ibs, seletivo: agg.seletivoValor, total: cbs + ibs + agg.seletivoValor }
}

function profitTax(regime: 'presumido' | 'real', profile: CompanyProfile): number {
  if (regime === 'real') {
    const lucroReal = profile.faturamentoAnual * (profile.margemLucro / 100)
    const irpj =
      lucroReal * (IRPJ_RATE / 100) +
      Math.max(lucroReal - IRPJ_SURTAX_ANNUAL_THRESHOLD, 0) * (IRPJ_SURTAX_RATE / 100)
    const csll = lucroReal * (CSLL_RATE / 100)
    return irpj + csll
  }

  const baseIrpj = profile.faturamentoAnual * (PRESUMPTION_IRPJ_PCT[profile.setor] / 100)
  const baseCsll = profile.faturamentoAnual * (PRESUMPTION_CSLL_PCT[profile.setor] / 100)
  const irpj =
    baseIrpj * (IRPJ_RATE / 100) +
    Math.max(baseIrpj - IRPJ_SURTAX_ANNUAL_THRESHOLD, 0) * (IRPJ_SURTAX_RATE / 100)
  const csll = baseCsll * (CSLL_RATE / 100)
  return irpj + csll
}

function buildYears(
  profile: CompanyProfile,
  profitTaxValue: number,
  atualConsumption: number,
  reformaConsumption: number,
): YearlyProjection[] {
  return SIMULATION_YEARS.map((ano) => {
    const weights = TRANSITION_SCHEDULE[ano]
    const blendedConsumption =
      atualConsumption * weights.oldWeight + reformaConsumption * weights.newWeight
    const tributosAtuais = profitTaxValue + atualConsumption
    const tributosReforma = profitTaxValue + blendedConsumption
    return {
      ano,
      receita: profile.faturamentoAnual,
      tributosAtuais,
      tributosReforma,
      cargaAtualPct: (tributosAtuais / profile.faturamentoAnual) * 100,
      cargaReformaPct: (tributosReforma / profile.faturamentoAnual) * 100,
    }
  })
}

function buildRegimeResult(regime: RegimeKey, anos: YearlyProjection[]): RegimeResult {
  const first = anos[0]
  const last = anos[anos.length - 1]
  return {
    regime,
    label: regimeLabel(regime),
    tributosHoje: regime === 'iva_dual' ? null : first.tributosAtuais,
    cargaHojePct: regime === 'iva_dual' ? null : first.cargaAtualPct,
    tributos2033: last.tributosReforma,
    carga2033Pct: last.cargaReformaPct,
    economiaEstimada: first.tributosAtuais - last.tributosReforma,
    anos,
  }
}

function computeSimples(profile: CompanyProfile): RegimeResult {
  const effectiveRate = simplesEffectiveRate(profile.setor, profile.faturamentoAnual)
  const tributos = profile.faturamentoAnual * (effectiveRate / 100)
  const anos: YearlyProjection[] = SIMULATION_YEARS.map((ano) => ({
    ano,
    receita: profile.faturamentoAnual,
    tributosAtuais: tributos,
    tributosReforma: tributos,
    cargaAtualPct: effectiveRate,
    cargaReformaPct: effectiveRate,
  }))
  return buildRegimeResult('simples', anos)
}

function computeRegular(
  regime: 'presumido' | 'real',
  profile: CompanyProfile,
  agg: Aggregate,
): { result: RegimeResult; breakdown: { atual: ReturnType<typeof consumptionAtual>; reforma: ReturnType<typeof consumptionReforma> } } {
  const atual = consumptionAtual(agg, profile, regime)
  const reforma = consumptionReforma(agg, regime)
  const profit = profitTax(regime, profile)
  const anos = buildYears(profile, profit, atual.total, reforma.total)
  return { result: buildRegimeResult(regime, anos), breakdown: { atual, reforma } }
}

function buildWaterfall(
  regimeAtualResult: RegimeResult,
  breakdown: { atual: ReturnType<typeof consumptionAtual>; reforma: ReturnType<typeof consumptionReforma> },
): WaterfallStep[] {
  return [
    { label: 'Carga atual (2026)', valor: regimeAtualResult.tributosHoje ?? 0 },
    { label: '(-) PIS/COFINS extintos', valor: -breakdown.atual.pisCofins },
    { label: '(-) ICMS/ISS substituídos', valor: -breakdown.atual.icmsIss },
    { label: '(+) CBS federal', valor: breakdown.reforma.cbs },
    { label: '(+) IBS estados/municípios', valor: breakdown.reforma.ibs },
    ...(breakdown.reforma.seletivo > 0
      ? [{ label: '(+) Imposto Seletivo', valor: breakdown.reforma.seletivo }]
      : []),
    { label: 'Carga em 2033 (estimada)', valor: regimeAtualResult.tributos2033 },
  ]
}

function buildDrillDown(lineItems: LineItem[], profile: CompanyProfile): {
  porNcm: DrillDownRow[]
  porParceiro: DrillDownRow[]
} {
  const rateAtual = consumptionRateAtual(profile.setor, profile.uf) / 100
  const rateReforma = IVA_DUAL_REFERENCE_RATE / 100

  function porNcm(): DrillDownRow[] {
    const map = new Map<string, { receita: number; atual: number; reforma: number }>()
    let totalReceita = 0
    for (const item of lineItems) {
      if (item.operacao !== 'saida') continue
      const key = item.ncm ?? 'NCM não identificado'
      const { factor, selectivoRate } = taxFactor(item.ncm, item.cst)
      const entry = map.get(key) ?? { receita: 0, atual: 0, reforma: 0 }
      entry.receita += item.valor
      entry.atual += item.valor * factor * rateAtual
      entry.reforma += item.valor * factor * (rateReforma + selectivoRate / 100)
      map.set(key, entry)
      totalReceita += item.valor
    }
    return Array.from(map.entries())
      .map(([chave, value]) => ({
        chave,
        label: chave,
        receita: value.receita,
        tributosAtuais: value.atual,
        tributosReforma: value.reforma,
        percentualReceita: totalReceita > 0 ? (value.receita / totalReceita) * 100 : 0,
      }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 20)
  }

  // Clientes (saída, débito) e fornecedores (entrada, crédito) são somados
  // juntos por nome — "receita" aqui representa o valor movimentado com
  // aquele parceiro, não apenas vendas.
  function porParceiro(): DrillDownRow[] {
    const map = new Map<
      string,
      { valor: number; atual: number; reforma: number; tipo: 'Cliente' | 'Fornecedor' }
    >()
    let totalValor = 0
    for (const item of lineItems) {
      const key = item.clienteFornecedor ?? 'Parceiro não identificado'
      const { factor, selectivoRate } = taxFactor(item.ncm, item.cst)
      const tipo = item.operacao === 'saida' ? 'Cliente' : 'Fornecedor'
      const entry = map.get(key) ?? { valor: 0, atual: 0, reforma: 0, tipo }
      entry.valor += item.valor
      entry.atual += item.valor * factor * rateAtual
      entry.reforma += item.valor * factor * (rateReforma + selectivoRate / 100)
      map.set(key, entry)
      totalValor += item.valor
    }
    return Array.from(map.entries())
      .map(([chave, value]) => ({
        chave,
        label: `${value.tipo} · ${chave}`,
        receita: value.valor,
        tributosAtuais: value.atual,
        tributosReforma: value.reforma,
        percentualReceita: totalValor > 0 ? (value.valor / totalValor) * 100 : 0,
      }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 20)
  }

  return { porNcm: porNcm(), porParceiro: porParceiro() }
}

export function runTaxEngine(
  profile: CompanyProfile,
  lineItems: LineItem[],
  alertas: string[] = [],
): EngineOutput {
  const agg = aggregateLineItems(lineItems, profile)

  const simples = computeSimples(profile)
  const { result: presumido, breakdown: presumidoBreakdown } = computeRegular(
    'presumido',
    profile,
    agg,
  )
  const { result: real, breakdown: realBreakdown } = computeRegular('real', profile, agg)

  // O cartão "IVA Dual" representa a migração para o regime regular pleno,
  // já com créditos integrais de CBS/IBS, usando o IRPJ/CSLL do Lucro Real
  // como base de tributação sobre o lucro (ver lib/tax-engine/rates.ts).
  const ivaDualAnos: YearlyProjection[] = SIMULATION_YEARS.map((ano) => {
    const profit = profitTax('real', profile)
    const tributos = profit + realBreakdown.reforma.total
    return {
      ano,
      receita: profile.faturamentoAnual,
      tributosAtuais: tributos,
      tributosReforma: tributos,
      cargaAtualPct: (tributos / profile.faturamentoAnual) * 100,
      cargaReformaPct: (tributos / profile.faturamentoAnual) * 100,
    }
  })
  const ivaDual = buildRegimeResult('iva_dual', ivaDualAnos)

  const regimes = [simples, presumido, real, ivaDual]

  const regimeAtualKey: RegimeKey = profile.regimeAtual
  const regimeAtualResult = regimes.find((r) => r.regime === regimeAtualKey) ?? simples
  const regimeIdeal = [...regimes].sort((a, b) => a.tributos2033 - b.tributos2033)[0]

  const breakdownByRegime: Record<RegimeAtual, { atual: ReturnType<typeof consumptionAtual>; reforma: ReturnType<typeof consumptionReforma> } | null> = {
    simples: null,
    presumido: presumidoBreakdown,
    real: realBreakdown,
  }
  // Empresas do Simples não têm essa decomposição (tudo unificado no DAS);
  // usamos o detalhamento do Presumido apenas para ilustrar a composição.
  const waterfallBreakdown =
    breakdownByRegime[profile.regimeAtual] ?? presumidoBreakdown
  const waterfall = buildWaterfall(regimeAtualResult, waterfallBreakdown)

  const { porNcm, porParceiro } = buildDrillDown(lineItems, profile)

  const baseline = regimeAtualResult.tributosHoje ?? regimeAtualResult.tributos2033
  const economiaAnual = baseline - regimeIdeal.tributos2033

  return {
    resumo: {
      receitaConsiderada: agg.receitaSaidas,
      regimeAtual: regimeAtualKey,
      regimeIdeal: regimeIdeal.regime,
      economiaAnual,
      economiaPct: baseline > 0 ? (economiaAnual / baseline) * 100 : 0,
      baseadoEmArquivos: lineItems.length > 0,
      totalLinhas: lineItems.length,
    },
    regimes,
    waterfall,
    drillDownPorNcm: porNcm,
    drillDownPorParceiro: porParceiro,
    alertas,
  }
}
