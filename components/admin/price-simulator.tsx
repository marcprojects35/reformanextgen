'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { Search } from 'lucide-react'
import type { SimuladorRow, DreProdutoRow, MargemContribuicaoCategoriaRow, DRELinha } from '@/lib/admin-engine'
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
  return row.projecao?.find(p => p.ano === ano)
    ?? { precoVenda: row.valorVendaAR, custo: row.custoAR, resultado: row.resultadoAtual, markupPct: row.markupAtualPct }
}

// Markup = (Preço − Custo) ÷ Custo, mostrado em valor (R$) e percentual lado a lado pra deixar
// o cálculo auditável. Margem Bruta = (Preço − Custo) ÷ Preço — percentual diferente do markup
// (base é o preço, não o custo) — ver computeSimulador em lib/admin-engine.ts.
const PROJECAO_COLUMNS: DrillColumn[] = [
  { key: 'ano', label: 'Ano' },
  { key: 'precoVenda', label: 'Preço Venda', format: 'currency' },
  { key: 'custo', label: 'Custo', format: 'currency' },
  { key: 'markupDisplay', label: 'Markup', format: 'text' },
  { key: 'margemBrutaPct', label: 'Margem Bruta', format: 'percent' },
]

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ simulador, ano }: { simulador: SimuladorRow[]; ano: number }) {
  if (!simulador.length) return null

  // Média ponderada pelo custo (Σresultado ÷ Σcusto), não média simples entre produtos — senão
  // um produto de ticket baixo com markup alto pesa igual a um de ticket alto com markup baixo,
  // distorcendo o markup "da carteira". Mesmo padrão de ponderação usado nas margens (MargemCards).
  const totalCustoAtual = simulador.reduce((s, r) => s + r.custoAR, 0) || 1
  const avgMarkupAtual = simulador.reduce((s, r) => s + r.markupAtualPct * r.custoAR, 0) / totalCustoAtual

  // `custo` do ano vem de precoVenda − resultado (o próprio ponto da projeção), não custoAR —
  // o custo interpolado muda ano a ano junto com a transição.
  const anoVals = simulador.map(r => {
    const v = getAnoValues(r, ano)
    return { ...v, custo: v.precoVenda - v.resultado }
  })
  const totalCustoAno = anoVals.reduce((s, v) => s + v.custo, 0) || 1
  const avgMarkupAno = anoVals.reduce((s, v) => s + v.markupPct * v.custo, 0) / totalCustoAno

  const markupDeltaFromAtual = avgMarkupAno - avgMarkupAtual

  const totalResultadoAtual = simulador.reduce((s, r) => s + r.resultadoAtual, 0)
  const totalResultadoAno = anoVals.reduce((s, v) => s + v.resultado, 0)

  return (
    <Explain text="Markup é quanto você soma sobre o custo pra chegar no preço de venda." className="block">
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="rounded-2xl border border-border bg-foreground/[0.025] p-4">
        <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">Markup Atual (2026)</p>
        <p className="text-2xl font-bold text-foreground font-tabular">{pct(avgMarkupAtual)}</p>
        <p className="text-xs text-foreground/30 mt-1">{R$(totalResultadoAtual, 0)} de resultado sobre custo</p>
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
          {R$(totalResultadoAno, 0)} de resultado · {markupDeltaFromAtual >= 0 ? '+' : ''}{pct(markupDeltaFromAtual)} vs. atual
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
  const totalResultadoAR = margemProdutos.reduce((s, r) => s + r.resultadoAtual, 0)
  const totalResultadoDR = margemProdutos.reduce((s, r) => s + r.resultadoDR, 0)
  const totalResultadoContribuicaoAR = margemProdutos.reduce((s, r) => s + r.resultadoContribuicaoAR, 0)
  const totalResultadoContribuicaoDR = margemProdutos.reduce((s, r) => s + r.resultadoContribuicaoDR, 0)
  const margemLiquida = margemLiquidaInsight(dre)

  const CARD = (label: string, value: number, baseline: number, valorRS: number, sub: string) => {
    const melhora = value >= baseline
    return (
      <div className={`rounded-2xl border p-4 ${melhora ? 'border-gain/20 bg-gain/[0.03]' : 'border-loss/20 bg-loss/[0.03]'}`}>
        <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">{label}</p>
        <p className={`text-2xl font-bold font-tabular ${melhora ? 'text-gain' : 'text-loss'}`}>{pct(value)}</p>
        <p className="text-xs text-foreground/40 mt-1 font-tabular">{R$(valorRS, 0)}</p>
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
        <p className="text-xs text-foreground/40 mt-1 font-tabular">{R$(totalResultadoAR, 0)}</p>
        <p className="text-xs text-foreground/30 mt-1">(receita − custo) ÷ receita</p>
      </div>
      {CARD('Margem Bruta (Depois)', margemBrutaDRPct, margemBrutaARPct, totalResultadoDR, `${margemBrutaDRPct >= margemBrutaARPct ? '+' : ''}${pct(margemBrutaDRPct - margemBrutaARPct)} vs. antes`)}
      <div className="rounded-2xl border border-border bg-foreground/[0.025] p-4">
        <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">Margem Contribuição (Antes)</p>
        <p className="text-2xl font-bold text-foreground font-tabular">{pct(margemContribuicaoARPct)}</p>
        <p className="text-xs text-foreground/40 mt-1 font-tabular">{R$(totalResultadoContribuicaoAR, 0)}</p>
        <p className="text-xs text-foreground/30 mt-1">(receita − custo − tributo venda) ÷ receita</p>
      </div>
      {CARD('Margem Contribuição (Depois)', margemContribuicaoDRPct, margemContribuicaoARPct, totalResultadoContribuicaoDR, `${margemContribuicaoDRPct >= margemContribuicaoARPct ? '+' : ''}${pct(margemContribuicaoDRPct - margemContribuicaoARPct)} vs. antes`)}
      {margemLiquida && (
        <>
          <div className="rounded-2xl border border-border bg-foreground/[0.025] p-4">
            <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">Margem Líquida (Antes)</p>
            <p className="text-2xl font-bold text-foreground font-tabular">{pct(margemLiquida.arPct)}</p>
            <p className="text-xs text-foreground/40 mt-1 font-tabular">{R$(margemLiquida.lucroLiquidoAR, 0)}</p>
            <p className="text-xs text-foreground/30 mt-1">lucro líquido ÷ receita líquida</p>
          </div>
          {CARD('Margem Líquida (Depois)', margemLiquida.drPct, margemLiquida.arPct, margemLiquida.lucroLiquidoDR, `${margemLiquida.drPct >= margemLiquida.arPct ? '+' : ''}${pct(margemLiquida.drPct - margemLiquida.arPct)} vs. antes`)}
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

function ProdutoExtremoCard({ label, produto, valor, valorRS, isGain, onClick }: {
  label: string
  produto: DreProdutoRow
  valor: number
  valorRS: number
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
      <p className="text-xs text-foreground/40 font-tabular">{R$(valorRS, 0)}</p>
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
      <ProdutoExtremoCard label="Maior Margem Bruta" produto={maiorBruta} valor={maiorBruta.margemBrutaDRPct} valorRS={maiorBruta.resultadoDR} isGain onClick={() => abrir(maiorBruta)} />
      <ProdutoExtremoCard label="Menor Margem Bruta" produto={menorBruta} valor={menorBruta.margemBrutaDRPct} valorRS={menorBruta.resultadoDR} isGain={false} onClick={() => abrir(menorBruta)} />
      <ProdutoExtremoCard label="Maior Margem de Contribuição (Líquida)" produto={maiorContribuicao} valor={maiorContribuicao.margemContribuicaoDRPct} valorRS={maiorContribuicao.resultadoContribuicaoDR} isGain onClick={() => abrir(maiorContribuicao)} />
      <ProdutoExtremoCard label="Menor Margem de Contribuição (Líquida)" produto={menorContribuicao} valor={menorContribuicao.margemContribuicaoDRPct} valorRS={menorContribuicao.resultadoContribuicaoDR} isGain={false} onClick={() => abrir(menorContribuicao)} />
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
      { key: 'valorAr', label: 'Valor Antes', format: 'currency' },
      { key: 'ar', label: 'Antes', format: 'percent' },
      { key: 'valorDr', label: 'Valor Depois', format: 'currency' },
      { key: 'dr', label: 'Depois', format: 'percent' },
    ],
    rows: [
      { metrica: 'Margem Bruta', valorAr: r.resultadoAtual, ar: r.margemBrutaARPct, valorDr: r.resultadoDR, dr: r.margemBrutaDRPct },
      { metrica: 'Margem de Contribuição', valorAr: r.resultadoContribuicaoAR, ar: r.margemContribuicaoARPct, valorDr: r.resultadoContribuicaoDR, dr: r.margemContribuicaoDRPct },
    ],
    extra: { title: 'Detalhes técnicos da planilha', items: buildDetalhesExtra(r.detalhes) },
  }
}

const MARGEM_CONTRIB_RANK_COUNT = 5

function MargemContribuicaoTornado({ margemProdutos }: { margemProdutos: DreProdutoRow[] }) {
  const { open } = useDrillDown()
  const comDelta = margemProdutos.map(r => ({ ...r, delta: r.margemContribuicaoDRPct - r.margemContribuicaoARPct }))
  const beneficiados = [...comDelta].filter(r => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, MARGEM_CONTRIB_RANK_COUNT)
  const prejudicados = [...comDelta].filter(r => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, MARGEM_CONTRIB_RANK_COUNT)

  if (!beneficiados.length && !prejudicados.length) return null

  const data = [...beneficiados, ...[...prejudicados].reverse()]
  const maxAbs = Math.max(...data.map(d => Math.abs(d.delta)), 1)
  const labelByChave = new Map(data.map(d => [chave(d), d.descricao || d.ncm]))

  function abrirDetalhe(d: DreProdutoRow) {
    open(margemContribuicaoDrillContent(d))
  }

  const todosContent: DrillContent = {
    title: 'Todos os produtos — variação da margem de contribuição',
    subtitle: `${comDelta.length} produtos analisados`,
    wide: true,
    columns: [
      { key: 'produto', label: 'Produto' },
      { key: 'ncm', label: 'NCM', mono: true },
      { key: 'delta', label: 'Variação', format: 'pctPointDeltaGain' },
      { key: 'ar', label: 'Antes', format: 'percent' },
      { key: 'dr', label: 'Depois', format: 'percent' },
    ],
    rows: [...comDelta].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).map(r => ({
      produto: r.descricao || 'Produto sem descrição',
      ncm: r.ncm,
      delta: r.delta,
      ar: r.margemContribuicaoARPct,
      dr: r.margemContribuicaoDRPct,
    })),
  }

  return (
    <div className="rounded-xl border border-border bg-foreground/[0.025] p-4">
      <div className="flex items-center gap-4 mb-3">
        <Explain text="Margem de Contribuição desconta da receita também o tributo que incide na própria venda, além do custo — por isso pode mudar mais que a Margem Bruta." className="block w-fit">
          <h3 className="text-sm font-semibold text-foreground">Produtos que mais mudam a Margem de Contribuição</h3>
        </Explain>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-gain" />
          <span className="text-xs text-gain">aumentam ({beneficiados.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-loss" />
          <span className="text-xs text-loss">reduzem ({prejudicados.length})</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--foreground) 4%, transparent)" horizontal={false} />
          <XAxis
            type="number"
            domain={[-maxAbs, maxAbs]}
            tickFormatter={v => `${v.toFixed(0)}pp`}
            tick={{ fill: 'color-mix(in srgb, var(--foreground) 25%, transparent)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            className="font-tabular"
          />
          <YAxis
            type="category"
            dataKey={(d: DreProdutoRow) => chave(d)}
            width={130}
            axisLine={false}
            tickLine={false}
            tick={
              <ClickableTick
                onSelect={i => abrirDetalhe(data[i])}
                formatter={(c: string) => shortLabel(labelByChave.get(c) ?? c)}
                fontSize={11}
              />
            }
          />
          <ReferenceLine x={0} stroke="color-mix(in srgb, var(--foreground) 15%, transparent)" />
          <Tooltip
            content={<ChartTooltip formatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}pp`} />}
            labelFormatter={(c: unknown) => labelByChave.get(String(c)) ?? String(c)}
            cursor={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}
          />
          <Bar dataKey="delta" name="Variação da margem de contribuição" radius={[3, 3, 3, 3]} barSize={14} activeBar={ACTIVE_BAR}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.delta >= 0 ? GAIN : LOSS} cursor="pointer" onClick={() => abrirDetalhe(d)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {comDelta.length > data.length && (
        <DrillMoreRow
          content={todosContent}
          label={`Ver todos os produtos (${comDelta.length})`}
          className="mt-2 justify-end"
        />
      )}
    </div>
  )
}

// ─── Margem de contribuição por categoria mercadológica ────────────────────────
// Mesma taxonomia Seção/Grupo/Subgrupo/Família de lib/merc-categorias.ts, já usada em
// MercadologicaCharts pra custo/carga tributária — aqui aplicada à margem de contribuição.

const MERC_CATEGORIA_INITIAL_COUNT = 8

function MargemContribuicaoPorCategoria({ categorias }: { categorias: MargemContribuicaoCategoriaRow[] }) {
  const { open } = useDrillDown()
  if (!categorias.length) return null

  const sorted = [...categorias].sort((a, b) => b.receitaDR - a.receitaDR)
  const top = sorted.slice(0, MERC_CATEGORIA_INITIAL_COUNT)

  function abrirCategoria(r: MargemContribuicaoCategoriaRow) {
    open({
      title: r.categoria,
      subtitle: `${r.count} produtos`,
      accentColor: r.margemContribuicaoDRPct >= r.margemContribuicaoARPct ? GAIN : LOSS,
      columns: [
        { key: 'metrica', label: 'Métrica' },
        { key: 'valorAr', label: 'Valor Antes', format: 'currency' },
        { key: 'ar', label: 'Antes', format: 'percent' },
        { key: 'valorDr', label: 'Valor Depois', format: 'currency' },
        { key: 'dr', label: 'Depois', format: 'percent' },
      ],
      rows: [
        { metrica: 'Margem de Contribuição', valorAr: r.resultadoContribuicaoAR, ar: r.margemContribuicaoARPct, valorDr: r.resultadoContribuicaoDR, dr: r.margemContribuicaoDRPct },
      ],
    })
  }

  const todasContent: DrillContent = {
    title: 'Todas as categorias mercadológicas',
    subtitle: `${sorted.length} categorias analisadas`,
    wide: true,
    columns: [
      { key: 'categoria', label: 'Categoria' },
      { key: 'produtos', label: 'Produtos' },
      { key: 'receitaDr', label: 'Receita (Depois)', format: 'currency' },
      { key: 'valorDr', label: 'Margem Contribuição (Depois)', format: 'currency' },
      { key: 'ar', label: 'Margem Antes', format: 'percent' },
      { key: 'dr', label: 'Margem Depois', format: 'percent' },
    ],
    rows: sorted.map(r => ({
      categoria: r.categoria,
      produtos: r.count,
      receitaDr: r.receitaDR,
      valorDr: r.resultadoContribuicaoDR,
      ar: r.margemContribuicaoARPct,
      dr: r.margemContribuicaoDRPct,
    })),
  }

  return (
    <div className="rounded-xl border border-border bg-foreground/[0.025] p-4">
      <Explain text="Agrupa a margem de contribuição por Seção da taxonomia de mercado (alimentos, saúde etc.), ponderada pela receita de cada produto." className="mb-3 block w-fit">
        <p className="text-sm font-semibold text-foreground">Margem de Contribuição por Categoria Mercadológica</p>
      </Explain>
      <ResponsiveContainer width="100%" height={Math.max(220, top.length * 34)}>
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--foreground) 4%, transparent)" horizontal={false} />
          <XAxis type="number" tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fill: 'color-mix(in srgb, var(--foreground) 25%, transparent)', fontSize: 10 }} axisLine={false} tickLine={false} className="font-tabular" />
          <YAxis
            type="category"
            dataKey="categoria"
            width={150}
            axisLine={false}
            tickLine={false}
            tick={<ClickableTick onSelect={i => abrirCategoria(top[i])} formatter={(v: string) => shortLabel(v, 20)} fontSize={11} />}
          />
          <Tooltip content={<ChartTooltip formatter={(v: number) => `${v.toFixed(1)}%`} />} cursor={{ fill: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }} />
          <Bar dataKey="margemContribuicaoARPct" name="Antes" fill="color-mix(in srgb, var(--foreground) 22%, transparent)" radius={[0, 3, 3, 0]} barSize={9} activeBar={ACTIVE_BAR} />
          <Bar dataKey="margemContribuicaoDRPct" name="Depois" radius={[0, 3, 3, 0]} barSize={9} activeBar={ACTIVE_BAR}>
            {top.map((r, i) => (
              <Cell key={i} fill={r.margemContribuicaoDRPct >= r.margemContribuicaoARPct ? GAIN : LOSS} cursor="pointer" onClick={() => abrirCategoria(top[i])} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {sorted.length > top.length && (
        <DrillMoreRow
          content={todasContent}
          label={`Ver todas as categorias (${sorted.length})`}
          className="mt-2 justify-end"
        />
      )}
    </div>
  )
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
      rows: (row.projecao ?? []).map(p => ({
        ano: p.ano,
        precoVenda: p.precoVenda,
        custo: p.custo,
        markupDisplay: `${R$(p.resultado)} (${pct(p.markupPct)})`,
        margemBrutaPct: p.precoVenda > 0 ? (p.resultado / p.precoVenda) * 100 : 0,
      })),
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
      { key: 'resultadoAtual', label: 'Resultado Atual', format: 'currency' },
      { key: 'markupAtual', label: 'Markup Atual', format: 'percent' },
      { key: 'resultadoDr', label: 'Resultado (Depois)', format: 'currency' },
      { key: 'margemBruta', label: 'Margem Bruta', format: 'percent' },
      { key: 'resultadoContribuicaoDr', label: 'Result. Contribuição (Depois)', format: 'currency' },
      { key: 'margemContribuicao', label: 'Margem Contribuição', format: 'percent' },
    ],
    rows: simulador.map(row => ({
      produto: row.descricao || 'Produto sem descrição',
      ncm: row.ncm,
      custoAr: row.custoAR,
      custoDr: row.custoDR,
      resultadoAtual: row.resultadoAtual,
      markupAtual: row.markupAtualPct,
      resultadoDr: row.resultadoDR,
      margemBruta: row.margemBrutaDRPct,
      resultadoContribuicaoDr: row.resultadoContribuicaoDR,
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
              <th className={th}>Markup ({ano})</th>
              <th className={th}>Margem Bruta ({ano})</th>
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
                  text="Clique na linha pra ver a projeção de preço, custo, markup e margem bruta ano a ano (2026-2033) deste produto."
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
                    <p>{R$(row.resultadoAtual)}</p>
                    <p className="text-xs text-foreground/35">{pct(row.markupAtualPct)}</p>
                  </td>
                  <td className={`px-2.5 py-1.5 text-right text-sm whitespace-nowrap font-tabular ${
                    row.margemBrutaDRPct >= row.margemBrutaARPct ? 'text-gain' : 'text-loss'
                  }`}>
                    <p>{R$(row.resultadoDR)}</p>
                    <p className="text-xs opacity-70">{pct(row.margemBrutaDRPct)}</p>
                  </td>
                  <td className={`px-2.5 py-1.5 text-right text-sm whitespace-nowrap font-tabular ${
                    row.margemContribuicaoDRPct >= row.margemContribuicaoARPct ? 'text-gain' : 'text-loss'
                  }`}>
                    <p>{R$(row.resultadoContribuicaoDR)}</p>
                    <p className="text-xs opacity-70">{pct(row.margemContribuicaoDRPct)}</p>
                  </td>
                  <td className={`px-2.5 py-1.5 text-right text-sm text-foreground/70 whitespace-nowrap font-tabular border-l border-primary/10`}>
                    {R$(av.precoVenda)}
                  </td>
                  <td className={`px-2.5 py-1.5 text-right text-sm whitespace-nowrap font-tabular ${
                    av.markupPct >= row.markupAtualPct ? 'text-gain/80' : 'text-primary/80'
                  }`}>
                    <p>{R$(av.resultado)}</p>
                    <p className="text-xs opacity-70">{pct(av.markupPct)}</p>
                  </td>
                  <td className={`px-2.5 py-1.5 text-right text-sm whitespace-nowrap font-tabular font-semibold ${
                    av.precoVenda > 0 && (av.resultado / av.precoVenda) * 100 >= row.margemBrutaARPct ? 'text-gain' : 'text-loss'
                  }`}>
                    <p>{R$(av.resultado)}</p>
                    <p className="text-xs font-normal opacity-70">{pct(av.precoVenda > 0 ? (av.resultado / av.precoVenda) * 100 : 0)}</p>
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

// ─── Margem de contribuição: categoria + ranking de produtos lado a lado ───────

export function MargemContribuicaoCharts({ margemProdutos, categorias }: {
  margemProdutos: DreProdutoRow[]
  categorias: MargemContribuicaoCategoriaRow[]
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <MargemContribuicaoPorCategoria categorias={categorias} />
      <MargemContribuicaoTornado margemProdutos={margemProdutos} />
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
