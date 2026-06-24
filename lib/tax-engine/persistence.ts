import type { ResultRow } from '@/lib/db'
import type { EngineOutput, RegimeResult, YearlyProjection } from './types'

const META_REGIME = '_meta'

interface MetaPayload {
  resumo: EngineOutput['resumo']
  waterfall: EngineOutput['waterfall']
  drillDownPorNcm: EngineOutput['drillDownPorNcm']
  drillDownPorParceiro: EngineOutput['drillDownPorParceiro']
  alertas: EngineOutput['alertas']
}

/**
 * A tabela `results` guarda uma linha por regime (com a série `anos` no
 * payload_json) e uma linha extra `_meta` com o restante do resultado
 * (resumo, waterfall, drill-down). Evita criar mais tabelas para dados que
 * só fazem sentido lidos em conjunto.
 */
export function toResultRows(output: EngineOutput, faturamentoAnual: number) {
  const regimeRows = output.regimes.map((regime) => ({
    regime: regime.regime,
    ano: 2033,
    receita: faturamentoAnual,
    tributosAtuais: regime.tributosHoje ?? 0,
    tributosReforma: regime.tributos2033,
    cargaAtualPct: regime.cargaHojePct ?? 0,
    cargaReformaPct: regime.carga2033Pct,
    payload: { anos: regime.anos, economiaEstimada: regime.economiaEstimada, label: regime.label },
  }))

  const metaPayload: MetaPayload = {
    resumo: output.resumo,
    waterfall: output.waterfall,
    drillDownPorNcm: output.drillDownPorNcm,
    drillDownPorParceiro: output.drillDownPorParceiro,
    alertas: output.alertas,
  }

  return [
    ...regimeRows,
    {
      regime: META_REGIME,
      ano: 0,
      receita: faturamentoAnual,
      tributosAtuais: 0,
      tributosReforma: 0,
      cargaAtualPct: 0,
      cargaReformaPct: 0,
      payload: metaPayload,
    },
  ]
}

export function fromResultRows(rows: ResultRow[]): EngineOutput | null {
  const metaRow = rows.find((row) => row.regime === META_REGIME)
  if (!metaRow?.payload_json) return null
  const meta = JSON.parse(metaRow.payload_json) as MetaPayload

  const regimes: RegimeResult[] = rows
    .filter((row) => row.regime !== META_REGIME)
    .map((row) => {
      const payload = row.payload_json
        ? (JSON.parse(row.payload_json) as { anos: YearlyProjection[]; economiaEstimada: number; label: string })
        : { anos: [], economiaEstimada: 0, label: row.regime }
      return {
        regime: row.regime as RegimeResult['regime'],
        label: payload.label,
        tributosHoje: row.regime === 'iva_dual' ? null : row.tributos_atuais,
        cargaHojePct: row.regime === 'iva_dual' ? null : row.carga_atual_pct,
        tributos2033: row.tributos_reforma,
        carga2033Pct: row.carga_reforma_pct,
        economiaEstimada: payload.economiaEstimada,
        anos: payload.anos,
      }
    })

  return {
    resumo: meta.resumo,
    regimes,
    waterfall: meta.waterfall,
    drillDownPorNcm: meta.drillDownPorNcm,
    drillDownPorParceiro: meta.drillDownPorParceiro,
    alertas: meta.alertas,
  }
}
