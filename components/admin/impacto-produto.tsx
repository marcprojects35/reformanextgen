'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { Search, ChevronRight } from 'lucide-react'
import { chaveCompra, chaveVenda, type ComprasNCMRow, type VendasDetalheRow, type DetalhesTecnicos } from '@/lib/admin-engine'
import { fmtShort, sign } from '@/lib/admin-format'
import { GAIN, LOSS } from '@/lib/admin-colors'
import { normalizeSearch } from '@/lib/utils'
import { useDrillDown, buildDetalhesExtra, DrillMoreRow, type DrillContent } from '@/components/admin/drill-down'
import { Explain } from '@/components/admin/explain-tooltip'

// ─── FadeUp ───────────────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Impact computation ───────────────────────────────────────────────────────

interface NCMImpact {
  ncm: string
  /** Chave real da linha — codigo_produto quando a planilha traz um, senão o próprio ncm.
   *  Vários produtos distintos podem compartilhar o mesmo NCM (classificação fiscal, não
   *  identidade do produto), então isso é o que garante uma linha por produto e não por NCM. */
  chave: string
  descricao?: string
  netImpact: number         // (vendaDR - vendaAR) - (custoDR - custoAR)
  revenueImpact: number     // vendaDR - vendaAR
  costImpact: number        // custoDR - custoAR
  valorAR: number           // compras valorAR (volume proxy)
  detalhes?: DetalhesTecnicos
}

function computeImpacts(comprasNCM: ComprasNCMRow[], vendasNCM: VendasDetalheRow[]): NCMImpact[] {
  const vendasMap = new Map<string, VendasDetalheRow>()
  for (const v of vendasNCM) vendasMap.set(chaveVenda(v), v)

  const results: NCMImpact[] = []

  for (const c of comprasNCM) {
    const venda = vendasMap.get(chaveCompra(c))
    if (!venda) continue

    const revenueImpact = venda.valorDR - venda.valorAR
    const costImpact    = c.valorDR - c.valorAR
    const netImpact     = revenueImpact - costImpact

    results.push({
      ncm: c.ncm,
      chave: chaveCompra(c),
      descricao: c.descricao ?? venda.descricao,
      netImpact,
      revenueImpact,
      costImpact,
      valorAR: c.valorAR,
      detalhes: c.detalhes ?? venda.detalhes,
    })
  }

  return results
}

// Compartilhado entre as listas e a busca — os dois abrem o mesmo
// detalhe pra um produto.
function impactoDrillContent(d: NCMImpact): DrillContent {
  return {
    title: d.descricao || 'Produto sem descrição',
    accentColor: d.netImpact >= 0 ? GAIN : LOSS,
    columns: [
      { key: 'metrica', label: 'Métrica' },
      { key: 'valor', label: 'Valor', format: 'delta' },
    ],
    rows: [
      { metrica: 'Variação de Receita', valor: d.revenueImpact },
      { metrica: 'Variação de Custo', valor: d.costImpact },
      { metrica: 'Impacto Líquido', valor: d.netImpact },
    ],
    extra: { title: 'Detalhes técnicos da planilha', items: buildDetalhesExtra(d.detalhes) },
  }
}

// ─── Busca de produto ─────────────────────────────────────────────────────────

function ProdutoSearch({ impacts }: { impacts: NCMImpact[] }) {
  const { open } = useDrillDown()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const q = normalizeSearch(query.trim())
  const results = q
    ? impacts.filter(r => normalizeSearch(r.descricao ?? '').includes(q) || normalizeSearch(r.ncm).includes(q)).slice(0, 8)
    : []

  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/30" />
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Buscar produto por nome ou NCM..."
        className="h-10 w-full rounded-xl border border-border bg-foreground/5 pl-9 pr-3 text-sm text-foreground placeholder-foreground/30 outline-none transition-colors focus:border-primary/50"
      />
      {focused && q && (
        <div className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          {results.length === 0 ? (
            <p className="px-3.5 py-3 text-xs text-foreground/30">Nenhum produto encontrado.</p>
          ) : (
            results.map(r => (
              <button
                key={r.chave}
                type="button"
                onMouseDown={() => open(impactoDrillContent(r))}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-foreground/5"
              >
                <span className="min-w-0 truncate">
                  <span className="truncate text-foreground/70">{r.descricao}</span>
                  <span className="ml-2 font-mono text-[10px] text-foreground/30">{r.ncm}</span>
                </span>
                <span className={`shrink-0 font-tabular text-xs font-semibold ${r.netImpact >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {sign(r.netImpact)}{fmtShort(r.netImpact)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Listas ranqueadas (beneficiados / prejudicados) ───────────────────────────
// A curva com todos os produtos ficava ilegível em bases com milhares de itens
// (a imensa maioria perto de zero, achatada entre dois picos isolados nas pontas)
// — duas listas ranqueadas mostram direto quem são os produtos que mais pesam,
// com "Ver todos" pra quem quiser a base completa (mesmo padrão de outras seções,
// ver DrillMoreRow).

const IMPACTO_LISTA_INITIAL_COUNT = 12

function ImpactoListRow({ item, rank, cor, onOpen }: { item: NCMImpact; rank: number; cor: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-foreground/[0.04]"
    >
      <span className="w-5 shrink-0 text-right font-tabular text-[10px] text-foreground/25">{rank}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-foreground/80">{item.descricao || 'Sem descrição'}</span>
      <span className="hidden shrink-0 font-mono text-[10px] text-foreground/25 sm:block">{item.ncm}</span>
      <span className="w-24 shrink-0 text-right font-tabular text-xs font-semibold" style={{ color: cor }}>
        {sign(item.netImpact)}{fmtShort(item.netImpact)}
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-foreground/15" />
    </button>
  )
}

function ImpactoLista({ titulo, itens, cor }: { titulo: string; itens: NCMImpact[]; cor: string }) {
  const { open } = useDrillDown()
  const top = itens.slice(0, IMPACTO_LISTA_INITIAL_COUNT)

  const todosContent: DrillContent = {
    title: titulo,
    subtitle: `${itens.length} produtos`,
    wide: true,
    accentColor: cor,
    columns: [
      { key: 'descricao', label: 'Produto' },
      { key: 'ncm', label: 'NCM', mono: true },
      { key: 'revenueImpact', label: 'Receita', format: 'delta' },
      { key: 'costImpact', label: 'Custo', format: 'delta' },
      { key: 'netImpact', label: 'Líquido', format: 'delta' },
    ],
    rows: itens.map(r => ({
      descricao: r.descricao || 'Sem descrição', ncm: r.ncm,
      revenueImpact: r.revenueImpact, costImpact: r.costImpact, netImpact: r.netImpact,
    })),
  }

  return (
    <div className="rounded-xl border border-border bg-foreground/[0.025] p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full" style={{ background: cor }} />
        <h4 className="text-sm font-semibold" style={{ color: cor }}>{titulo}</h4>
        <span className="text-xs text-foreground/30">({itens.length})</span>
      </div>
      {top.length === 0 ? (
        <p className="py-8 text-center text-xs italic text-foreground/25">Nenhum produto nesta categoria.</p>
      ) : (
        <div className="divide-y divide-white/5">
          {top.map((item, i) => (
            <ImpactoListRow
              key={item.chave}
              item={item}
              rank={i + 1}
              cor={cor}
              onOpen={() => open(impactoDrillContent(item))}
            />
          ))}
        </div>
      )}
      {itens.length > top.length && (
        <DrillMoreRow content={todosContent} label={`Ver todos (${itens.length})`} className="mt-2 justify-end" />
      )}
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function ImpactoProduto({ comprasNCM, vendasNCM }: {
  comprasNCM: ComprasNCMRow[]
  vendasNCM: VendasDetalheRow[]
}) {
  const impacts = computeImpacts(comprasNCM, vendasNCM)

  if (!impacts.length) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-foreground/25 italic">
          Nenhum produto encontrado em compras e vendas simultaneamente
        </p>
      </div>
    )
  }

  // Mais beneficiado primeiro / mais prejudicado primeiro — cada lista na sua própria ordem,
  // em vez de derivar uma da outra via reverse (fácil de inverter sinal por engano).
  const beneficiados = impacts.filter(r => r.netImpact > 0).sort((a, b) => b.netImpact - a.netImpact)
  const prejudicados = impacts.filter(r => r.netImpact < 0).sort((a, b) => a.netImpact - b.netImpact)

  // Net totals
  const totalNet = impacts.reduce((s, r) => s + r.netImpact, 0)
  const totalRevenue = impacts.reduce((s, r) => s + r.revenueImpact, 0)
  const totalCost = impacts.reduce((s, r) => s + r.costImpact, 0)

  return (
    <div className="space-y-6 pb-10">

      {/* Net summary row */}
      <FadeUp>
        <Explain text="Soma o impacto de todos os produtos casados (comprados e vendidos): quanto sua receita de vendas varia menos/mais o quanto seu custo de compras varia, produto a produto, com a Reforma." className="block">
        <div className="grid grid-cols-3 gap-3">
          <div className={`rounded-xl border p-4 ${
            totalNet >= 0
              ? 'border-gain/20 bg-gain/[0.04]'
              : 'border-loss/20 bg-loss/[0.04]'
          }`}>
            <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">Impacto Líquido</p>
            <p className={`text-2xl font-bold font-tabular ${totalNet >= 0 ? 'text-gain' : 'text-loss'}`}>
              {sign(totalNet)}{fmtShort(totalNet)}
            </p>
            <p className="text-xs text-foreground/30 mt-1">resultado = receita − custo</p>
          </div>
          <div className={`rounded-xl border p-4 ${
            totalRevenue >= 0
              ? 'border-gain/20 bg-gain/[0.02]'
              : 'border-loss/20 bg-loss/[0.02]'
          }`}>
            <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">Variação de Receita</p>
            <p className={`text-2xl font-bold font-tabular ${totalRevenue >= 0 ? 'text-gain' : 'text-loss'}`}>
              {sign(totalRevenue)}{fmtShort(totalRevenue)}
            </p>
            <p className="text-xs text-foreground/30 mt-1">vendas DR − vendas AR</p>
          </div>
          <div className={`rounded-xl border p-4 ${
            totalCost <= 0
              ? 'border-gain/20 bg-gain/[0.02]'
              : 'border-loss/20 bg-loss/[0.02]'
          }`}>
            <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-3">Variação de Custo</p>
            <p className={`text-2xl font-bold font-tabular ${totalCost <= 0 ? 'text-gain' : 'text-loss'}`}>
              {sign(totalCost)}{fmtShort(totalCost)}
            </p>
            <p className="text-xs text-foreground/30 mt-1">compras DR − compras AR</p>
          </div>
        </div>
        </Explain>
      </FadeUp>

      {/* Busca de produto específico */}
      <FadeUp delay={0.03}>
        <ProdutoSearch impacts={impacts} />
      </FadeUp>

      {/* Duas listas ranqueadas — mais beneficiados e mais prejudicados */}
      <FadeUp delay={0.05}>
        <div className="grid gap-4 md:grid-cols-2">
          <ImpactoLista titulo="Mais beneficiados" itens={beneficiados} cor={GAIN} />
          <ImpactoLista titulo="Mais prejudicados" itens={prejudicados} cor={LOSS} />
        </div>
      </FadeUp>

      {/* Legend */}
      <FadeUp delay={0.1}>
        <p className="text-xs text-foreground/20 text-center">
          Impacto líquido = (Receita DR − Receita AR) − (Custo DR − Custo AR). Produtos com volume nas duas pontas (compras e vendas).
          {impacts.length > 0 && ` Total de ${impacts.length} produtos analisados.`}
        </p>
      </FadeUp>

    </div>
  )
}
