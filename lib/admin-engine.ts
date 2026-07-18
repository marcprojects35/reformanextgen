import * as XLSX from 'xlsx'
import { resolverCategoriaMercadologica } from '@/lib/merc-classifier'
import { computeCategoriaMercadologicaRollup, type CategoriaMercadologicaRow, type CategoriaComCaminho } from '@/lib/merc-categorias'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmpresaInfo {
  empresa: string
  cnpj: string
  regime: string
  periodo: string
  /** Id da empresa cadastrada (lib/db-admin.ts) — viaja com o relatório serializado pra permitir
   *  buscar os relatórios irmãos (outros anos) da mesma empresa direto no client. */
  empresaId?: number
  /** Nome dos arquivos originais importados pra este ano — usado só pra mostrar a origem do dado. */
  arquivoProdutos?: string
  arquivoServicos?: string
  /** Nome da planilha mercadológica (opcional) usada pra classificar produtos por Seção/Grupo/
   *  Subgrupo/Família — ver parseMercadologicaClassificacao. */
  arquivoMercadologica?: string
}

export interface CompraCategoria {
  categoria: string
  valorAR: number
  impostosAR: number
  valorDesonerado: number
  custoAR: number
  custoEfetivoARPct: number
  creditoAR: number
  cargaTributariaARPct: number
  valorDR: number
  impostosDR: number
  custoDR: number
  custoEfetivoDRPct: number
  creditoDR: number
}

export interface VendaCategoria {
  categoria: string
  valorAR: number
  impostosAR: number
  debitoAR: number
  valorDesonerado: number
  cargaTributariaARPct: number
  valorDR: number
  impostosDR: number
  debitoDR: number
  cargaTributariaDRPct: number
}

export interface DRELinha {
  categoria: string
  ar: number
  anoBase: number
  diffRS: number
  diffPct: number
  anos: Record<number, number>
}

export interface FluxoLinha {
  categoria: string
  ar: number
  dr: number
  diffRS: number
  diffPct: number
  anos: Record<number, number>
}

export interface RegimeComparacao {
  regime: string
  resultadoPosIRCS: number
  tributosCredito: number
  tributosDebito: number
  tributosRecolhidos: number
  melhor: boolean
}

/** Alíquotas efetivas médias por tipo de tributo, antes (AR) e depois (DR) da reforma. */
export interface AliquotasEfetivas {
  aliqIcmsARPct: number; aliqIcmsDRPct: number
  aliqIcmsStARPct: number; aliqIcmsStDRPct: number
  aliqIcmsDifalARPct: number; aliqIcmsDifalDRPct: number
  aliqIssARPct: number; aliqIssDRPct: number
  aliqIpiARPct: number; aliqIpiDRPct: number
  aliqPisCofinsARPct: number; aliqPisCofinsDRPct: number
}

/**
 * Campos de cauda longa das planilhas reais — sem volume próprio pra virar gráfico
 * dedicado, mas mantidos para exibição no painel de detalhe (drill-down).
 */
export interface DetalhesTecnicos {
  desconto?: number
  metodo?: string
  custoDespesa?: string
  origem?: string
  fornecedorIndustrial?: string
  temCreditoIcms?: string
  temCreditoPisCofins?: string
  temCreditoIpi?: string
  valorMovimentacaoContraria?: number
  valorDepreciacao?: number
  descricaoAnexo?: string
  anexo?: string
  /** Fração de redução da alíquota-padrão de IBS/CBS aplicável ao produto (0 = sem redução,
   *  0.6 = redução de 60%, 1 = isento/alíquota zero) — vem da coluna `beneficio`, mesma fonte
   *  do anexo legal (descricaoAnexo). Usado pra projeção de preço ano a ano (ver simularPrecificacaoAnos). */
  beneficioReducaoFrac?: number
  prestacao?: string
  cstIcms?: string
  cstIpi?: string
  cstPis?: string
  cstCofins?: string
  // Valores "brutos" originais do input, antes da simulação AR/DR
  valorBrutoInput?: number
  aliqIcmsInput?: number
  aliqIssInput?: number
  aliqIpiInput?: number
  aliqPisCofinsCreditarInput?: number
  aliqPisCofinsDesonerarInput?: number
  aliqIcmsStInput?: number
  aliqIcmsDifalInput?: number
  valorIcmsInput?: number
  valorIcmsStInput?: number
  valorIcmsDifalInput?: number
  valorIssInput?: number
  valorIpiInput?: number
  valorPisCofinsInput?: number
  // Metadados internos do sistema de cálculo original — sem valor analítico próprio,
  // mas incluídos para que literalmente nenhuma coluna da planilha fique de fora.
  idInput?: string
  dataCriacaoInput?: string
  versaoInicialInput?: string
  versaoFinalInput?: string
  calculoId?: string
  chaveValidacao?: string
  inputId?: string
  idResultadoAr?: string
  dataCriacaoResultadoAr?: string
  idResultadoDr?: string
  dataCriacaoResultadoDr?: string
  anoDr?: string
  anoNumDr?: string
  tipoInput?: string
}

/** Quebra de tributos (R$, soma por tipo) de um item — campos FLAT (não aninhados), mesma
 *  convenção de `AliquotasEfetivas`: cada tipo tem um par nomeAR/nomeDR, exigido pelo overlay
 *  de AR travado no ano-base (`overlayCamposAR` em lib/projecao-real.ts), que só enxerga campos
 *  de 1º nível cujo nome contém "AR"/"DR" — um objeto aninhado (ex.: `tributos.icms.ar`) passaria
 *  batido pelo overlay e vazaria o AR do ano errado. Base de cálculo completa (Preço da
 *  Mercadoria, tributos embutidos/fora do preço) do drill-down de produto vem daqui. */
export interface TributoBreakdownFlat {
  impostosAR?: number; impostosDR?: number
  creditoAR?: number; creditoDR?: number
  icmsAR?: number; icmsDR?: number
  icmsStAR?: number; icmsStDR?: number
  icmsDifalAR?: number; icmsDifalDR?: number
  issAR?: number; issDR?: number
  ipiAR?: number; ipiDR?: number
  pisCofinsAR?: number; pisCofinsDR?: number
  ibsAR?: number; ibsDR?: number
  cbsAR?: number; cbsDR?: number
  semIvaAR?: number; semIvaDR?: number
}

export interface ComprasNCMRow extends Partial<AliquotasEfetivas>, TributoBreakdownFlat {
  ncm: string
  descricao?: string
  /** Código único do produto (coluna `codigo_produto`), quando a planilha traz um — é a
   *  identidade real da linha (várias planilhas têm dezenas de produtos distintos sob o
   *  mesmo NCM, que é só uma classificação fiscal). Ausente em serviços (sem código próprio)
   *  e em planilhas antigas já pré-agregadas por NCM. Ver normalizeCodigoItem/chaveProduto. */
  codigoProduto?: string
  /** 'servico' quando o item veio de uma planilha de serviços (NCM aqui é na verdade o CNAE). */
  tipo?: 'produto' | 'servico'
  /** Categoria de operação (Produtos/Serviços/Locação de Imóveis/Móveis/Venda de Imóveis/Outros)
   *  derivada do CFOP — mesma taxonomia de comprasCategorias (aba Categorias de Operação). */
  categoria?: string
  valorAR: number
  valorDR: number
  cargaARPct: number
  cargaDRPct: number
  custoAR: number
  custoDR: number
  isMonofasico: boolean
  detalhes?: DetalhesTecnicos
  /** Categoria da taxonomia Seção/Grupo/Subgrupo/Família (lib/merc-categorias.ts), sugerida por
   *  similaridade de texto a partir da descrição ou corrigida manualmente (ncm_categoria_overrides). */
  categoriaMercadologica?: CategoriaComCaminho
}

export interface ComprasRegimeRow {
  regime: string
  valorAR: number
}

export interface ComprasFornecedorRow {
  cnpj: string
  /** Razão social / nome fantasia resolvido a partir do CNPJ (consulta pública, no import). */
  nome?: string
  regime?: string
  cargaARPct: number
  cargaDRPct: number
  valorAR: number
  valorDesonerado: number
  tributosAR: number
  valorDR: number
  tributosDR: number
  custoAR: number
}

export interface ComprasCFOPRow {
  cfop: string
  cargaARPct: number
  cargaDRPct: number
  valorAR: number
  valorDesonerado: number
  tributosAR: number
  valorDR: number
  tributosDR: number
  diffCusto: number
}

export interface VendasDetalheRow extends Partial<AliquotasEfetivas>, TributoBreakdownFlat {
  codigo: string
  descricao?: string
  /** Razão social / nome fantasia do cliente, resolvido a partir do CNPJ (quando `codigo` é um CNPJ). */
  nome?: string
  /** Código único do produto (coluna `codigo_produto`) — só populado em vendasNCM, quando a
   *  planilha traz um. Ver ComprasNCMRow.codigoProduto. */
  codigoProduto?: string
  /** 'servico' quando o item veio de uma planilha de serviços (codigo aqui é na verdade o CNAE). */
  tipo?: 'produto' | 'servico'
  /** Categoria de operação (Produtos/Serviços/Locação de Imóveis/Móveis/Venda de Imóveis/Outros)
   *  derivada do CFOP — mesma taxonomia de vendasCategorias (aba Categorias de Operação). Só
   *  populado em vendasNCM. */
  categoria?: string
  cargaARPct: number
  cargaDRPct: number
  valorAR: number
  valorDesonerado: number
  tributosAR: number
  valorDR: number
  tributosDR: number
  diffCusto: number
  detalhes?: DetalhesTecnicos
  /** Só populado quando `codigo` é um NCM (vendasNCM) — ver ComprasNCMRow.categoriaMercadologica. */
  categoriaMercadologica?: CategoriaComCaminho
}

export interface VendasRegimeRow {
  regime: string
  valorAR: number
}

export interface VendasB2CRow {
  tipo: 'B2B' | 'B2C'
  valorAR: number
  valorDR: number
  cargaARPct: number
  cargaDRPct: number
  diffCusto: number
  count: number
}

export interface ComprasSimplesRow {
  cnpj: string
  nome?: string
  valorAR: number
  pctTotalCompras: number
  ncms: { ncm: string; valorAR: number; descricao?: string }[]
}

export interface SimuladorRow {
  ncm: string
  descricao?: string
  /** Ver ComprasNCMRow.codigoProduto — identidade real da linha quando presente. */
  codigoProduto?: string
  detalhes?: DetalhesTecnicos
  custoAR: number
  custoDR: number
  valorVendaAR: number
  valorVendaDR: number
  markupAtualPct: number
  resultadoAtual: number
  resultadoDR: number
  /** (Receita − Custo) ÷ Receita — mesma fórmula de DreProdutoRow.margemBrutaPct. */
  margemBrutaARPct: number
  margemBrutaDRPct: number
  /** (Receita − Custo − Tributo de venda) ÷ Receita — desconta da receita também o tributo
   *  que incide na venda (ICMS/PIS-COFINS antes, IBS/CBS depois), não só o custo de aquisição. */
  margemContribuicaoARPct: number
  margemContribuicaoDRPct: number
  /** Categoria da taxonomia mercadológica (Seção/Grupo/Subgrupo/Família) do produto. */
  categoriaMercadologica?: CategoriaComCaminho
  /** Preço de venda, resultado e markup ano a ano (2026-2033) — ver simularPrecificacaoAnos. */
  projecao: { ano: number; precoVenda: number; resultado: number; markupPct: number }[]
}

export interface CategoriaRow {
  categoria: string
  valorAR: number
  valorDR: number
  custoAR: number
  custoDR: number
  cargaARPct: number
  cargaDRPct: number
  diffCusto: number
  /** Valor com exoneração/imunidade tributária (isento, não incidência etc.), somado do CFOP.
   *  Opcional pra manter `CategoriaMercadologicaRow[]` estruturalmente compatível com
   *  `CategoriaRow[]` em `mergeCat` (mesmo formato, exceto por este campo). */
  valorDesonerado?: number
  count: number
}

export interface DreProdutoRow {
  ncm: string
  descricao?: string
  /** Ver ComprasNCMRow.codigoProduto — identidade real da linha quando presente. */
  codigoProduto?: string
  tipo?: 'produto' | 'servico'
  detalhes?: DetalhesTecnicos
  receitaAR: number
  receitaDR: number
  custoAR: number
  custoDR: number
  margemBrutaARPct: number
  margemBrutaDRPct: number
  /** (Receita − Custo − Tributo de venda) ÷ Receita — ver SimuladorRow.margemContribuicaoPct. */
  margemContribuicaoARPct: number
  margemContribuicaoDRPct: number
  /** Categoria da taxonomia mercadológica (Seção/Grupo/Subgrupo/Família) do produto. */
  categoriaMercadologica?: CategoriaComCaminho
  resultadoAtual: number
  resultadoDR: number
  diffResultado: number
  projecao: { ano: number; resultado: number; margem: number; real?: boolean }[]
  /** Base de cálculo completa do lado compra (Preço da Mercadoria, tributos embutidos/fora do
   *  preço, crédito) — valorAR/DR aqui é o total pago (custoAR/DR já descontou o crédito), só
   *  disponível quando a planilha real (não a resumida Compras_NCM) foi usada no import. */
  compra?: { valorAR: number; valorDR: number; impostosAR?: number; impostosDR?: number; creditoAR?: number; creditoDR?: number; tributos: TributoComposicao }
  /** Mesma base de cálculo do lado venda — ver `compra`. */
  venda?: { valorAR: number; valorDR: number; impostosAR?: number; impostosDR?: number; creditoAR?: number; creditoDR?: number; tributos: TributoComposicao }
}

/** Valor de um tributo antes (ar) e depois (dr) da reforma. */
export interface TributoARDR { ar: number; dr: number }

/** Composição da carga tributária por tipo de tributo — antes (tributos "antigos") e depois (IBS/CBS). */
export interface TributoComposicao {
  icms: TributoARDR
  icmsSt: TributoARDR
  icmsDifal: TributoARDR
  iss: TributoARDR
  ipi: TributoARDR
  pisCofins: TributoARDR
  ibs: TributoARDR
  cbs: TributoARDR
  semIva: TributoARDR
}

/** Margem de contribuição agregada por Seção da taxonomia mercadológica (mesma taxonomia de
 *  lib/merc-categorias.ts) — ver computeMargemContribuicaoPorCategoria. */
export interface MargemContribuicaoCategoriaRow {
  categoria: string
  receitaAR: number
  receitaDR: number
  margemContribuicaoARPct: number
  margemContribuicaoDRPct: number
  count: number
}

export interface AdminReportV2 {
  empresa: EmpresaInfo
  geradoEm: string
  compras: CompraCategoria[]
  comprasNCM: ComprasNCMRow[]
  comprasRegime: ComprasRegimeRow[]
  comprasFornecedores: ComprasFornecedorRow[]
  comprasCFOP: ComprasCFOPRow[]
  comprasSimples: ComprasSimplesRow[]
  comprasCategorias: CategoriaRow[]
  comprasTipoOperacao: CategoriaRow[]
  comprasOrigemUF: CategoriaRow[]
  comprasBeneficio: CategoriaRow[]
  comprasOrigem: CategoriaRow[]
  comprasCST: CategoriaRow[]
  /** Compras agrupadas por Seção mercadológica (lib/merc-categorias.ts) — cesta básica, saúde etc. */
  comprasMercadologica: CategoriaMercadologicaRow[]
  vendas: VendaCategoria[]
  vendasNCM: VendasDetalheRow[]
  vendasClientes: VendasDetalheRow[]
  vendasCFOP: VendasDetalheRow[]
  vendasRegime: VendasRegimeRow[]
  vendasB2C: VendasB2CRow[]
  vendasCategorias: CategoriaRow[]
  /** Total de linhas de venda (notas/cupons) processadas nas planilhas de transações — ausente em relatórios salvos antes deste campo existir, e 0 quando a importação não usa o formato de linha por transação. */
  vendasCount?: number
  /** Vendas agrupadas por Seção mercadológica (lib/merc-categorias.ts) — cesta básica, saúde etc. */
  vendasMercadologica: CategoriaMercadologicaRow[]
  simulador: SimuladorRow[]
  dreProduto: DreProdutoRow[]
  margemProdutos: DreProdutoRow[]
  /** Margem de contribuição agrupada por Seção mercadológica — ver MargemContribuicaoCategoriaRow. */
  simuladorMercadologica: MargemContribuicaoCategoriaRow[]
  dre: DRELinha[]
  fluxo: FluxoLinha[]
  regimes: RegimeComparacao[]
  tributos?: { compras: TributoComposicao; vendas: TributoComposicao }
}

// ─── Normalization ────────────────────────────────────────────────────────────

function n(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function parseNum(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0
  const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.')
  const num = parseFloat(s)
  return isFinite(num) ? num : 0
}

function parsePct(v: unknown): number {
  const s = String(v ?? '').trim().replace('%', '').replace(',', '.')
  const num = parseFloat(s)
  if (!isFinite(num)) return 0
  return Math.abs(num) <= 1 && Math.abs(num) !== 0 ? num * 100 : num
}

// NCM tem sempre 8 dígitos. Planilhas que guardam a coluna como número (em vez de
// texto) perdem o zero à esquerda no Excel antes mesmo do import (ex.: "02013000"
// vira 2013000) — repõe o zero que falta pra manter os prefixos de categoria/
// monofásico e a comparação com overrides consistentes.
export function normalizeNcm(v: unknown): string {
  const s = String(v ?? '').trim()
  return /^\d{1,7}$/.test(s) ? s.padStart(8, '0') : s
}

/** Chave real de identidade de uma linha de produto — o `codigo_produto` da planilha
 *  quando presente (várias linhas de NCM diferentes podem ser o mesmo produto reclassificado,
 *  mas o inverso é o caso comum: um NCM abrange dezenas de produtos distintos), caindo pro
 *  NCM/CNAE só quando a planilha não trouxe código de produto (serviços, ou formatos antigos
 *  já pré-agregados por NCM). Usada tanto pra agrupar quanto pra casar compra×venda do mesmo item. */
export function chaveCompra(c: ComprasNCMRow): string { return c.codigoProduto || c.ncm }
export function chaveVenda(v: VendasDetalheRow): string { return v.codigoProduto || v.codigo }

type Row = Record<string, unknown>

function findCol(headers: string[], ...keys: string[]): string | null {
  for (const k of keys) {
    const kn = n(k)
    const exact = headers.find(h => n(h) === kn)
    if (exact) return exact
    const partial = headers.find(h => n(h).includes(kn) || kn.includes(n(h)))
    if (partial) return partial
  }
  return null
}

function getStr(row: Row, headers: string[], ...keys: string[]): string {
  const col = findCol(headers, ...keys)
  return col ? String(row[col] ?? '') : ''
}

function getNum(row: Row, headers: string[], ...keys: string[]): number {
  const col = findCol(headers, ...keys)
  return col ? parseNum(row[col]) : 0
}

function getPct(row: Row, headers: string[], ...keys: string[]): number {
  const col = findCol(headers, ...keys)
  return col ? parsePct(row[col]) : 0
}

// ─── Buffer reader (handles XLSX, XLS, CSV with auto-delimiter) ───────────────

function detectDelimiter(line: string): string {
  const candidates = [';', ',', '\t', '|']
  let best = ','
  let max = 0
  for (const d of candidates) {
    const count = line.split(d).length - 1
    if (count > max) { max = count; best = d }
  }
  return best
}

// ERPs brasileiros costumam prefixar campos "tipo texto" (CNPJ, código de produto etc.) com um
// apóstrofo pra evitar que planilhas convertam pra número e cortem zeros à esquerda — mesma
// convenção do Excel pra células digitadas manualmente. O parser de CSV não interpreta isso
// (não é um formato CSV padrão), então um campo vazio vira literalmente a string `'` sozinha,
// que é truthy e acaba sendo usada como chave de agrupamento válida (ex.: todo CNPJ em branco
// vira "o mesmo fornecedor"). Removendo o apóstrofo líder aqui, campos vazios voltam a ser `''`
// e caem nos fallbacks corretos (descartados / agrupados por NCM) em todo o pipeline.
function stripForceTextMarkers(wb: XLSX.WorkBook): XLSX.WorkBook {
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    for (const cellRef of Object.keys(ws)) {
      if (cellRef.startsWith('!')) continue
      const cell = ws[cellRef]
      if (cell && cell.t === 's' && typeof cell.v === 'string' && cell.v.startsWith("'")) {
        cell.v = cell.v.slice(1)
        if (typeof cell.w === 'string' && cell.w.startsWith("'")) cell.w = cell.w.slice(1)
      }
    }
  }
  return wb
}

function readCsvBuffer(buffer: Buffer): XLSX.WorkBook {
  const str = buffer.toString('utf8')
    .replace(/^﻿/, '')   // strip BOM
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  const firstLine = str.split('\n')[0]
  const fs = detectDelimiter(firstLine)
  return stripForceTextMarkers(XLSX.read(str, { type: 'string', FS: fs }))
}

function readBuffer(buffer: Buffer, filename?: string): XLSX.WorkBook {
  if (filename?.toLowerCase().endsWith('.csv')) {
    return readCsvBuffer(buffer)
  }
  try {
    return XLSX.read(buffer, { type: 'buffer' })
  } catch {
    return readCsvBuffer(buffer)
  }
}

// ─── Raw Transaction CSV: aggregation helpers ─────────────────────────────────

interface TxAgg {
  valorAR: number
  impostosAR: number
  valorDesonerado: number
  custoAR: number
  creditoAR: number
  cargaARWSum: number   // weighted sum: carga * valor (for weighted avg later)
  valorDR: number
  impostosDR: number
  custoDR: number
  creditoDR: number
  cargaDRWSum: number
  // Quebra por tipo de tributo (soma) — antes (AR) e depois (DR) da reforma
  icmsAR: number; icmsDR: number
  icmsStAR: number; icmsStDR: number
  icmsDifalAR: number; icmsDifalDR: number
  issAR: number; issDR: number
  ipiAR: number; ipiDR: number
  pisCofinsAR: number; pisCofinsDR: number
  ibsAR: number; ibsDR: number
  cbsAR: number; cbsDR: number
  semIvaAR: number; semIvaDR: number
  // Alíquotas efetivas (soma ponderada por valorAR/valorDR, mesmo padrão de cargaARWSum)
  aliqIcmsARWSum: number; aliqIcmsDRWSum: number
  aliqIcmsStARWSum: number; aliqIcmsStDRWSum: number
  aliqIcmsDifalARWSum: number; aliqIcmsDifalDRWSum: number
  aliqIssARWSum: number; aliqIssDRWSum: number
  aliqIpiARWSum: number; aliqIpiDRWSum: number
  aliqPisCofinsARWSum: number; aliqPisCofinsDRWSum: number
}

interface DetailAgg extends TxAgg {
  diffCusto: number
}

function emptyAgg(): TxAgg {
  return {
    valorAR: 0, impostosAR: 0, valorDesonerado: 0, custoAR: 0, creditoAR: 0, cargaARWSum: 0,
    valorDR: 0, impostosDR: 0, custoDR: 0, creditoDR: 0, cargaDRWSum: 0,
    icmsAR: 0, icmsDR: 0, icmsStAR: 0, icmsStDR: 0, icmsDifalAR: 0, icmsDifalDR: 0,
    issAR: 0, issDR: 0, ipiAR: 0, ipiDR: 0, pisCofinsAR: 0, pisCofinsDR: 0,
    ibsAR: 0, ibsDR: 0, cbsAR: 0, cbsDR: 0, semIvaAR: 0, semIvaDR: 0,
    aliqIcmsARWSum: 0, aliqIcmsDRWSum: 0, aliqIcmsStARWSum: 0, aliqIcmsStDRWSum: 0,
    aliqIcmsDifalARWSum: 0, aliqIcmsDifalDRWSum: 0, aliqIssARWSum: 0, aliqIssDRWSum: 0,
    aliqIpiARWSum: 0, aliqIpiDRWSum: 0, aliqPisCofinsARWSum: 0, aliqPisCofinsDRWSum: 0,
  }
}

function emptyDetail(): DetailAgg { return { ...emptyAgg(), diffCusto: 0 } }

function accumulate(agg: TxAgg, v: {
  valorAR: number; impostosAR: number; valorDesonerado: number
  custoAR: number; creditoAR: number; cargaARPct: number
  valorDR: number; impostosDR: number; custoDR: number
  creditoDR: number; cargaDRPct: number
  icmsAR?: number; icmsDR?: number
  icmsStAR?: number; icmsStDR?: number
  icmsDifalAR?: number; icmsDifalDR?: number
  issAR?: number; issDR?: number
  ipiAR?: number; ipiDR?: number
  pisCofinsAR?: number; pisCofinsDR?: number
  ibsAR?: number; ibsDR?: number
  cbsAR?: number; cbsDR?: number
  semIvaAR?: number; semIvaDR?: number
  aliqIcmsAR?: number; aliqIcmsDR?: number
  aliqIcmsStAR?: number; aliqIcmsStDR?: number
  aliqIcmsDifalAR?: number; aliqIcmsDifalDR?: number
  aliqIssAR?: number; aliqIssDR?: number
  aliqIpiAR?: number; aliqIpiDR?: number
  aliqPisCofinsAR?: number; aliqPisCofinsDR?: number
}) {
  agg.valorAR        += v.valorAR
  agg.impostosAR     += v.impostosAR
  agg.valorDesonerado+= v.valorDesonerado
  agg.custoAR        += v.custoAR
  agg.creditoAR      += v.creditoAR
  agg.cargaARWSum    += v.cargaARPct * v.valorAR
  agg.valorDR        += v.valorDR
  agg.impostosDR     += v.impostosDR
  agg.custoDR        += v.custoDR
  agg.creditoDR      += v.creditoDR
  agg.cargaDRWSum    += v.cargaDRPct * v.valorDR
  agg.icmsAR         += v.icmsAR ?? 0
  agg.icmsDR         += v.icmsDR ?? 0
  agg.icmsStAR       += v.icmsStAR ?? 0
  agg.icmsStDR       += v.icmsStDR ?? 0
  agg.icmsDifalAR    += v.icmsDifalAR ?? 0
  agg.icmsDifalDR    += v.icmsDifalDR ?? 0
  agg.issAR          += v.issAR ?? 0
  agg.issDR          += v.issDR ?? 0
  agg.ipiAR          += v.ipiAR ?? 0
  agg.ipiDR          += v.ipiDR ?? 0
  agg.pisCofinsAR    += v.pisCofinsAR ?? 0
  agg.pisCofinsDR    += v.pisCofinsDR ?? 0
  agg.ibsAR          += v.ibsAR ?? 0
  agg.ibsDR          += v.ibsDR ?? 0
  agg.cbsAR          += v.cbsAR ?? 0
  agg.cbsDR          += v.cbsDR ?? 0
  agg.semIvaAR       += v.semIvaAR ?? 0
  agg.semIvaDR       += v.semIvaDR ?? 0
  agg.aliqIcmsARWSum      += (v.aliqIcmsAR ?? 0) * v.valorAR
  agg.aliqIcmsDRWSum      += (v.aliqIcmsDR ?? 0) * v.valorDR
  agg.aliqIcmsStARWSum    += (v.aliqIcmsStAR ?? 0) * v.valorAR
  agg.aliqIcmsStDRWSum    += (v.aliqIcmsStDR ?? 0) * v.valorDR
  agg.aliqIcmsDifalARWSum += (v.aliqIcmsDifalAR ?? 0) * v.valorAR
  agg.aliqIcmsDifalDRWSum += (v.aliqIcmsDifalDR ?? 0) * v.valorDR
  agg.aliqIssARWSum       += (v.aliqIssAR ?? 0) * v.valorAR
  agg.aliqIssDRWSum       += (v.aliqIssDR ?? 0) * v.valorDR
  agg.aliqIpiARWSum       += (v.aliqIpiAR ?? 0) * v.valorAR
  agg.aliqIpiDRWSum       += (v.aliqIpiDR ?? 0) * v.valorDR
  agg.aliqPisCofinsARWSum += (v.aliqPisCofinsAR ?? 0) * v.valorAR
  agg.aliqPisCofinsDRWSum += (v.aliqPisCofinsDR ?? 0) * v.valorDR
}

function avgCargaAR(agg: TxAgg): number {
  return agg.valorAR > 0 ? agg.cargaARWSum / agg.valorAR : 0
}
function avgCargaDR(agg: TxAgg): number {
  return agg.valorDR > 0 ? agg.cargaDRWSum / agg.valorDR : 0
}

/** Alíquotas efetivas médias (ponderadas por valor) por tipo de tributo — antes e depois. */
function aliquotasEfetivas(agg: TxAgg) {
  const ar = (wsum: number) => agg.valorAR > 0 ? wsum / agg.valorAR : 0
  const dr = (wsum: number) => agg.valorDR > 0 ? wsum / agg.valorDR : 0
  return {
    aliqIcmsARPct: ar(agg.aliqIcmsARWSum), aliqIcmsDRPct: dr(agg.aliqIcmsDRWSum),
    aliqIcmsStARPct: ar(agg.aliqIcmsStARWSum), aliqIcmsStDRPct: dr(agg.aliqIcmsStDRWSum),
    aliqIcmsDifalARPct: ar(agg.aliqIcmsDifalARWSum), aliqIcmsDifalDRPct: dr(agg.aliqIcmsDifalDRWSum),
    aliqIssARPct: ar(agg.aliqIssARWSum), aliqIssDRPct: dr(agg.aliqIssDRWSum),
    aliqIpiARPct: ar(agg.aliqIpiARWSum), aliqIpiDRPct: dr(agg.aliqIpiDRWSum),
    aliqPisCofinsARPct: ar(agg.aliqPisCofinsARWSum), aliqPisCofinsDRPct: dr(agg.aliqPisCofinsDRWSum),
  }
}

/** Quebra de tributos (R$, soma por tipo) de um item — campos FLAT, mesmo padrão de
 *  `aliquotasEfetivas` — base de cálculo completa (Preço da Mercadoria, Impostos
 *  embutidos/fora do preço, Valor Total Pago) exibida no drill-down de produto. Fica achatado
 *  (não em `TributoComposicao` aninhado) pra continuar visível ao overlay de AR travado no
 *  ano-base (`overlayCamposAR`), que só enxerga campos de 1º nível — ver TributoBreakdownFlat. */
function tributoBreakdownFlat(agg: TxAgg): TributoBreakdownFlat {
  return {
    impostosAR: agg.impostosAR, impostosDR: agg.impostosDR,
    creditoAR: agg.creditoAR, creditoDR: agg.creditoDR,
    icmsAR: agg.icmsAR, icmsDR: agg.icmsDR,
    icmsStAR: agg.icmsStAR, icmsStDR: agg.icmsStDR,
    icmsDifalAR: agg.icmsDifalAR, icmsDifalDR: agg.icmsDifalDR,
    issAR: agg.issAR, issDR: agg.issDR,
    ipiAR: agg.ipiAR, ipiDR: agg.ipiDR,
    pisCofinsAR: agg.pisCofinsAR, pisCofinsDR: agg.pisCofinsDR,
    ibsAR: agg.ibsAR, ibsDR: agg.ibsDR,
    cbsAR: agg.cbsAR, cbsDR: agg.cbsDR,
    semIvaAR: agg.semIvaAR, semIvaDR: agg.semIvaDR,
  }
}

/** Converte a quebra flat (ComprasNCMRow/VendasDetalheRow, já com AR travado no ano-base pelo
 *  overlay) pro formato aninhado `TributoComposicao` — só pra exibição (DreProdutoRow.compra/
 *  venda), nunca armazenado/atravessado pelo overlay. */
function tributoComposicaoFromFlat(f: TributoBreakdownFlat): TributoComposicao {
  return {
    icms:      { ar: f.icmsAR ?? 0,      dr: f.icmsDR ?? 0 },
    icmsSt:    { ar: f.icmsStAR ?? 0,    dr: f.icmsStDR ?? 0 },
    icmsDifal: { ar: f.icmsDifalAR ?? 0, dr: f.icmsDifalDR ?? 0 },
    iss:       { ar: f.issAR ?? 0,       dr: f.issDR ?? 0 },
    ipi:       { ar: f.ipiAR ?? 0,       dr: f.ipiDR ?? 0 },
    pisCofins: { ar: f.pisCofinsAR ?? 0, dr: f.pisCofinsDR ?? 0 },
    ibs:       { ar: f.ibsAR ?? 0,       dr: f.ibsDR ?? 0 },
    cbs:       { ar: f.cbsAR ?? 0,       dr: f.cbsDR ?? 0 },
    semIva:    { ar: f.semIvaAR ?? 0,    dr: f.semIvaDR ?? 0 },
  }
}

function sumCreditsAR(row: Row, headers: string[]): number {
  const direct = getNum(row, headers, 'credito_ar')
  if (direct !== 0) return direct
  return (
    getNum(row, headers, 'credito_icms_ar') +
    getNum(row, headers, 'credito_icms_st_ar') +
    getNum(row, headers, 'credito_icms_difal_ar') +
    getNum(row, headers, 'credito_iss_ar') +
    getNum(row, headers, 'credito_ipi_ar') +
    getNum(row, headers, 'credito_pis_cofins_ar') +
    getNum(row, headers, 'credito_ibs_ar') +
    getNum(row, headers, 'credito_cbs_ar')
  )
}

function sumCreditsDR(row: Row, headers: string[]): number {
  const direct = getNum(row, headers, 'credito_dr')
  if (direct !== 0) return direct
  return (
    getNum(row, headers, 'credito_icms_dr') +
    getNum(row, headers, 'credito_icms_st_dr') +
    getNum(row, headers, 'credito_icms_difal_dr') +
    getNum(row, headers, 'credito_iss_dr') +
    getNum(row, headers, 'credito_ipi_dr') +
    getNum(row, headers, 'credito_pis_cofins_dr') +
    getNum(row, headers, 'credito_ibs_dr') +
    getNum(row, headers, 'credito_cbs_dr')
  )
}

// ─── Monofásico NCM check ─────────────────────────────────────────────────────

const NCM_MONOFASICO_PREFIXES = [
  '2710', '2711', '2712',
  '2201', '2202', '2203', '2204', '2205', '2206', '2207', '2208',
  '3003', '3004',
  '3301', '3302', '3303', '3304', '3305', '3306', '3307',
  '8701', '8702', '8703', '8704', '8705', '8706', '8707', '8708',
]

function isMonofasico(ncm: string): boolean {
  const clean = ncm.replace(/\D/g, '')
  return NCM_MONOFASICO_PREFIXES.some(p => clean.startsWith(p))
}

// Maps CFOP last-3-digits to business category, seguindo os grupos oficiais
// da tabela CFOP (Ajuste SINIEF 07/01) por centena/faixa de 50.
function categoriaPorCFOP(cfop: string): string {
  const d = cfop.replace(/\D/g, '')
  if (d.length < 4) return 'Outros'
  const sub = d.slice(1)
  const n3 = parseInt(sub, 10)
  if (sub === '121' || sub === '122') return 'Venda de Imóveis'
  if (sub === '351') return 'Locação de Móveis'
  if (sub === '352') return 'Locação de Imóveis'
  if (n3 >= 301 && n3 <= 399) return 'Serviços'
  if (n3 >= 100 && n3 <= 299) return 'Produtos'
  if (n3 >= 400 && n3 <= 449) return 'Substituição Tributária'
  if (n3 >= 450 && n3 <= 499) return 'Sistemas de Integração'
  if (n3 >= 500 && n3 <= 549) return 'Remessa p/ Exportação'
  if (n3 >= 550 && n3 <= 599) return 'Ativo Imobilizado e Uso/Consumo'
  if (n3 >= 600 && n3 <= 699) return 'Créditos e Ressarcimento de ICMS'
  if (n3 >= 900 && n3 <= 999) return 'Outras Entradas/Saídas'
  return 'Outros'
}

// ─── Raw Transaction CSV parser ───────────────────────────────────────────────
// Handles CSV exports with columns: tipo_movimentacao, valor_ar, valor_dr, etc.

function isRawTransactionHeaders(headers: string[]): boolean {
  return !!(
    findCol(headers, 'tipo_movimentacao') &&
    findCol(headers, 'valor_ar') &&
    findCol(headers, 'valor_dr')
  )
}

type TxFileType = 'produtos' | 'servicos'

function detectTxFileType(headers: string[]): TxFileType {
  if (
    findCol(headers, 'ncm') ||
    findCol(headers, 'cfop') ||
    findCol(headers, 'codigo_produto', 'descricao_produto')
  ) return 'produtos'
  return 'servicos'
}

function parseRawTransactions(ws: XLSX.WorkSheet): {
  fileType: TxFileType
  compras: CompraCategoria[]
  vendas: VendaCategoria[]
  comprasNCM: ComprasNCMRow[]
  comprasRegime: ComprasRegimeRow[]
  comprasFornecedores: ComprasFornecedorRow[]
  comprasCFOP: ComprasCFOPRow[]
  comprasSimples: ComprasSimplesRow[]
  vendasNCM: VendasDetalheRow[]
  vendasClientes: VendasDetalheRow[]
  vendasCFOP: VendasDetalheRow[]
  vendasRegime: VendasRegimeRow[]
  vendasB2C: VendasB2CRow[]
  comprasCategorias: CategoriaRow[]
  vendasCategorias: CategoriaRow[]
  comprasTipoOperacao: CategoriaRow[]
  comprasOrigemUF: CategoriaRow[]
  comprasBeneficio: CategoriaRow[]
  comprasOrigem: CategoriaRow[]
  comprasCST: CategoriaRow[]
  /** Total de linhas de saída (venda) processadas — proxy pra qtde de notas/cupons emitidos. */
  vendasCount: number
  tributos?: { compras: TributoComposicao; vendas: TributoComposicao }
  empresa?: Partial<EmpresaInfo>
} {
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: '' })
  if (!data.length) return { fileType: 'produtos', compras: [], vendas: [], comprasNCM: [], comprasRegime: [], comprasFornecedores: [], comprasCFOP: [], comprasSimples: [], vendasNCM: [], vendasClientes: [], vendasCFOP: [], vendasRegime: [], vendasB2C: [], comprasCategorias: [], vendasCategorias: [], comprasTipoOperacao: [], comprasOrigemUF: [], comprasBeneficio: [], comprasOrigem: [], comprasCST: [], vendasCount: 0 }

  const headers = Object.keys(data[0])
  const fileType = detectTxFileType(headers)

  const comprasAgg = emptyAgg()
  const vendasAgg  = emptyAgg()

  const comprasNCMMap   = new Map<string, DetailAgg>()
  const vendasNCMMap    = new Map<string, DetailAgg>()
  const comprasCFOPMap  = new Map<string, DetailAgg>()
  const vendasCFOPMap   = new Map<string, DetailAgg>()
  const comprasCNPJMap  = new Map<string, DetailAgg>()
  const vendasCNPJMap   = new Map<string, DetailAgg>()
  const regimeMap       = new Map<string, number>()
  const cnpjRegimeMap   = new Map<string, string>()

  const vendasRegimeMap = new Map<string, number>()
  const b2bAgg = emptyDetail()
  const b2cAgg = emptyDetail()
  let b2bCount = 0
  let b2cCount = 0
  const simplFornMap = new Map<string, { agg: DetailAgg; ncms: Map<string, number> }>()
  const comprasCatMap = new Map<string, DetailAgg & { count: number }>()
  const vendasCatMap  = new Map<string, DetailAgg & { count: number }>()
  const tipoOperacaoMap = new Map<string, DetailAgg & { count: number }>()
  const origemUFMap     = new Map<string, DetailAgg & { count: number }>()
  const beneficioMap    = new Map<string, DetailAgg & { count: number }>()
  const origemMap       = new Map<string, DetailAgg & { count: number }>()
  const cstMap          = new Map<string, DetailAgg & { count: number }>()

  // Chave de item (codigo_produto quando existe, senão NCM/CNAE) → descrição legível, primeira vista
  const codigoDescMap = new Map<string, string>()
  // Chave de item → detalhes técnicos (campos de cauda longa), primeira linha vista por chave
  const codigoDetalhesMap = new Map<string, DetalhesTecnicos>()
  // Chave de item → NCM/CNAE real (a chave em si vira codigo_produto quando existe, e passa
  // a não ser mais o NCM — precisa desse mapa pra recuperar o NCM de exibição/classificação
  // fiscal na hora de emitir a linha). Primeira vista, mesmo padrão dos mapas acima.
  const codigoNcmMap = new Map<string, string>()
  // Chave de item → categoria de operação (Produtos/Serviços/Locação/... via CFOP, mesma
  // taxonomia de comprasCategorias/vendasCategorias) — primeira vista, mesmo padrão acima.
  const codigoCategoriaMap = new Map<string, string>()

  let regime = ''
  let cnpjEmpresa = ''
  let vendasCount = 0

  for (const row of data) {
    const tipoCol = findCol(headers, 'tipo_movimentacao')
    const tipoRaw = tipoCol ? n(String(row[tipoCol] ?? '')) : ''
    const isEntrada = tipoRaw === 'entrada'
    const isSaida   = tipoRaw === 'saida' || tipoRaw === 'saida'
    if (!isEntrada && !isSaida) continue

    const valorAR = getNum(row, headers, 'valor_ar')
    const valorDR = getNum(row, headers, 'valor_dr')
    if (valorAR === 0 && valorDR === 0) continue

    if (isSaida) vendasCount++

    const impostosAR      = getNum(row, headers, 'valor_impostos_ar')
    const impostosDR      = getNum(row, headers, 'valor_impostos_dr')
    const cargaARPct      = getPct(row, headers, 'porcentagem_carga_tributaria_ar')
    const cargaDRPct      = getPct(row, headers, 'porcentagem_carga_tributaria_dr')
    const valorDesonerado = getNum(row, headers, 'valor_desonerado')
    const creditoAR       = sumCreditsAR(row, headers)
    const creditoDR       = sumCreditsDR(row, headers)
    const custoAR         = getNum(row, headers, 'custo_ar') || Math.max(0, valorAR - creditoAR)
    const custoDR         = getNum(row, headers, 'custo_dr') || Math.max(0, valorDR - creditoDR)
    const diffCusto       = custoDR - custoAR

    // Quebra por tipo de tributo — antes (AR, tributos "antigos") e depois (DR, IBS/CBS)
    const icmsAR       = getNum(row, headers, 'valor_icms_ar')
    const icmsDR       = getNum(row, headers, 'valor_icms_dr')
    const icmsStAR     = getNum(row, headers, 'valor_icms_st_ar')
    const icmsStDR     = getNum(row, headers, 'valor_icms_st_dr')
    const icmsDifalAR  = getNum(row, headers, 'valor_icms_difal_ar')
    const icmsDifalDR  = getNum(row, headers, 'valor_icms_difal_dr')
    const issAR        = getNum(row, headers, 'valor_iss_ar')
    const issDR        = getNum(row, headers, 'valor_iss_dr')
    const ipiAR        = getNum(row, headers, 'valor_ipi_ar')
    const ipiDR        = getNum(row, headers, 'valor_ipi_dr')
    const pisCofinsAR  = getNum(row, headers, 'valor_pis_cofins_ar')
    const pisCofinsDR  = getNum(row, headers, 'valor_pis_cofins_dr')
    const ibsAR        = getNum(row, headers, 'valor_ibs_ar')
    const ibsDR        = getNum(row, headers, 'valor_ibs_dr')
    const cbsAR        = getNum(row, headers, 'valor_cbs_ar')
    const cbsDR        = getNum(row, headers, 'valor_cbs_dr')
    const semIvaAR     = getNum(row, headers, 'valor_sem_iva_ar')
    const semIvaDR     = getNum(row, headers, 'valor_sem_iva_dr')

    // Alíquotas efetivas por tipo de tributo
    const aliqIcmsAR      = getPct(row, headers, 'aliq_icms_ar')
    const aliqIcmsDR      = getPct(row, headers, 'aliq_icms_dr')
    const aliqIcmsStAR    = getPct(row, headers, 'aliq_icms_st_ar')
    const aliqIcmsStDR    = getPct(row, headers, 'aliq_icms_st_dr')
    const aliqIcmsDifalAR = getPct(row, headers, 'aliq_icms_difal_ar')
    const aliqIcmsDifalDR = getPct(row, headers, 'aliq_icms_difal_dr')
    const aliqIssAR       = getPct(row, headers, 'aliq_iss_ar')
    const aliqIssDR       = getPct(row, headers, 'aliq_iss_dr')
    const aliqIpiAR       = getPct(row, headers, 'aliq_ipi_ar')
    const aliqIpiDR       = getPct(row, headers, 'aliq_ipi_dr')
    const aliqPisCofinsAR = getPct(row, headers, 'aliq_pis_cofins_ar')
    const aliqPisCofinsDR = getPct(row, headers, 'aliq_pis_cofins_dr')

    const v = {
      valorAR, impostosAR, valorDesonerado, custoAR, creditoAR, cargaARPct, valorDR, impostosDR, custoDR, creditoDR, cargaDRPct,
      icmsAR, icmsDR, icmsStAR, icmsStDR, icmsDifalAR, icmsDifalDR, issAR, issDR, ipiAR, ipiDR,
      pisCofinsAR, pisCofinsDR, ibsAR, ibsDR, cbsAR, cbsDR, semIvaAR, semIvaDR,
      aliqIcmsAR, aliqIcmsDR, aliqIcmsStAR, aliqIcmsStDR, aliqIcmsDifalAR, aliqIcmsDifalDR,
      aliqIssAR, aliqIssDR, aliqIpiAR, aliqIpiDR, aliqPisCofinsAR, aliqPisCofinsDR,
    }
    accumulate(isEntrada ? comprasAgg : vendasAgg, v)

    // Regime info from data
    if (!regime) regime = getStr(row, headers, 'meu_regime_simulado', 'regime_simulado')
    if (!cnpjEmpresa) cnpjEmpresa = getStr(row, headers, 'cnpj_empresa', 'cnpj_emitente')

    // Código do item — NCM para produtos, CNAE para serviços (não têm NCM) — e sua descrição
    const ncmColReal = findCol(headers, 'ncm')
    const cnaeCol = findCol(headers, 'cnae_principal')
    const rawCodigo = ncmColReal ? String(row[ncmColReal] ?? '').trim() : cnaeCol ? String(row[cnaeCol] ?? '').trim() : ''
    const ncm = ncmColReal ? normalizeNcm(rawCodigo) : rawCodigo
    const descricaoCol = findCol(headers, 'descricao_produto') ?? findCol(headers, 'descricao_atividade')
    const descricaoItem = descricaoCol ? String(row[descricaoCol] ?? '').trim() : ''
    // Código único do produto (planilhas de produto trazem; serviços não têm equivalente) —
    // várias planilhas reais têm dezenas/centenas de produtos distintos sob o mesmo NCM (o
    // NCM é só a classificação fiscal, não identifica o item), então agrupar/casar por NCM
    // sozinho junta produtos diferentes numa linha só. codigo_produto é a chave real do item.
    const codigoProdutoCol = findCol(headers, 'codigo_produto')
    const codigoProdutoRaw = codigoProdutoCol ? String(row[codigoProdutoCol] ?? '').trim() : ''
    const itemKey = codigoProdutoRaw || ncm
    if (itemKey && !codigoNcmMap.has(itemKey)) codigoNcmMap.set(itemKey, ncm)
    if (itemKey && descricaoItem && !codigoDescMap.has(itemKey)) codigoDescMap.set(itemKey, descricaoItem)
    if (itemKey && !codigoDetalhesMap.has(itemKey)) {
      const desconto = getNum(row, headers, 'desconto')
      const valorMovContraria = getNum(row, headers, 'valor_movimentacao_contraria_input')
      const valorDepreciacao = getNum(row, headers, 'valor_depreciacao')
      const detalhes: DetalhesTecnicos = {
        desconto: desconto || undefined,
        metodo: getStr(row, headers, 'metodo').trim() || undefined,
        custoDespesa: getStr(row, headers, 'custo_despesa').trim() || undefined,
        origem: getStr(row, headers, 'origem').trim() || undefined,
        fornecedorIndustrial: getStr(row, headers, 'fornecedor_industrial').trim() || undefined,
        temCreditoIcms: getStr(row, headers, 'tem_credito_icms').trim() || undefined,
        temCreditoPisCofins: getStr(row, headers, 'tem_credito_pis_cofins').trim() || undefined,
        temCreditoIpi: getStr(row, headers, 'tem_credito_ipi').trim() || undefined,
        valorMovimentacaoContraria: valorMovContraria || undefined,
        valorDepreciacao: valorDepreciacao || undefined,
        descricaoAnexo: getStr(row, headers, 'descricao_anexo').trim() || undefined,
        anexo: getStr(row, headers, 'anexo').trim() || undefined,
        beneficioReducaoFrac: getNum(row, headers, 'beneficio') || undefined,
        prestacao: getStr(row, headers, 'prestacao').trim() || undefined,
        cstIcms: getStr(row, headers, 'cst_icms').trim() || undefined,
        cstIpi: getStr(row, headers, 'cst_ipi').trim() || undefined,
        cstPis: getStr(row, headers, 'cst_pis').trim() || undefined,
        cstCofins: getStr(row, headers, 'cst_cofins').trim() || undefined,
        valorBrutoInput: getNum(row, headers, 'valor_bruto_input') || undefined,
        aliqIcmsInput: getPct(row, headers, 'aliq_icms_input') || undefined,
        aliqIssInput: getPct(row, headers, 'aliq_iss_input') || undefined,
        aliqIpiInput: getPct(row, headers, 'aliq_ipi_input') || undefined,
        aliqPisCofinsCreditarInput: getPct(row, headers, 'aliq_pis_cofins_creditar_input') || undefined,
        aliqPisCofinsDesonerarInput: getPct(row, headers, 'aliq_pis_cofins_desonerar_input') || undefined,
        aliqIcmsStInput: getPct(row, headers, 'aliq_icms_st_input') || undefined,
        aliqIcmsDifalInput: getPct(row, headers, 'aliq_icms_difal_input') || undefined,
        valorIcmsInput: getNum(row, headers, 'valor_icms_input') || undefined,
        valorIcmsStInput: getNum(row, headers, 'valor_icms_st_input') || undefined,
        valorIcmsDifalInput: getNum(row, headers, 'valor_icms_difal_input') || undefined,
        valorIssInput: getNum(row, headers, 'valor_iss_input') || undefined,
        valorIpiInput: getNum(row, headers, 'valor_ipi_input') || undefined,
        valorPisCofinsInput: getNum(row, headers, 'valor_pis_cofins_input') || undefined,
        idInput: getStr(row, headers, 'id_input').trim() || undefined,
        dataCriacaoInput: getStr(row, headers, 'data_criacao_input').trim() || undefined,
        versaoInicialInput: getStr(row, headers, 'versao_inicial_input').trim() || undefined,
        versaoFinalInput: getStr(row, headers, 'versao_final_input').trim() || undefined,
        calculoId: getStr(row, headers, 'calculo_id').trim() || undefined,
        chaveValidacao: getStr(row, headers, 'chave_validacao').trim() || undefined,
        inputId: getStr(row, headers, 'input_id').trim() || undefined,
        idResultadoAr: getStr(row, headers, 'id_resultado_ar').trim() || undefined,
        dataCriacaoResultadoAr: getStr(row, headers, 'data_criacao_resultado_ar').trim() || undefined,
        idResultadoDr: getStr(row, headers, 'id_resultado_dr').trim() || undefined,
        dataCriacaoResultadoDr: getStr(row, headers, 'data_criacao_resultado_dr').trim() || undefined,
        anoDr: getStr(row, headers, 'ano_dr').trim() || undefined,
        anoNumDr: getStr(row, headers, 'ano_num_dr').trim() || undefined,
        tipoInput: getStr(row, headers, 'tipo_input').trim() || undefined,
      }
      if (Object.values(detalhes).some(v => v !== undefined)) codigoDetalhesMap.set(itemKey, detalhes)
    }
    if (ncm && ncm !== '0' && ncm !== '') {
      const map = isEntrada ? comprasNCMMap : vendasNCMMap
      const agg = map.get(itemKey) ?? emptyDetail()
      accumulate(agg, v)
      agg.diffCusto += diffCusto
      map.set(itemKey, agg)
    }

    // Dimensões extras (produtos apenas — serviços não têm essas colunas)
    const tipoOperacao = getStr(row, headers, 'tipo_operacao').trim()
    if (tipoOperacao) {
      const existing = tipoOperacaoMap.get(tipoOperacao) ?? { ...emptyDetail(), count: 0 }
      accumulate(existing, v)
      existing.diffCusto += diffCusto
      existing.count++
      tipoOperacaoMap.set(tipoOperacao, existing)
    }
    const ufEmitente = getStr(row, headers, 'uf_emitente').trim()
    if (ufEmitente) {
      const existing = origemUFMap.get(ufEmitente) ?? { ...emptyDetail(), count: 0 }
      accumulate(existing, v)
      existing.diffCusto += diffCusto
      existing.count++
      origemUFMap.set(ufEmitente, existing)
    }
    const manterBeneficio = getStr(row, headers, 'manter_beneficio').trim()
    if (manterBeneficio) {
      const label = n(manterBeneficio) === '1' || n(manterBeneficio) === 'true' || n(manterBeneficio) === 'sim'
        ? 'Com Benefício Mantido' : 'Sem Benefício / Perdido'
      const existing = beneficioMap.get(label) ?? { ...emptyDetail(), count: 0 }
      accumulate(existing, v)
      existing.diffCusto += diffCusto
      existing.count++
      beneficioMap.set(label, existing)
    }
    const origemValor = getStr(row, headers, 'origem').trim()
    if (origemValor) {
      const existing = origemMap.get(origemValor) ?? { ...emptyDetail(), count: 0 }
      accumulate(existing, v)
      existing.diffCusto += diffCusto
      existing.count++
      origemMap.set(origemValor, existing)
    }
    const cstIcmsValor = getStr(row, headers, 'cst_icms').trim()
    if (cstIcmsValor) {
      const existing = cstMap.get(cstIcmsValor) ?? { ...emptyDetail(), count: 0 }
      accumulate(existing, v)
      existing.diffCusto += diffCusto
      existing.count++
      cstMap.set(cstIcmsValor, existing)
    }

    // CFOP (produtos only)
    const cfopCol = findCol(headers, 'cfop')
    const cfop = cfopCol ? String(row[cfopCol] ?? '').trim() : ''
    if (cfop && cfop !== '0' && cfop !== '') {
      const map = isEntrada ? comprasCFOPMap : vendasCFOPMap
      const agg = map.get(cfop) ?? emptyDetail()
      accumulate(agg, v)
      agg.diffCusto += diffCusto
      map.set(cfop, agg)
      if (itemKey && !codigoCategoriaMap.has(itemKey)) codigoCategoriaMap.set(itemKey, categoriaPorCFOP(cfop))
    }

    // CNPJ supplier/client
    const cnpj = getStr(row, headers, 'cnpj_outra_parte').trim()
    if (cnpj && cnpj !== '0') {
      const map = isEntrada ? comprasCNPJMap : vendasCNPJMap
      const agg = map.get(cnpj) ?? emptyDetail()
      accumulate(agg, v)
      agg.diffCusto += diffCusto
      map.set(cnpj, agg)
    }

    // Regime of other party (for compras regime chart)
    if (isEntrada) {
      const regimeOutra = getStr(row, headers, 'regime_tributario_outra_parte').trim()
      if (regimeOutra) {
        regimeMap.set(regimeOutra, (regimeMap.get(regimeOutra) ?? 0) + valorAR)
        if (cnpj && cnpj !== '0') cnpjRegimeMap.set(cnpj, regimeOutra)
      }
    }

    // Regime dos clientes (saídas)
    if (isSaida) {
      const regimeCliente = getStr(row, headers, 'regime_tributario_outra_parte').trim()
      if (regimeCliente) {
        vendasRegimeMap.set(regimeCliente, (vendasRegimeMap.get(regimeCliente) ?? 0) + valorAR)
      }
      const cnpjNum = cnpj.replace(/\D/g, '')
      if (cnpjNum.length === 14) {
        accumulate(b2bAgg, v); b2bAgg.diffCusto += diffCusto; b2bCount++
      } else if (cnpjNum.length === 11) {
        accumulate(b2cAgg, v); b2cAgg.diffCusto += diffCusto; b2cCount++
      }
    }

    // Fornecedores do Simples (entradas)
    if (isEntrada) {
      const regimeForn = getStr(row, headers, 'regime_tributario_outra_parte').trim()
      if (n(regimeForn).includes('simples') && cnpj) {
        const entry = simplFornMap.get(cnpj) ?? { agg: emptyDetail(), ncms: new Map<string, number>() }
        accumulate(entry.agg, v)
        entry.agg.diffCusto += diffCusto
        // Chave por itemKey (não NCM puro) — mesma lógica de comprasNCM: várias planilhas reais
        // têm produtos distintos sob o mesmo NCM, então agrupar por NCM sozinho perde a
        // descrição (codigoDescMap é indexado por itemKey, não por NCM).
        if (itemKey) entry.ncms.set(itemKey, (entry.ncms.get(itemKey) ?? 0) + valorAR)
        simplFornMap.set(cnpj, entry)
      }
    }

    // Category by CFOP
    if (cfop) {
      const cat = categoriaPorCFOP(cfop)
      const catMap = isEntrada ? comprasCatMap : vendasCatMap
      const existing = catMap.get(cat) ?? { ...emptyDetail(), count: 0 }
      accumulate(existing, v)
      existing.diffCusto += diffCusto
      existing.count++
      catMap.set(cat, existing)
    }
  }

  const comprasLabel = fileType === 'servicos' ? 'Serviços Tomados' : 'Compras Produtos'
  const vendasLabel  = fileType === 'servicos' ? 'Serviços Prestados' : 'Vendas Produtos'

  const compras: CompraCategoria[] = comprasAgg.valorAR > 0 || comprasAgg.valorDR > 0 ? [{
    categoria:           comprasLabel,
    valorAR:             comprasAgg.valorAR,
    impostosAR:          comprasAgg.impostosAR,
    valorDesonerado:     comprasAgg.valorDesonerado,
    custoAR:             comprasAgg.custoAR,
    custoEfetivoARPct:   avgCargaAR(comprasAgg),
    creditoAR:           comprasAgg.creditoAR,
    cargaTributariaARPct:avgCargaAR(comprasAgg),
    valorDR:             comprasAgg.valorDR,
    impostosDR:          comprasAgg.impostosDR,
    custoDR:             comprasAgg.custoDR,
    custoEfetivoDRPct:   avgCargaDR(comprasAgg),
    creditoDR:           comprasAgg.creditoDR,
  }] : []

  const vendas: VendaCategoria[] = vendasAgg.valorAR > 0 || vendasAgg.valorDR > 0 ? [{
    categoria:            vendasLabel,
    valorAR:              vendasAgg.valorAR,
    impostosAR:           vendasAgg.impostosAR,
    debitoAR:             vendasAgg.impostosAR,
    valorDesonerado:      vendasAgg.valorDesonerado,
    cargaTributariaARPct: avgCargaAR(vendasAgg),
    valorDR:              vendasAgg.valorDR,
    impostosDR:           vendasAgg.impostosDR,
    debitoDR:             vendasAgg.impostosDR,
    cargaTributariaDRPct: avgCargaDR(vendasAgg),
  }] : []

  const toDetailRow = (codigo: string, agg: DetailAgg): VendasDetalheRow => ({
    codigo,
    descricao:     codigoDescMap.get(codigo),
    tipo:          fileType === 'servicos' ? 'servico' as const : 'produto' as const,
    cargaARPct:    avgCargaAR(agg),
    cargaDRPct:    avgCargaDR(agg),
    valorAR:       agg.valorAR,
    valorDesonerado: agg.valorDesonerado,
    tributosAR:    agg.impostosAR,
    valorDR:       agg.valorDR,
    tributosDR:    agg.impostosDR,
    diffCusto:     agg.diffCusto,
    detalhes:      codigoDetalhesMap.get(codigo),
    ...tributoBreakdownFlat(agg),
    ...aliquotasEfetivas(agg),
  })

  const toFornRow = (cnpj: string, agg: DetailAgg): ComprasFornecedorRow => ({
    cnpj,
    regime:        cnpjRegimeMap.get(cnpj),
    cargaARPct:    avgCargaAR(agg),
    cargaDRPct:    avgCargaDR(agg),
    valorAR:       agg.valorAR,
    valorDesonerado: agg.valorDesonerado,
    tributosAR:    agg.impostosAR,
    valorDR:       agg.valorDR,
    tributosDR:    agg.impostosDR,
    custoAR:       agg.custoAR,
  })

  const toCFOPRow = (cfop: string, agg: DetailAgg): ComprasCFOPRow => ({
    cfop,
    cargaARPct:    avgCargaAR(agg),
    cargaDRPct:    avgCargaDR(agg),
    valorAR:       agg.valorAR,
    valorDesonerado: agg.valorDesonerado,
    tributosAR:    agg.impostosAR,
    valorDR:       agg.valorDR,
    tributosDR:    agg.impostosDR,
    diffCusto:     agg.diffCusto,
  })

  const totalComprasAR = comprasAgg.valorAR || 1

  const comprasSimples: ComprasSimplesRow[] = Array.from(simplFornMap.entries()).map(([cnpj, entry]) => ({
    cnpj,
    valorAR: entry.agg.valorAR,
    pctTotalCompras: (entry.agg.valorAR / totalComprasAR) * 100,
    // Chave é itemKey (codigo_produto quando a planilha traz, senão o próprio NCM) — resolve
    // o NCM fiscal real via codigoNcmMap e a descrição via codigoDescMap, mesmo padrão de comprasNCM.
    ncms: Array.from(entry.ncms.entries())
      .map(([itemKey, valorAR]) => ({
        ncm: codigoNcmMap.get(itemKey) ?? itemKey,
        valorAR,
        descricao: codigoDescMap.get(itemKey),
      }))
      .sort((a, b) => b.valorAR - a.valorAR)
      .slice(0, 5),
  })).sort((a, b) => b.valorAR - a.valorAR)

  const vendasB2C: VendasB2CRow[] = []
  if (b2bCount > 0 || b2bAgg.valorAR > 0) {
    vendasB2C.push({
      tipo: 'B2B',
      valorAR: b2bAgg.valorAR,
      valorDR: b2bAgg.valorDR,
      cargaARPct: avgCargaAR(b2bAgg),
      cargaDRPct: avgCargaDR(b2bAgg),
      diffCusto: b2bAgg.diffCusto,
      count: b2bCount,
    })
  }
  if (b2cCount > 0 || b2cAgg.valorAR > 0) {
    vendasB2C.push({
      tipo: 'B2C',
      valorAR: b2cAgg.valorAR,
      valorDR: b2cAgg.valorDR,
      cargaARPct: avgCargaAR(b2cAgg),
      cargaDRPct: avgCargaDR(b2cAgg),
      diffCusto: b2cAgg.diffCusto,
      count: b2cCount,
    })
  }

  return {
    fileType,
    compras,
    vendas,
    vendasCount,
    // Chave do map é itemKey (codigo_produto quando a planilha traz, senão o próprio NCM) —
    // o NCM real de exibição/classificação fiscal vem de codigoNcmMap; codigoProduto só é
    // emitido quando de fato veio de um código de produto distinto do NCM (produtos, não serviços).
    comprasNCM: Array.from(comprasNCMMap.entries()).map(([itemKey, agg]) => {
      const ncm = codigoNcmMap.get(itemKey) ?? itemKey
      return {
        ncm,
        codigoProduto: itemKey !== ncm ? itemKey : undefined,
        descricao:  codigoDescMap.get(itemKey),
        categoria:  codigoCategoriaMap.get(itemKey),
        tipo:       fileType === 'servicos' ? 'servico' as const : 'produto' as const,
        valorAR:    agg.valorAR,
        valorDR:    agg.valorDR,
        cargaARPct: avgCargaAR(agg),
        cargaDRPct: avgCargaDR(agg),
        custoAR:    agg.custoAR,
        custoDR:    agg.custoDR,
        isMonofasico: isMonofasico(ncm),
        detalhes:   codigoDetalhesMap.get(itemKey),
        ...tributoBreakdownFlat(agg),
        ...aliquotasEfetivas(agg),
      }
    }),
    comprasRegime: Array.from(regimeMap.entries()).map(([r, valorAR]) => ({ regime: r, valorAR })),
    comprasFornecedores: Array.from(comprasCNPJMap.entries()).map(([cnpj, agg]) => toFornRow(cnpj, agg)),
    comprasCFOP:         Array.from(comprasCFOPMap.entries()).map(([cfop, agg]) => toCFOPRow(cfop, agg)),
    comprasSimples,
    vendasNCM:           Array.from(vendasNCMMap.entries()).map(([itemKey, agg]) => {
      const ncm = codigoNcmMap.get(itemKey) ?? itemKey
      return {
        ...toDetailRow(ncm, agg),
        codigoProduto: itemKey !== ncm ? itemKey : undefined,
        descricao: codigoDescMap.get(itemKey),
        categoria: codigoCategoriaMap.get(itemKey),
        detalhes:  codigoDetalhesMap.get(itemKey),
      }
    }),
    vendasClientes:      Array.from(vendasCNPJMap.entries()).map(([cnpj, agg]) => toDetailRow(cnpj, agg)),
    vendasCFOP:          Array.from(vendasCFOPMap.entries()).map(([cfop, agg]) => toDetailRow(cfop, agg)),
    vendasRegime: Array.from(vendasRegimeMap.entries()).map(([regime, valorAR]) => ({ regime, valorAR })),
    vendasB2C,
    comprasCategorias: Array.from(comprasCatMap.entries()).map(([categoria, agg]) => ({
      categoria,
      valorAR:    agg.valorAR,
      valorDR:    agg.valorDR,
      custoAR:    agg.custoAR,
      custoDR:    agg.custoDR,
      cargaARPct: avgCargaAR(agg),
      cargaDRPct: avgCargaDR(agg),
      diffCusto:  agg.diffCusto,
      valorDesonerado: agg.valorDesonerado,
      count:      agg.count,
    })).sort((a, b) => b.valorAR - a.valorAR),
    vendasCategorias: Array.from(vendasCatMap.entries()).map(([categoria, agg]) => ({
      categoria,
      valorAR:    agg.valorAR,
      valorDR:    agg.valorDR,
      custoAR:    agg.custoAR,
      custoDR:    agg.custoDR,
      cargaARPct: avgCargaAR(agg),
      cargaDRPct: avgCargaDR(agg),
      diffCusto:  agg.diffCusto,
      valorDesonerado: agg.valorDesonerado,
      count:      agg.count,
    })).sort((a, b) => b.valorAR - a.valorAR),
    comprasTipoOperacao: Array.from(tipoOperacaoMap.entries()).map(([categoria, agg]) => ({
      categoria,
      valorAR:    agg.valorAR,
      valorDR:    agg.valorDR,
      custoAR:    agg.custoAR,
      custoDR:    agg.custoDR,
      cargaARPct: avgCargaAR(agg),
      cargaDRPct: avgCargaDR(agg),
      diffCusto:  agg.diffCusto,
      valorDesonerado: agg.valorDesonerado,
      count:      agg.count,
    })).sort((a, b) => b.valorAR - a.valorAR),
    comprasOrigemUF: Array.from(origemUFMap.entries()).map(([categoria, agg]) => ({
      categoria,
      valorAR:    agg.valorAR,
      valorDR:    agg.valorDR,
      custoAR:    agg.custoAR,
      custoDR:    agg.custoDR,
      cargaARPct: avgCargaAR(agg),
      cargaDRPct: avgCargaDR(agg),
      diffCusto:  agg.diffCusto,
      valorDesonerado: agg.valorDesonerado,
      count:      agg.count,
    })).sort((a, b) => b.valorAR - a.valorAR),
    comprasBeneficio: Array.from(beneficioMap.entries()).map(([categoria, agg]) => ({
      categoria,
      valorAR:    agg.valorAR,
      valorDR:    agg.valorDR,
      custoAR:    agg.custoAR,
      custoDR:    agg.custoDR,
      cargaARPct: avgCargaAR(agg),
      cargaDRPct: avgCargaDR(agg),
      diffCusto:  agg.diffCusto,
      valorDesonerado: agg.valorDesonerado,
      count:      agg.count,
    })).sort((a, b) => b.valorAR - a.valorAR),
    comprasOrigem: Array.from(origemMap.entries()).map(([categoria, agg]) => ({
      categoria,
      valorAR:    agg.valorAR,
      valorDR:    agg.valorDR,
      custoAR:    agg.custoAR,
      custoDR:    agg.custoDR,
      cargaARPct: avgCargaAR(agg),
      cargaDRPct: avgCargaDR(agg),
      diffCusto:  agg.diffCusto,
      valorDesonerado: agg.valorDesonerado,
      count:      agg.count,
    })).sort((a, b) => b.valorAR - a.valorAR),
    comprasCST: Array.from(cstMap.entries()).map(([categoria, agg]) => ({
      categoria,
      valorAR:    agg.valorAR,
      valorDR:    agg.valorDR,
      custoAR:    agg.custoAR,
      custoDR:    agg.custoDR,
      cargaARPct: avgCargaAR(agg),
      cargaDRPct: avgCargaDR(agg),
      diffCusto:  agg.diffCusto,
      valorDesonerado: agg.valorDesonerado,
      count:      agg.count,
    })).sort((a, b) => b.valorAR - a.valorAR),
    tributos: {
      compras: {
        icms:      { ar: comprasAgg.icmsAR,      dr: comprasAgg.icmsDR },
        icmsSt:    { ar: comprasAgg.icmsStAR,    dr: comprasAgg.icmsStDR },
        icmsDifal: { ar: comprasAgg.icmsDifalAR, dr: comprasAgg.icmsDifalDR },
        iss:       { ar: comprasAgg.issAR,       dr: comprasAgg.issDR },
        ipi:       { ar: comprasAgg.ipiAR,       dr: comprasAgg.ipiDR },
        pisCofins: { ar: comprasAgg.pisCofinsAR, dr: comprasAgg.pisCofinsDR },
        ibs:       { ar: comprasAgg.ibsAR,       dr: comprasAgg.ibsDR },
        cbs:       { ar: comprasAgg.cbsAR,       dr: comprasAgg.cbsDR },
        semIva:    { ar: comprasAgg.semIvaAR,    dr: comprasAgg.semIvaDR },
      },
      vendas: {
        icms:      { ar: vendasAgg.icmsAR,      dr: vendasAgg.icmsDR },
        icmsSt:    { ar: vendasAgg.icmsStAR,    dr: vendasAgg.icmsStDR },
        icmsDifal: { ar: vendasAgg.icmsDifalAR, dr: vendasAgg.icmsDifalDR },
        iss:       { ar: vendasAgg.issAR,       dr: vendasAgg.issDR },
        ipi:       { ar: vendasAgg.ipiAR,       dr: vendasAgg.ipiDR },
        pisCofins: { ar: vendasAgg.pisCofinsAR, dr: vendasAgg.pisCofinsDR },
        ibs:       { ar: vendasAgg.ibsAR,       dr: vendasAgg.ibsDR },
        cbs:       { ar: vendasAgg.cbsAR,       dr: vendasAgg.cbsDR },
        semIva:    { ar: vendasAgg.semIvaAR,    dr: vendasAgg.semIvaDR },
      },
    },
    empresa: regime || cnpjEmpresa ? { regime, cnpj: cnpjEmpresa } : undefined,
  }
}

// ─── Content-based sheet type detection ──────────────────────────────────────

type SheetType =
  | 'empresa' | 'compras' | 'vendas' | 'dre' | 'fluxo' | 'regime'
  | 'comprasNCM' | 'comprasRegime' | 'comprasFornecedor' | 'comprasCFOP'
  | 'vendasNCM' | 'vendasCliente' | 'vendasCFOP'
  | 'transacoes'
  | 'unknown'

function detectSheetType(ws: XLSX.WorkSheet): SheetType {
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: 0 })
  if (!data.length) return 'unknown'
  const headers = Object.keys(data[0])

  // Raw transaction format: check first (most specific)
  if (isRawTransactionHeaders(headers)) return 'transacoes'

  const has = (...keys: string[]) => !!findCol(headers, ...keys)

  if (has('Campo', 'Field', 'Chave') && has('Valor', 'Value')) return 'empresa'
  if (has('Resultado_Pos_IRCS', 'ResultadoPosIRCS')) return 'regime'
  if (has('Ano_Base', 'AnoBase', 'Ano Base')) return 'dre'
  if (has('NCM', 'Ncm')) {
    return has('Soma_Custo_AR', 'Custo_AR', 'CustoAR') ? 'comprasNCM' : 'vendasNCM'
  }
  if (has('CFOP', 'Cfop')) {
    return has('Soma_Custo_AR', 'Custo_AR', 'CustoAR') ? 'comprasCFOP' : 'vendasCFOP'
  }
  if (has('CNPJ', 'Cnpj', 'Fornecedor', 'Cliente')) {
    return has('Soma_Custo_AR', 'Custo_AR', 'CustoAR') ? 'comprasFornecedor' : 'vendasCliente'
  }
  if (has('Regime', 'Tributacao') && !has('Categoria', 'Conta', 'Item')) return 'comprasRegime'
  if (has('Categoria', 'Conta', 'Item', 'Descricao')) {
    if (has('Custo_AR', 'CustoAR', 'Credito_AR', 'CreditoAR', 'Custo_Efetivo_AR')) return 'compras'
    if (has('Debito_AR', 'DebitoAR')) return 'vendas'
    if (has('AR', 'ar') && has('DR', 'dr') && has('Diff_RS', 'DiffRS', 'Diferenca_RS')) return 'fluxo'
  }
  return 'unknown'
}

// ─── Sheet parsers (template format) ─────────────────────────────────────────

function parseEmpresa(ws: XLSX.WorkSheet): EmpresaInfo {
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: '' })
  const map: Record<string, string> = {}
  for (const row of data) {
    const keys = Object.keys(row)
    if (keys.length >= 2) {
      const k = n(String(row[keys[0]] ?? ''))
      map[k] = String(row[keys[1]] ?? '')
    }
  }
  const get = (...keys: string[]): string => {
    for (const k of keys) { const v = map[n(k)]; if (v) return v }
    return ''
  }
  return {
    empresa: get('Nome_Empresa', 'Empresa', 'Razao_Social', 'nome'),
    cnpj:    get('CNPJ', 'cnpj'),
    regime:  get('Regime', 'Tributacao'),
    periodo: get('Periodo', 'Mes', 'Competencia', 'Data'),
  }
}

function parseCompras(ws: XLSX.WorkSheet): CompraCategoria[] {
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: 0 })
  if (!data.length) return []
  const headers = Object.keys(data[0])
  return data.map(row => ({
    categoria:            getStr(row, headers, 'Categoria', 'Descricao', 'Item') || 'Sem categoria',
    valorAR:              getNum(row, headers, 'Valor_AR', 'ValorAR', 'valor AR'),
    impostosAR:           getNum(row, headers, 'Impostos_AR', 'ImpostosAR'),
    valorDesonerado:      getNum(row, headers, 'Valor_Desonerado', 'ValorDesonerado'),
    custoAR:              getNum(row, headers, 'Custo_AR', 'CustoAR'),
    custoEfetivoARPct:    getPct(row, headers, 'Custo_Efetivo_AR', 'CustoEfetivoAR'),
    creditoAR:            getNum(row, headers, 'Credito_AR', 'CreditoAR'),
    cargaTributariaARPct: getPct(row, headers, 'Carga_Tributaria_AR', 'CargaTributariaAR', 'Carga_AR'),
    valorDR:              getNum(row, headers, 'Valor_DR', 'ValorDR'),
    impostosDR:           getNum(row, headers, 'Impostos_DR', 'ImpostosDR'),
    custoDR:              getNum(row, headers, 'Custo_DR', 'CustoDR'),
    custoEfetivoDRPct:    getPct(row, headers, 'Custo_Efetivo_DR', 'CustoEfetivoDR'),
    creditoDR:            getNum(row, headers, 'Credito_DR', 'CreditoDR'),
  })).filter(r => r.valorAR > 0 || r.valorDR > 0 || r.categoria !== 'Sem categoria')
}

function parseVendas(ws: XLSX.WorkSheet): VendaCategoria[] {
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: 0 })
  if (!data.length) return []
  const headers = Object.keys(data[0])
  return data.map(row => ({
    categoria:             getStr(row, headers, 'Categoria', 'Descricao', 'Item') || 'Sem categoria',
    valorAR:               getNum(row, headers, 'Valor_AR', 'ValorAR'),
    impostosAR:            getNum(row, headers, 'Impostos_AR', 'ImpostosAR'),
    debitoAR:              getNum(row, headers, 'Debito_AR', 'DebitoAR'),
    valorDesonerado:       getNum(row, headers, 'Valor_Desonerado', 'ValorDesonerado'),
    cargaTributariaARPct:  getPct(row, headers, 'Carga_AR', 'CargaAR'),
    valorDR:               getNum(row, headers, 'Valor_DR', 'ValorDR'),
    impostosDR:            getNum(row, headers, 'Impostos_DR', 'ImpostosDR'),
    debitoDR:              getNum(row, headers, 'Debito_DR', 'DebitoDR'),
    cargaTributariaDRPct:  getPct(row, headers, 'Carga_DR', 'CargaDR'),
  })).filter(r => r.valorAR > 0 || r.valorDR > 0)
}

const DRE_ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

function parseDRE(ws: XLSX.WorkSheet): DRELinha[] {
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: 0 })
  if (!data.length) return []
  const headers = Object.keys(data[0])
  return data.map(row => {
    const anos: Record<number, number> = {}
    for (const ano of DRE_ANOS) {
      const col = findCol(headers, String(ano), `ano_${ano}`)
      anos[ano] = col ? parseNum(row[col]) : 0
    }
    return {
      categoria: getStr(row, headers, 'Categoria', 'Conta', 'Item', 'Descricao') || 'Sem categoria',
      ar:        getNum(row, headers, 'AR', 'ar', 'Atual'),
      anoBase:   getNum(row, headers, 'Ano_Base', 'AnoBase', 'Ano Base', 'DR', 'dr'),
      diffRS:    getNum(row, headers, 'Diff_RS', 'DiffRS', 'Diferença R$'),
      diffPct:   getPct(row, headers, 'Diff_Pct', 'DiffPct', 'Diferença %'),
      anos,
    }
  }).filter(r => r.categoria !== 'Sem categoria' && (r.ar !== 0 || r.anoBase !== 0))
}

function parseFluxo(ws: XLSX.WorkSheet): FluxoLinha[] {
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: 0 })
  if (!data.length) return []
  const headers = Object.keys(data[0])
  return data.map(row => {
    const anos: Record<number, number> = {}
    for (const ano of DRE_ANOS) {
      const col = findCol(headers, String(ano), `ano_${ano}`)
      anos[ano] = col ? parseNum(row[col]) : 0
    }
    return {
      categoria: getStr(row, headers, 'Categoria', 'Conta', 'Item') || 'Sem categoria',
      ar:        getNum(row, headers, 'AR', 'ar', 'Atual'),
      dr:        getNum(row, headers, 'DR', 'dr', 'Novo'),
      diffRS:    getNum(row, headers, 'Diff_RS', 'DiffRS'),
      diffPct:   getPct(row, headers, 'Diff_Pct', 'DiffPct'),
      anos,
    }
  }).filter(r => r.categoria !== 'Sem categoria' && (r.ar !== 0 || r.dr !== 0))
}

function parseRegime(ws: XLSX.WorkSheet): RegimeComparacao[] {
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: 0 })
  if (!data.length) return []
  const headers = Object.keys(data[0])
  const result = data.map(row => ({
    regime:              getStr(row, headers, 'Regime', 'Tributacao', 'Nome'),
    resultadoPosIRCS:    getNum(row, headers, 'Resultado_Pos_IRCS', 'ResultadoPosIRCS'),
    tributosCredito:     getNum(row, headers, 'Tributos_Credito', 'TributosCredito'),
    tributosDebito:      getNum(row, headers, 'Tributos_Debito', 'TributosDebito'),
    tributosRecolhidos:  getNum(row, headers, 'Tributos_Recolhidos', 'TributosRecolhidos'),
    melhor: false,
  })).filter(r => r.regime)
  if (result.length > 0) {
    const max = Math.max(...result.map(r => r.resultadoPosIRCS))
    result.forEach(r => { r.melhor = r.resultadoPosIRCS === max })
  }
  return result
}

function parseComprasNCM(ws: XLSX.WorkSheet): ComprasNCMRow[] {
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: 0 })
  if (!data.length) return []
  const headers = Object.keys(data[0])
  return data.map(row => {
    const ncm = normalizeNcm(getStr(row, headers, 'NCM', 'Ncm', 'ncm'))
    return {
      ncm,
      valorAR:     getNum(row, headers, 'Valor_AR', 'ValorAR'),
      valorDR:     getNum(row, headers, 'Valor_DR', 'ValorDR'),
      cargaARPct:  getPct(row, headers, 'Carga_AR', 'CargaAR'),
      cargaDRPct:  getPct(row, headers, 'Carga_DR', 'CargaDR'),
      custoAR:     getNum(row, headers, 'Custo_AR', 'CustoAR', 'Soma_Custo_AR'),
      custoDR:     getNum(row, headers, 'Custo_DR', 'CustoDR', 'Soma_Custo_DR'),
      isMonofasico: isMonofasico(ncm),
    }
  }).filter(r => r.ncm && r.valorAR > 0)
}

function parseComprasRegime(ws: XLSX.WorkSheet): ComprasRegimeRow[] {
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: 0 })
  if (!data.length) return []
  const headers = Object.keys(data[0])
  return data.map(row => ({
    regime: getStr(row, headers, 'Regime', 'Tributacao', 'Nome'),
    valorAR:getNum(row, headers, 'Valor_AR', 'ValorAR', 'Valor'),
  })).filter(r => r.regime && r.valorAR > 0)
}

function parseComprasFornecedor(ws: XLSX.WorkSheet): ComprasFornecedorRow[] {
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: 0 })
  if (!data.length) return []
  const headers = Object.keys(data[0])
  return data.map(row => ({
    cnpj:           getStr(row, headers, 'CNPJ', 'Cnpj', 'Fornecedor'),
    cargaARPct:     getPct(row, headers, 'Media_Carga_AR', 'CargaARPct'),
    cargaDRPct:     getPct(row, headers, 'Media_Carga_DR', 'CargaDRPct'),
    valorAR:        getNum(row, headers, 'Soma_Valor_AR', 'ValorAR'),
    valorDesonerado:getNum(row, headers, 'Soma_Valor_Desonerado', 'ValorDesonerado'),
    tributosAR:     getNum(row, headers, 'Tributos_AR', 'TributosAR'),
    valorDR:        getNum(row, headers, 'Soma_Valor_DR', 'ValorDR'),
    tributosDR:     getNum(row, headers, 'Tributos_DR', 'TributosDR'),
    custoAR:        getNum(row, headers, 'Soma_Custo_AR', 'CustoAR'),
  })).filter(r => r.cnpj && r.valorAR > 0)
}

function parseComprasCFOP(ws: XLSX.WorkSheet): ComprasCFOPRow[] {
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: 0 })
  if (!data.length) return []
  const headers = Object.keys(data[0])
  return data.map(row => ({
    cfop:           String(getStr(row, headers, 'CFOP', 'Cfop') || getNum(row, headers, 'CFOP', 'Cfop')),
    cargaARPct:     getPct(row, headers, 'Media_Carga_AR', 'CargaARPct'),
    cargaDRPct:     getPct(row, headers, 'Media_Carga_DR', 'CargaDRPct'),
    valorAR:        getNum(row, headers, 'Soma_Valor_AR', 'ValorAR'),
    valorDesonerado:getNum(row, headers, 'Soma_Valor_Desonerado', 'ValorDesonerado'),
    tributosAR:     getNum(row, headers, 'Tributos_AR', 'TributosAR'),
    valorDR:        getNum(row, headers, 'Soma_Valor_DR', 'ValorDR'),
    tributosDR:     getNum(row, headers, 'Tributos_DR', 'TributosDR'),
    diffCusto:      getNum(row, headers, 'Soma_Diff_Custo', 'DiffCusto'),
  })).filter(r => r.cfop && r.valorAR > 0)
}

function parseVendasDetalhe(ws: XLSX.WorkSheet, codigoKeys: string[], isNcm = false): VendasDetalheRow[] {
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: 0 })
  if (!data.length) return []
  const headers = Object.keys(data[0])
  return data.map(row => {
    const raw = getStr(row, headers, ...codigoKeys)
    const codigoBruto = raw || String(getNum(row, headers, ...codigoKeys))
    const codigo = isNcm ? normalizeNcm(codigoBruto) : codigoBruto
    return {
      codigo,
      cargaARPct:    getPct(row, headers, 'Media_Carga_AR', 'Carga_AR'),
      cargaDRPct:    getPct(row, headers, 'Media_Carga_DR', 'Carga_DR'),
      valorAR:       getNum(row, headers, 'Soma_Valor_AR', 'ValorAR'),
      valorDesonerado:getNum(row, headers, 'Soma_Valor_Desonerado', 'ValorDesonerado'),
      tributosAR:    getNum(row, headers, 'Tributos_AR', 'TributosAR'),
      valorDR:       getNum(row, headers, 'Soma_Valor_DR', 'ValorDR'),
      tributosDR:    getNum(row, headers, 'Tributos_DR', 'TributosDR'),
      diffCusto:     getNum(row, headers, 'Soma_Diff_Custo', 'DiffCusto'),
    }
  }).filter(r => r.codigo && r.codigo !== '0' && r.valorAR > 0)
}

// ─── Workbook parser (named sheets + content-based fallback) ──────────────────

type ParsedWB = Omit<AdminReportV2, 'geradoEm'> & { empresa: Partial<EmpresaInfo> }

function emptyParsed(): ParsedWB {
  return {
    empresa: { empresa: '', cnpj: '', regime: '', periodo: '' },
    compras: [], comprasNCM: [], comprasRegime: [], comprasFornecedores: [], comprasCFOP: [], comprasSimples: [], comprasCategorias: [],
    comprasTipoOperacao: [], comprasOrigemUF: [], comprasBeneficio: [], comprasOrigem: [], comprasCST: [], comprasMercadologica: [],
    vendas: [], vendasNCM: [], vendasClientes: [], vendasCFOP: [], vendasRegime: [], vendasB2C: [], vendasCategorias: [], vendasMercadologica: [],
    vendasCount: 0,
    simulador: [], dreProduto: [], margemProdutos: [], simuladorMercadologica: [],
    dre: [], fluxo: [], regimes: [],
  }
}

function somaTributoARDR(a: TributoARDR, b: TributoARDR): TributoARDR {
  return { ar: a.ar + b.ar, dr: a.dr + b.dr }
}

function somaTributoComposicao(a: TributoComposicao, b: TributoComposicao): TributoComposicao {
  return {
    icms:      somaTributoARDR(a.icms, b.icms),
    icmsSt:    somaTributoARDR(a.icmsSt, b.icmsSt),
    icmsDifal: somaTributoARDR(a.icmsDifal, b.icmsDifal),
    iss:       somaTributoARDR(a.iss, b.iss),
    ipi:       somaTributoARDR(a.ipi, b.ipi),
    pisCofins: somaTributoARDR(a.pisCofins, b.pisCofins),
    ibs:       somaTributoARDR(a.ibs, b.ibs),
    cbs:       somaTributoARDR(a.cbs, b.cbs),
    semIva:    somaTributoARDR(a.semIva, b.semIva),
  }
}

function parseWorkbook(wb: XLSX.WorkBook): ParsedWB {
  const result = emptyParsed()

  const findSheet = (...names: string[]) => {
    for (const name of names) {
      const nn = n(name)
      const key = wb.SheetNames.find(s => n(s) === nn || n(s).includes(nn))
      if (key) return { key, ws: wb.Sheets[key] }
    }
    return null
  }

  const matched = new Set<string>()
  const use = (found: { key: string; ws: XLSX.WorkSheet } | null, fn: (ws: XLSX.WorkSheet) => void) => {
    if (found) { matched.add(found.key); fn(found.ws) }
  }

  use(findSheet('Empresa', 'info', 'dados'),          ws => { result.empresa = parseEmpresa(ws) })
  use(findSheet('Compras', 'compra', 'purchases'),     ws => { result.compras = parseCompras(ws) })
  use(findSheet('Vendas', 'venda', 'sales'),           ws => { result.vendas = parseVendas(ws) })
  use(findSheet('DRE', 'resultado', 'financeiro'),     ws => { result.dre = parseDRE(ws) })
  use(findSheet('Fluxo', 'fluxo', 'caixa', 'cash'),   ws => { result.fluxo = parseFluxo(ws) })
  use(findSheet('Regime', 'regime', 'tributacao'),     ws => { result.regimes = parseRegime(ws) })
  use(findSheet('Compras_NCM', 'ComprasNCM'),          ws => { result.comprasNCM = parseComprasNCM(ws) })
  use(findSheet('Compras_Regime', 'ComprasRegime'),    ws => { result.comprasRegime = parseComprasRegime(ws) })
  use(findSheet('Compras_Fornecedor', 'Fornecedores'), ws => { result.comprasFornecedores = parseComprasFornecedor(ws) })
  use(findSheet('Compras_CFOP', 'ComprasCFOP'),        ws => { result.comprasCFOP = parseComprasCFOP(ws) })
  use(findSheet('Vendas_NCM', 'VendasNCM'),            ws => { result.vendasNCM = parseVendasDetalhe(ws, ['NCM', 'Ncm'], true) })
  use(findSheet('Vendas_Cliente', 'VendasCliente'),    ws => { result.vendasClientes = parseVendasDetalhe(ws, ['CNPJ', 'Cnpj', 'Cliente']) })
  use(findSheet('Vendas_CFOP', 'VendasCFOP'),          ws => { result.vendasCFOP = parseVendasDetalhe(ws, ['CFOP', 'Cfop']) })

  // Content-based fallback for unmatched sheets (CSV / generic names)
  for (const name of wb.SheetNames) {
    if (matched.has(name)) continue
    const ws = wb.Sheets[name]
    const type = detectSheetType(ws)

    switch (type) {
      case 'transacoes': {
        const tx = parseRawTransactions(ws)
        result.compras.push(...tx.compras)
        result.vendas.push(...tx.vendas)
        result.comprasNCM.push(...tx.comprasNCM)
        result.comprasRegime.push(...tx.comprasRegime)
        result.comprasFornecedores.push(...tx.comprasFornecedores)
        result.comprasCFOP.push(...tx.comprasCFOP)
        result.comprasSimples.push(...tx.comprasSimples)
        result.vendasNCM.push(...tx.vendasNCM)
        result.vendasClientes.push(...tx.vendasClientes)
        result.vendasCFOP.push(...tx.vendasCFOP)
        result.vendasRegime.push(...tx.vendasRegime)
        result.vendasB2C.push(...tx.vendasB2C)
        result.comprasCategorias.push(...tx.comprasCategorias)
        result.vendasCategorias.push(...tx.vendasCategorias)
        result.comprasTipoOperacao.push(...tx.comprasTipoOperacao)
        result.comprasOrigemUF.push(...tx.comprasOrigemUF)
        result.comprasBeneficio.push(...tx.comprasBeneficio)
        result.comprasOrigem.push(...tx.comprasOrigem)
        result.comprasCST.push(...tx.comprasCST)
        result.vendasCount = (result.vendasCount ?? 0) + tx.vendasCount
        if (tx.tributos) {
          result.tributos = result.tributos
            ? { compras: somaTributoComposicao(result.tributos.compras, tx.tributos.compras), vendas: somaTributoComposicao(result.tributos.vendas, tx.tributos.vendas) }
            : tx.tributos
        }
        if (tx.empresa && !result.empresa.regime) {
          result.empresa = { ...result.empresa, ...tx.empresa }
        }
        break
      }
      case 'empresa':          if (!result.empresa.empresa) result.empresa = parseEmpresa(ws); break
      case 'compras':          result.compras.push(...parseCompras(ws)); break
      case 'vendas':           result.vendas.push(...parseVendas(ws)); break
      case 'dre':              if (!result.dre.length) result.dre = parseDRE(ws); break
      case 'fluxo':            if (!result.fluxo.length) result.fluxo = parseFluxo(ws); break
      case 'regime':           if (!result.regimes.length) result.regimes = parseRegime(ws); break
      case 'comprasNCM':       result.comprasNCM.push(...parseComprasNCM(ws)); break
      case 'comprasRegime':    result.comprasRegime.push(...parseComprasRegime(ws)); break
      case 'comprasFornecedor':result.comprasFornecedores.push(...parseComprasFornecedor(ws)); break
      case 'comprasCFOP':      result.comprasCFOP.push(...parseComprasCFOP(ws)); break
      case 'vendasNCM':        result.vendasNCM.push(...parseVendasDetalhe(ws, ['NCM', 'Ncm'], true)); break
      case 'vendasCliente':    result.vendasClientes.push(...parseVendasDetalhe(ws, ['CNPJ', 'Cnpj', 'Cliente'])); break
      case 'vendasCFOP':       result.vendasCFOP.push(...parseVendasDetalhe(ws, ['CFOP', 'Cfop'])); break
    }
  }

  return result
}

// ─── Planilha mercadológica (classificação real por produto) ──────────────────

/**
 * Extrai codigo_produto → código de Família (lib/merc-categorias.ts) de uma planilha
 * mercadológica real do cliente (ex.: export "LJ 01 - mes 05 - 2028.csv"). É a mesma estrutura
 * de linha de uma planilha de Produtos comum (tipo_movimentacao/valor_ar/valor_dr/etc.), só que
 * com duas colunas extras trazendo a classificação oficial já feita pelo cliente — "Cod Familia"
 * (código pontuado, ex. "1.08.005.001", que bate exatamente com o `codigo` de uma Família em
 * lib/data/estrutura-mercadologica.json) e "Grupo" (descrição, não usada aqui). Isso substitui o
 * palpite por similaridade de texto (lib/merc-classifier.ts) por dado real onde existir.
 * Import é opcional — se as colunas não forem encontradas, devolve mapa vazio (sem erro).
 */
export function parseMercadologicaClassificacao(buffer: Buffer, filename?: string): Record<string, string> {
  const wb = readBuffer(buffer, filename)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: '' })
  if (!data.length) return {}

  const headers = Object.keys(data[0])
  const codigoCol  = findCol(headers, 'codigo_produto')
  const familiaCol = findCol(headers, 'cod_familia', 'codigo_familia')
  if (!codigoCol || !familiaCol) return {}

  // Primeira linha vista por produto vence — mesmo padrão de codigoDescMap em
  // parseRawTransactions (a classificação de um produto não muda linha a linha).
  const mapa: Record<string, string> = {}
  for (const row of data) {
    const codigo  = String(row[codigoCol] ?? '').trim()
    const familia = String(row[familiaCol] ?? '').trim()
    if (!codigo || !familia || mapa[codigo]) continue
    mapa[codigo] = familia
  }
  return mapa
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * @param overridesNCM Correções manuais de categoria mercadológica por NCM
 * (lib/db-admin.ts: getNcmCategoriaOverrides) — têm prioridade sobre a sugestão automática.
 * @param mapaMercadologica codigo_produto → código de Família, vindo de uma planilha
 * mercadológica real e opcional (ver parseMercadologicaClassificacao) — prioridade sobre a
 * sugestão por texto, mas abaixo de uma correção manual (overridesNCM).
 */
export function gerarRelatorioV2(
  buffer: Buffer,
  defaultEmpresa?: Partial<EmpresaInfo>,
  filename?: string,
  overridesNCM?: Record<string, string>,
  mapaMercadologica?: Record<string, string>,
): AdminReportV2 {
  const wb = readBuffer(buffer, filename)
  const parsed = parseWorkbook(wb)

  const base: EmpresaInfo = {
    empresa: defaultEmpresa?.empresa ?? parsed.empresa.empresa ?? '',
    cnpj:    defaultEmpresa?.cnpj    ?? parsed.empresa.cnpj    ?? '',
    regime:  defaultEmpresa?.regime  ?? parsed.empresa.regime  ?? '',
    periodo: defaultEmpresa?.periodo ?? parsed.empresa.periodo ?? new Date().toISOString().slice(0, 7),
  }

  const comprasNCM = parsed.comprasNCM.map(r => ({
    ...r,
    categoriaMercadologica: resolverCategoriaMercadologica(
      r.descricao, overridesNCM?.[r.ncm], r.codigoProduto ? mapaMercadologica?.[r.codigoProduto] : undefined,
    ),
  }))
  const vendasNCM = parsed.vendasNCM.map(r => ({
    ...r,
    categoriaMercadologica: resolverCategoriaMercadologica(
      r.descricao, overridesNCM?.[r.codigo], r.codigoProduto ? mapaMercadologica?.[r.codigoProduto] : undefined,
    ),
  }))

  return {
    empresa:             base,
    geradoEm:            new Date().toISOString(),
    compras:             parsed.compras,
    comprasNCM,
    comprasRegime:       parsed.comprasRegime,
    comprasFornecedores: parsed.comprasFornecedores,
    comprasCFOP:         parsed.comprasCFOP,
    comprasSimples:      parsed.comprasSimples,
    comprasCategorias:   parsed.comprasCategorias,
    comprasTipoOperacao: parsed.comprasTipoOperacao,
    comprasOrigemUF:     parsed.comprasOrigemUF,
    comprasBeneficio:    parsed.comprasBeneficio,
    comprasOrigem:       parsed.comprasOrigem,
    comprasCST:          parsed.comprasCST,
    comprasMercadologica: computeCategoriaMercadologicaRollup(comprasNCM),
    vendas:              parsed.vendas,
    vendasNCM,
    vendasClientes:      parsed.vendasClientes,
    vendasCFOP:          parsed.vendasCFOP,
    vendasRegime:        parsed.vendasRegime,
    vendasB2C:           parsed.vendasB2C,
    vendasCategorias:    parsed.vendasCategorias,
    vendasCount:         parsed.vendasCount,
    vendasMercadologica: computeCategoriaMercadologicaRollup(vendasNCM),
    simulador:           computeSimulador(comprasNCM, vendasNCM),
    dreProduto:          computeDreProduto(comprasNCM, vendasNCM),
    margemProdutos:      computeMargemProdutos(comprasNCM, vendasNCM),
    simuladorMercadologica: computeMargemContribuicaoPorCategoria(computeMargemProdutos(comprasNCM, vendasNCM)),
    dre:                 parsed.dre,
    fluxo:               parsed.fluxo,
    regimes:             parsed.regimes,
    tributos:            parsed.tributos,
  }
}

// ─── Simulador de Preço ───────────────────────────────────────────────────────

export function computeSimulador(comprasNCM: ComprasNCMRow[], vendasNCM: VendasDetalheRow[]): SimuladorRow[] {
  const vendasMap = new Map<string, VendasDetalheRow>()
  for (const v of vendasNCM) vendasMap.set(chaveVenda(v), v)

  const rows: SimuladorRow[] = []
  for (const c of comprasNCM) {
    const venda = vendasMap.get(chaveCompra(c))
    if (!venda || c.custoAR === 0 || c.valorAR === 0) continue

    const vendaAR = venda.valorAR
    const vendaDR = venda.valorDR
    const { custoAR, custoDR } = c
    const resultadoAtual  = vendaAR - custoAR
    const resultadoDR     = vendaDR - custoDR
    const markupAtualPct  = custoAR > 0 ? (resultadoAtual / custoAR) * 100 : 0

    // Margem bruta = (Receita − Custo) ÷ Receita. Margem de contribuição desconta da
    // receita também o tributo que incide na própria venda (ICMS/PIS-COFINS antes,
    // IBS/CBS depois) — não só o custo de aquisição.
    const margemBrutaARPct = vendaAR > 0 ? (resultadoAtual / vendaAR) * 100 : 0
    const margemBrutaDRPct = vendaDR > 0 ? (resultadoDR / vendaDR) * 100 : 0
    const tributoVendaAR = venda.tributosAR ?? 0
    const tributoVendaDR = venda.tributosDR ?? 0
    const margemContribuicaoARPct = vendaAR > 0 ? ((resultadoAtual - tributoVendaAR) / vendaAR) * 100 : 0
    const margemContribuicaoDRPct = vendaDR > 0 ? ((resultadoDR - tributoVendaDR) / vendaDR) * 100 : 0

    // Preço de venda ano a ano pra preservar a receita líquida de hoje (2026), dado o
    // cronograma real de transição — ver simularPrecificacaoAnos. O custo de cada ano
    // segue a mesma curva não-linear entre custoAR/custoDR (ver fracaoTransicaoAnos),
    // usando o mix de tributos/redução do lado da compra.
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
      markupAtualPct, resultadoAtual, resultadoDR,
      margemBrutaARPct, margemBrutaDRPct, margemContribuicaoARPct, margemContribuicaoDRPct,
      categoriaMercadologica: c.categoriaMercadologica ?? venda.categoriaMercadologica,
      projecao,
    })
  }

  return rows
    .sort((a, b) => Math.abs(b.resultadoDR - b.resultadoAtual) - Math.abs(a.resultadoDR - a.resultadoAtual))
}

// ─── Cronograma de transição IBS/CBS (LC 214/2025) ────────────────────────────
// Reproduz fielmente a memória de cálculo de "exemplo de precificação.xlsx" — validado
// célula a célula contra as 4 planilhas de cenário (Tributado x Tributado, Zero x
// Tributado 60%, Tributado x Zero, Zero x Tributado) antes de virar código.
//
// Ideia central: ICMS/ISS somem gradualmente e são substituídos por IBS na MESMA
// proporção (2026-2028: nada muda; 2029-2032: corta 10pp/ano; 2033: salto final pros
// 100%). CBS substitui PIS/COFINS de uma vez só a partir de 2027 (2026 é ano de teste,
// aproximado aqui como inalterado). O preço de venda em cada ano é o necessário pra
// manter constante a receita líquida que o produto já gera hoje (2026).

const ALIQUOTA_PADRAO_BASE = 0.28 // IBS + CBS combinados, alíquota padrão cheia (sem redução)
const IBS_SHARE = 2 / 3 // IBS é 66,67% da alíquota padrão combinada
const CBS_SHARE = 1 / 3 // CBS é 33,33% da alíquota padrão combinada

/** Fração do ICMS/ISS "antes" que ainda incide em cada ano (o resto já virou IBS). */
const ICMS_REMANESCENTE: Record<number, number> = {
  2026: 1, 2027: 1, 2028: 1, 2029: 0.9, 2030: 0.8, 2031: 0.7, 2032: 0.6, 2033: 0,
}
/** Fração da alíquota-padrão de IBS já em vigor em cada ano. */
const IBS_IMPLEMENTADO: Record<number, number> = {
  2026: 0, 2027: 0, 2028: 0, 2029: 0.10, 2030: 0.20, 2031: 0.30, 2032: 0.40, 2033: 1,
}

/** Alíquota-padrão combinada (IBS+CBS) do produto em 2033, dada sua fração de redução
 *  (lib/admin-engine.ts: DetalhesTecnicos.beneficioReducaoFrac — 0 = sem redução, 0.6 =
 *  redução de 60%, 1 = isento). */
function aliquotaPadraoProduto(reducaoFrac: number | undefined): number {
  return ALIQUOTA_PADRAO_BASE * (1 - (reducaoFrac ?? 0))
}

export interface PrecificacaoAno {
  ano: number
  precoVenda: number
  icms: number
  pisCofins: number
  ibs: number
  cbs: number
}

/**
 * Projeta ano a ano (2026-2033) o preço de venda necessário pra manter constante a
 * receita líquida atual do produto, dado o cronograma de transição acima. `precoAtual`
 * é o preço de venda hoje (2026); `icmsAntesFrac`/`pisCofinsAntesFrac` são as alíquotas
 * efetivas atuais do produto (frações 0-1, não pontos percentuais); `reducaoFrac` é a
 * fração de redução de IBS/CBS aplicável (ver aliquotaPadraoProduto).
 */
export function simularPrecificacaoAnos(params: {
  precoAtual: number
  icmsAntesFrac: number
  pisCofinsAntesFrac: number
  reducaoFrac: number | undefined
}): PrecificacaoAno[] {
  const { precoAtual, icmsAntesFrac, pisCofinsAntesFrac } = params
  const aliquotaPadrao = aliquotaPadraoProduto(params.reducaoFrac)
  const ibsAlvo = aliquotaPadrao * IBS_SHARE
  const cbsAlvo = aliquotaPadrao * CBS_SHARE

  // 2026: os valores reais de hoje — ainda nada mudou.
  const icms2026 = precoAtual * icmsAntesFrac
  const pisCofins2026 = (precoAtual - icms2026) * pisCofinsAntesFrac
  const precoSemTributos = precoAtual - icms2026 - pisCofins2026 // receita líquida-alvo, preservada nos próximos anos

  return DRE_ANOS.map(ano => {
    if (ano === 2026) {
      return { ano, precoVenda: precoAtual, icms: icms2026, pisCofins: pisCofins2026, ibs: 0, cbs: 0 }
    }
    const cbs = ano >= 2027 ? cbsAlvo : 0 // CBS substitui o PIS/Cofins cheio a partir de 2027
    const ibs = ibsAlvo * (IBS_IMPLEMENTADO[ano] ?? 0)
    const icmsPct = icmsAntesFrac * (ICMS_REMANESCENTE[ano] ?? 0)
    const icmsEfetivo = icmsPct * (1 + cbs + ibs) // ICMS incide "por dentro", já com IBS/CBS na base
    const precoVenda = icmsEfetivo < 1 ? precoSemTributos / (1 - icmsEfetivo) : precoSemTributos
    return {
      ano, precoVenda,
      icms: precoVenda * icmsEfetivo, pisCofins: 0,
      ibs: precoSemTributos * ibs, cbs: precoSemTributos * cbs,
    }
  })
}

/**
 * Fração (0→1) de "quanto da transição 2026→2033 já foi implementada" em cada ano, pro
 * mix específico de tributos/redução deste produto — deriva de simularPrecificacaoAnos
 * em vez de uma reta genérica, mas sempre bate exatamente 0 em 2026 e 1 em 2033, então dá
 * pra usar como peso de interpolação entre um valor "antes" e um valor "depois" já
 * conhecidos (ex.: custoAR/custoDR), preservando os dois extremos oficiais do relatório.
 */
function fracaoTransicaoAnos(params: {
  icmsAntesFrac: number
  pisCofinsAntesFrac: number
  reducaoFrac: number | undefined
}): Record<number, number> {
  const precificacao = simularPrecificacaoAnos({ precoAtual: 1, ...params })
  const precoAtual = precificacao[0].precoVenda
  const precoFinal = precificacao[precificacao.length - 1].precoVenda
  const gap = precoAtual - precoFinal
  const fracoes: Record<number, number> = {}
  for (const p of precificacao) {
    fracoes[p.ano] = Math.abs(gap) > 1e-9 ? (precoAtual - p.precoVenda) / gap : (IBS_IMPLEMENTADO[p.ano] ?? 1)
  }
  return fracoes
}

export function computeDreProduto(comprasNCM: ComprasNCMRow[], vendasNCM: VendasDetalheRow[]): DreProdutoRow[] {
  const vendasMap = new Map<string, VendasDetalheRow>()
  for (const v of vendasNCM) vendasMap.set(chaveVenda(v), v)

  const rows: DreProdutoRow[] = []
  for (const c of comprasNCM) {
    const venda = vendasMap.get(chaveCompra(c))
    if (!venda || c.valorAR === 0) continue

    const receitaAR = venda.valorAR
    const receitaDR = venda.valorDR
    const custoAR   = c.custoAR
    const custoDR   = c.custoDR
    const resultadoAtual = receitaAR - custoAR
    const resultadoDR    = receitaDR - custoDR

    // Interpola entre os extremos AR/DR já conhecidos usando o formato real do
    // cronograma de transição (não-linear, com o salto final em 2033) em vez de uma
    // reta genérica — compras e vendas cada uma com seu próprio mix de tributos/redução.
    const fracaoCusto = fracaoTransicaoAnos({
      icmsAntesFrac: (c.aliqIcmsARPct ?? 0) / 100,
      pisCofinsAntesFrac: (c.aliqPisCofinsARPct ?? 0) / 100,
      reducaoFrac: c.detalhes?.beneficioReducaoFrac,
    })
    const fracaoReceita = fracaoTransicaoAnos({
      icmsAntesFrac: (venda.aliqIcmsARPct ?? 0) / 100,
      pisCofinsAntesFrac: (venda.aliqPisCofinsARPct ?? 0) / 100,
      reducaoFrac: venda.detalhes?.beneficioReducaoFrac ?? c.detalhes?.beneficioReducaoFrac,
    })

    const projecao = DRE_ANOS.map(ano => {
      const receita = receitaAR + (receitaDR - receitaAR) * (fracaoReceita[ano] ?? 1)
      const custo   = custoAR   + (custoDR   - custoAR)   * (fracaoCusto[ano] ?? 1)
      const resultado = receita - custo
      const margem    = receita > 0 ? (resultado / receita) * 100 : 0
      return { ano, resultado, margem }
    })

    const tributoVendaAR = venda.tributosAR ?? 0
    const tributoVendaDR = venda.tributosDR ?? 0

    rows.push({
      ncm: c.ncm,
      codigoProduto: c.codigoProduto,
      descricao: c.descricao ?? venda.descricao,
      tipo: c.tipo ?? venda.tipo,
      detalhes: c.detalhes ?? venda.detalhes,
      receitaAR, receitaDR, custoAR, custoDR,
      margemBrutaARPct: receitaAR > 0 ? (resultadoAtual / receitaAR) * 100 : 0,
      margemBrutaDRPct: receitaDR > 0 ? (resultadoDR    / receitaDR) * 100 : 0,
      margemContribuicaoARPct: receitaAR > 0 ? ((resultadoAtual - tributoVendaAR) / receitaAR) * 100 : 0,
      margemContribuicaoDRPct: receitaDR > 0 ? ((resultadoDR    - tributoVendaDR) / receitaDR) * 100 : 0,
      categoriaMercadologica: c.categoriaMercadologica ?? venda.categoriaMercadologica,
      resultadoAtual, resultadoDR,
      diffResultado: resultadoDR - resultadoAtual,
      projecao,
      ...baseCalculoCompraVenda(c, venda),
    })
  }

  return rows.sort((a, b) => Math.abs(b.diffResultado) - Math.abs(a.diffResultado))
}

/** Monta os blocos `compra`/`venda` (base de cálculo completa) de um DreProdutoRow a partir
 *  das linhas casadas de comprasNCM/vendasNCM — mesmos dados usados em `computeDreProduto` e
 *  `computeMargemProdutos`, extraídos aqui pra não duplicar entre as duas funções. */
function baseCalculoCompraVenda(c: ComprasNCMRow, venda: VendasDetalheRow): Pick<DreProdutoRow, 'compra' | 'venda'> {
  return {
    compra: { valorAR: c.valorAR, valorDR: c.valorDR, impostosAR: c.impostosAR, impostosDR: c.impostosDR, creditoAR: c.creditoAR, creditoDR: c.creditoDR, tributos: tributoComposicaoFromFlat(c) },
    venda: { valorAR: venda.valorAR, valorDR: venda.valorDR, impostosAR: venda.impostosAR, impostosDR: venda.impostosDR, creditoAR: venda.creditoAR, creditoDR: venda.creditoDR, tributos: tributoComposicaoFromFlat(venda) },
  }
}

/**
 * Substitui, ano a ano, os pontos de projeção sintética (fórmula `REFORMA_TAXA`) pelo valor
 * real "Depois" (DR) de uma planilha realmente importada pra aquele ano — quando existir.
 * `realDataByYear` vem de outros relatórios da MESMA empresa (ver `lib/projecao-real.ts`).
 * Anos sem planilha real, ou onde o NCM não aparece nela (produto novo/descontinuado),
 * mantêm o ponto de fórmula como estava.
 */
export function overlayProjecaoComDadosReais(
  dreProduto: DreProdutoRow[],
  realDataByYear: Map<number, { comprasNCM: ComprasNCMRow[]; vendasNCM: VendasDetalheRow[] }>,
): DreProdutoRow[] {
  // Pré-indexa comprasNCM/vendasNCM de cada ano por chave, uma vez, fora do loop de dreProduto.
  // Antes disso, cada linha de dreProduto fazia um `.find()` linear no array inteiro de
  // compras/vendas do ano, repetido por ano presente em `realDataByYear` — com milhares de
  // produtos e milhares de linhas de compras/vendas, isso é O(produtos × anos × linhas) e era
  // o principal gargalo de tempo ao trocar de ano num relatório grande. Indexado em Map aqui diminui pra O(produtos × anos + anos × linhas).
  const indexByYear = new Map<number, { compras: Map<string, ComprasNCMRow>; vendas: Map<string, VendasDetalheRow> }>()
  for (const [ano, real] of realDataByYear) {
    indexByYear.set(ano, {
      compras: new Map(real.comprasNCM.map(c => [chaveCompra(c), c])),
      vendas: new Map(real.vendasNCM.map(v => [chaveVenda(v), v])),
    })
  }

  return dreProduto.map(row => ({
    ...row,
    projecao: row.projecao.map(p => {
      const idx = indexByYear.get(p.ano)
      if (!idx) return p
      const chave = row.codigoProduto || row.ncm
      const compra = idx.compras.get(chave)
      const venda = idx.vendas.get(chave)
      if (!compra || !venda) return p
      const resultado = venda.valorDR - compra.custoDR
      const margem = venda.valorDR > 0 ? (resultado / venda.valorDR) * 100 : 0
      return { ano: p.ano, resultado, margem, real: true }
    }),
  }))
}

/**
 * Margem bruta por produto/serviço — igual a `computeDreProduto` no universo (os dois
 * devolvem todos os produtos casados, sem corte), mas sem o campo `projecao` (interpolação
 * ano a ano), pra alimentar rankings de "maior/menor margem" e "principais serviços" sem o
 * custo do cálculo de projeção quando ele não é necessário.
 */
export function computeMargemProdutos(comprasNCM: ComprasNCMRow[], vendasNCM: VendasDetalheRow[]): DreProdutoRow[] {
  const vendasMap = new Map<string, VendasDetalheRow>()
  for (const v of vendasNCM) vendasMap.set(chaveVenda(v), v)

  const rows: DreProdutoRow[] = []
  for (const c of comprasNCM) {
    const venda = vendasMap.get(chaveCompra(c))
    if (!venda || c.valorAR === 0) continue

    const receitaAR = venda.valorAR
    const receitaDR = venda.valorDR
    const custoAR   = c.custoAR
    const custoDR   = c.custoDR
    const resultadoAtual = receitaAR - custoAR
    const resultadoDR    = receitaDR - custoDR

    const tributoVendaAR = venda.tributosAR ?? 0
    const tributoVendaDR = venda.tributosDR ?? 0

    rows.push({
      ncm: c.ncm,
      codigoProduto: c.codigoProduto,
      descricao: c.descricao ?? venda.descricao,
      tipo: c.tipo ?? venda.tipo,
      detalhes: c.detalhes ?? venda.detalhes,
      receitaAR, receitaDR, custoAR, custoDR,
      margemBrutaARPct: receitaAR > 0 ? (resultadoAtual / receitaAR) * 100 : 0,
      margemBrutaDRPct: receitaDR > 0 ? (resultadoDR    / receitaDR) * 100 : 0,
      margemContribuicaoARPct: receitaAR > 0 ? ((resultadoAtual - tributoVendaAR) / receitaAR) * 100 : 0,
      margemContribuicaoDRPct: receitaDR > 0 ? ((resultadoDR    - tributoVendaDR) / receitaDR) * 100 : 0,
      categoriaMercadologica: c.categoriaMercadologica ?? venda.categoriaMercadologica,
      resultadoAtual, resultadoDR,
      diffResultado: resultadoDR - resultadoAtual,
      projecao: [],
      ...baseCalculoCompraVenda(c, venda),
    })
  }

  return rows.sort((a, b) => b.margemBrutaDRPct - a.margemBrutaDRPct)
}

/** Margem de contribuição agregada por Seção mercadológica (mesma taxonomia de
 *  lib/merc-categorias.ts) — usa `margemProdutos` (universo completo, não filtrado como o
 *  `simulador`) pra não enviesar a agregação por categoria. Média ponderada pela receita,
 *  igual ao padrão de `computeCategoriaMercadologicaRollup`. */
export function computeMargemContribuicaoPorCategoria(margemProdutos: DreProdutoRow[]): MargemContribuicaoCategoriaRow[] {
  interface Acc { receitaAR: number; receitaDR: number; margemARWSum: number; margemDRWSum: number; count: number }
  const map = new Map<string, Acc>()
  for (const r of margemProdutos) {
    const categoria = r.categoriaMercadologica?.secao ?? 'Não Classificado'
    const acc = map.get(categoria) ?? { receitaAR: 0, receitaDR: 0, margemARWSum: 0, margemDRWSum: 0, count: 0 }
    acc.receitaAR += r.receitaAR
    acc.receitaDR += r.receitaDR
    acc.margemARWSum += r.margemContribuicaoARPct * r.receitaAR
    acc.margemDRWSum += r.margemContribuicaoDRPct * r.receitaDR
    acc.count += 1
    map.set(categoria, acc)
  }
  return Array.from(map.entries()).map(([categoria, a]) => ({
    categoria,
    receitaAR: a.receitaAR,
    receitaDR: a.receitaDR,
    margemContribuicaoARPct: a.receitaAR > 0 ? a.margemARWSum / a.receitaAR : 0,
    margemContribuicaoDRPct: a.receitaDR > 0 ? a.margemDRWSum / a.receitaDR : 0,
    count: a.count,
  })).sort((a, b) => b.receitaDR - a.receitaDR)
}

/**
 * Margem líquida da empresa (Lucro Líquido ÷ Receita Líquida) — só existe quando
 * a planilha DRE importada tem essas duas linhas explicitamente. Diferente da
 * margem bruta por produto (`computeMargemProdutos`), que é sempre calculável a
 * partir das transações de compra/venda.
 */
export function margemLiquidaInsight(dre: DRELinha[]): { arPct: number; drPct: number } | null {
  const lucroLiquido = dre.find(d => n(d.categoria).includes('lucroliquido'))
  const receitaLiquida = dre.find(d => n(d.categoria).includes('receitaliquida'))
  if (!lucroLiquido || !receitaLiquida || (receitaLiquida.ar === 0 && receitaLiquida.anoBase === 0)) return null
  return {
    arPct: receitaLiquida.ar > 0 ? (lucroLiquido.ar / receitaLiquida.ar) * 100 : 0,
    drPct: receitaLiquida.anoBase > 0 ? (lucroLiquido.anoBase / receitaLiquida.anoBase) * 100 : 0,
  }
}

// ─── Merge two reports (Produtos + Serviços) ──────────────────────────────────

export function mergeReports(r1: AdminReportV2, r2: AdminReportV2): AdminReportV2 {
  const empresa: EmpresaInfo = r1.empresa.empresa
    ? r1.empresa
    : r2.empresa.empresa
    ? r2.empresa
    : r1.empresa

  const mergedRegimeMap = new Map<string, number>()
  for (const row of [...r1.comprasRegime, ...r2.comprasRegime]) {
    mergedRegimeMap.set(row.regime, (mergedRegimeMap.get(row.regime) ?? 0) + row.valorAR)
  }

  const mergedVendasRegimeMap = new Map<string, number>()
  for (const row of [...(r1.vendasRegime ?? []), ...(r2.vendasRegime ?? [])]) {
    mergedVendasRegimeMap.set(row.regime, (mergedVendasRegimeMap.get(row.regime) ?? 0) + row.valorAR)
  }

  const mergedB2CMap = new Map<'B2B' | 'B2C', VendasB2CRow>()
  for (const row of [...(r1.vendasB2C ?? []), ...(r2.vendasB2C ?? [])]) {
    const existing = mergedB2CMap.get(row.tipo)
    if (existing) {
      const totalAR = existing.valorAR + row.valorAR
      const totalDR = existing.valorDR + row.valorDR
      mergedB2CMap.set(row.tipo, {
        tipo: row.tipo,
        valorAR: totalAR,
        valorDR: totalDR,
        cargaARPct: totalAR > 0 ? (existing.cargaARPct * existing.valorAR + row.cargaARPct * row.valorAR) / totalAR : 0,
        cargaDRPct: totalDR > 0 ? (existing.cargaDRPct * existing.valorDR + row.cargaDRPct * row.valorDR) / totalDR : 0,
        diffCusto: existing.diffCusto + row.diffCusto,
        count: existing.count + row.count,
      })
    } else {
      mergedB2CMap.set(row.tipo, { ...row })
    }
  }

  const mergedSimplesCNPJMap = new Map<string, ComprasSimplesRow>()
  for (const row of [...(r1.comprasSimples ?? []), ...(r2.comprasSimples ?? [])]) {
    const existing = mergedSimplesCNPJMap.get(row.cnpj)
    if (existing) {
      const ncmMap = new Map<string, { valorAR: number; descricao?: string }>()
      for (const n of [...existing.ncms, ...row.ncms]) {
        const cur = ncmMap.get(n.ncm)
        ncmMap.set(n.ncm, { valorAR: (cur?.valorAR ?? 0) + n.valorAR, descricao: cur?.descricao ?? n.descricao })
      }
      mergedSimplesCNPJMap.set(row.cnpj, {
        cnpj: row.cnpj,
        valorAR: existing.valorAR + row.valorAR,
        pctTotalCompras: existing.pctTotalCompras + row.pctTotalCompras,
        ncms: Array.from(ncmMap.entries()).map(([ncm, v]) => ({ ncm, valorAR: v.valorAR, descricao: v.descricao })).sort((a, b) => b.valorAR - a.valorAR).slice(0, 5),
      })
    } else {
      mergedSimplesCNPJMap.set(row.cnpj, { ...row })
    }
  }

  // Merge categorias by key
  function mergeCat(a: CategoriaRow[], b: CategoriaRow[]): CategoriaRow[] {
    const m = new Map<string, CategoriaRow>()
    for (const r of [...a, ...b]) {
      const ex = m.get(r.categoria)
      if (!ex) { m.set(r.categoria, { ...r }); continue }
      const totalAR = ex.valorAR + r.valorAR || 1
      const totalDR = ex.valorDR + r.valorDR || 1
      m.set(r.categoria, {
        categoria:  r.categoria,
        valorAR:    ex.valorAR   + r.valorAR,
        valorDR:    ex.valorDR   + r.valorDR,
        custoAR:    ex.custoAR   + r.custoAR,
        custoDR:    ex.custoDR   + r.custoDR,
        cargaARPct: (ex.cargaARPct * ex.valorAR + r.cargaARPct * r.valorAR) / totalAR,
        cargaDRPct: (ex.cargaDRPct * ex.valorDR + r.cargaDRPct * r.valorDR) / totalDR,
        diffCusto:  ex.diffCusto + r.diffCusto,
        valorDesonerado: (ex.valorDesonerado ?? 0) + (r.valorDesonerado ?? 0),
        count:      ex.count     + r.count,
      })
    }
    return Array.from(m.values()).sort((a, b) => b.valorAR - a.valorAR)
  }

  const mergedComprasNCM = [...r1.comprasNCM, ...r2.comprasNCM]
  const mergedVendasNCM  = [...r1.vendasNCM,  ...r2.vendasNCM]

  return {
    empresa,
    geradoEm:            new Date().toISOString(),
    compras:             [...r1.compras,             ...r2.compras],
    comprasNCM:          mergedComprasNCM,
    comprasRegime:       Array.from(mergedRegimeMap.entries()).map(([regime, valorAR]) => ({ regime, valorAR })),
    comprasFornecedores: [...r1.comprasFornecedores, ...r2.comprasFornecedores],
    comprasCFOP:         [...r1.comprasCFOP,         ...r2.comprasCFOP],
    comprasSimples:      Array.from(mergedSimplesCNPJMap.values()),
    comprasCategorias:   mergeCat(r1.comprasCategorias ?? [], r2.comprasCategorias ?? []),
    comprasTipoOperacao: mergeCat(r1.comprasTipoOperacao ?? [], r2.comprasTipoOperacao ?? []),
    comprasOrigemUF:     mergeCat(r1.comprasOrigemUF ?? [], r2.comprasOrigemUF ?? []),
    comprasBeneficio:    mergeCat(r1.comprasBeneficio ?? [], r2.comprasBeneficio ?? []),
    comprasOrigem:       mergeCat(r1.comprasOrigem ?? [], r2.comprasOrigem ?? []),
    comprasCST:          mergeCat(r1.comprasCST ?? [], r2.comprasCST ?? []),
    comprasMercadologica: mergeCat(r1.comprasMercadologica ?? [], r2.comprasMercadologica ?? []),
    vendas:              [...r1.vendas,              ...r2.vendas],
    vendasNCM:           mergedVendasNCM,
    vendasClientes:      [...r1.vendasClientes,      ...r2.vendasClientes],
    vendasCFOP:          [...r1.vendasCFOP,          ...r2.vendasCFOP],
    vendasRegime:        Array.from(mergedVendasRegimeMap.entries()).map(([regime, valorAR]) => ({ regime, valorAR })),
    vendasB2C:           Array.from(mergedB2CMap.values()),
    vendasCategorias:    mergeCat(r1.vendasCategorias ?? [], r2.vendasCategorias ?? []),
    vendasCount:         (r1.vendasCount ?? 0) + (r2.vendasCount ?? 0),
    vendasMercadologica: mergeCat(r1.vendasMercadologica ?? [], r2.vendasMercadologica ?? []),
    simulador:           computeSimulador(mergedComprasNCM, mergedVendasNCM),
    dreProduto:          computeDreProduto(mergedComprasNCM, mergedVendasNCM),
    margemProdutos:      computeMargemProdutos(mergedComprasNCM, mergedVendasNCM),
    simuladorMercadologica: computeMargemContribuicaoPorCategoria(computeMargemProdutos(mergedComprasNCM, mergedVendasNCM)),
    dre:                 r1.dre.length    ? r1.dre    : r2.dre,
    fluxo:               r1.fluxo.length  ? r1.fluxo  : r2.fluxo,
    regimes:             r1.regimes.length ? r1.regimes : r2.regimes,
    tributos:            r1.tributos && r2.tributos
      ? { compras: somaTributoComposicao(r1.tributos.compras, r2.tributos.compras), vendas: somaTributoComposicao(r1.tributos.vendas, r2.tributos.vendas) }
      : (r1.tributos ?? r2.tributos),
  }
}

// ─── Debug ────────────────────────────────────────────────────────────────────

export function getWorkbookDebugInfo(buffer: Buffer, filename?: string): string {
  try {
    const wb = readBuffer(buffer, filename)
    return wb.SheetNames.map(name => {
      const ws = wb.Sheets[name]
      const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: '' })
      const tipo = detectSheetType(ws)
      if (!data.length) return `"${name}" [0 linhas, tipo: ${tipo}]: (vazio)`
      const headers = Object.keys(data[0])
      const sample = data[0]
      const sampleStr = headers.slice(0, 10).map(h => `${h}=${JSON.stringify(sample[h])}`).join(' | ')
      return `"${name}" [${data.length} linhas, tipo: ${tipo}]\nColunas (${headers.length}): ${headers.join(' | ')}\nAmostra: ${sampleStr}`
    }).join('\n\n')
  } catch (e) {
    return `Erro ao ler arquivo: ${String(e)}`
  }
}

// ─── Computed Insights ────────────────────────────────────────────────────────

export function comprasInsight(compras: CompraCategoria[]) {
  const totalCustoAR = compras.reduce((s, c) => s + c.custoAR, 0)
  const totalCustoDR = compras.reduce((s, c) => s + c.custoDR, 0)
  const diff = totalCustoDR - totalCustoAR
  const pct = totalCustoAR > 0 ? (diff / totalCustoAR) * 100 : 0
  return { diff, pct, totalAR: totalCustoAR, totalDR: totalCustoDR }
}

export function vendasInsight(vendas: VendaCategoria[]) {
  const totalAR = vendas.reduce((s, v) => s + v.valorAR, 0)
  const totalDR = vendas.reduce((s, v) => s + v.valorDR, 0)
  const diff = totalDR - totalAR
  const pct = totalAR > 0 ? (diff / totalAR) * 100 : 0
  return { diff, pct, totalAR, totalDR }
}

/**
 * Impacto real da reforma nas vendas, líquido de imposto (valor - impostos), em vez do valor
 * bruto vendido (`vendasInsight`, usado pro card "Receita Total" — o preço cobrado do cliente
 * não muda por causa da reforma, só a carga tributária embutida). Usado especificamente pelo
 * card "Vendas em Alta/Queda" do resumo executivo, que é sobre impacto financeiro, não receita
 * bruta — sem isso o diff sempre dava ~0 (valorAR ≈ valorDR linha a linha) e o card nunca
 * mudava de ano pra ano.
 */
export function vendasImpactoInsight(vendas: VendaCategoria[]) {
  const totalAR = vendas.reduce((s, v) => s + (v.valorAR - v.impostosAR), 0)
  const totalDR = vendas.reduce((s, v) => s + (v.valorDR - v.impostosDR), 0)
  const diff = totalDR - totalAR
  const pct = totalAR > 0 ? (diff / totalAR) * 100 : 0
  return { diff, pct, totalAR, totalDR }
}

export function dreInsight(dre: DRELinha[]) {
  const ll = dre.find(d => n(d.categoria).includes('lucroliquido') || n(d.categoria).includes('lucroliqui'))
  return ll ? { diffRS: ll.diffRS, diffPct: ll.diffPct, ar: ll.ar, anoBase: ll.anoBase } : null
}

export function fluxoInsight(fluxo: FluxoLinha[]) {
  const resultado = fluxo.find(f => n(f.categoria).includes('resultado'))
  return resultado ? { diffRS: resultado.diffRS, diffPct: resultado.diffPct, ar: resultado.ar, dr: resultado.dr } : null
}

export const DRE_ANOS_LIST = DRE_ANOS

// ─── Resumo por período (empresas / comparativo histórico) ───────────────────

export interface ResumoPeriodo {
  custoAR: number; custoDR: number
  receitaAR: number; receitaDR: number
  resultadoAR: number; resultadoDR: number
  impostosAR: number; impostosDR: number
  valorTotalAR: number; valorTotalDR: number
  cargaTributariaARPct: number; cargaTributariaDRPct: number
}

/** Extrai um resumo compacto de um relatório completo — reaproveita os *Insight já existentes. */
export function resumoPeriodo(report: AdminReportV2): ResumoPeriodo {
  const c = comprasInsight(report.compras)
  const v = vendasInsight(report.vendas)
  const impostosAR = report.compras.reduce((s, x) => s + x.impostosAR, 0) + report.vendas.reduce((s, x) => s + x.impostosAR, 0)
  const impostosDR = report.compras.reduce((s, x) => s + x.impostosDR, 0) + report.vendas.reduce((s, x) => s + x.impostosDR, 0)
  const valorTotalAR = report.compras.reduce((s, x) => s + x.valorAR, 0) + report.vendas.reduce((s, x) => s + x.valorAR, 0)
  const valorTotalDR = report.compras.reduce((s, x) => s + x.valorDR, 0) + report.vendas.reduce((s, x) => s + x.valorDR, 0)
  return {
    custoAR: c.totalAR, custoDR: c.totalDR,
    receitaAR: v.totalAR, receitaDR: v.totalDR,
    resultadoAR: v.totalAR - c.totalAR, resultadoDR: v.totalDR - c.totalDR,
    impostosAR, impostosDR,
    valorTotalAR, valorTotalDR,
    cargaTributariaARPct: valorTotalAR > 0 ? (impostosAR / valorTotalAR) * 100 : 0,
    cargaTributariaDRPct: valorTotalDR > 0 ? (impostosDR / valorTotalDR) * 100 : 0,
  }
}

export type Granularidade = 'mensal' | 'trimestral' | 'semestral' | 'anual'

export interface PeriodoAgrupado {
  chave: string
  label: string
  resumo: ResumoPeriodo
  qtdRelatorios: number
}

/** Extrai o ano (número) de um `periodo` no formato "AAAA-MM". */
export function anoDoPeriodo(periodoYYYYMM: string): number {
  return Number(periodoYYYYMM.split('-')[0])
}

function chavePeriodo(periodoYYYYMM: string, gran: Granularidade): { chave: string; label: string } {
  const [anoStr, mesStr] = periodoYYYYMM.split('-')
  const ano = Number(anoStr), mes = Number(mesStr)
  if (!ano || !mes) return { chave: periodoYYYYMM || 'sem-período', label: periodoYYYYMM || 'Sem período' }
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  if (gran === 'mensal') return { chave: periodoYYYYMM, label: `${MESES[mes - 1]}/${ano}` }
  if (gran === 'trimestral') { const t = Math.ceil(mes / 3); return { chave: `${ano}-T${t}`, label: `T${t} ${ano}` } }
  if (gran === 'semestral') { const s = mes <= 6 ? 1 : 2; return { chave: `${ano}-S${s}`, label: `S${s} ${ano}` } }
  return { chave: String(ano), label: String(ano) }
}

/**
 * Agrupa resumos mensais em trimestres/semestres/anos — soma métricas de fluxo
 * (custo, receita, resultado, impostos, valor total são valores de período, somam
 * corretamente) e recalcula percentuais de carga tributária a partir dos valores
 * somados (nunca faz média simples de percentual já calculado).
 */
export function agruparPorPeriodo(
  itens: { periodo: string; resumo: ResumoPeriodo }[],
  granularidade: Granularidade,
): PeriodoAgrupado[] {
  const map = new Map<string, { label: string; soma: Omit<ResumoPeriodo, 'cargaTributariaARPct' | 'cargaTributariaDRPct'>; count: number }>()

  for (const { periodo, resumo } of itens) {
    const { chave, label } = chavePeriodo(periodo, granularidade)
    const ex = map.get(chave)?.soma ?? {
      custoAR: 0, custoDR: 0, receitaAR: 0, receitaDR: 0, resultadoAR: 0, resultadoDR: 0,
      impostosAR: 0, impostosDR: 0, valorTotalAR: 0, valorTotalDR: 0,
    }
    ex.custoAR += resumo.custoAR; ex.custoDR += resumo.custoDR
    ex.receitaAR += resumo.receitaAR; ex.receitaDR += resumo.receitaDR
    ex.resultadoAR += resumo.resultadoAR; ex.resultadoDR += resumo.resultadoDR
    ex.impostosAR += resumo.impostosAR; ex.impostosDR += resumo.impostosDR
    ex.valorTotalAR += resumo.valorTotalAR; ex.valorTotalDR += resumo.valorTotalDR
    const count = (map.get(chave)?.count ?? 0) + 1
    map.set(chave, { label, soma: ex, count })
  }

  return Array.from(map.entries())
    .map(([chave, { label, soma, count }]) => ({
      chave,
      label,
      qtdRelatorios: count,
      resumo: {
        ...soma,
        cargaTributariaARPct: soma.valorTotalAR > 0 ? (soma.impostosAR / soma.valorTotalAR) * 100 : 0,
        cargaTributariaDRPct: soma.valorTotalDR > 0 ? (soma.impostosDR / soma.valorTotalDR) * 100 : 0,
      },
    }))
    .sort((a, b) => a.chave.localeCompare(b.chave))
}
