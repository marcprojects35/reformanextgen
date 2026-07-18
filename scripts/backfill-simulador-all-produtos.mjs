// Recalcula `simulador` dos relatórios já salvos em data/admin.db — antes de
// lib/admin-engine.ts remover o corte `.slice(0, 30)` de computeSimulador, o
// JSON gravado no import já vinha truncado aos 30 produtos de maior impacto,
// então corrigir só o código não bastava pros relatórios antigos: o campo
// `simulador` continuava congelado com o corte antigo. Recalcula a partir do
// `comprasNCM`/`vendasNCM` já salvos no próprio report_json (esses nunca foram
// cortados) e regrava o relatório. Roda uma vez:
//   node scripts/backfill-simulador-all-produtos.mjs
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

const DB_PATH = path.join(process.cwd(), 'data', 'admin.db')
const db = new DatabaseSync(DB_PATH)

// ─── Réplica fiel de computeSimulador (lib/admin-engine.ts), sem o corte top-30 ──

const DRE_ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]
const ALIQUOTA_PADRAO_BASE = 0.28
const IBS_SHARE = 2 / 3
const CBS_SHARE = 1 / 3
const ICMS_REMANESCENTE = { 2026: 1, 2027: 1, 2028: 1, 2029: 0.9, 2030: 0.8, 2031: 0.7, 2032: 0.6, 2033: 0 }
const IBS_IMPLEMENTADO = { 2026: 0, 2027: 0, 2028: 0, 2029: 0.10, 2030: 0.20, 2031: 0.30, 2032: 0.40, 2033: 1 }

function aliquotaPadraoProduto(reducaoFrac) {
  return ALIQUOTA_PADRAO_BASE * (1 - (reducaoFrac ?? 0))
}

function simularPrecificacaoAnos({ precoAtual, icmsAntesFrac, pisCofinsAntesFrac, reducaoFrac }) {
  const aliquotaPadrao = aliquotaPadraoProduto(reducaoFrac)
  const ibsAlvo = aliquotaPadrao * IBS_SHARE
  const cbsAlvo = aliquotaPadrao * CBS_SHARE

  const icms2026 = precoAtual * icmsAntesFrac
  const pisCofins2026 = (precoAtual - icms2026) * pisCofinsAntesFrac
  const precoSemTributos = precoAtual - icms2026 - pisCofins2026

  return DRE_ANOS.map(ano => {
    if (ano === 2026) {
      return { ano, precoVenda: precoAtual, icms: icms2026, pisCofins: pisCofins2026, ibs: 0, cbs: 0 }
    }
    const cbs = ano >= 2027 ? cbsAlvo : 0
    const ibs = ibsAlvo * (IBS_IMPLEMENTADO[ano] ?? 0)
    const icmsPct = icmsAntesFrac * (ICMS_REMANESCENTE[ano] ?? 0)
    const icmsEfetivo = icmsPct * (1 + cbs + ibs)
    const precoVenda = icmsEfetivo < 1 ? precoSemTributos / (1 - icmsEfetivo) : precoSemTributos
    return {
      ano, precoVenda,
      icms: precoVenda * icmsEfetivo, pisCofins: 0,
      ibs: precoSemTributos * ibs, cbs: precoSemTributos * cbs,
    }
  })
}

function fracaoTransicaoAnos(params) {
  const precificacao = simularPrecificacaoAnos({ precoAtual: 1, ...params })
  const precoAtual = precificacao[0].precoVenda
  const precoFinal = precificacao[precificacao.length - 1].precoVenda
  const gap = precoAtual - precoFinal
  const fracoes = {}
  for (const p of precificacao) {
    fracoes[p.ano] = Math.abs(gap) > 1e-9 ? (precoAtual - p.precoVenda) / gap : (IBS_IMPLEMENTADO[p.ano] ?? 1)
  }
  return fracoes
}

function chaveCompra(c) { return c.codigoProduto || c.ncm }
function chaveVenda(v) { return v.codigoProduto || v.codigo }

function computeSimulador(comprasNCM, vendasNCM) {
  const vendasMap = new Map()
  for (const v of vendasNCM ?? []) vendasMap.set(chaveVenda(v), v)

  const rows = []
  for (const c of comprasNCM ?? []) {
    const venda = vendasMap.get(chaveCompra(c))
    if (!venda || c.custoAR === 0 || c.valorAR === 0) continue

    const vendaAR = venda.valorAR
    const vendaDR = venda.valorDR
    const { custoAR, custoDR } = c
    const resultadoAtual = vendaAR - custoAR
    const resultadoDR = vendaDR - custoDR
    const markupAtualPct = custoAR > 0 ? (resultadoAtual / custoAR) * 100 : 0
    const markupNecessarioPct = custoDR > 0 ? (resultadoAtual / custoDR) * 100 : 0

    const margemBrutaARPct = vendaAR > 0 ? (resultadoAtual / vendaAR) * 100 : 0
    const margemBrutaDRPct = vendaDR > 0 ? (resultadoDR / vendaDR) * 100 : 0
    const tributoVendaAR = venda.tributosAR ?? 0
    const tributoVendaDR = venda.tributosDR ?? 0
    const margemContribuicaoARPct = vendaAR > 0 ? ((resultadoAtual - tributoVendaAR) / vendaAR) * 100 : 0
    const margemContribuicaoDRPct = vendaDR > 0 ? ((resultadoDR - tributoVendaDR) / vendaDR) * 100 : 0

    const precoAnos = simularPrecificacaoAnos({
      precoAtual: vendaAR,
      icmsAntesFrac: (venda.aliqIcmsARPct ?? 0) / 100,
      pisCofinsAntesFrac: (venda.aliqPisCofinsARPct ?? 0) / 100,
      reducaoFrac: venda.detalhes?.beneficioReducaoFrac ?? c.detalhes?.beneficioReducaoFrac,
    })
    const fracaoCusto = fracaoTransicaoAnos({
      icmsAntesFrac: (c.aliqIcmsARPct ?? 0) / 100,
      pisCofinsAntesFrac: (c.aliqPisCofinsARPct ?? 0) / 100,
      reducaoFrac: c.detalhes?.beneficioReducaoFrac,
    })
    const projecao = precoAnos.map(p => {
      const custo = custoAR + (custoDR - custoAR) * (fracaoCusto[p.ano] ?? 1)
      const resultado = p.precoVenda - custo
      const markupPct = custo > 0 ? (resultado / custo) * 100 : 0
      return { ano: p.ano, precoVenda: p.precoVenda, resultado, markupPct }
    })

    rows.push({
      ncm: c.ncm,
      codigoProduto: c.codigoProduto,
      descricao: c.descricao ?? venda.descricao,
      detalhes: c.detalhes ?? venda.detalhes,
      custoAR, custoDR, valorVendaAR: vendaAR, valorVendaDR: vendaDR,
      markupAtualPct, markupNecessarioPct, resultadoAtual, resultadoDR,
      margemBrutaARPct, margemBrutaDRPct, margemContribuicaoARPct, margemContribuicaoDRPct,
      categoriaMercadologica: c.categoriaMercadologica ?? venda.categoriaMercadologica,
      projecao,
    })
  }

  return rows.sort((a, b) => Math.abs(b.resultadoDR - b.resultadoAtual) - Math.abs(a.resultadoDR - a.resultadoAtual))
}

// ─── Migração ───────────────────────────────────────────────────────────────

const reports = db.prepare('SELECT id, report_json FROM admin_reports').all()
let fixed = 0
let totalAntes = 0
let totalDepois = 0

for (const row of reports) {
  const report = JSON.parse(row.report_json)
  const antes = Array.isArray(report.simulador) ? report.simulador.length : 0
  const novoSimulador = computeSimulador(report.comprasNCM, report.vendasNCM)

  totalAntes += antes
  totalDepois += novoSimulador.length

  if (novoSimulador.length !== antes) {
    report.simulador = novoSimulador
    db.prepare('UPDATE admin_reports SET report_json = ? WHERE id = ?').run(JSON.stringify(report), row.id)
    fixed++
    console.log(`  relatório #${row.id}: simulador ${antes} → ${novoSimulador.length} produtos`)
  }
}

console.log(`\nRelatórios corrigidos: ${fixed} de ${reports.length}`)
console.log(`Total de produtos no simulador: ${totalAntes} → ${totalDepois}`)

db.close()
