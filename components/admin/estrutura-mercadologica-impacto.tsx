'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'

import { getMercCategoria, getMercCategoriasTree, type CategoriaNode, type CategoriaMercadologica } from '@/lib/merc-categorias'
import type { DreProdutoRow } from '@/lib/admin-engine'
import { Input } from '@/components/ui/input'
import { fmtShort } from '@/lib/admin-format'
import { GAIN, LOSS } from '@/lib/admin-colors'
import { emojiProduto } from '@/lib/produto-emoji'
import { useDrillDown, buildDetalhesExtra, DrillMoreRow, type DrillContent } from '@/components/admin/drill-down'
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

function produtoDrillContent(r: DreProdutoRow): DrillContent {
  return {
    title: r.descricao || 'Produto sem descrição',
    subtitle: r.categoriaMercadologica?.caminho ?? 'Não classificado',
    accentColor: delta(r) >= 0 ? GAIN : LOSS,
    columns: [
      { key: 'metrica', label: 'Métrica' },
      { key: 'ar', label: 'Antes', format: 'currency' },
      { key: 'dr', label: 'Depois', format: 'currency' },
    ],
    rows: [{ metrica: 'Resultado', ar: r.resultadoAtual, dr: r.resultadoDR }],
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
  node, depth, query, matched, expanded, onToggle, impactoPorCodigo, produtosPorFamilia, allowedCodes, maxAbsProduto, onProdutoClick,
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

  return (
    <div>
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
        {node.nivel === 'secao' && <span className="shrink-0 text-sm">{SECAO_ICONS[node.descricao] ?? '📦'}</span>}
        <span
          className={
            node.nivel === 'secao'
              ? 'flex-1 truncate text-xs font-semibold text-foreground'
              : node.nivel === 'familia'
                ? 'flex-1 truncate text-[11px] text-foreground/55'
                : 'flex-1 truncate text-xs font-medium text-foreground/80'
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
   *  como raiz mesmo assim, já que não têm um nível abaixo pra promover. */
  const raizesVisiveis = treePodada.flatMap(secao => (secao.filhos.length > 0 ? secao.filhos : [secao])).filter(raiz => {
    if (allowedCodes && !allowedCodes.has(raiz.codigo)) return false
    if (query && !matched.has(raiz.codigo)) return false
    return true
  })

  const filtroAtivo = selectedGrupos.size < allGrupos.length

  function abrirProduto(p: DreProdutoRow) {
    open(produtoDrillContent(p))
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
          <Explain text="Mesma taxonomia Seção → Grupo → Subgrupo → Família da árvore ao lado, mas nas Famílias em vez de contar produtos mostra os produtos reais do cliente e a variação de Resultado (R$) de cada um após a reforma." className="block w-fit">
            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Impacto dos Produtos na Estrutura Mercadológica{ano ? ` (${ano})` : ''}</p>
          </Explain>
          <p className="mt-0.5 text-[11px] text-foreground/35">Produtos reais do cliente, agrupados na mesma taxonomia — variação de resultado (R$) antes × depois da reforma.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" />
            <Input
              placeholder="Pesquisar produto ou categoria…"
              value={query}
              onChange={e => setQuery(e.target.value)}
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

      <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border/60 bg-background/40 p-1.5">
        {raizesVisiveis.map(raiz => (
          <ImpactoTreeNode
            key={raiz.codigo}
            node={raiz}
            depth={0}
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
      className={`flex flex-col gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
        isGain ? 'border-gain/25 bg-gradient-to-br from-gain/10 to-transparent' : 'border-loss/25 bg-gradient-to-br from-loss/10 to-transparent'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] text-2xl">
          {emoji}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isGain ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'}`}>
          {isGain ? 'Ganha' : 'Perde'}
        </span>
      </div>
      <div>
        <p className="line-clamp-2 text-sm font-semibold text-foreground" title={produto.descricao || `NCM ${produto.ncm}`}>
          {produto.descricao || `NCM ${produto.ncm}`}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-foreground/35" title={caminho}>{caminho}</p>
      </div>
      <p className={`font-tabular text-xl font-black ${isGain ? 'text-gain' : 'text-loss'}`}>
        {isGain ? '+' : ''}{fmtShort(d)}
      </p>
      <div className="flex items-center justify-between text-[10px] text-foreground/30 font-tabular">
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

function ProdutoAfetadoRow({ produto, maxAbs, ano, onClick }: { produto: DreProdutoRow; maxAbs: number; ano?: number | null; onClick: () => void }) {
  const d = delta(produto)
  const isGain = d >= 0
  const widthPct = maxAbs > 0 ? Math.min(100, (Math.abs(d) / maxAbs) * 100) : 0
  const caminho = produto.categoriaMercadologica?.caminho ?? 'Não classificado'
  const anoDepois = ano ?? ANO_BASE

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
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-tabular">
        <span className="text-foreground/50">{fmtShort(produto.resultadoAtual)}</span>
        <span className="text-foreground/25">{ANO_BASE} antes da reforma</span>
        <span className="text-foreground/20">→</span>
        <span className={isGain ? 'text-gain' : 'text-loss'}>{fmtShort(produto.resultadoDR)}</span>
        <span className="text-foreground/25">{anoDepois} depois da reforma</span>
      </div>
      <span className="relative h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-foreground/[0.06]">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${isGain ? 'bg-gain' : 'bg-loss'}`}
          style={{ width: `${widthPct}%` }}
        />
      </span>
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

  const maxAbs = Math.max(...[...beneficiados, ...prejudicados].map(r => Math.abs(r.delta)), 1)

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
            Produtos Mais Afetados — Estrutura Mercadológica{ano ? ` (${ano})` : ''}
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
            <ProdutoAfetadoRow key={chave(r.row)} produto={r.row} maxAbs={maxAbs} ano={ano} onClick={() => abrirProduto(r.row)} />
          ))}
          {!beneficiados.length && <p className="py-4 text-center text-xs text-foreground/25">Nenhum produto beneficiado.</p>}
        </div>
        <div className="space-y-0.5">
          {prejudicados.map(r => (
            <ProdutoAfetadoRow key={chave(r.row)} produto={r.row} maxAbs={maxAbs} ano={ano} onClick={() => abrirProduto(r.row)} />
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
