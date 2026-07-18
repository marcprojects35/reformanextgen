'use client'

import { ArrowRight, Check, Gauge, MessageCircle, Sparkles, UserCheck } from 'lucide-react'
import { Reveal } from './reveal'
import { cn } from '@/lib/utils'

// TODO: substituir pelo número real de WhatsApp (formato: DDI+DDD+número, ex: 5511999999999)
const WHATSAPP_NUMBER = '5500000000000'
const WHATSAPP_MESSAGE =
  'Olá! Gostaria de falar com um consultor sobre o modelo analítico da Reforma NextGen.'

const tracks = [
  {
    key: 'diagnostico',
    icon: Gauge,
    badge: 'Sem cadastro',
    name: 'Diagnóstico Gratuito',
    description:
      'Responda 4 perguntas rápidas e receba na hora um resultado simulado sobre o impacto da Reforma Tributária no seu negócio — sem precisar se cadastrar.',
    features: [
      'Sem cadastro para começar, sem enviar arquivos fiscais',
      'Resultado simulado em poucos minutos',
      'Primeira visão do impacto da reforma na sua empresa',
      'Cadastre o CNPJ só no final, se quiser acompanhar na plataforma',
    ],
    cta: 'Fazer diagnóstico gratuito',
    highlight: false,
    href: '/diagnostico',
    external: false,
  },
  {
    key: 'sintetico',
    icon: Sparkles,
    badge: 'Rápido e automático',
    name: 'Modelo Sintético',
    description:
      'Cadastre sua empresa e receba, em poucos minutos, um resultado simulado sobre o impacto da Reforma Tributária no seu negócio.',
    features: [
      'Cadastro 100% online, sem enviar arquivos fiscais',
      'Resultado simulado em poucos minutos',
      'Primeira visão do impacto da reforma na sua empresa',
      'Ideal para uma análise rápida e exploratória',
    ],
    cta: 'Cadastrar minha empresa',
    highlight: false,
    href: '/cadastro',
    external: false,
  },
  {
    key: 'analitico',
    icon: UserCheck,
    badge: 'Acompanhamento dedicado',
    name: 'Modelo Analítico',
    description:
      'Um consultor especialista acompanha a sua empresa para coletar e validar os dados fiscais e entregar uma análise completa e personalizada.',
    features: [
      'Consultor dedicado para a sua empresa',
      'Coleta e validação detalhada dos dados fiscais',
      'Análise completa e personalizada do impacto',
      'Acompanhamento contínuo durante a transição',
    ],
    cta: 'Falar com um consultor',
    highlight: true,
    href: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`,
    external: true,
  },
]

export function EngagementSection() {
  return (
    <section
      id="planos"
      className="relative bg-surface/40 px-4 py-24 md:py-32"
    >
      <div className="divider-fade absolute inset-x-0 top-0" aria-hidden />
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Como Começar
          </span>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            Escolha a forma de avançar com a sua empresa.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
            Um diagnóstico gratuito e imediato, um resultado simulado após o
            cadastro, ou uma análise completa com acompanhamento de um
            consultor especialista.
          </p>
        </Reveal>

        <div className="mt-14 grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track, i) => (
            <Reveal key={track.key} delay={i * 0.1}>
              <div
                className={cn(
                  'relative flex h-full flex-col rounded-3xl border bg-card p-8 transition-transform duration-300 hover:-translate-y-1',
                  track.highlight
                    ? 'border-primary/60 glow-gold'
                    : 'border-border',
                )}
              >
                {track.highlight && (
                  <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Mais completo
                  </span>
                )}

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                  <track.icon className="h-5 w-5" />
                </div>
                <span className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  {track.badge}
                </span>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                  {track.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {track.description}
                </p>

                <ul className="mt-7 flex flex-1 flex-col gap-3">
                  {track.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm text-foreground/90"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                        <Check className="h-3 w-3" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <a
                  href={track.href}
                  target={track.external ? '_blank' : undefined}
                  rel={track.external ? 'noopener noreferrer' : undefined}
                  className={cn(
                    'mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-transform hover:scale-[1.02]',
                    track.highlight
                      ? 'btn-shine bg-primary text-primary-foreground'
                      : 'border border-border bg-secondary/40 text-foreground hover:bg-secondary',
                  )}
                >
                  {track.external && <MessageCircle className="h-4 w-4" />}
                  {track.cta}
                  {!track.external && (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
