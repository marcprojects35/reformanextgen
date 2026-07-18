'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { Search } from 'lucide-react'
import type { SimuladorRow, DreProdutoRow, DRELinha } from '@/lib/admin-engine'
import { margemLiquidaInsight } from '@/lib/admin-engine'
import { normalizeSearch } from '@/lib/utils'
import { GAIN, LOSS, ChartTooltip, ACTIVE_BAR } from '@/lib/admin-colors'
import { useDrillDown, buildDetalhesExtra, DrillMoreRow, type DrillColumn, type DrillContent } from '@/components/admin/drill-down'
import { ClickableTick } from '@/components/admin/clickable-tick'
import { Explain, ExplainRow } from '@/components/admin/explain-tooltip'

// ─── Formatters ───────────────────────────────────────────────────────────────

const R$ = (n: number, digits = 2) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)

function pct(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

// ─── Ano da transição ──────────────────────────────────────────────────────────

const ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

function getAnoValues(row: SimuladorRow, ano: number) {
  return row.projecao?.find(p => p.ano === ano) ?? { precoVenda: row.valorVendaAR, resultado: row.resultadoAtual, markupPct: row.markupAtualPct }
}

const PROJECAO_COLUMNS: DrillColumn[] = [
  { key: 'ano', label: 'Ano' },
  { key: 'precoVenda', label: 'Preço Venda', format: 'currency' },
  { key: 'markupPct', label: 'Markup', format: 'percent' },
  { key: 'resultado', label: 'Margem Bruta', format: 'currency' },
]

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ simulador, ano }: { simulador: SimuladorRow[]; ano: number }) {
  if (!simulador.length) return null

  const avgMarkupAtual = simulador.reduce((s, r) => s + r.markupAtualPct, 0) / simulador.length

  const anoVals = simulador.map(r => getAnoValues(r, ano))
  const avgMarkupAno = anoVals.reduce((s, v) => s + v.markupPct, 0) / anoVals.length

  const markupDeltaFromAtual = avgMarkupAno - avgMarkupAtual

  return (
    <Explain text="Markup é quanto você soma sobre o custo pra chegar no preço de venda." className="block">
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="rounded-2xl border border-border bg-foreground/[0.025] p-4">
        <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">Markup Atual (2026)</p>
        <p className="text-2xl font-bold text-foreground font-tabular">{pct(avgMarkupAtual)}</p>
        <p className="text-xs text-foreground/30 mt-1">margem média sobre custo</p>
      </div>
      <div className={`rounded-2xl border p-4 ${
        markupDeltaFromAtual >= 0
          ? 'border-gain/20 bg-gain/[0.03]'
          : 'border-primary/20 bg-primary/[0.03]'
      }`}>
        <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">
          Markup em {ano}
        </p>
        <p className={`text-2xl font-bold font-tabular ${
          markupDeltaFromAtual >= 0 ? 'text-gain' : 'text-primary'
        }`}>
          {pct(avgMarkupAno)}
        </p>
        <p className="text-xs text-foreground/30 mt-1">
          {markupDeltaFromAtual >= 0 ? '+' : ''}{pct(markupDeltaFromAtual)} vs. atual
        </p>
      </div>
    </div>
    </Explain>
  )
}

// ─── Margem bruta / contribuição (cards) ───────────────────────────────────────
// Médias ponderadas pela receita, calculadas sobre `margemProdutos` (universo completo
// casado compra+venda, não o `simulador` que descarta linhas com custoAR/valorAR zerado).

function MargemCards({ margemProdutos, dre }: { margemProdutos: DreProdutoRow[]; dre: DRELinha[] }) {
  if (!margemProdutos.length) return null

  const totalReceitaAR = margemProdutos.reduce((s, r) => s + r.receitaAR, 0) || 1
  const totalReceitaDR = margemProdutos.reduce((s, r) => s + r.receitaDR, 0) || 1
  const margemBrutaARPct = margemProdutos.reduce((s, r) => s + r.margemBrutaARPct * r.receitaAR, 0) / totalReceitaAR
  const margemBrutaDRPct = margemProdutos.reduce((s, r) => s + r.margemBrutaDRPct * r.receitaDR, 0) / totalReceitaDR
  const margemContribuicaoARPct = margemProdutos.reduce((s, r) => s + r.margemContribuicaoARPct * r.receitaAR, 0) / totalReceitaAR
  const margemContribuicaoDRPct = margemProdutos.reduce((s, r) => s + r.margemContribuicaoDRPct * r.receitaDR, 0) / totalReceitaDR
  const margemLiquida = margemLiquidaInsight(dre)

  const CARD = (label: string, value: number, baseline: number, sub: string) => {
    const melhora = value >= baseline
    return (
      <div className={`rounded-2xl border p-4 ${melhora ? 'border-gain/20 bg-gain/[0.03]' : 'border-loss/20 bg-loss/[0.03]'}`}>
        <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">{label}</p>
        <p className={`text-2xl font-bold font-tabular ${melhora ? 'text-gain' : 'text-loss'}`}>{pct(value)}</p>
        <p className="text-xs text-foreground/30 mt-1">{sub}</p>
      </div>
    )
  }

  return (
    <Explain text="Margem Bruta é (receita − custo) ÷ receita. Margem de Contribuição vai além: também desconta da receita o tributo que incide na própria venda (ICMS/PIS-COFINS antes, IBS/CBS depois). Margem Líquida é a margem final da empresa (Lucro Líquido ÷ Receita Líquida), vinda direto da sua DRE importada — só aparece quando a planilha tem essas duas linhas." className="block">
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
      <div className="rounded-2xl border border-border bg-foreground/[0.025] p-4">
        <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">Margem Bruta (Antes)</p>
        <p className="text-2xl font-bold text-foreground font-tabular">{pct(margemBrutaARPct)}</p>
        <p className="text-xs text-foreground/30 mt-1">(receita − custo) ÷ receita</p>
      </div>
      {CARD('Margem Bruta (Depois)', margemBrutaDRPct, margemBrutaARPct, `${margemBrutaDRPct >= margemBrutaARPct ? '+' : ''}${pct(margemBrutaDRPct - margemBrutaARPct)} vs. antes`)}
      <div className="rounded-2xl border border-border bg-foreground/[0.025] p-4">
        <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">Margem Contribuição (Antes)</p>
        <p className="text-2xl font-bold text-foreground font-tabular">{pct(margemContribuicaoARPct)}</p>
        <p className="text-xs text-foreground/30 mt-1">(receita − custo − tributo venda) ÷ receita</p>
      </div>
      {CARD('Margem Contribuição (Depois)', margemContribuicaoDRPct, margemContribuicaoARPct, `${margemContribuicaoDRPct >= margemContribuicaoARPct ? '+' : ''}${pct(margemContribuicaoDRPct - margemContribuicaoARPct)} vs. antes`)}
      {margemLiquida && (
        <>
          <div className="rounded-2xl border border-border bg-foreground/[0.025] p-4">
            <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">Margem Líquida (Antes)</p>
            <p className="text-2xl font-bold text-foreground font-tabular">{pct(margemLiquida.arPct)}</p>
            <p className="text-xs text-foreground/30 mt-1">lucro líquido ÷ receita líquida</p>
          </div>
          {CARD('Margem Líquida (Depois)', margemLiquida.drPct, margemLiquida.arPct, `${margemLiquida.drPct >= margemLiquida.arPct ? '+' : ''}${pct(margemLiquida.drPct - margemLiquida.arPct)} vs. antes`)}
        </>
      )}
    </div>
    </Explain>
  )
}

// ─── Maior / menor margem bruta e de contribuição entre os produtos ───────────
// Complementa os cartões de média ponderada (MargemCards) apontando qual produto
// especificamente puxa cada extremo — mesmo universo `margemProdutos` (não filtrado
// como o `simulador`), valores "Depois da Reforma".

function ProdutoExtremoCard({ label, produto, valor, isGain, onClick }: {
  label: string
  produto: DreProdutoRow
  valor: number
  isGain: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition hover:border-foreground/20 ${
        isGain ? 'border-gain/20 bg-gain/[0.03]' : 'border-loss/20 bg-loss/[0.03]'
      }`}
    >
      <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">{label}</p>
      <p className={`text-2xl font-bold font-tabular ${isGain ? 'text-gain' : 'text-loss'}`}>{pct(valor)}</p>
      <p className="mt-1 truncate text-xs text-foreground/40" title={produto.descricao || `NCM ${produto.ncm}`}>
        {produto.descricao || `NCM ${produto.ncm}`}
      </p>
    </button>
  )
}

function MargemExtremos({ margemProdutos }: { margemProdutos: DreProdutoRow[] }) {
  const { open } = useDrillDown()
  if (!margemProdutos.length) return null

  const porBruta = [...margemProdutos].sort((a, b) => b.margemBrutaDRPct - a.margemBrutaDRPct)
  const maiorBruta = porBruta[0]
  const menorBruta = porBruta[porBruta.length - 1]

  const porContribuicao = [...margemProdutos].sort((a, b) => b.margemContribuicaoDRPct - a.margemContribuicaoDRPct)
  const maiorContribuicao = porContribuicao[0]
  const menorContribuicao = porContribuicao[porContribuicao.length - 1]

  function abrir(p: DreProdutoRow) {
    open(margemContribuicaoDrillContent(p))
  }

  return (
    <Explain text="Aponta, entre todos os produtos casados (compra + venda), qual tem a maior e a menor margem — Bruta é (receita − custo) ÷ receita; de Contribuição (a 'margem líquida' do produto) também desconta o tributo que incide na própria venda. Valores já 'Depois da Reforma'." className="block">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <ProdutoExtremoCard label="Maior Margem Bruta" produto={maiorBruta} valor={maiorBruta.margemBrutaDRPct} isGain onClick={() => abrir(maiorBruta)} />
      <ProdutoExtremoCard label="Menor Margem Bruta" produto={menorBruta} valor={menorBruta.margemBrutaDRPct} isGain={false} onClick={() => abrir(menorBruta)} />
      <ProdutoExtremoCard label="Maior Margem de Contribuição (Líquida)" produto={maiorContribuicao} valor={maiorContribuicao.margemContribuicaoDRPct} isGain onClick={() => abrir(maiorContribuicao)} />
      <ProdutoExtremoCard label="Menor Margem de Contribuição (Líquida)" produto={menorContribuicao} valor={menorContribuicao.margemContribuicaoDRPct} isGain={false} onClick={() => abrir(menorContribuicao)} />
    </div>
    </Explain>
  )
}

// ─── Produtos que mais aumentam / reduzem a margem de contribuição (tornado) ──
// Mesmo padrão de ImpactoProduto (impacto-produto.tsx): universo completo de produtos
// casados (`margemProdutos`, não filtrado como o `simulador`), diverging bar chart, clique abre o detalhe.

function shortLabel(s: string, max = 18): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

// Chave real da linha — codigo_produto quando presente, senão o NCM. Várias linhas podem
// compartilhar o mesmo NCM (produtos diferentes sob a mesma classificação fiscal), então
// usar só o NCM como key/dataKey do eixo colide (React key duplicada, categoria de eixo duplicada).
function chave(row: { ncm: string; codigoProduto?: string }): string {
  return row.codigoProduto || row.ncm
}

function margemContribuicaoDrillContent(r: DreProdutoRow): DrillContent {
  const delta = r.margemContribuicaoDRPct - r.margemContribuicaoARPct
  return {
    title: r.descricao || 'Produto sem descrição',
    subtitle: r.categoriaMercadologica?.secao,
    accentColor: delta >= 0 ? GAIN : LOSS,
    columns: [
      { key: 'metrica', label: 'Métrica' },
      { key: 'ar', label: 'Antes', format: 'percent' },
      { key: 'dr', label: 'Depois', format: 'percent' },
    ],
    rows: [
      { metrica: 'Margem Bruta', ar: r.margemBrutaARPct, dr: r.margemBrutaDRPct },
      { metrica: 'Margem de Contribuição', ar: r.margemContribuicaoARPct, dr: r.margemContribuicaoDRPct },
    ],
    extra: { title: 'Detalhes técnicos da planilha', items: buildDetalhesExtra(r.detalhes) },
  }
}


// ─── Table ────────────────────────────────────────────────────────────────────

const TABLE_INITIAL_COUNT = 10

function SimuladorTable({ simulador, ano }: { simulador: SimuladorRow[]; ano: number }) {
  const { open } = useDrillDown()
  const rows = simulador.slice(0, TABLE_INITIAL_COUNT)
  const th = 'px-2.5 py-2 text-right text-xs font-medium text-foreground/25 whitespace-nowrap'
  const td = 'px-2.5 py-1.5 text-right text-sm text-foreground/55 whitespace-nowrap font-tabular'

  function abrirDetalhe(row: SimuladorRow) {
    open({
      title: row.descricao || 'Produto sem descrição',
      subtitle: 'Preço de venda necessário pra manter a receita líquida de 2026, ano a ano',
      columns: PROJECAO_COLUMNS,
      rows: row.projecao ?? [],
      extra: { title: 'Detalhes técnicos da planilha', items: buildDetalhesExtra(row.detalhes) },
    })
  }

  const todosContent: DrillContent = {
    title: 'Todos os produtos',
    subtitle: `${simulador.length} produtos analisados`,
    wide: true,
    columns: [
      { key: 'produto', label: 'Produto' },
      { key: 'ncm', label: 'NCM', mono: true },
      { key: 'custoAr', label: 'Custo AR', format: 'currency' },
      { key: 'custoDr', label: 'Custo DR', format: 'currency' },
      { key: 'markupAtual', label: 'Markup Atual', format: 'percent' },
      { key: 'margemBruta', label: 'Margem Bruta', format: 'percent' },
      { key: 'margemContribuicao', label: 'Margem Contribuição', format: 'percent' },
    ],
    rows: simulador.map(row => ({
      produto: row.descricao || 'Produto sem descrição',
      ncm: row.ncm,
      custoAr: row.custoAR,
      custoDr: row.custoDR,
      markupAtual: row.markupAtualPct,
      margemBruta: row.margemBrutaDRPct,
      margemContribuicao: row.margemContribuicaoDRPct,
    })),
  }

  return (
    <div className="rounded-2xl border border-border bg-popover overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-foreground/[0.015]">
              <th className="px-2.5 py-2 text-left text-xs font-medium text-foreground/25 whitespace-nowrap sticky left-0 bg-popover">Produto</th>
              <th className={th}>NCM</th>
              <th className={th}>Custo AR</th>
              <th className={th}>Custo DR</th>
              <th className={th}>Preço Venda AR</th>
              <th className={th}>Preço Venda DR</th>
              <th className={th}>Markup Atual</th>
              <th className={th}>Margem Bruta</th>
              <th className={th}>Margem Contribuição</th>
              <th className={`${th} border-l border-primary/20`}>Preço Venda ({ano})</th>
              <th className={th}>Resultado ({ano})</th>
              <th className={th}>Markup ({ano})</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-2.5 py-8 text-center text-sm text-foreground/25">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
            {rows.map((row, i) => {
              const av = getAnoValues(row, ano)

              return (
                <ExplainRow
                  key={chave(row) + i}
                  onClick={() => abrirDetalhe(row)}
                  text="Clique na linha pra ver a projeção de preço, resultado e markup ano a ano (2026-2033) deste produto."
                  className="border-b border-border"
                >
                  <td className="px-2.5 py-1.5 text-sm sticky left-0 bg-popover max-w-[220px]">
                    <p className="truncate text-foreground/70" title={row.descricao || 'Produto sem descrição'}>
                      {row.descricao || 'Produto sem descrição'}
                    </p>
                  </td>
                  <td className="px-2.5 py-1.5 text-right text-xs font-mono text-foreground/40 whitespace-nowrap">{row.ncm}</td>
                  <td className={td}>{R$(row.custoAR)}</td>
                  <td className={`${td} ${row.custoDR < row.custoAR ? 'text-gain/80' : row.custoDR > row.custoAR ? 'text-loss/80' : ''}`}>
                    {R$(row.custoDR)}
                  </td>
                  <td className={td}>{R$(row.valorVendaAR)}</td>
                  <td className={td}>{R$(row.valorVendaDR)}</td>
                  <td className="px-2.5 py-1.5 text-right text-sm text-foreground/55 whitespace-nowrap font-tabular">
                    {pct(row.markupAtualPct)}
                  </td>
                  <td className={`px-2.5 py-1.5 text-right text-sm whitespace-nowrap font-tabular ${
                    row.margemBrutaDRPct >= row.margemBrutaARPct ? 'text-gain' : 'text-loss'
                  }`}>
                    {pct(row.margemBrutaDRPct)}
                  </td>
                  <td className={`px-2.5 py-1.5 text-right text-sm whitespace-nowrap font-tabular ${
                    row.margemContribuicaoDRPct >= row.margemContribuicaoARPct ? 'text-gain' : 'text-loss'
                  }`}>
                    {pct(row.margemContribuicaoDRPct)}
                  </td>
                  <td className={`px-2.5 py-1.5 text-right text-sm text-foreground/70 whitespace-nowrap font-tabular border-l border-primary/10`}>
                    {R$(av.precoVenda)}
                  </td>
                  <td className={`px-2.5 py-1.5 text-right text-sm whitespace-nowrap font-tabular font-semibold ${
                    av.resultado >= row.resultadoAtual ? 'text-gain' : 'text-loss'
                  }`}>
                    {R$(av.resultado)}
                  </td>
                  <td className={`px-2.5 py-1.5 text-right text-sm whitespace-nowrap font-tabular ${
                    av.markupPct >= row.markupAtualPct ? 'text-gain/80' : 'text-primary/80'
                  }`}>
                    {pct(av.markupPct)}
                  </td>
                </ExplainRow>
              )
            })}
          </tbody>
        </table>
      </div>
      {simulador.length > TABLE_INITIAL_COUNT && (
        <DrillMoreRow
          content={todosContent}
          label={`Ver mais (+${simulador.length - TABLE_INITIAL_COUNT})`}
          className="w-full justify-center border-t border-border py-2.5"
        />
      )}
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function PriceSimulator({ simulador, margemProdutos = [], dre = [] }: {
  simulador: SimuladorRow[]
  margemProdutos?: DreProdutoRow[]
  dre?: DRELinha[]
}) {
  const [ano, setAno] = useState(2033)
  const [search, setSearch] = useState('')

  if (!simulador.length) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-foreground/25 italic">
          Dados insuficientes para simulação — é necessário ter compras e vendas pelo mesmo produto
        </p>
      </div>
    )
  }

  const searchNormalized = normalizeSearch(search.trim())
  const filtrado = searchNormalized
    ? simulador.filter(r => normalizeSearch(r.descricao ?? '').includes(searchNormalized) || normalizeSearch(r.ncm).includes(searchNormalized))
    : simulador

  return (
    <div className="space-y-6 pb-10">
      {/* Ano toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-foreground/30 mr-1">Ano da transição:</span>
        {ANOS.map(a => (
          <button
            key={a}
            onClick={() => setAno(a)}
            className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
              ano === a
                ? 'bg-primary text-primary-foreground'
                : 'bg-foreground/8 text-foreground/50 hover:bg-foreground/12 hover:text-foreground border border-border'
            }`}
          >
            {a}
          </button>
        ))}
        <span className="text-xs text-foreground/25 ml-1">— preço necessário pra manter a receita líquida de 2026</span>
      </div>

      {/* Summary */}
      <SummaryCards simulador={simulador} ano={ano} />
      <MargemCards margemProdutos={margemProdutos} dre={dre} />
      <MargemExtremos margemProdutos={margemProdutos} />

      {/* Search */}
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto por nome ou NCM..."
          className="h-10 w-full rounded-xl border border-border bg-foreground/5 pl-9 pr-3 text-sm text-foreground placeholder-foreground/30 outline-none transition-colors focus:border-primary/50"
        />
      </div>

      {/* Table */}
      <SimuladorTable simulador={filtrado} ano={ano} />
    </div>
  )
}
