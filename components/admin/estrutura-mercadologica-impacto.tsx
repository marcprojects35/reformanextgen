'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Info, Search, SlidersHorizontal, X } from 'lucide-react'
import { PieChart, Pie, Cell, Sector, ResponsiveContainer, Tooltip } from 'recharts'
import { motion, AnimatePresence } from 'motion/react'

import { getMercCategoria, getMercCategoriasTree, type CategoriaNode, type CategoriaMercadologica } from '@/lib/merc-categorias'
import type { DreProdutoRow } from '@/lib/admin-engine'
import { Input } from '@/components/ui/input'
import { fmtShort } from '@/lib/admin-format'
import { GAIN, LOSS, GOLD, chartColor, ChartTooltip } from '@/lib/admin-colors'
import { emojiProduto } from '@/lib/produto-emoji'
import { useDrillDown, buildDetalhesExtra, DrillMoreRow, type DrillContent, type DrillBaseCalculoBloco } from '@/components/admin/drill-down'
import { Explain } from '@/components/admin/explain-tooltip'
import { SECAO_ICONS, normalize, FilterPopover } from '@/components/admin/estrutura-mercadologica-tree'

const NAO_CLASSIFICADO_CODIGO = '__nao_classificado__'

function chave(row: { ncm: string; codigoProduto?: string }): string {
  return row.codigoProduto || row.ncm
}

function delta(r: DreProdutoRow): number {
  return r.resultadoDR - r.resultadoAtual
}

function produtoMatch(p: DreProdutoRow, termo: string): boolean {
  return normalize(p.descricao ?? '').includes(termo) || normalize(p.ncm).includes(termo)
}

/** Base de cálculo completa (Compra/Venda) do produto — só existe quando a planilha real
 *  (não a resumida Compras_NCM/Vendas_NCM) foi usada no import, daí a checagem de
 *  `impostosAR`/`impostosDR` (o único jeito de saber se a quebra por tributo veio populada). */
function produtoBaseCalculo(r: DreProdutoRow): DrillBaseCalculoBloco[] | undefined {
  const blocos: DrillBaseCalculoBloco[] = []
  if (r.compra && (r.compra.impostosAR !== undefined || r.compra.impostosDR !== undefined)) {
    blocos.push({
      titulo: 'Compras (Movimento Tipo Entrada)',
      valorTotalAR: r.compra.valorAR,
      valorTotalDR: r.compra.valorDR,
      impostosAR: r.compra.impostosAR,
      impostosDR: r.compra.impostosDR,
      creditoAR: r.compra.creditoAR,
      creditoDR: r.compra.creditoDR,
      custoLiquidoLabel: 'Custos de Compra',
      custoLiquidoAR: r.custoAR,
      custoLiquidoDR: r.custoDR,
      tributos: r.compra.tributos,
    })
  }
  if (r.venda && (r.venda.impostosAR !== undefined || r.venda.impostosDR !== undefined)) {
    blocos.push({
      titulo: 'Vendas (Movimento Tipo Saída)',
      valorTotalAR: r.venda.valorAR,
      valorTotalDR: r.venda.valorDR,
      impostosAR: r.venda.impostosAR,
      impostosDR: r.venda.impostosDR,
      tributos: r.venda.tributos,
    })
  }
  return blocos.length ? blocos : undefined
}

function produtoDrillContent(r: DreProdutoRow): DrillContent {
  const markupARPct = r.custoAR > 0 ? (r.resultadoAtual / r.custoAR) * 100 : 0
  const markupDRPct = r.custoDR > 0 ? (r.resultadoDR / r.custoDR) * 100 : 0
  return {
    title: r.descricao || 'Produto sem descrição',
    subtitle: r.categoriaMercadologica?.caminho ?? 'Não classificado',
    accentColor: delta(r) >= 0 ? GAIN : LOSS,
    columns: [
      { key: 'metrica', label: 'Métrica' },
      { key: 'valorAr', label: 'Valor Antes', format: 'currency' },
      { key: 'ar', label: 'Antes', format: 'percent' },
      { key: 'valorDr', label: 'Valor Depois', format: 'currency' },
      { key: 'dr', label: 'Depois', format: 'percent' },
    ],
    rows: [
      { metrica: 'Preço de Venda', valorAr: r.receitaAR, valorDr: r.receitaDR },
      { metrica: 'Custo', valorAr: r.custoAR, valorDr: r.custoDR },
      { metrica: 'Resultado', valorAr: r.resultadoAtual, valorDr: r.resultadoDR },
      { metrica: 'Markup', valorAr: r.resultadoAtual, ar: markupARPct, valorDr: r.resultadoDR, dr: markupDRPct },
      { metrica: 'Margem Bruta', valorAr: r.resultadoAtual, ar: r.margemBrutaARPct, valorDr: r.resultadoDR, dr: r.margemBrutaDRPct },
      { metrica: 'Margem de Contribuição', valorAr: r.resultadoContribuicaoAR, ar: r.margemContribuicaoARPct, valorDr: r.resultadoContribuicaoDR, dr: r.margemContribuicaoDRPct },
    ],
    baseCalculo: produtoBaseCalculo(r),
    extra: { title: 'Detalhes técnicos da planilha', items: buildDetalhesExtra(r.detalhes) },
  }
}

/** Soma o impacto em resultado (R$) de cada produto no código da sua Família e em todos os
 *  ancestrais (Subgrupo/Grupo/Seção) — mesma ideia de buildAggregation em
 *  estrutura-mercadologica-tree.tsx, mas somando valor de impacto em vez de contar produtos. */
function buildImpacto(produtos: DreProdutoRow[]): { porCodigo: Map<string, number>; porFamilia: Map<string, DreProdutoRow[]> } {
  const porCodigo = new Map<string, number>()
  const porFamilia = new Map<string, DreProdutoRow[]>()

  for (const r of produtos) {
    const codigoFamilia = r.categoriaMercadologica?.codigo ?? NAO_CLASSIFICADO_CODIGO
    porFamilia.set(codigoFamilia, [...(porFamilia.get(codigoFamilia) ?? []), r])

    let atual: CategoriaMercadologica | undefined = r.categoriaMercadologica
    while (atual) {
      porCodigo.set(atual.codigo, (porCodigo.get(atual.codigo) ?? 0) + delta(r))
      atual = atual.parentCodigo ? getMercCategoria(atual.parentCodigo) : undefined
    }
    if (!r.categoriaMercadologica) {
      porCodigo.set(NAO_CLASSIFICADO_CODIGO, (porCodigo.get(NAO_CLASSIFICADO_CODIGO) ?? 0) + delta(r))
    }
  }

  return { porCodigo, porFamilia }
}

/** Remove recursivamente nós cujo código não está em `validCodes` — usado pra podar da
 *  árvore qualquer categoria (Seção/Grupo/Subgrupo/Família) sem produto real do cliente. */
function prune(nodes: CategoriaNode[], porCodigo: Map<string, number>): CategoriaNode[] {
  return nodes
    .filter(n => porCodigo.has(n.codigo))
    .map(n => ({ ...n, filhos: prune(n.filhos, porCodigo) }))
}

function ImpactoBadge({ valor }: { valor: number }) {
  if (!valor) return null
  const isGain = valor >= 0
  return (
    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-tabular font-medium ${isGain ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
      {isGain ? '+' : ''}{fmtShort(valor)}
    </span>
  )
}

function ProdutoRow({ produto, maxAbs, onClick }: { produto: DreProdutoRow; maxAbs: number; onClick: () => void }) {
  const d = delta(produto)
  const isGain = d >= 0
  const widthPct = maxAbs > 0 ? Math.min(100, (Math.abs(d) / maxAbs) * 100) : 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left transition hover:bg-foreground/[0.04]"
    >
      <span className="flex-1 truncate text-[11px] text-foreground/60" title={produto.descricao || `NCM ${produto.ncm}`}>
        {produto.descricao || `NCM ${produto.ncm}`}
      </span>
      <span className="relative h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-foreground/[0.06]">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${isGain ? 'bg-gain' : 'bg-loss'}`}
          style={{ width: `${widthPct}%` }}
        />
      </span>
      <span className={`w-16 shrink-0 text-right text-[10px] font-tabular font-medium ${isGain ? 'text-gain' : 'text-loss'}`}>
        {isGain ? '+' : ''}{fmtShort(d)}
      </span>
    </button>
  )
}

function ImpactoTreeNode({
  node, depth, query, matched, expanded, onToggle, impactoPorCodigo, produtosPorFamilia, allowedCodes, maxAbsProduto, onProdutoClick, secaoDescricao,
}: {
  node: CategoriaNode
  depth: number
  query: string
  matched: Set<string>
  expanded: Set<string>
  onToggle: (codigo: string) => void
  impactoPorCodigo: Map<string, number>
  produtosPorFamilia: Map<string, DreProdutoRow[]>
  allowedCodes: Set<string> | null
  maxAbsProduto: number
  onProdutoClick: (p: DreProdutoRow) => void
  /** Nome da Seção ancestral — só passado pra raízes (depth 0), usado como fallback de ícone
   *  quando o nome do Grupo em si não bate com nenhuma palavra-chave (ver lib/produto-emoji.ts). */
  secaoDescricao?: string
}) {
  if (allowedCodes && !allowedCodes.has(node.codigo)) return null
  if (query && !matched.has(node.codigo)) return null

  const isLeaf = node.filhos.length === 0
  const termo = normalize(query.trim())
  const produtos = isLeaf ? (produtosPorFamilia.get(node.codigo) ?? []) : []
  const produtosVisiveis = (termo ? produtos.filter(p => produtoMatch(p, termo)) : produtos)
    .slice()
    .sort((a, b) => Math.abs(delta(b)) - Math.abs(delta(a)))
  const expansivel = !isLeaf || produtos.length > 0
  const isOpen = query ? true : expanded.has(node.codigo)
  const impacto = impactoPorCodigo.get(node.codigo) ?? 0

  // A raiz visível hoje é o Grupo (Seção foi removida da exibição) — por isso o Grupo herda
  // o destaque (ícone + negrito) que antes era da Seção; Subgrupo fica num meio-termo e
  // Família (folha) continua a mais discreta.
  const isRaiz = node.nivel === 'secao' || node.nivel === 'grupo'
  const icone = node.nivel === 'secao'
    ? (SECAO_ICONS[node.descricao] ?? '📦')
    : node.nivel === 'grupo'
      ? emojiProduto(node.descricao, secaoDescricao)
      : null

  return (
    <div className={depth === 0 ? 'mt-2 border-t border-border/40 pt-2 first:mt-0 first:border-t-0 first:pt-0' : ''}>
      <button
        type="button"
        onClick={() => expansivel && onToggle(node.codigo)}
        className={`flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left transition hover:bg-foreground/[0.04] ${expansivel ? '' : 'cursor-default'}`}
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
      >
        {expansivel ? (
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-foreground/30 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" />
        )}
        {icone && <span className="shrink-0 text-sm">{icone}</span>}
        <span
          className={
            isRaiz
              ? 'flex-1 truncate text-xs font-semibold text-foreground'
              : node.nivel === 'familia'
                ? 'flex-1 truncate text-[11px] text-foreground/50'
                : 'flex-1 truncate text-[11.5px] font-medium text-foreground/65'
          }
        >
          {node.descricao}
        </span>
        <ImpactoBadge valor={impacto} />
      </button>
      {!isLeaf && isOpen && (
        <div>
          {node.filhos.map(child => (
            <ImpactoTreeNode
              key={child.codigo}
              node={child}
              depth={depth + 1}
              query={query}
              matched={matched}
              expanded={expanded}
              onToggle={onToggle}
              impactoPorCodigo={impactoPorCodigo}
              produtosPorFamilia={produtosPorFamilia}
              allowedCodes={allowedCodes}
              maxAbsProduto={maxAbsProduto}
              onProdutoClick={onProdutoClick}
            />
          ))}
        </div>
      )}
      {isLeaf && isOpen && produtosVisiveis.length > 0 && (
        <div style={{ paddingLeft: `${(depth + 1) * 18 + 8}px` }} className="space-y-0.5 py-0.5">
          {produtosVisiveis.map(p => (
            <ProdutoRow key={chave(p)} produto={p} maxAbs={maxAbsProduto} onClick={() => onProdutoClick(p)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Donut da estrutura mercadológica ──────────────────────────────────────────
// Cada fatia é uma categoria raiz da árvore (Grupo, ou Seção quando não tem Grupo
// embaixo, ex. "Não Classificado") — não agrupa em "Outros" como o RegimeDonut de
// compras-charts.tsx. A cor da fatia identifica a categoria (paleta CHART_COLORS,
// por índice); a direção do impacto (ganho/perda) fica só no sinal e na cor do
// texto (+R$/-R$, verde/vermelho), nunca na fatia — mesma separação de papéis de
// categoria-charts.tsx.

interface DonutSlice {
  codigo: string
  name: string
  icone: string | null
  impacto: number
  value: number
  pct: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActivePieSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, onClick } = props
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 10} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.25} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} stroke={GOLD} strokeWidth={2} onClick={onClick} cursor="pointer" />
    </g>
  )
}

function ImpactoDonut({
  slices, hoverIndex, setHoverIndex, selectedRaiz, onSelect, onVerProdutos, netTotal,
}: {
  slices: DonutSlice[]
  hoverIndex: number | null
  setHoverIndex: (i: number | null) => void
  selectedRaiz: string | null
  onSelect: (codigo: string) => void
  onVerProdutos: (codigo?: string) => void
  netTotal: number
}) {
  if (!slices.length) {
    return <p className="py-10 text-center text-xs text-foreground/25">Sem variação de resultado para montar o gráfico.</p>
  }

  const displayed = hoverIndex !== null ? slices[hoverIndex] : (selectedRaiz ? slices.find(s => s.codigo === selectedRaiz) ?? null : null)

  return (
    <div className="flex flex-col items-center gap-8 lg:flex-row">
      <div className="relative h-72 w-72 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              cx="50%" cy="50%"
              innerRadius={90} outerRadius={120}
              dataKey="value"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...(hoverIndex !== null ? { activeIndex: hoverIndex, activeShape: (p: any) => <ActivePieSlice {...p} /> } : {})}
              onMouseEnter={(_, i) => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              stroke="none"
            >
              {slices.map((entry, i) => (
                <Cell
                  key={entry.codigo}
                  fill={chartColor(i)}
                  opacity={hoverIndex === null || hoverIndex === i ? 1 : 0.3}
                  cursor="pointer"
                  onClick={() => onSelect(entry.codigo)}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip formatter={fmtShort} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <AnimatePresence mode="wait">
            {displayed ? (
              <motion.div key={displayed.codigo} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.2 }}>
                <p className={`text-xl font-bold font-tabular ${displayed.impacto >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {displayed.impacto >= 0 ? '+' : ''}{fmtShort(displayed.impacto)}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-foreground/40">{displayed.icone} {displayed.name}</p>
              </motion.div>
            ) : (
              <motion.div key="total" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.2 }}>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-foreground/30">Impacto Total</p>
                <p className={`text-xl font-bold font-tabular ${netTotal >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {netTotal >= 0 ? '+' : ''}{fmtShort(netTotal)}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => onVerProdutos(displayed?.codigo)}
            className="pointer-events-auto mt-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary transition hover:bg-primary/20"
          >
            Conheça os produtos
          </button>
        </div>
      </div>
      <div className="w-full flex-1 space-y-1.5 overflow-y-auto pr-1 lg:max-h-72">
        {slices.map((entry, i) => (
          <motion.div
            key={entry.codigo}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.03, duration: 0.5 }}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
            onClick={() => onSelect(entry.codigo)}
            className={`group flex cursor-pointer items-center gap-3 rounded-lg -mx-2 px-2 py-1 transition-colors hover:bg-foreground/[0.03] ${selectedRaiz === entry.codigo ? 'bg-primary/[0.06]' : ''}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: chartColor(i) }} />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-sm text-foreground/70 transition-colors group-hover:text-foreground">{entry.icone} {entry.name}</span>
                <span className={`ml-2 shrink-0 font-tabular text-sm font-semibold ${entry.impacto >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {entry.impacto >= 0 ? '+' : ''}{fmtShort(entry.impacto)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-foreground/5">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: chartColor(i) }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${entry.pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: i * 0.03 + 0.15 }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function ArvoreExplicacaoModal({ onClose }: { onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        key="panel"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="fixed left-1/2 top-1/2 z-[91] w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-popover p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <p className="text-sm font-semibold text-foreground">A árvore mercadológica</p>
          <button type="button" onClick={onClose} className="text-foreground/30 transition-colors hover:text-foreground/60" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-foreground/60">
          É a taxonomia usada pra organizar tudo o que o seu negócio vende: Seção → Grupo → Subgrupo → Família — por
          exemplo, &ldquo;Alimentos → Mercearia Seca → Cereais → Arroz Integral&rdquo;. Cada fatia do gráfico ao lado é uma
          categoria dessa árvore, e dentro dela estão os produtos reais do seu negócio, já com a variação de resultado
          (R$) que a reforma tributária traz pra cada um. Clique numa fatia (ou use o botão &ldquo;Conheça os produtos&rdquo;)
          pra entrar na categoria e ver os produtos por dentro.
        </p>
      </motion.div>
    </AnimatePresence>
  )
}

export function EstruturaMercadologicaImpacto({ margemProdutos, ano }: { margemProdutos: DreProdutoRow[]; ano?: number | null }) {
  const { open } = useDrillDown()
  const treeReal = useMemo(() => getMercCategoriasTree(), [])
  const { porCodigo, porFamilia } = useMemo(() => buildImpacto(margemProdutos), [margemProdutos])

  const temNaoClassificados = (porFamilia.get(NAO_CLASSIFICADO_CODIGO) ?? []).length > 0
  const tree = useMemo(() => {
    if (!temNaoClassificados) return treeReal
    const naoClassificadoNode: CategoriaNode = {
      codigo: NAO_CLASSIFICADO_CODIGO, descricao: 'Não Classificado', nivel: 'secao', parentCodigo: null, filhos: [],
    }
    return [...treeReal, naoClassificadoNode]
  }, [treeReal, temNaoClassificados])

  // Poda categorias sem nenhum produto real no cliente (nem direto, nem em nenhum
  // descendente) — evita mostrar centenas de Famílias/Subgrupos/Grupos da taxonomia
  // "genérica" que esse cliente simplesmente não vende. `porCodigo` já tem exatamente
  // uma entrada por código com pelo menos 1 produto na subárvore (ver buildImpacto).
  const treePodada = useMemo(() => prune(tree, porCodigo), [tree, porCodigo])
  const treeRealPodada = useMemo(() => prune(treeReal, porCodigo), [treeReal, porCodigo])

  const maxAbsProduto = useMemo(
    () => Math.max(...margemProdutos.map(p => Math.abs(delta(p))), 1),
    [margemProdutos],
  )

  const allGrupos = useMemo(() => treeRealPodada.flatMap(s => s.filhos.map(g => g.codigo)), [treeRealPodada])

  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedGrupos, setSelectedGrupos] = useState<Set<string>>(() => new Set(allGrupos))
  const [selectedRaiz, setSelectedRaiz] = useState<string | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [explicacaoOpen, setExplicacaoOpen] = useState(false)

  function toggle(codigo: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  const matched = useMemo(() => {
    const set = new Set<string>()
    const termo = normalize(query.trim())
    if (!termo) return set

    function walk(node: CategoriaNode): boolean {
      const selfHit = normalize(node.descricao).includes(termo)
      const childHit = node.filhos.map(walk).some(Boolean)
      const isLeaf = node.filhos.length === 0
      const produtosHit = isLeaf && (porFamilia.get(node.codigo) ?? []).some(p => produtoMatch(p, termo))
      const hit = selfHit || childHit || produtosHit
      if (hit) set.add(node.codigo)
      return hit
    }
    treePodada.forEach(walk)
    return set
  }, [treePodada, query, porFamilia])

  const allowedCodes = useMemo(() => {
    if (selectedGrupos.size === allGrupos.length) return null

    const allowed = new Set<string>()
    function addSubtree(node: CategoriaNode) {
      allowed.add(node.codigo)
      node.filhos.forEach(addSubtree)
    }
    for (const secao of treeRealPodada) {
      let secaoTemSelecionado = false
      for (const grupo of secao.filhos) {
        if (selectedGrupos.has(grupo.codigo)) {
          secaoTemSelecionado = true
          addSubtree(grupo)
        }
      }
      if (secaoTemSelecionado) allowed.add(secao.codigo)
    }
    return allowed
  }, [treeRealPodada, selectedGrupos, allGrupos.length])

  /** Pula o nível de Seção (ex.: "Alimentos") na exibição — a árvore mostra a partir do
   *  Grupo (ex.: "Mercearia Seca"). Seções sem Grupo (ex.: "Não Classificado") aparecem
   *  como raiz mesmo assim, já que não têm um nível abaixo pra promover. Carrega o nome da
   *  Seção junto (mesmo escondida) pra servir de fallback de ícone do Grupo. */
  const raizesTodas = useMemo(
    () => treePodada.flatMap(secao => (secao.filhos.length > 0 ? secao.filhos : [secao]).map(raiz => ({ raiz, secaoDescricao: secao.descricao }))),
    [treePodada],
  )

  const raizesVisiveis = raizesTodas.filter(({ raiz }) => {
    if (allowedCodes && !allowedCodes.has(raiz.codigo)) return false
    if (query && !matched.has(raiz.codigo)) return false
    if (selectedRaiz && raiz.codigo !== selectedRaiz) return false
    return true
  })

  const filtroAtivo = selectedGrupos.size < allGrupos.length
  const mostrarLista = Boolean(query) || filtroAtivo || Boolean(selectedRaiz)

  // Fatias do donut: uma por categoria raiz com variação de resultado — o tamanho é o
  // módulo do impacto líquido (maior variação = fatia maior) e a cor é ganho/perda, não
  // identidade da categoria (o nome já identifica, na legenda ao lado e no centro do gráfico).
  const donutSlices: DonutSlice[] = useMemo(() => {
    const base = raizesTodas
      .map(({ raiz, secaoDescricao }) => {
        const impacto = porCodigo.get(raiz.codigo) ?? 0
        const icone = raiz.nivel === 'secao' ? (SECAO_ICONS[raiz.descricao] ?? '📦') : emojiProduto(raiz.descricao, secaoDescricao)
        return { codigo: raiz.codigo, name: raiz.descricao, icone, impacto, value: Math.abs(impacto) }
      })
      .filter(s => s.value > 0)
      .sort((a, b) => b.value - a.value)
    const totalAbs = base.reduce((s, x) => s + x.value, 0)
    return base.map(s => ({ ...s, pct: totalAbs > 0 ? (s.value / totalAbs) * 100 : 0 }))
  }, [raizesTodas, porCodigo])

  const netTotalImpacto = useMemo(
    () => raizesTodas.reduce((s, { raiz }) => s + (porCodigo.get(raiz.codigo) ?? 0), 0),
    [raizesTodas, porCodigo],
  )

  function collectFamiliaCodigos(node: CategoriaNode): string[] {
    return node.filhos.length === 0 ? [node.codigo] : node.filhos.flatMap(collectFamiliaCodigos)
  }

  function produtosDaRaiz(codigo: string): DreProdutoRow[] {
    const entry = raizesTodas.find(r => r.raiz.codigo === codigo)
    if (!entry) return []
    return collectFamiliaCodigos(entry.raiz).flatMap(fc => porFamilia.get(fc) ?? [])
  }

  function abrirProduto(p: DreProdutoRow) {
    open(produtoDrillContent(p))
  }

  /** Botão "Conheça os produtos" do donut — mesma tela (modal com tabela larga) que
   *  se abriria entrando por uma categoria e chegando nos produtos dela; sem categoria
   *  ativa (nada selecionado/em hover), abre com todos os produtos do cliente. */
  function abrirProdutos(codigo?: string) {
    const produtosAlvo = codigo ? produtosDaRaiz(codigo) : margemProdutos
    const nomeCategoria = codigo ? donutSlices.find(s => s.codigo === codigo)?.name : undefined
    const ordenados = [...produtosAlvo].sort((a, b) => Math.abs(delta(b)) - Math.abs(delta(a)))
    open({
      title: nomeCategoria ? `Produtos — ${nomeCategoria}` : 'Todos os produtos',
      subtitle: `${ordenados.length} produto${ordenados.length !== 1 ? 's' : ''} analisado${ordenados.length !== 1 ? 's' : ''}`,
      wide: true,
      columns: [
        { key: 'produto', label: 'Produto' },
        { key: 'caminho', label: 'Caminho' },
        { key: 'ncm', label: 'NCM', mono: true },
        { key: 'delta', label: 'Variação', format: 'delta' },
        { key: 'ar', label: 'Antes', format: 'currency' },
        { key: 'dr', label: 'Depois', format: 'currency' },
      ],
      rows: ordenados.map(r => ({
        produto: r.descricao || 'Produto sem descrição',
        caminho: r.categoriaMercadologica?.caminho ?? 'Não classificado',
        ncm: r.ncm,
        delta: delta(r),
        ar: r.resultadoAtual,
        dr: r.resultadoDR,
      })),
    })
  }

  function toggleSelectRaiz(codigo: string) {
    setQuery('')
    setSelectedRaiz(prev => {
      const next = prev === codigo ? null : codigo
      if (next) setExpanded(e => new Set(e).add(next))
      return next
    })
  }

  function handleQueryChange(v: string) {
    setQuery(v)
    if (v) setSelectedRaiz(null)
  }

  if (!margemProdutos.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-foreground/[0.02] p-4 py-24">
        <p className="text-sm italic text-foreground/25">
          Dados insuficientes para calcular impacto — é necessário ter compras e vendas pelo mesmo produto
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-foreground/[0.02] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Explain text="Mesma taxonomia Seção → Grupo → Subgrupo → Família da árvore ao lado, mas nas Famílias em vez de contar produtos mostra os produtos reais do cliente e a variação de Resultado (R$) de cada um após a reforma." className="block w-fit">
              <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Impacto dos Produtos na Estrutura Mercadológica{ano ? ` (${ano})` : ''}</p>
            </Explain>
            <button
              type="button"
              onClick={() => setExplicacaoOpen(true)}
              className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-foreground/50 transition hover:border-primary/40 hover:text-primary"
            >
              <Info className="h-3 w-3" />
              Conheça a árvore mercadológica
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-foreground/35">Produtos reais do cliente, agrupados na mesma taxonomia — variação de resultado (R$) antes × depois da reforma.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" />
            <Input
              placeholder="Pesquisar produto ou categoria…"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              className="!h-8 w-56 pl-8 pr-7 text-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/30 transition-colors hover:text-foreground/60"
                aria-label="Limpar pesquisa"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen(v => !v)}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition ${
                filtroAtivo
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-foreground/50 hover:border-foreground/20 hover:text-foreground'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtrar
              {filtroAtivo && (
                <span className="rounded-full bg-primary/20 px-1.5 text-[10px] font-tabular">{selectedGrupos.size}</span>
              )}
            </button>
            {filterOpen && (
              <FilterPopover
                tree={treeRealPodada}
                selectedGrupos={selectedGrupos}
                setSelectedGrupos={setSelectedGrupos}
                onClose={() => setFilterOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-background/40 p-4">
        <ImpactoDonut
          slices={donutSlices}
          hoverIndex={hoverIndex}
          setHoverIndex={setHoverIndex}
          selectedRaiz={selectedRaiz}
          onSelect={toggleSelectRaiz}
          onVerProdutos={abrirProdutos}
          netTotal={netTotalImpacto}
        />
      </div>

      {mostrarLista && (
        <div className="mt-3">
          {selectedRaiz && !query && (
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                {donutSlices.find(s => s.codigo === selectedRaiz)?.name}
              </span>
              <button
                type="button"
                onClick={() => setSelectedRaiz(null)}
                className="text-[11px] text-foreground/35 transition-colors hover:text-foreground/60"
              >
                Ver todas as categorias
              </button>
            </div>
          )}
          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border/60 bg-background/40 p-1.5">
            {raizesVisiveis.map(({ raiz, secaoDescricao }) => (
              <ImpactoTreeNode
                key={raiz.codigo}
                node={raiz}
                depth={0}
                secaoDescricao={secaoDescricao}
                query={query}
                matched={matched}
                expanded={expanded}
                onToggle={toggle}
                impactoPorCodigo={porCodigo}
                produtosPorFamilia={porFamilia}
                allowedCodes={allowedCodes}
                maxAbsProduto={maxAbsProduto}
                onProdutoClick={abrirProduto}
              />
            ))}
            {raizesVisiveis.length === 0 && (
              <p className="py-6 text-center text-xs text-foreground/25">Nenhuma categoria encontrada.</p>
            )}
          </div>
        </div>
      )}

      {explicacaoOpen && <ArvoreExplicacaoModal onClose={() => setExplicacaoOpen(false)} />}
    </div>
  )
}

// ─── Produtos mais impactados (cards) ──────────────────────────────────────────
// Os 4 produtos com maior variação de Resultado (R$) em módulo — ganho ou perda —
// dentre TODOS os produtos reais do cliente no ano selecionado (margemProdutos já
// vem completo do relatório, sem corte — ver computeMargemProdutos em admin-engine.ts).
// Ano muda → o relatório troca → margemProdutos troca → os cards recalculam sozinhos.

const IMPACTO_CARDS_COUNT = 4

function ProdutoImpactoCard({ produto, onClick }: { produto: DreProdutoRow; onClick: () => void }) {
  const d = delta(produto)
  const isGain = d >= 0
  const emoji = emojiProduto(produto.descricao, produto.categoriaMercadologica?.secao)
  const caminho = produto.categoriaMercadologica?.caminho ?? 'Não classificado'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-1.5 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
        isGain ? 'border-gain/25 bg-gradient-to-br from-gain/10 to-transparent' : 'border-loss/25 bg-gradient-to-br from-loss/10 to-transparent'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05] text-sm">
          {emoji}
        </span>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${isGain ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'}`}>
          {isGain ? 'Ganha' : 'Perde'}
        </span>
      </div>
      <div>
        <p className="line-clamp-2 text-xs font-semibold text-foreground" title={produto.descricao || `NCM ${produto.ncm}`}>
          {produto.descricao || `NCM ${produto.ncm}`}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-foreground/35" title={caminho}>{caminho}</p>
      </div>
      <p className={`font-tabular text-base font-bold ${isGain ? 'text-gain' : 'text-loss'}`}>
        {isGain ? '+' : ''}{fmtShort(d)}
      </p>
      <div className="flex items-center justify-between text-[9px] text-foreground/30 font-tabular">
        <span>Antes {fmtShort(produto.resultadoAtual)}</span>
        <span>Depois {fmtShort(produto.resultadoDR)}</span>
      </div>
    </button>
  )
}

export function ProdutosMaisImpactadosCards({ margemProdutos, ano }: { margemProdutos: DreProdutoRow[]; ano?: number | null }) {
  const { open } = useDrillDown()

  const top4 = useMemo(
    () => [...margemProdutos].sort((a, b) => Math.abs(delta(b)) - Math.abs(delta(a))).slice(0, IMPACTO_CARDS_COUNT),
    [margemProdutos],
  )

  if (!top4.length) return null

  function abrirProduto(p: DreProdutoRow) {
    open(produtoDrillContent(p))
  }

  return (
    <div className="rounded-xl border border-border bg-foreground/[0.02] p-4">
      <Explain text="Os 4 produtos com maior variação de Resultado (R$) — pra mais ou pra menos — entre todos os produtos reais do cliente no ano selecionado." className="block w-fit">
        <p className="mb-3 text-xs font-semibold text-foreground/60 uppercase tracking-wide">
          Produtos Mais Impactados{ano ? ` (${ano})` : ''}
        </p>
      </Explain>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {top4.map(p => (
          <ProdutoImpactoCard key={chave(p)} produto={p} onClick={() => abrirProduto(p)} />
        ))}
      </div>
    </div>
  )
}

// ─── Produtos mais afetados na estrutura mercadológica ─────────────────────────
// Ranking dos produtos com maior variação de resultado (R$) dentro da taxonomia
// mercadológica — mesmo par de listas (aumentam/reduzem) do ranking de margem de
// contribuição em price-simulator.tsx, mas mostrando o caminho da categoria de cada produto.

const PRODUTOS_AFETADOS_RANK_COUNT = 8
const ANO_BASE = 2026

function ProdutoAfetadoRow({ produto, ano, onClick }: { produto: DreProdutoRow; ano?: number | null; onClick: () => void }) {
  const d = delta(produto)
  const isGain = d >= 0
  const caminho = produto.categoriaMercadologica?.caminho ?? 'Não classificado'
  const anoDepois = ano ?? ANO_BASE

  // Cada coluna tem sua própria barra, comparável só dentro da mesma linha — o produto A
  // pode valer 10x o produto B, então normalizar as duas pelo maior dos dois (|AR| ou |DR|
  // deste produto) é o que deixa visível "antes vs depois"; usar o maxAbs global (do ranking
  // inteiro) deixaria quase toda barra minúscula. AR neutro, DR colorido — mesma convenção
  // dos outros gráficos AR/DR do admin (ex.: NCMBars em compras-charts.tsx).
  const localMax = Math.max(Math.abs(produto.resultadoAtual), Math.abs(produto.resultadoDR), 1)
  const arWidthPct = Math.min(100, (Math.abs(produto.resultadoAtual) / localMax) * 100)
  const drWidthPct = Math.min(100, (Math.abs(produto.resultadoDR) / localMax) * 100)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-1 rounded-lg px-2 py-2 text-left transition hover:bg-foreground/[0.04]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex-1 truncate text-xs font-medium text-foreground/75" title={produto.descricao || `NCM ${produto.ncm}`}>
          {produto.descricao || `NCM ${produto.ncm}`}
        </span>
        <span className={`shrink-0 text-xs font-tabular font-semibold ${isGain ? 'text-gain' : 'text-loss'}`}>
          {isGain ? '+' : ''}{fmtShort(d)}
        </span>
      </div>
      <span className="truncate text-[10px] text-foreground/35" title={caminho}>{caminho}</span>
      <div className="grid grid-cols-2 gap-x-3">
        <div>
          <p className="text-[9px] uppercase tracking-wide text-foreground/25">{ANO_BASE} antes da reforma</p>
          <p className="text-[11px] font-tabular font-medium text-foreground/55">{fmtShort(produto.resultadoAtual)}</p>
          <span className="relative mt-1 block h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-foreground/[0.06]">
            <span className="absolute inset-y-0 left-0 rounded-full bg-foreground/25" style={{ width: `${arWidthPct}%` }} />
          </span>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-foreground/25">{anoDepois} depois da reforma</p>
          <p className={`text-[11px] font-tabular font-medium ${isGain ? 'text-gain' : 'text-loss'}`}>{fmtShort(produto.resultadoDR)}</p>
          <span className="relative mt-1 block h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-foreground/[0.06]">
            <span className={`absolute inset-y-0 left-0 rounded-full ${isGain ? 'bg-gain' : 'bg-loss'}`} style={{ width: `${drWidthPct}%` }} />
          </span>
        </div>
      </div>
    </button>
  )
}

export function ProdutosMaisAfetadosMercadologica({ margemProdutos, ano }: { margemProdutos: DreProdutoRow[]; ano?: number | null }) {
  const { open } = useDrillDown()

  const comDelta = useMemo(() => margemProdutos.map(r => ({ row: r, delta: delta(r) })), [margemProdutos])
  const beneficiados = useMemo(
    () => [...comDelta].filter(r => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, PRODUTOS_AFETADOS_RANK_COUNT),
    [comDelta],
  )
  const prejudicados = useMemo(
    () => [...comDelta].filter(r => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, PRODUTOS_AFETADOS_RANK_COUNT),
    [comDelta],
  )

  if (!beneficiados.length && !prejudicados.length) return null

  function abrirProduto(p: DreProdutoRow) {
    open(produtoDrillContent(p))
  }

  const todosContent: DrillContent = {
    title: 'Todos os produtos — impacto na estrutura mercadológica',
    subtitle: `${comDelta.length} produtos analisados`,
    wide: true,
    columns: [
      { key: 'produto', label: 'Produto' },
      { key: 'caminho', label: 'Caminho' },
      { key: 'ncm', label: 'NCM', mono: true },
      { key: 'delta', label: 'Variação', format: 'delta' },
      { key: 'ar', label: 'Antes', format: 'currency' },
      { key: 'dr', label: 'Depois', format: 'currency' },
    ],
    rows: [...comDelta].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).map(r => ({
      produto: r.row.descricao || 'Produto sem descrição',
      caminho: r.row.categoriaMercadologica?.caminho ?? 'Não classificado',
      ncm: r.row.ncm,
      delta: r.delta,
      ar: r.row.resultadoAtual,
      dr: r.row.resultadoDR,
    })),
  }

  return (
    <div className="rounded-xl border border-border bg-foreground/[0.02] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <Explain text="Ranking dos produtos com maior variação de resultado (R$) dentro da estrutura mercadológica — mostra o caminho (Seção → Grupo → Subgrupo → Família) de cada produto." className="block w-fit">
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">
            Produtos Mais Afetados em Margem Bruta — Estrutura Mercadológica{ano ? ` (${ano})` : ''}
          </p>
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
      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <div className="space-y-0.5">
          {beneficiados.map(r => (
            <ProdutoAfetadoRow key={chave(r.row)} produto={r.row} ano={ano} onClick={() => abrirProduto(r.row)} />
          ))}
          {!beneficiados.length && <p className="py-4 text-center text-xs text-foreground/25">Nenhum produto beneficiado.</p>}
        </div>
        <div className="space-y-0.5">
          {prejudicados.map(r => (
            <ProdutoAfetadoRow key={chave(r.row)} produto={r.row} ano={ano} onClick={() => abrirProduto(r.row)} />
          ))}
          {!prejudicados.length && <p className="py-4 text-center text-xs text-foreground/25">Nenhum produto prejudicado.</p>}
        </div>
      </div>
      {comDelta.length > beneficiados.length + prejudicados.length && (
        <DrillMoreRow
          content={todosContent}
          label={`Ver todos os produtos (${comDelta.length})`}
          className="mt-2 justify-end"
        />
      )}
    </div>
  )
}
