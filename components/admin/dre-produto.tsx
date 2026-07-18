'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts'
import type { DreProdutoRow } from '@/lib/admin-engine'
import { GAIN, LOSS, GOLD, ChartTooltip } from '@/lib/admin-colors'
import { useDrillDown, buildDetalhesExtra, type DrillColumn } from '@/components/admin/drill-down'
import { Explain } from '@/components/admin/explain-tooltip'

const R$ = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

const pct = (n: number) =>
  `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

// Chave real da linha — codigo_produto quando presente, senão o NCM. Várias linhas podem
// compartilhar o mesmo NCM (produtos diferentes sob a mesma classificação fiscal), então
// usar só o NCM como key/id colide (React key duplicada, id de gradient SVG duplicado).
function chave(row: { ncm: string; codigoProduto?: string }): string {
  return row.codigoProduto || row.ncm
}

// Colunas da projeção ano-a-ano reutilizadas tanto no drill-down do mini-gráfico
// quanto no drill-down de cada linha da tabela.
const PROJECAO_COLUMNS: DrillColumn[] = [
  { key: 'ano', label: 'Ano' },
  { key: 'resultado', label: 'Resultado', format: 'currency' },
  { key: 'margem', label: 'Margem', format: 'percent' },
  { key: 'origem', label: 'Origem' },
]

function buildProjecaoRows(row: DreProdutoRow) {
  return row.projecao.map(p => ({ ano: p.ano, resultado: p.resultado, margem: p.margem, origem: p.real ? 'Real' : 'Projeção' }))
}

function ProjectionMiniChart({ row, selectedAno }: { row: DreProdutoRow; selectedAno: number | null }) {
  const { open } = useDrillDown()
  const isGood = row.diffResultado >= 0
  const color = isGood ? GAIN : LOSS
  const gradId = `dreProdutoMini-${chave(row)}`

  const data = [
    { ano: 'AR', resultado: row.resultadoAtual, real: false },
    ...row.projecao.map(p => ({ ano: String(p.ano), resultado: p.resultado, real: !!p.real })),
  ]
  const selectedPoint = selectedAno != null ? data.find(d => d.ano === String(selectedAno)) : null

  function abrirProjecao() {
    open({
      title: row.descricao || row.ncm,
      subtitle: row.descricao ? row.ncm : undefined,
      accentColor: color,
      columns: PROJECAO_COLUMNS,
      rows: buildProjecaoRows(row),
      extra: { title: 'Detalhes técnicos da planilha', items: buildDetalhesExtra(row.detalhes) },
    })
  }

  return (
    <ResponsiveContainer width="100%" height={72}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} onClick={abrirProjecao} className="cursor-pointer">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="ano" tick={{ fill: 'color-mix(in srgb, var(--foreground) 25%, transparent)', fontSize: 9 }} axisLine={false} tickLine={false} interval={0} className="font-tabular" />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'color-mix(in srgb, var(--foreground) 15%, transparent)' }} />
        <Area
          type="monotone"
          dataKey="resultado"
          name="Resultado"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={(props: { cx?: number; cy?: number; payload?: { real?: boolean }; index?: number }) => {
            const { cx, cy, payload, index } = props
            if (!payload?.real || cx === undefined || cy === undefined) return <g key={index} />
            return <circle key={index} cx={cx} cy={cy} r={2.5} fill={color} stroke="var(--background)" strokeWidth={1} />
          }}
          activeDot={{ r: 5, fill: color, stroke: GOLD, strokeWidth: 2 }}
        />
        {selectedPoint && (
          <ReferenceDot x={selectedPoint.ano} y={selectedPoint.resultado} r={4} fill={GOLD} stroke="var(--background)" strokeWidth={1} />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}

const CARDS_STEP = 3

export function DreProduto({ dreProduto }: { dreProduto: DreProdutoRow[] }) {
  const { open } = useDrillDown()
  const [selectedAno, setSelectedAno] = useState<number | null>(null)
  const [view, setView] = useState<'cards' | 'tabela'>('cards')
  const [visibleGanhos, setVisibleGanhos] = useState(CARDS_STEP)
  const [visiblePerdas, setVisiblePerdas] = useState(CARDS_STEP)

  function abrirLinha(row: DreProdutoRow) {
    const isGood = row.diffResultado >= 0
    open({
      title: row.descricao || row.ncm,
      subtitle: `Receita ${R$(row.receitaAR)} → ${R$(row.receitaDR)} · Custo ${R$(row.custoAR)} → ${R$(row.custoDR)} · Margem ${pct(row.margemBrutaARPct)} → ${pct(row.margemBrutaDRPct)} · Resultado ${R$(row.resultadoAtual)} → ${R$(row.resultadoDR)} · Δ ${row.diffResultado >= 0 ? '+' : ''}${R$(row.diffResultado)}`,
      accentColor: isGood ? GAIN : LOSS,
      columns: PROJECAO_COLUMNS,
      rows: buildProjecaoRows(row),
      extra: { title: 'Detalhes técnicos da planilha', items: buildDetalhesExtra(row.detalhes) },
    })
  }

  if (!dreProduto.length) {
    return (
      <div className="rounded-2xl border border-border bg-foreground/[0.015] p-4 text-center">
        <p className="text-sm text-foreground/30">DRE por produto não disponível.</p>
        <p className="mt-1 text-xs text-foreground/20">
          É necessário ter NCMs presentes em ambas as planilhas de compras e vendas.
        </p>
      </div>
    )
  }

  const topGanhos    = [...dreProduto].filter(r => r.diffResultado >= 0).sort((a, b) => b.diffResultado - a.diffResultado)
  const topPerdas    = [...dreProduto].filter(r => r.diffResultado < 0).sort((a, b) => a.diffResultado - b.diffResultado)
  const avgMargemAR  = dreProduto.reduce((s, r) => s + r.margemBrutaARPct, 0) / dreProduto.length
  const avgMargemDR  = dreProduto.reduce((s, r) => s + r.margemBrutaDRPct, 0) / dreProduto.length
  const totalDiffRes = dreProduto.reduce((s, r) => s + r.diffResultado, 0)

  const anoData = selectedAno
    ? dreProduto.map(r => ({
        ncm: r.ncm,
        ...r.projecao.find(p => p.ano === selectedAno)!,
      }))
    : null

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <FadeUp>
        <Explain text="Margem Bruta média (não ponderada) de todos os produtos casados — compra e venda do mesmo item. Impacto Total é a soma, produto a produto, de quanto o resultado (receita − custo) muda com a Reforma." className="block">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Margem Média AR', value: pct(avgMargemAR), sub: 'Antes da Reforma', color: 'text-foreground/70' },
            { label: 'Margem Média DR', value: pct(avgMargemDR), sub: 'Após a Reforma', color: avgMargemDR >= avgMargemAR ? 'text-gain' : 'text-loss' },
            { label: 'Impacto Total', value: R$(Math.abs(totalDiffRes)), sub: totalDiffRes >= 0 ? 'Ganho no resultado' : 'Perda no resultado', color: totalDiffRes >= 0 ? 'text-gain' : 'text-loss' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-border bg-foreground/[0.025] p-3">
              <p className="text-[10px] uppercase tracking-wider text-foreground/30">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold font-tabular ${s.color}`}>{s.value}</p>
              <p className="mt-0.5 text-xs text-foreground/30">{s.sub}</p>
            </div>
          ))}
        </div>
        </Explain>
      </FadeUp>

      {/* Ano selector */}
      <FadeUp delay={0.1}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-foreground/30">Projeção por ano:</span>
          <button
            onClick={() => setSelectedAno(null)}
            className={`rounded-lg px-3 py-1 text-xs transition-all ${selectedAno === null ? 'bg-foreground/15 text-foreground' : 'text-foreground/35 hover:text-foreground/60'}`}
          >
            Geral
          </button>
          {ANOS.map(ano => (
            <button
              key={ano}
              onClick={() => setSelectedAno(selectedAno === ano ? null : ano)}
              className={`rounded-lg px-3 py-1 text-xs transition-all ${selectedAno === ano ? 'bg-primary text-primary-foreground font-semibold' : 'text-foreground/35 hover:text-foreground/60'}`}
            >
              {ano}
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            {(['cards', 'tabela'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-lg px-3 py-1 text-xs capitalize transition-all ${view === v ? 'bg-foreground/10 text-foreground' : 'text-foreground/30 hover:text-foreground/50'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </FadeUp>

      {view === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Ganhos */}
          {topGanhos.length > 0 && (
            <FadeUp delay={0.15}>
              <div className="space-y-2">
                <Explain text="Produtos com maior aumento de resultado (receita − custo) da Reforma, entre os que têm compra e venda casadas, do que mais ganha pro que menos ganha." className="block w-fit">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-gain" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gain">Produtos que mais ganham</p>
                  <span className="text-xs text-foreground/25 font-tabular">({topGanhos.length})</span>
                </div>
                </Explain>
                {topGanhos.slice(0, visibleGanhos).map((row, i) => {
                  const anoRow = selectedAno ? row.projecao.find(p => p.ano === selectedAno) : null
                  const resultado = anoRow?.resultado ?? row.resultadoDR
                  const margem    = anoRow?.margem    ?? row.margemBrutaDRPct
                  return (
                    <div key={chave(row)} className="rounded-xl border border-gain/20 bg-gain/5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] text-foreground/30 font-mono">{row.ncm}</span>
                          <p className="text-sm font-semibold text-foreground truncate" title={row.descricao ?? row.ncm}>{row.descricao || row.ncm}</p>
                        </div>
                        <span className="rounded-full bg-gain/20 px-2 py-0.5 text-xs font-semibold text-gain font-tabular">
                          +{R$(row.diffResultado)}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-foreground/30">Resultado AR</p>
                          <p className="text-foreground/70 font-tabular">{R$(row.resultadoAtual)}</p>
                        </div>
                        <div>
                          <p className="text-foreground/30">{selectedAno ? selectedAno : 'Resultado DR'}</p>
                          <p className="text-gain font-tabular">{R$(resultado)}</p>
                        </div>
                        <div>
                          <p className="text-foreground/30">Margem DR</p>
                          <p className="text-gain font-tabular">{pct(margem)}</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <ProjectionMiniChart row={row} selectedAno={selectedAno} />
                      </div>
                    </div>
                  )
                })}
                {visibleGanhos < topGanhos.length && (
                  <button
                    type="button"
                    onClick={() => setVisibleGanhos(v => v + CARDS_STEP)}
                    className="w-full rounded-xl border border-dashed border-gain/25 py-2 text-xs font-medium text-gain/70 transition hover:border-gain/40 hover:text-gain"
                  >
                    Ver mais ({topGanhos.length - visibleGanhos} restantes)
                  </button>
                )}
              </div>
            </FadeUp>
          )}

          {/* Perdas */}
          {topPerdas.length > 0 && (
            <FadeUp delay={0.2}>
              <div className="space-y-2">
                <Explain text="Produtos com maior queda de resultado (receita − custo) com a Reforma, entre os que têm compra e venda casadas, do que mais perde pro que menos perde." className="block w-fit">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-loss" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-loss">Produtos mais impactados</p>
                  <span className="text-xs text-foreground/25 font-tabular">({topPerdas.length})</span>
                </div>
                </Explain>
                {topPerdas.slice(0, visiblePerdas).map((row, i) => {
                  const anoRow = selectedAno ? row.projecao.find(p => p.ano === selectedAno) : null
                  const resultado = anoRow?.resultado ?? row.resultadoDR
                  const margem    = anoRow?.margem    ?? row.margemBrutaDRPct
                  return (
                    <div key={chave(row)} className="rounded-xl border border-loss/20 bg-loss/5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] text-foreground/30 font-mono">{row.ncm}</span>
                          <p className="text-sm font-semibold text-foreground truncate" title={row.descricao ?? row.ncm}>{row.descricao || row.ncm}</p>
                        </div>
                        <span className="rounded-full bg-loss/20 px-2 py-0.5 text-xs font-semibold text-loss font-tabular">
                          {R$(row.diffResultado)}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-foreground/30">Resultado AR</p>
                          <p className="text-foreground/70 font-tabular">{R$(row.resultadoAtual)}</p>
                        </div>
                        <div>
                          <p className="text-foreground/30">{selectedAno ? selectedAno : 'Resultado DR'}</p>
                          <p className="text-loss font-tabular">{R$(resultado)}</p>
                        </div>
                        <div>
                          <p className="text-foreground/30">Margem DR</p>
                          <p className="text-loss font-tabular">{pct(margem)}</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <ProjectionMiniChart row={row} selectedAno={selectedAno} />
                      </div>
                    </div>
                  )
                })}
                {visiblePerdas < topPerdas.length && (
                  <button
                    type="button"
                    onClick={() => setVisiblePerdas(v => v + CARDS_STEP)}
                    className="w-full rounded-xl border border-dashed border-loss/25 py-2 text-xs font-medium text-loss/70 transition hover:border-loss/40 hover:text-loss"
                  >
                    Ver mais ({topPerdas.length - visiblePerdas} restantes)
                  </button>
                )}
              </div>
            </FadeUp>
          )}
        </div>
      ) : (
        /* Tabela */
        <FadeUp delay={0.15}>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-foreground/[0.02]">
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-foreground/30">NCM</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-foreground/30">Receita AR</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-foreground/30">Custo AR</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-foreground/30">Margem AR</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-foreground/30">
                    {selectedAno ? `Resultado ${selectedAno}` : 'Resultado DR'}
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-foreground/30">
                    {selectedAno ? `Margem ${selectedAno}` : 'Margem DR'}
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-foreground/30">Δ Resultado</th>
                </tr>
              </thead>
              <tbody>
                {dreProduto.map((row, i) => {
                  const anoRow = selectedAno ? row.projecao.find(p => p.ano === selectedAno) : null
                  const resultado = anoRow?.resultado ?? row.resultadoDR
                  const margem    = anoRow?.margem    ?? row.margemBrutaDRPct
                  const diff      = resultado - row.resultadoAtual
                  return (
                    <tr
                      key={chave(row)}
                      onClick={() => abrirLinha(row)}
                      className={`cursor-pointer border-b border-border transition-colors hover:bg-foreground/[0.02] ${i % 2 === 0 ? '' : 'bg-foreground/[0.01]'}`}
                    >
                      <td className="px-3 py-2 text-xs text-foreground/70 max-w-[220px]">
                        {row.descricao
                          ? <><p className="truncate text-foreground/80" title={row.descricao}>{row.descricao}</p><p className="font-mono text-[10px] text-foreground/30">{row.ncm}</p></>
                          : <span className="font-mono">{row.ncm}</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-foreground/50 font-tabular">{R$(row.receitaAR)}</td>
                      <td className="px-3 py-2 text-right text-xs text-foreground/50 font-tabular">{R$(row.custoAR)}</td>
                      <td className="px-3 py-2 text-right text-xs text-foreground/60 font-tabular">{pct(row.margemBrutaARPct)}</td>
                      <td className="px-3 py-2 text-right text-xs text-foreground/70 font-tabular">{R$(resultado)}</td>
                      <td className={`px-3 py-2 text-right text-xs font-tabular ${margem >= row.margemBrutaARPct ? 'text-gain' : 'text-loss'}`}>
                        {pct(margem)}
                      </td>
                      <td className={`px-3 py-2 text-right text-xs font-semibold font-tabular ${diff >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {diff >= 0 ? '+' : ''}{R$(diff)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </FadeUp>
      )}
    </div>
  )
}
