import {
  getEmpresaReports, getAdminReport, getAdminReportParsed,
  getComputedReportCache, setComputedReportCache,
} from '@/lib/db-admin'
import {
  anoDoPeriodo, overlayProjecaoComDadosReais, chaveCompra, chaveVenda,
  computeSimulador, computeDreProduto, computeMargemProdutos, computeMargemContribuicaoPorCategoria,
  type AdminReportV2, type ComprasNCMRow, type VendasDetalheRow,
  type CompraCategoria, type VendaCategoria, type DRELinha,
} from '@/lib/admin-engine'
import { computeCategoriaMercadologicaRollup } from '@/lib/merc-categorias'

const ANO_MIN = 2026
const ANO_MAX = 2033

/**
 * Enriquece `report.dreProduto` com dados reais de outros relatórios da MESMA empresa —
 * quando existe um import real pra um dos anos da projeção (2026-2033), o ponto daquele
 * ano passa a usar o valor real ("Depois") importado em vez da interpolação por fórmula.
 * Roda ao vivo, na leitura do relatório — relatórios antigos já salvos se beneficiam
 * automaticamente assim que outro import (de outro ano) existir pra mesma empresa.
 *
 * `lote` escopa a busca aos relatórios-irmãos da MESMA análise (mesmo lote de importação) —
 * sem isso, uma empresa com mais de uma análise (reimportou o lote inteiro, ou tem imports
 * avulsos antigos) misturava dados de análises diferentes e escaneava relatórios demais a
 * cada leitura (era a causa da lentidão ao trocar de ano). `lote` null cai no comportamento
 * antigo (sem escopo) só pra relatórios legados salvos antes dessa coluna existir.
 */
export function enrichReportComDadosReais(report: AdminReportV2, empresaId: number | null, lote?: string | null): AdminReportV2 {
  if (!empresaId || !report.dreProduto?.length) return report

  const todos = getEmpresaReports(empresaId) // ordenado periodo ASC, created_at ASC
  const rows = lote ? todos.filter(r => r.lote === lote) : todos
  const realByYear = new Map<number, { comprasNCM: ComprasNCMRow[]; vendasNCM: VendasDetalheRow[] }>()

  for (const row of rows) {
    const ano = anoDoPeriodo(row.periodo)
    if (!ano || ano < ANO_MIN || ano > ANO_MAX) continue
    const parsed = getAdminReportParsed(row.id)
    if (!parsed) continue
    // itera em ordem ascendente — se houver mais de um import no mesmo ano (mesmo lote), o mais recente vence
    realByYear.set(ano, { comprasNCM: parsed.comprasNCM ?? [], vendasNCM: parsed.vendasNCM ?? [] })
  }

  if (!realByYear.size) return report
  return { ...report, dreProduto: overlayProjecaoComDadosReais(report.dreProduto, realByYear) }
}

/** Copia, de `baseline` pra uma cópia de `atual`, todo campo cujo nome contenha "AR" e tenha um
 *  par "DR" correspondente no mesmo objeto (convenção consistente no engine: valorAR/valorDR,
 *  custoAR/custoDR, impostosAR/impostosDR etc.) — o lado DR e os demais campos ficam intactos. */
function overlayCamposAR<T extends object>(atual: T, baseline: T): T {
  const atualRec = atual as Record<string, unknown>
  const baselineRec = baseline as Record<string, unknown>
  const copia: Record<string, unknown> = { ...atualRec }
  for (const chave of Object.keys(baselineRec)) {
    if (!chave.includes('AR')) continue
    const chaveDR = chave.replace('AR', 'DR')
    if (!(chaveDR in atualRec)) continue
    copia[chave] = baselineRec[chave]
  }
  return copia as T
}

function overlayPorCategoria<T extends { categoria: string }>(atuais: T[], baseline: T[]): T[] {
  const porCategoria = new Map(baseline.map(b => [b.categoria, b]))
  return atuais.map(row => {
    const base = porCategoria.get(row.categoria)
    return base ? overlayCamposAR(row, base) : row
  })
}

/**
 * Trava o lado AR (antes da reforma — situação atual, deveria ser a mesma nas 8 planilhas de
 * uma análise) no valor do ano-base (2026) da mesma empresa, mantendo o DR de cada ano vindo da
 * planilha respectiva daquele ano. Segue a mesma filosofia não-destrutiva de
 * `enrichReportComDadosReais`: não mexe no `report_json` salvo, recalcula na leitura a partir do
 * relatório-irmão 2026. Sem `empresaId`, ou quando o próprio `report` já É o ano-base, devolve
 * como veio (2026 é sempre a fonte da verdade, nunca sobrescrito).
 *
 * Fora de escopo por ora (não recebem overlay): comprasFornecedores, comprasSimples,
 * vendasClientes, comprasCFOP/vendasCFOP, comprasRegime/vendasRegime,
 * comprasCategorias/vendasCategorias, comprasTipoOperacao, comprasOrigemUF, comprasBeneficio,
 * comprasOrigem, comprasCST, vendasB2C, fluxo.
 *
 * `lote` escopa a busca do ano-base (2026) à MESMA análise do `report` recebido — sem isso,
 * o baseline podia vir de outra análise/importação da mesma empresa. `lote` null cai no
 * comportamento antigo (sem escopo, "último visto vence") pra relatórios legados.
 */
export function overlayARComBaseline(report: AdminReportV2, empresaId: number | null, lote?: string | null): AdminReportV2 {
  const anoAtual = anoDoPeriodo(report.empresa.periodo)
  if (!empresaId || !Number.isFinite(anoAtual) || anoAtual === ANO_MIN) return report

  const todos = getEmpresaReports(empresaId) // ordenado periodo ASC, created_at ASC
  const rows = lote ? todos.filter(r => r.lote === lote) : todos
  let baselineId: number | null = null
  for (const row of rows) {
    if (anoDoPeriodo(row.periodo) === ANO_MIN) baselineId = row.id // último visto vence
  }
  if (!baselineId) return report

  const baseline = getAdminReportParsed(baselineId)
  if (!baseline) return report

  const compras: CompraCategoria[] = overlayPorCategoria(report.compras, baseline.compras)
  const vendas: VendaCategoria[] = overlayPorCategoria(report.vendas, baseline.vendas)

  const comprasNCMBaselineMap = new Map(baseline.comprasNCM.map(b => [chaveCompra(b), b]))
  const comprasNCM: ComprasNCMRow[] = report.comprasNCM.map(row => {
    const base = comprasNCMBaselineMap.get(chaveCompra(row))
    return base ? overlayCamposAR<ComprasNCMRow>(row, base) : row
  })

  const vendasNCMBaselineMap = new Map(baseline.vendasNCM.map(b => [chaveVenda(b), b]))
  const vendasNCM: VendasDetalheRow[] = report.vendasNCM.map(row => {
    const base = vendasNCMBaselineMap.get(chaveVenda(row))
    return base ? overlayCamposAR<VendasDetalheRow>(row, base) : row
  })

  const dreBaselineMap = new Map(baseline.dre.map(b => [b.categoria, b]))
  const dre: DRELinha[] = report.dre.map(row => {
    const base = dreBaselineMap.get(row.categoria)
    return base ? { ...row, ar: base.ar } : row
  })

  // Recalcula os agregados derivados de comprasNCM/vendasNCM com o AR já travado, reusando as
  // mesmas funções puras que gerarRelatorioV2() já usa — evita duplicar a lógica de cálculo e
  // mantém Simulador/DRE Produto/Margem/Mercadológica consistentes com o AR travado.
  const margemProdutos = computeMargemProdutos(comprasNCM, vendasNCM)

  return {
    ...report,
    compras, vendas, comprasNCM, vendasNCM, dre,
    simulador: computeSimulador(comprasNCM, vendasNCM),
    dreProduto: computeDreProduto(comprasNCM, vendasNCM),
    margemProdutos,
    simuladorMercadologica: computeMargemContribuicaoPorCategoria(margemProdutos),
    comprasMercadologica: computeCategoriaMercadologicaRollup(comprasNCM),
    vendasMercadologica: computeCategoriaMercadologicaRollup(vendasNCM),
  }
}

/**
 * Pipeline completa de leitura de um relatório — parse (cacheado) + AR travado no ano-base +
 * overlay de dados reais entre anos-irmãos — memoizada por id no resultado final
 * (`getComputedReportCache`/`setComputedReportCache` em lib/db-admin.ts). O resultado só muda
 * quando esse relatório OU algum irmão do mesmo lote é reimportado (invalidado em
 * `saveAdminReport`), então cachear aqui faz a segunda visita a um ano já visto ser quase
 * instantânea, pra qualquer usuário, não só a mesma sessão de navegador. Usada pelos 3 pontos
 * de leitura (admin, cliente, público) em vez de cada um repetir a mesma pipeline.
 */
export function getComputedReport(id: number): AdminReportV2 | null {
  const cached = getComputedReportCache(id)
  if (cached) return cached

  const row = getAdminReport(id)
  if (!row) return null
  const parsed = getAdminReportParsed(id)
  if (!parsed) return null

  const comAR = overlayARComBaseline(parsed, row.empresa_id, row.lote)
  const computed = enrichReportComDadosReais(comAR, row.empresa_id, row.lote)
  setComputedReportCache(id, computed)
  return computed
}
