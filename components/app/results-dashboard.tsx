'use client'

import { useRef } from 'react'
import { Download } from 'lucide-react'
import { RecalculateButton } from './recalculate-button'
import { motion, useScroll, useTransform } from 'motion/react'

import type { SimulationWithCompany } from '@/lib/db'
import type { EngineOutput } from '@/lib/tax-engine/types'
import { formatCurrencyBRL, regimeAtualLabels, setorLabels } from '@/lib/labels'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from '@/components/ui/tabs'
import { SpotlightCard } from '@/components/landing/spotlight-card'
import { Reveal } from '@/components/landing/reveal'
import { Parallax } from '@/components/landing/parallax'
import { WordReveal } from '@/components/landing/word-reveal'
import { AnimatedCounter } from '@/components/landing/animated-counter'
import { RegimeComparisonCard } from './regime-comparison-card'
import { DreTable } from './dre-table'
import { WaterfallChart } from './waterfall-chart'
import { DrillDownTable } from './drilldown-table'
import { ScrollScrubTimeline } from './scroll-scrub-timeline'

/* ─── chapter divider ──────────────────────────────────────────── */
function Chapter({
  number,
  label,
  children,
}: {
  number: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Reveal y={24} className="relative">
      <div className="mb-6 flex items-center gap-3">
        <span className="font-mono text-xs font-semibold text-primary">{number}</span>
        <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      </div>
      {children}
    </Reveal>
  )
}

/* ─── scroll-faded section separator ───────────────────────────── */
function SectionFade() {
  return (
    <div className="relative py-12">
      <div className="divider-fade" aria-hidden />
    </div>
  )
}

/* ─── main component ────────────────────────────────────────────── */
export function ResultsDashboard({
  simulation,
  output,
}: {
  simulation: SimulationWithCompany
  output: EngineOutput
}) {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroOpacity = useTransform(heroProgress, [0, 0.8], [1, 0])
  const heroY = useTransform(heroProgress, [0, 1], [0, -40])

  const regimeAtualResult = output.regimes.find((r) => r.regime === output.resumo.regimeAtual)!
  const regimeIdealResult = output.regimes.find((r) => r.regime === output.resumo.regimeIdeal)!
  const jaNoIdeal = output.resumo.regimeAtual === output.resumo.regimeIdeal
  const poupando = output.resumo.economiaAnual >= 0

  /* narrative sentence shown between hero and regime cards */
  const narrativeText = jaNoIdeal
    ? `Sua empresa já opera no regime mais eficiente para 2033. A Reforma Tributária vai entrar em vigor gradualmente até 2033, mas seu posicionamento atual é o ideal.`
    : `Migrando do ${regimeAtualLabels[simulation.regime_atual]} para o ${regimeIdealResult.label}, sua empresa pode economizar até ${formatCurrencyBRL(Math.abs(output.resumo.economiaAnual))} por ano com a chegada plena da Reforma Tributária em 2033.`

  async function handleExport() {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([{
        empresa: simulation.razao_social,
        setor: setorLabels[simulation.setor],
        uf: simulation.uf,
        regime_atual: regimeAtualLabels[simulation.regime_atual],
        regime_ideal: regimeIdealResult.label,
        economia_anual_estimada: output.resumo.economiaAnual,
        economia_pct: output.resumo.economiaPct,
        baseado_em_arquivos: output.resumo.baseadoEmArquivos ? 'sim' : 'não',
        total_linhas_importadas: output.resumo.totalLinhas,
      }]),
      'Resumo',
    )
    const regimesRows = output.regimes.flatMap((r) =>
      r.anos.map((a) => ({
        regime: r.label, ano: a.ano, receita: a.receita,
        tributos_atuais: a.tributosAtuais, tributos_reforma: a.tributosReforma,
        carga_atual_pct: a.cargaAtualPct, carga_reforma_pct: a.cargaReformaPct,
      })),
    )
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(regimesRows), 'Regimes')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(output.drillDownPorNcm), 'Por NCM')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(output.drillDownPorParceiro), 'Por Parceiro')
    XLSX.writeFile(wb, `simulacao-${simulation.id}-${simulation.razao_social}.xlsx`)
  }

  return (
    <div className="flex flex-col">

      {/* ── HERO — parallax + animated counter ──────────────────── */}
      <section ref={heroRef} className="relative min-h-[55vh] overflow-hidden px-0 pb-8 pt-2">
        <Parallax
          speed={60}
          className="pointer-events-none absolute left-1/2 top-[-60px] h-[420px] w-[720px] -translate-x-1/2 rounded-full blur-[140px]"
        >
          <div
            className="h-full w-full rounded-full"
            style={{
              background: poupando
                ? 'radial-gradient(circle, rgba(255,180,0,0.2), transparent 70%)'
                : 'radial-gradient(circle, rgba(255,77,77,0.14), transparent 70%)',
            }}
          />
        </Parallax>

        <motion.div style={{ opacity: heroOpacity, y: heroY }} className="relative">
          {/* breadcrumb row */}
          <Reveal y={12}>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium text-primary">Resultado da simulação</p>
                <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
                  {simulation.razao_social}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{setorLabels[simulation.setor]}</Badge>
                  <Badge variant="outline">{simulation.uf}</Badge>
                  <Badge variant="outline">{regimeAtualLabels[simulation.regime_atual]}</Badge>
                  <Badge variant={output.resumo.baseadoEmArquivos ? 'success' : 'warning'}>
                    {output.resumo.baseadoEmArquivos
                      ? `${output.resumo.totalLinhas} linhas importadas`
                      : 'Estimativa simplificada'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RecalculateButton simulationId={simulation.id} />
                <Button
                  onClick={handleExport}
                  className="h-10 gap-2 rounded-xl border border-border bg-secondary/60 px-4 text-sm font-medium text-foreground hover:bg-secondary"
                >
                  <Download className="h-4 w-4" />
                  Exportar XLSX
                </Button>
              </div>
            </div>
          </Reveal>

          {/* big number */}
          <Reveal delay={0.08} y={32} className="mt-10 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {poupando ? 'Economia anual estimada' : 'Aumento estimado de carga'}
            </p>
            <p className="mt-3 text-5xl font-semibold tracking-tight md:text-7xl">
              <span className={poupando ? 'text-gradient-gold' : 'text-destructive'}>
                <AnimatedCounter
                  value={Math.abs(output.resumo.economiaAnual) / 1000}
                  decimals={1}
                  prefix="R$ "
                  suffix=" mil"
                />
              </span>
            </p>
            <p className="mt-2 text-lg text-muted-foreground">
              <AnimatedCounter
                value={Math.abs(output.resumo.economiaPct)}
                decimals={1}
                suffix="% da receita anual"
              />
            </p>
          </Reveal>

          {/* two pill stats */}
          <Reveal delay={0.12} y={16} className="mt-8 flex justify-center gap-3">
            {[
              { label: 'Regime atual', value: regimeAtualLabels[simulation.regime_atual] },
              { label: 'Regime ideal em 2033', value: regimeIdealResult.label },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border bg-card/70 px-5 py-3 text-center backdrop-blur-sm"
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </Reveal>
        </motion.div>
      </section>

      {output.alertas.length > 0 && (
        <Reveal>
          <Alert variant="default" className="mb-6">
            <p className="font-medium">Avisos da importação ({output.alertas.length})</p>
            <ul className="mt-1.5 max-h-28 list-disc space-y-0.5 overflow-y-auto pl-4 text-xs">
              {output.alertas.slice(0, 30).map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </Alert>
        </Reveal>
      )}

      <SectionFade />

      {/* ── CHAPTER 1 — NARRATIVE ───────────────────────────────── */}
      <Chapter number="01" label="O cenário">
        <WordReveal
          text={narrativeText}
          className="text-balance text-xl font-semibold leading-snug tracking-tight text-foreground md:text-2xl"
        />
      </Chapter>

      <SectionFade />

      {/* ── CHAPTER 2 — COMPARAÇÃO DE REGIMES ───────────────────── */}
      <Chapter number="02" label="Comparação de regimes">
        <p className="mb-6 text-sm text-muted-foreground">
          Veja como cada regime se comporta hoje e após a reforma plena em 2033.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {output.regimes.map((regime, i) => (
            <motion.div
              key={regime.regime}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.09, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <RegimeComparisonCard
                regime={regime}
                isIdeal={regime.regime === output.resumo.regimeIdeal}
                isAtual={regime.regime === output.resumo.regimeAtual}
              />
            </motion.div>
          ))}
        </div>
      </Chapter>

      <SectionFade />

      {/* ── CHAPTER 3 — LINHA DO TEMPO (scroll-scrubbed) ─────────── */}
      <Chapter number="03" label="A transição 2026→2033">
        <p className="mb-6 text-sm text-muted-foreground">
          O sistema tributário muda gradualmente ao longo de 8 anos. Role para
          ver a evolução da carga tributária mês a mês.
        </p>
        <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm">
          <ScrollScrubTimeline
            series={
              jaNoIdeal
                ? [{ label: regimeAtualResult.label, color: '#ffb400', anos: regimeAtualResult.anos }]
                : [
                    { label: `Atual: ${regimeAtualResult.label}`, color: '#9ca3af', anos: regimeAtualResult.anos },
                    { label: `Ideal: ${regimeIdealResult.label}`, color: '#ffb400', anos: regimeIdealResult.anos },
                  ]
            }
          />
        </SpotlightCard>
      </Chapter>

      <SectionFade />

      {/* ── CHAPTER 4 — COMPOSIÇÃO DA CARGA (waterfall) ─────────── */}
      <Chapter number="04" label="Composição da carga">
        <p className="mb-6 text-sm text-muted-foreground">
          Como os tributos atuais são substituídos pelo IVA Dual — CBS, IBS e Imposto Seletivo.
        </p>
        <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm">
          <h3 className="mb-5 text-sm font-semibold tracking-tight">
            {regimeAtualResult.label} — hoje vs. 2033
          </h3>
          <WaterfallChart steps={output.waterfall} />
        </SpotlightCard>
      </Chapter>

      <SectionFade />

      {/* ── CHAPTER 5 — ANÁLISE DETALHADA (tabs) ────────────────── */}
      <Chapter number="05" label="Análise detalhada">
        <p className="mb-6 text-sm text-muted-foreground">
          DRE projetada e detalhamento por NCM e parceiro comercial.
        </p>
        <Tabs defaultValue="dre">
          <TabsList>
            <TabsIndicator />
            <TabsTab value="dre">DRE projetada</TabsTab>
            <TabsTab value="ncm">Por NCM</TabsTab>
            <TabsTab value="parceiro">Por parceiro</TabsTab>
          </TabsList>

          <TabsPanel value="dre">
            <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm">
              <DreTable anos={regimeAtualResult.anos} label={regimeAtualResult.label} />
            </SpotlightCard>
          </TabsPanel>

          <TabsPanel value="ncm">
            <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm">
              <h3 className="mb-4 text-sm font-semibold tracking-tight">Por NCM</h3>
              <DrillDownTable
                rows={output.drillDownPorNcm}
                emptyLabel="Nenhum NCM identificado nos arquivos importados."
              />
            </SpotlightCard>
          </TabsPanel>

          <TabsPanel value="parceiro">
            <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm">
              <h3 className="mb-4 text-sm font-semibold tracking-tight">Por cliente / fornecedor</h3>
              <DrillDownTable
                rows={output.drillDownPorParceiro}
                valueLabel="Valor movimentado"
                emptyLabel="Nenhum parceiro identificado nos arquivos importados."
              />
            </SpotlightCard>
          </TabsPanel>
        </Tabs>
      </Chapter>
    </div>
  )
}
