import type { RegimeAtual, Setor } from '@/lib/db'

/**
 * Heurística simples e pública, sem CNPJ nem documentos fiscais — serve como
 * isca de captação de lead, não substitui a simulação completa (admin-engine).
 * Referência de alíquota cheia do IVA Dual (CBS+IBS) amplamente divulgada nas
 * discussões da reforma: ~26,5%. Os fatores por setor/regime abaixo são
 * aproximações diretivas, não um cálculo tributário oficial.
 */
const ALIQUOTA_REFORMA_CHEIA = 26.5

const CARGA_ATUAL_BASE: Record<RegimeAtual, Record<Setor, number>> = {
  simples: {
    comercio: 8,
    industria: 9.5,
    servicos: 15.5,
    servicos_fator_r: 6.5,
    agropecuaria: 5,
  },
  presumido: {
    comercio: 12,
    industria: 13.5,
    servicos: 17,
    servicos_fator_r: 14,
    agropecuaria: 9,
  },
  real: {
    comercio: 14,
    industria: 16,
    servicos: 19,
    servicos_fator_r: 17,
    agropecuaria: 11,
  },
}

// Ajuste directivo: setores de serviço com regimes especiais tendem a sentir mais
// o efeito do IVA cheio; Simples e agro têm regras de transição mais suaves.
const FATOR_REFORMA: Record<RegimeAtual, Record<Setor, number>> = {
  simples: {
    comercio: 0.55,
    industria: 0.55,
    servicos: 0.7,
    servicos_fator_r: 0.75,
    agropecuaria: 0.4,
  },
  presumido: {
    comercio: 0.85,
    industria: 0.85,
    servicos: 1.05,
    servicos_fator_r: 1.05,
    agropecuaria: 0.6,
  },
  real: {
    comercio: 0.9,
    industria: 0.92,
    servicos: 1.1,
    servicos_fator_r: 1.1,
    agropecuaria: 0.65,
  },
}

export interface DiagnosticInput {
  setor: Setor
  regimeAtual: RegimeAtual
  faturamentoAnual: number
  margemLucro: number
}

export interface DiagnosticResult {
  cargaAtualEstimadaPct: number
  cargaReformaEstimadaPct: number
  direcao: 'aumento' | 'reducao' | 'neutro'
  impactoAnualEstimado: number
  mensagem: string
}

export function computeDiagnostic(input: DiagnosticInput): DiagnosticResult {
  const cargaAtual = CARGA_ATUAL_BASE[input.regimeAtual][input.setor]
  const cargaReforma = ALIQUOTA_REFORMA_CHEIA * FATOR_REFORMA[input.regimeAtual][input.setor]

  const diffPct = cargaReforma - cargaAtual
  const impactoAnualEstimado = (input.faturamentoAnual * diffPct) / 100

  const direcao: DiagnosticResult['direcao'] = diffPct > 0.5 ? 'aumento' : diffPct < -0.5 ? 'reducao' : 'neutro'

  const mensagem =
    direcao === 'aumento'
      ? `Pelo seu perfil, sua carga tributária tende a aumentar com a reforma — uma estimativa inicial de ${cargaAtual.toFixed(1)}% para ${cargaReforma.toFixed(1)}% sobre o faturamento. Vale planejar a transição com antecedência.`
      : direcao === 'reducao'
        ? `Pelo seu perfil, sua carga tributária tende a reduzir com a reforma — uma estimativa inicial de ${cargaAtual.toFixed(1)}% para ${cargaReforma.toFixed(1)}% sobre o faturamento.`
        : `Pelo seu perfil, o impacto da reforma tende a ser próximo do neutro no curto prazo, em torno de ${cargaReforma.toFixed(1)}% sobre o faturamento.`

  return {
    cargaAtualEstimadaPct: cargaAtual,
    cargaReformaEstimadaPct: cargaReforma,
    direcao,
    impactoAnualEstimado,
    mensagem,
  }
}
